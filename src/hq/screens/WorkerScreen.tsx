/**
 * HQ — one employee's workspace.
 *
 * Chat in the middle, work on the right. The split is the whole idea: you talk
 * normally, and when the request is real work a job appears beside the
 * conversation with a plan you can watch tick over. Same reason a person says
 * "right, I'll do these four things" before disappearing for an hour.
 *
 * The stream is only a window. Jobs and images are written server-side as they
 * happen, so reloading mid-job loses nothing — the panel repopulates from the
 * database.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { FileDrop } from '../components/FileDrop';
import type { FileDropHandle } from '../components/FileDrop';
import { Picker } from '../components/Picker';
import type { PickerOption } from '../components/Picker';
import { IconBack, IconClip, IconEdit, IconExpand, IconSend } from '../icons';
import {
  WORKER_MODELS, addLesson, cancelJob, deleteLesson, getConversation, getWorker, listLessons,
  listWorkerFiles, listWorkers, newConversation, reportUrl, sendToWorker, setConversationModels,
  updateLesson, updateWorker,
} from '../services/hqApi';
import type {
  Job, Lesson, MediaItem, Report, Worker, WorkerCapabilities, WorkerConversation, WorkerEvent,
  WorkerFile,
  WorkerMessage,
} from '../types';
import styles from './WorkerScreen.module.css';

/**
 * Bookkeeping the plan already shows. "Updating the plan" six times in a row
 * says nothing the job panel isn't saying better, with its actual steps.
 */
const HIDDEN_FROM_TRACE = new Set(['update_step']);

/** Collapse consecutive repeats, so three of the same read as one line. */
function summarise(names: string[], labels: Record<string, string>): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (HIDDEN_FROM_TRACE.has(name)) continue;
    const label = labels[name] || name;
    const last = out[out.length - 1];
    if (last === label) continue;
    if (last?.startsWith(`${label} ×`)) {
      out[out.length - 1] = `${label} ×${Number(last.split('×')[1]) + 1}`;
    } else if (last === label) {
      out[out.length - 1] = `${label} ×2`;
    } else {
      out.push(label);
    }
  }
  return out;
}

/** What each tool is called in front of a human. */
const TOOL_LABELS: Record<string, string> = {
  search_hq: 'Looking through what HQ knows',
  generate_image: 'Generating an image',
  render_html: 'Rendering exact type',
  start_job: 'Writing a plan',
  update_step: 'Updating the plan',
  finish_job: 'Wrapping up',
  brand_kit: 'Checking the brand kit',
  remember: 'Saving this into HQ',
  publish_report: 'Putting a report together',
  write_copy: 'Finding the words',
};

/** Which model did it, when it wasn't the worker's own brain. */
function labelFor(name: string, worker: Worker | null): string {
  const base = TOOL_LABELS[name] || name;
  if (name !== 'write_copy') return base;
  const voice = (worker?.settings?.phrasingModel as string) || '';
  return voice ? `${base} · ${voice}` : base;
}

/**
 * One picture. Always says which model made it and what it cost — you cannot
 * judge an image, or decide whether the dearer model was worth it, without
 * knowing which one produced it.
 */
function Thumb({ item }: { item: MediaItem }) {
  const cost = Number(item.cost_usd || 0);
  return (
    <a className={styles.thumb} href={item.url || '#'} target="_blank" rel="noopener noreferrer">
      {item.url && <img src={item.url} alt={item.title || ''} loading="lazy" />}
      <span className={styles.thumbTitle} dir="auto">{item.title}</span>
      {(item.model || cost > 0) && (
        <span className={styles.thumbMeta}>
          {item.model && <span className={styles.thumbModel}>{item.model}</span>}
          {cost > 0 && <span className={styles.thumbCost}>${cost.toFixed(2)}</span>}
        </span>
      )}
    </a>
  );
}

/**
 * The three "who does this" decisions, each with the emoji that identifies it.
 * Kept together so the header and the defaults modal cannot drift apart — they
 * render the same list, differing only in scope.
 */
const BRAIN_ICON = '🧠';
const VOICE_ICON = '🖋️';
const IMAGE_ICON = '🎨';

const money = (n: number) => `$${n.toFixed(2)}`;

export function WorkerScreen() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [conversations, setConversations] = useState<WorkerConversation[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<WorkerMessage[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [liveJob, setLiveJob] = useState<Job | null>(null);
  const [openJobId, setOpenJobId] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * What she has done this turn, kept visible in the chat.
   * Without it the conversation goes silent for minutes during a job while all
   * the movement happens in the side rail — which reads as a hang.
   */
  const [trace, setTrace] = useState<string[]>([]);
  /**
   * Which messages have their working shown. Collapsed by default — the
   * finished thread should read as a conversation, with the working available
   * rather than in the way.
   */
  const [openThinking, setOpenThinking] = useState<Set<number>>(new Set());

  // One panel for everything Maya is told: her job description and what she has
  // learned. They shape every answer the same way, so they belong together.
  const [panel, setPanel] = useState<'role' | 'lessons' | null>(null);
  const [draftRole, setDraftRole] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [newLesson, setNewLesson] = useState('');
  const [editingLesson, setEditingLesson] = useState<number | null>(null);
  const [draftLesson, setDraftLesson] = useState('');
  const [caps, setCaps] = useState<WorkerCapabilities | null>(null);
  /**
   * Which model draws the pictures in THIS chat. Per conversation, not per
   * employee: what a picture should look like changes with the brief, and a
   * draft chat and the chat where you build the real campaign want different
   * models. null means she picks per brief.
   */
  const [imageModel, setImageModel] = useState<string | null>(null);
  const [convModel, setConvModel] = useState<string | null>(null);
  const [convPhrasing, setConvPhrasing] = useState<string | null>(null);
  /**
   * What she has been given. Two scopes on purpose: the briefcase is in front
   * of her forever, conversation files only for this chat.
   */
  const [briefcase, setBriefcase] = useState<WorkerFile[]>([]);
  const [convFiles, setConvFiles] = useState<WorkerFile[]>([]);
  /** The composer's paperclip opens the picker directly — no intermediate bar. */
  const convDrop = useRef<FileDropHandle>(null);
  /** Progress belongs on the clip, not as text shoved into the input field. */
  const [attaching, setAttaching] = useState(false);
  /**
   * Files attached but not yet sent. They live ON TOP OF THE INPUT, where you
   * just put them — the rail is easy to miss at the moment you attach.
   *
   * On send they move to the rail: the file is then part of the conversation
   * and stays in context for all of it, so a chip left in the input would imply
   * it is about to be sent again.
   */
  const [pending, setPending] = useState<WorkerFile[]>([]);
  /**
   * A job opened full-size. The rail is 300px wide and the brief is whatever
   * was actually asked for — often several paragraphs — so it is unreadable
   * where it lives. This is the only place you can read it whole.
   */
  const [openJob, setOpenJob] = useState<Job | null>(null);

  const bottom = useRef<HTMLDivElement>(null);

  /**
   * The three option lists. Built from the server's own registries so a model
   * added there shows up here without a client change — and each option carries
   * WHY you would pick it, which is the whole reason this is a menu and not a
   * row of pills.
   */
  const brainOptions: PickerOption[] = useMemo(
    () => WORKER_MODELS.map(m => ({ id: m.id, label: m.label, about: m.about })), []);

  const voiceOptions: PickerOption[] = useMemo(
    () => (caps?.phrasingModels || []).map(m => ({ id: m.id, label: m.label, about: m.about })),
    [caps]);

  const imageOptions: PickerOption[] = useMemo(
    () => (caps?.imageModels || []).map(m => ({
      id: m.id, label: m.label, about: m.about, meta: money(m.approxCost),
    })), [caps]);

  /** Her standing choices, which the header falls back to when nothing is pinned. */
  const workerVoice = (worker?.settings?.phrasingModel as string) || caps?.phrasingModels?.[0]?.id || null;
  const workerImage = (worker?.settings?.imageModel as string) || null;

  /** Everything already handed over — the composer holds the rest. */
  const handedOver = convFiles.filter(f => !pending.some(p => p.id === f.id));

  const labelOf = (options: PickerOption[], id: string | null | undefined) =>
    options.find(o => o.id === id)?.label || null;

  /**
   * The default row names what it resolves to rather than repeating the model
   * name as its title — otherwise "Sonnet 4.6" appears twice in one menu with
   * no way to tell which is which. They differ in a way worth stating: a pin
   * stays put when her default changes.
   */
  const defaultAbout = (options: PickerOption[], id: string | null | undefined) => {
    const name = labelOf(options, id);
    return name
      ? `${name} today — follows her job description if you change it there`
      : 'Follows her job description';
  };

  /** Marks whichever option she currently defaults to, so a pin is a choice. */
  const markDefault = (options: PickerOption[], id: string | null | undefined): PickerOption[] =>
    options.map(o => (o.id === id ? { ...o, meta: [o.meta, 'her default'].filter(Boolean).join(' · ') } : o));

  /**
   * Optimistic: these are settings writes and the control must not lag a click.
   * Only the keys passed are sent, so setting one cannot reset the others.
   */
  const saveConvModels = useCallback(async (patch: {
    model?: string | null; phrasingModel?: string | null; imageModel?: string | null;
  }) => {
    if (!conversationId) return;
    const before = { model: convModel, phrasingModel: convPhrasing, imageModel };
    if ('model' in patch) setConvModel(patch.model ?? null);
    if ('phrasingModel' in patch) setConvPhrasing(patch.phrasingModel ?? null);
    if ('imageModel' in patch) setImageModel(patch.imageModel ?? null);
    try {
      await setConversationModels(slug, conversationId, patch);
    } catch {
      setConvModel(before.model);
      setConvPhrasing(before.phrasingModel);
      setImageModel(before.imageModel);
    }
  }, [slug, conversationId, convModel, convPhrasing, imageModel]);

  const loadConversation = useCallback(async (id: number) => {
    const data = await getConversation(slug, id);
    setMessages(data.messages);
    setJobs(data.jobs);
    setMedia(data.media);
    setReports(data.reports || []);
    setImageModel(data.conversation?.image_model ?? null);
    setConvModel(data.conversation?.model ?? null);
    setConvPhrasing(data.conversation?.phrasing_model ?? null);
    setConvFiles(await listWorkerFiles(slug, id).catch(() => []));
    setPending([]);
    const live = data.jobs.find(j => j.status === 'running') || null;
    setLiveJob(live);

    // Reload mid-job and the thread was silent: `activity` is only set by
    // send(), so returning to a running job looked like a finished one that had
    // simply stopped talking. Recover the line from the job itself.
    if (live) {
      const steps = live.steps || [];
      const step = steps.find(st => st.status === 'running')
        || steps.find(st => st.status === 'pending');
      setActivity(step ? step.title : `${worker?.name || 'She'} is working`);
      // Rebuild what has already happened. Without this a reload showed the
      // current step alone, as though the job had only just begun.
      setTrace(steps.filter(st => st.status === 'done').map(st => st.title));
    } else {
      setActivity(null);
      setTrace([]);
    }
  }, [slug]);

  // What this HQ can do — which picture models exist, whether rendering is
  // available. The header's pickers are built from it, so it loads with the
  // screen rather than on demand.
  useEffect(() => {
    listWorkers().then(r => setCaps(r.capabilities)).catch(() => setCaps(null));
  }, []);

  // Her briefcase belongs to the employee, not to a conversation, so it loads
  // once with the screen.
  useEffect(() => {
    listWorkerFiles(slug).then(setBriefcase).catch(() => setBriefcase([]));
  }, [slug]);

  useEffect(() => {
    getWorker(slug)
      .then(async ({ worker: w, conversations: cs }) => {
        setWorker(w);
        setConversations(cs);
        const first = cs[0] || await newConversation(slug);
        setConversationId(first.id);
        await loadConversation(first.id);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not open this employee'));
  }, [slug, loadConversation]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activity, liveJob]);

  /**
   * Come back to a job that is still going and it keeps updating.
   *
   * The work never depended on this screen — the loop runs server-side and
   * writes as it goes — but without polling you returned to a frozen snapshot
   * and had to reload to see that anything had happened. Only runs when a job
   * is live AND this tab is not the one driving it, so a normal exchange is
   * unaffected.
   */
  useEffect(() => {
    if (busy || liveJob?.status !== 'running' || !conversationId) return;
    const timer = setInterval(() => { void loadConversation(conversationId); }, 2500);
    return () => clearInterval(timer);
  }, [busy, liveJob?.status, conversationId, loadConversation]);

  function note(line: string) {
    setTrace(prev => {
      const last = prev[prev.length - 1];
      if (last === line) return [...prev.slice(0, -1), `${line} ×2`];
      if (last?.startsWith(`${line} ×`)) {
        return [...prev.slice(0, -1), `${line} ×${Number(last.split('×')[1]) + 1}`];
      }
      return [...prev, line];
    });
  }

  function onEvent(e: WorkerEvent) {
    if (e.type === 'tool_start') {
      const label = labelFor(e.tool || '', worker);
      setActivity(label);
      if (!HIDDEN_FROM_TRACE.has(e.tool || '')) note(label);
    }
    if (e.type === 'tool_progress') setActivity(TOOL_LABELS[e.tool || ''] || 'Working');
    if (e.type === 'tool_failed') note(`${TOOL_LABELS[e.tool || ''] || e.tool} — didn't work`);
    if (e.type === 'job_started' && e.job) {
      setLiveJob(e.job);
      setOpenJobId(e.job.id);
      setJobs(prev => [e.job as Job, ...prev]);
      note(`Started a job: ${e.job.title}`);
    }
    if (e.type === 'job_step' && e.steps) {
      const steps = e.steps as Job['steps'];
      setLiveJob(prev => prev ? { ...prev, steps } : prev);
      setJobs(prev => prev.map(j => j.id === e.jobId ? { ...j, steps } : j));
    }
    if (e.type === 'job_finished') {
      setLiveJob(prev => prev ? { ...prev, status: 'done' } : prev);
      setJobs(prev => prev.map(j => j.id === e.jobId ? { ...j, status: 'done' } : j));
      setActivity(null); note('Finished the job');
    }
    if (e.type === 'media' && e.item) setMedia(prev => [e.item as MediaItem, ...prev]);
    if (e.type === 'report' && e.report) {
      setReports(prev => [e.report as Report, ...prev]);
      note(`Published a report: ${e.report.title}`);
    }
    // Every tool has returned and she is working out what to say. Without this
    // the longest silence in an exchange — after the last tool, before the
    // reply — showed nothing at all.
    if (e.type === 'composing') {
      setActivity(e.after === 'finish_job' ? 'Writing the answer' : 'Working out what to say');
    }
    if (e.type === 'text') setActivity(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || !conversationId || busy) return;

    setInput('');
    // Handed over: it now belongs to the conversation rather than to the
    // message you are composing, so it moves out of the composer.
    setPending([]);
    setBusy(true);
    setError(null);
    setTrace([]);
    // Something has to move the instant you press send. Without this the UI is
    // silent until the first tool call, which on a plain answer is the whole
    // wait — and silence reads as broken.
    setActivity(`${worker?.name || 'She'} is thinking`);
    setMessages(prev => [...prev, {
      id: Date.now(), role: 'user', content: text, metadata: {}, created_at: new Date().toISOString(),
    }]);

    try {
      await sendToWorker(slug, conversationId, text, onEvent);
      await loadConversation(conversationId);
      // The first message renames the conversation server-side; without this
      // the rail keeps showing "New conversation" forever.
      getWorker(slug).then(({ conversations: cs }) => setConversations(cs)).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through');
    } finally {
      setBusy(false);
      setActivity(null);
      setTrace([]);
    }
  }

  async function startFresh() {
    const c = await newConversation(slug);
    setConversations(prev => [c, ...prev]);
    setConversationId(c.id);
    setMessages([]); setJobs([]); setMedia([]); setLiveJob(null);
    setImageModel(null); setConvModel(null); setConvPhrasing(null);
  }

  async function saveRole() {
    if (!worker) return;
    setSavingRole(true);
    try {
      setWorker(await updateWorker(slug, { roleDefinition: draftRole }));
      setPanel(null);
    } finally {
      setSavingRole(false);
    }
  }

  function openPanel(which: 'role' | 'lessons') {
    setPanel(which);
    if (worker) setDraftRole(worker.role_definition);
    listLessons(slug).then(setLessons).catch(() => setLessons([]));
  }

  async function toggleLesson(l: Lesson) {
    setLessons(prev => prev.map(x => x.id === l.id ? { ...x, active: !x.active } : x));
    await updateLesson(l.id, { active: !l.active }).catch(() => listLessons(slug).then(setLessons));
  }

  async function saveLesson(id: number) {
    const updated = await updateLesson(id, { lesson: draftLesson });
    setLessons(prev => prev.map(x => x.id === id ? updated : x));
    setEditingLesson(null);
  }

  async function removeLesson(id: number) {
    setLessons(prev => prev.filter(x => x.id !== id));
    await deleteLesson(id).catch(() => listLessons(slug).then(setLessons));
  }

  async function createLesson() {
    const text = newLesson.trim();
    if (!text) return;
    setNewLesson('');
    // Awaited outside the setState callback — a state updater must stay pure.
    const created = await addLesson(slug, text);
    setLessons(prev => [created, ...prev]);
  }

  if (error && !worker) {
    return <div className={styles.screen}><div className={styles.loading}>{error}</div></div>;
  }
  if (!worker) {
    return <div className={styles.screen}><div className={styles.loading}>Loading…</div></div>;
  }

  return (
    <div className={styles.screen} style={{ ['--accent' as string]: worker.accent || 'var(--mag)' }}>
      {/* ── Conversations ─────────────────────────────────────────────────── */}
      <aside className={styles.rail}>
        <button className={styles.back} onClick={() => navigate('../team')}>
          <IconBack /> Team
        </button>

        <div className={styles.person}>
          <span className={styles.avatar}>{worker.avatar || '🙂'}</span>
          <div>
            <div className={styles.name}>{worker.name}</div>
            <div className={styles.role}>{worker.role_title}</div>
          </div>
        </div>

        <button className="hqPill" onClick={startFresh}>New conversation</button>

        <div className={styles.convList}>
          {conversations.map(c => (
            <button
              key={c.id}
              className={`${styles.conv} ${c.id === conversationId ? styles.convOn : ''}`}
              onClick={() => { setConversationId(c.id); loadConversation(c.id); }}
            >
              <span className={styles.convTitle} dir="auto">{c.title}</span>
              {!!c.media_count && <span className={styles.convCount}>{c.media_count} 🖼</span>}
            </button>
          ))}
        </div>

        <button className={styles.roleLink} onClick={() => openPanel('role')}>
          <IconEdit /> How {worker.name} works
        </button>
      </aside>

      {/* ── Conversation ──────────────────────────────────────────────────── */}
      <div className={styles.main}>
        {/* Fixed header so you always know which conversation you're in and
            which brain is answering — and can change it without leaving. */}
        <div className={styles.convHead}>
          {/* All three of the same decision in one row, left of the title: who
              thinks, who writes, who draws. These are THIS CONVERSATION only —
              her standing defaults live in "How she works". A picker showing
              her default is outlined; an override is tinted, so you can see at
              a glance that this chat is not behaving like the others. */}
          <div className={styles.pickers}>
            <Picker
              icon={BRAIN_ICON}
              title="Thinks with"
              options={markDefault(brainOptions, worker.model)}
              value={convModel}
              fallback={{
                label: 'Her default',
                about: defaultAbout(brainOptions, worker.model),
              }}
              onChange={id => saveConvModels({ model: id })}
              disabled={busy}
            />

            {!!caps?.phrasingModels?.length && (
              <Picker
                icon={VOICE_ICON}
                title="Writes with"
                options={markDefault(voiceOptions, workerVoice)}
                value={convPhrasing}
                fallback={{
                  label: 'Her default',
                  about: defaultAbout(voiceOptions, workerVoice),
                }}
                onChange={id => saveConvModels({ phrasingModel: id })}
                disabled={busy}
              />
            )}

            {caps?.images && !!caps.imageModels?.length && (
              <Picker
                icon={IMAGE_ICON}
                title="Draws with"
                options={markDefault(imageOptions, workerImage)}
                value={imageModel}
                fallback={{
                  label: 'Her default',
                  about: workerImage
                    ? defaultAbout(imageOptions, workerImage)
                    : 'She picks per brief — cheap to explore, dearer for a final',
                }}
                onChange={id => saveConvModels({ imageModel: id })}
                disabled={busy}
              />
            )}
          </div>

          <div className={styles.convHeadTitle} dir="auto">
            {conversations.find(c => c.id === conversationId)?.title || 'New conversation'}
          </div>
        </div>

        <div className={styles.thread}>
          {messages.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyAvatar}>{worker.avatar}</span>
              <div className={styles.emptyTitle}>{worker.tagline}</div>
              <div className={styles.emptyHint}>
                Ask a question and you get an answer. Ask for real work and {worker.name} writes a
                plan you can watch.
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            // Tool names are stored on every assistant message, so the working
            // is recoverable for the whole history, not just the live turn.
            const steps = summarise(
              (m.metadata?.toolCalls || []).map(c => c.name),
              Object.fromEntries(Object.keys(TOOL_LABELS).map(k => [k, labelFor(k, worker)])),
            );
            const showing = openThinking.has(m.id);

            // An assistant turn followed by another assistant turn is her
            // narrating mid-work ("right, I have what I need"), not answering
            // you. Shown as a quiet aside so the actual reply stands out.
            const aside = m.role === 'assistant'
              && messages[i + 1]?.role === 'assistant';

            return (
              <div key={m.id} className={styles.turn}>
                {/* Above the answer, because that is the order it happened in. */}
                {m.role === 'assistant' && steps.length > 0 && (
                  <div className={styles.thinking}>
                    <button
                      className={styles.thinkingToggle}
                      onClick={() => setOpenThinking(prev => {
                        const next = new Set(prev);
                        if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                        return next;
                      })}
                    >
                      <span className={`${styles.thinkChev} ${showing ? styles.thinkChevOpen : ''}`}>▸</span>
                      {showing
                        ? 'Hide working'
                        : `Worked through ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}
                    </button>
                    {showing && (
                      <div className={styles.thinkingBody}>
                        {steps.map((line, n) => (
                          <div key={n} className={styles.traceLine}>
                            <span className={styles.traceMark}>✓</span> {line}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : ''}`}>
                  {m.role === 'assistant' && <span className={styles.msgAvatar}>{aside ? '·' : worker.avatar}</span>}
                  <div className={`${styles.bubble} ${aside ? styles.aside : ''}`} dir="auto">
                    {m.role === 'assistant'
                      ? <div className="hqProse"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                      : m.content}
                  </div>
                </div>
              </div>
            );
          })}

          {(activity || trace.length > 0) && (
            <div className={`${styles.thinking} ${styles.thinkingLive}`}>
              <div className={styles.thinkingBody}>
                {trace.filter(line => line !== activity).map((line, i) => (
                  <div key={i} className={styles.traceLine}>
                    <span className={styles.traceMark}>✓</span> {line}
                  </div>
                ))}
                {activity && (
                  <div className={styles.traceLive}>
                    <span className="hqDots"><i /><i /><i /></span>
                    {activity}
                    {liveJob && liveJob.status === 'running' && (
                      <span className={styles.traceJob}>
                        · {(liveJob.steps || []).filter(st => st.status === 'done').length}
                        /{(liveJob.steps || []).length} of “{liveJob.title}”
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <div className={styles.errorBox}>{error}</div>}
          <div ref={bottom} />
        </div>

        <div className={styles.composer}>
          {/* Attached to THIS conversation and in context for all of it — the
              brief for this campaign, not a standing rule. The chips sit inside
              the composer because they are part of what you are sending, not a
              panel above it. */}
          <div className={styles.composerBody}>
            <FileDrop
              ref={convDrop}
              slug={slug}
              caps={caps}
              files={pending}
              onChange={next => {
                setPending(next);
                // The rail is the full list either way; it just hides whatever
                // is still sitting in the composer.
                setConvFiles(prev => {
                  const ids = new Set(next.map(f => f.id));
                  const kept = prev.filter(p => ids.has(p.id) || !pending.some(q => q.id === p.id));
                  return [...kept.filter(k => !ids.has(k.id)), ...next];
                });
              }}
              conversationId={conversationId}
              compact
              onBusyChange={setAttaching}
            />
            <div className={styles.composerRow}>
              <button
                className={styles.clip}
                onClick={() => convDrop.current?.pick()}
                disabled={attaching}
                title={`Attach a file to this conversation — ${(caps?.fileTypes || []).join(', ')}`}
              >
                {attaching ? <span className={styles.clipSpin} /> : <IconClip />}
              </button>
              <textarea
                className={styles.input}
                value={input}
                dir="auto"
                rows={1}
                placeholder={`Ask ${worker.name} for something…`}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
              />
              <button className={styles.send} onClick={send} disabled={busy || !input.trim()}>
                <IconSend />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Work ──────────────────────────────────────────────────────────── */}
      <aside className={styles.work}>
        <div className={styles.workHead}><span className="hqEyebrow">Work</span></div>

        {jobs.length === 0 && media.length === 0 && (
          <div className={styles.workEmpty}>
            Nothing yet. Ask for something that takes real steps and the plan appears here.
          </div>
        )}

        {/* One list of jobs, each carrying everything it produced. Images and
            reports used to sit in separate sections, which lost the answer to
            "what came out of THAT piece of work". */}
        {jobs.map(job => {
          const isOpen = openJobId === job.id || (openJobId === null && job.id === jobs[0].id);
          const steps = job.steps || [];
          const done = steps.filter(st => st.status === 'done').length;
          /**
           * The step she is actually on.
           *
           * A step only becomes 'running' when update_step fires, so between
           * ticks nothing is marked running and the card looked idle. The first
           * pending step is the live one in that gap. Derived once so the
           * collapsed line and the expanded list can never disagree.
           */
          const liveStep = job.status === 'running'
            ? (steps.find(st => st.status === 'running') || steps.find(st => st.status === 'pending'))
            : null;
          const jobMedia = media.filter(m => m.job_id === job.id);
          const jobReports = reports.filter(r => r.job_id === job.id);
          const images = Number(job.cost_usd || 0);
          const thinking = Number(job.llm_cost_usd || 0);
          const voice = Number(job.phrasing_cost_usd || 0);

          return (
            <div key={job.id} className={`${styles.job} ${job.status === 'running' ? styles.jobLive : ''}`}>
              <button className={styles.jobTop} onClick={() => setOpenJobId(isOpen ? -1 : job.id)}>
                <span className={`${styles.jobState} ${
                  job.status === 'running' ? styles.stateRunning :
                  job.status === 'waiting' ? styles.stateWaiting :
                  job.status === 'done' ? styles.stateDone : styles.stateOther}`}
                >
                  {job.status === 'running' ? 'working'
                    : job.status === 'waiting' ? 'needs you'
                    : job.status}
                </span>
                <span className={styles.jobTitle} dir="auto">{job.title}</span>
                <span
                  className={styles.jobExpand}
                  title="Read the whole brief"
                  onClick={e => { e.stopPropagation(); setOpenJob(job); }}
                >
                  <IconExpand />
                </span>
                <span className={styles.jobCount}>{done}/{steps.length}</span>
                <span className={`${styles.navChevron} ${isOpen ? styles.chevOpen : ''}`}>▾</span>
              </button>

              {/* Which step, and what she is doing within it.
                  The step is the answer to "what is it working on"; the phase
                  ("working out what to say") is a detail of that step, not a
                  replacement for it — showing the phase alone told you she was
                  busy without telling you at what.

                  A step only turns 'running' when update_step fires, so between
                  ticks the first pending step is the live one. Treating it as
                  such is what stops the card looking idle mid-job. */}
              {job.status === 'running' && !isOpen && liveStep && (
                <div className={styles.jobNow}>
                  <span className={styles.jobNowMark}><span className="hqDots"><i /><i /><i /></span></span>
                  <span className={styles.jobNowText} dir="auto">
                    {liveStep.title}
                    {activity && activity !== liveStep.title && (
                      <span className={styles.jobNowPhase}>{activity}</span>
                    )}
                  </span>
                </div>
              )}

              {isOpen && (
                <>
                  <ol className={styles.steps}>
                    {steps.map(st => (
                      <li key={st.n} className={`${styles.step} ${styles['step_' + st.status] || ''}`}>
                        <span className={styles.stepMark}>
                          {st.status === 'done' ? '✓'
                            : st.status === 'failed' ? '✕'
                            : liveStep && st.n === liveStep.n
                              ? <span className="hqDots"><i /><i /><i /></span>
                            : <span className={styles.stepDot} />}
                        </span>
                        <span className={styles.stepText} dir="auto">
                          {st.title}
                          {st.detail && <span className={styles.stepDetail}>{st.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {jobReports.length > 0 && (
                    <div className={styles.jobSection}>
                      <span className="hqEyebrow">
                        {jobReports.length === 1 ? 'Report' : `Reports · ${jobReports.length}`}
                      </span>
                    </div>
                  )}
                  {jobReports.map(r => (
                    <a
                      key={r.id}
                      className={styles.report}
                      href={reportUrl(r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={styles.reportIcon}>📄</span>
                      <span className={styles.reportBody}>
                        <span className={styles.reportTitle} dir="auto">{r.title}</span>
                        {r.summary && <span className={styles.reportSummary} dir="auto">{r.summary}</span>}
                      </span>
                      <span className={styles.reportOpen}>open ↗</span>
                    </a>
                  ))}

                  {jobMedia.length > 0 && (
                    <div className={styles.jobSection}>
                      <span className="hqEyebrow">
                        {jobMedia.length === 1 ? 'Made here' : `Made here · ${jobMedia.length}`}
                      </span>
                    </div>
                  )}
                  {jobMedia.length > 0 && (
                    <div className={styles.gallery}>
                      {jobMedia.map(m => (
                        <Thumb key={m.id} item={m} />
                      ))}
                    </div>
                  )}

                  {/* Both halves of the cost, because images alone understate it. */}
                  <div className={styles.jobFoot}>
                    {/* Three kinds of money, three providers. Rolled into one
                        number they are unauditable. */}
                    {(images > 0 || thinking > 0 || voice > 0) && (
                      <span
                        title={`Leonardo $${images.toFixed(4)} · Claude $${thinking.toFixed(4)} · voice model $${voice.toFixed(4)}`}
                      >
                        ${(images + thinking + voice).toFixed(2)}
                        <span className={styles.costSplit}>
                          {' '}({images.toFixed(2)} img · {thinking.toFixed(2)} think
                          {voice > 0 && ` · ${voice.toFixed(2)} voice`})
                        </span>
                      </span>
                    )}
                    {job.status === 'running' && (
                      <button className={styles.stop} onClick={() => cancelJob(job.id)}>Stop</button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* What this conversation was GIVEN, as against what she made. Sits in
            the rail because that is where a conversation's belongings are —
            and because a chip left in the composer reads as unsent. */}
        {handedOver.length > 0 && (
          <>
            <div className={styles.workHead}>
              <span className="hqEyebrow">
                {handedOver.length === 1 ? 'Attached here' : `Attached here · ${handedOver.length}`}
              </span>
            </div>
            <div className={styles.attached}>
              <FileDrop
                slug={slug}
                caps={caps}
                files={handedOver}
                onChange={next => setConvFiles([...pending, ...next])}
                conversationId={conversationId}
                compact
              />
            </div>
          </>
        )}

        {/* Anything made outside a job still has to be reachable. */}
        {media.some(m => !m.job_id) && (
          <>
            <div className={styles.workHead}><span className="hqEyebrow">Made in the chat</span></div>
            <div className={styles.gallery}>
              {media.filter(m => !m.job_id).map(m => (
                <Thumb key={m.id} item={m} />
              ))}
            </div>
          </>
        )}
      </aside>

      {/* The brief at a readable width. Everything in the rail is compressed to
          300px; this is where you actually read what was asked and what she
          planned in response. */}
      {openJob && (
        <div className={styles.modalWrap} onClick={() => setOpenJob(null)}>
          <div className={`${styles.modal} ${styles.jobModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.jobModalHead}>
              <span className={`${styles.jobState} ${
                openJob.status === 'running' ? styles.stateRunning :
                openJob.status === 'waiting' ? styles.stateWaiting :
                openJob.status === 'done' ? styles.stateDone : styles.stateOther}`}
              >
                {openJob.status === 'running' ? 'working'
                  : openJob.status === 'waiting' ? 'needs you'
                  : openJob.status}
              </span>
              <span className={styles.jobModalTitle} dir="auto">{openJob.title}</span>
            </div>

            <div className={styles.jobModalBody}>
              {openJob.brief && (
                <section className={styles.jobSection}>
                  <span className="hqEyebrow">What was asked</span>
                  <p className={styles.jobBrief} dir="auto">{openJob.brief}</p>
                </section>
              )}

              <section className={styles.jobSection}>
                <span className="hqEyebrow">Her plan</span>
                <ol className={styles.jobPlan}>
                  {(openJob.steps || []).map(step => (
                    <li key={step.n} className={`${styles.jobPlanStep} ${styles[`step_${step.status}`] || ''}`}>
                      <span className={styles.stepMark}>
                        {step.status === 'running'
                          ? <span className="hqDots"><i /><i /><i /></span>
                          : step.status === 'done' ? '✓' : step.status === 'failed' ? '✕' : '○'}
                      </span>
                      <span className={styles.jobPlanText} dir="auto">
                        <span className={styles.jobPlanTitle}>{step.title}</span>
                        {step.detail && <span className={styles.jobPlanDetail}>{step.detail}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <div className={styles.modalActions}>
              <button className="hqGhostPill" onClick={() => setOpenJob(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Everything she is told ────────────────────────────────────────── */}
      {panel && (
        <div className={styles.modalWrap} onClick={() => !savingRole && setPanel(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>How {worker.name} works</div>

            {/* Two halves of the same thing: what she was told to be, and what
                she has worked out since. Both go into her prompt verbatim. */}
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${panel === 'role' ? styles.tabOn : ''}`}
                onClick={() => setPanel('role')}
              >
                Job description
              </button>
              <button
                className={`${styles.tab} ${panel === 'lessons' ? styles.tabOn : ''}`}
                onClick={() => setPanel('lessons')}
              >
                What she has learned
                {lessons.length > 0 && <span className={styles.tabCount}>{lessons.filter(l => l.active).length}</span>}
              </button>
            </div>

            {panel === 'role' && (
              <>
                <p className={styles.modalHint}>
                  Exactly what {worker.name} is told before every conversation. Change it and the
                  next message uses the new version — no deploy, no code.
                </p>
                <textarea
                  className={styles.roleEditor}
                  value={draftRole}
                  onChange={e => setDraftRole(e.target.value)}
                  spellCheck={false}
                />
                {/* Her standing choices. Three different jobs, so three
                    different models: thinking picks what to say, voice says it
                    (where Hebrew that reads translated comes from), and pictures
                    are a different provider entirely. A conversation can
                    override any of them without touching these. */}
                {/* What she carries into every conversation. Sits under the job
                    description because it is the same thing in a different
                    form: the text says how she works, these say what to. */}
                <div className={styles.defaults}>
                  <span className="hqEyebrow">Her briefcase — read on every message</span>
                  <p className={styles.defaultsHint}>
                    Brand guidelines, tone of voice, an example of what good looks like. Unlike the
                    HQ library she does not have to go looking for these — they are in front of her
                    every time, and she is told to check her work against them.
                  </p>
                  <FileDrop
                    slug={slug}
                    caps={caps}
                    files={briefcase}
                    onChange={setBriefcase}
                  />
                </div>

                <div className={styles.defaults}>
                  <span className="hqEyebrow">Who does what, by default</span>
                  <div className={styles.defaultsRow}>
                    <Picker
                      icon={BRAIN_ICON}
                      title="Thinks with"
                      options={brainOptions}
                      value={worker.model}
                      onChange={async id => id && setWorker(await updateWorker(slug, { model: id }))}
                    />
                    {!!caps?.phrasingModels?.length && (
                      <Picker
                        icon={VOICE_ICON}
                        title="Writes with"
                        options={voiceOptions}
                        value={workerVoice}
                        onChange={async id => id && setWorker(await updateWorker(slug, { phrasingModel: id }))}
                      />
                    )}
                    {caps?.images && !!caps.imageModels?.length && (
                      <Picker
                        icon={IMAGE_ICON}
                        title="Draws with"
                        options={imageOptions}
                        value={workerImage}
                        fallback={{
                          label: 'She chooses',
                          about: 'Reads the brief and picks — cheap to explore, dearer for a final',
                        }}
                        onChange={async id => setWorker(await updateWorker(slug, { imageModel: id }))}
                      />
                    )}
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button className="hqMini" onClick={() => setPanel(null)} disabled={savingRole}>Cancel</button>
                  <button className="hqPill" onClick={saveRole} disabled={savingRole}>
                    {savingRole ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}

            {panel === 'lessons' && (
              <>
                <p className={styles.modalHint}>
                  Craft notes {worker.name} keeps — added by her as she works, or by you. Active
                  ones are part of her instructions in every conversation. Switch one off if it
                  turns out to be wrong.
                </p>

                <div className={styles.addLesson}>
                  <textarea
                    className={styles.lessonInput}
                    value={newLesson}
                    dir="auto"
                    rows={2}
                    placeholder="Something she should know next time…"
                    onChange={e => setNewLesson(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) createLesson(); }}
                  />
                  <button className="hqPill" onClick={createLesson} disabled={!newLesson.trim()}>Add</button>
                </div>

                <div className={styles.lessonList}>
                  {lessons.length === 0 && (
                    <div className={styles.lessonEmpty}>
                      Nothing yet. She writes these herself when she works something out — or add
                      one above.
                    </div>
                  )}

                  {lessons.map(l => (
                    <div key={l.id} className={`${styles.lesson} ${l.active ? '' : styles.lessonOff}`}>
                      {/* One tap to switch off, because "this is wrong" is the
                          most common thing you will want to do to a lesson. */}
                      <button
                        className={`${styles.lessonToggle} ${l.active ? styles.lessonToggleOn : ''}`}
                        onClick={() => toggleLesson(l)}
                        title={l.active ? 'In use — click to switch off' : 'Off — click to switch on'}
                      >
                        <span className={styles.lessonKnob} />
                      </button>

                      <div className={styles.lessonBody}>
                        {editingLesson === l.id ? (
                          <>
                            <textarea
                              className={styles.lessonInput}
                              value={draftLesson}
                              dir="auto"
                              rows={3}
                              onChange={e => setDraftLesson(e.target.value)}
                              autoFocus
                            />
                            <div className={styles.lessonActions}>
                              <button className="hqMini" onClick={() => setEditingLesson(null)}>Cancel</button>
                              <button className="hqMini" onClick={() => saveLesson(l.id)}>Save</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className={styles.lessonText} dir="auto">{l.lesson}</div>
                            <div className={styles.lessonMeta}>
                              {l.learned_from || 'Added by hand'}
                              <button
                                className={styles.lessonLink}
                                onClick={() => { setEditingLesson(l.id); setDraftLesson(l.lesson); }}
                              >
                                edit
                              </button>
                              <button
                                className={`${styles.lessonLink} ${styles.lessonRemove}`}
                                onClick={() => removeLesson(l.id)}
                              >
                                remove
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.modalActions}>
                  <button className="hqMini" onClick={() => setPanel(null)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
