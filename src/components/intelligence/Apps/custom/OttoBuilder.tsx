/**
 * Otto's builder — the three-panel page of mockups M2–M4, inside the
 * Intelligence shell (bilingual, branded, RTL-safe).
 *
 *   rail    Otto's chat: step strip (Chat/Plan/Approve/Build), transcript,
 *           the structured plan card, the composer.
 *   status  what Otto is doing now + the timed checklist + the Orb figure.
 *   canvas  the screen: empty state with starters, live build stages, and
 *           after a build the REAL rendered screen (no iframe — the same
 *           renderer the published page uses).
 *
 * The loop never changes: talk → plan → approve → build → keep talking,
 * and after the first build every plan is a change plan (v1's core idea,
 * kept). The build itself is a SERVER job — this page polls it, and
 * registers a task with the shell's job system so the header pill follows
 * the same progress (M4's "BUILDING SCREEN 24%").
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './OttoBuilder.module.css';
import { ottoService } from '../../../../services/ottoService';
import { ScreenRenderer } from './ScreenRenderer';
import { ScreenIcon } from './ScreenIcon';
import { OttoFigure, type OttoFigureState } from './OttoFigure';
import { useLanguage } from '../../../../context/LanguageContext';
import { useUserContext } from '../../../../context/UserContext';
import { useJobs } from '../../jobs/JobsContext';
import type {
  BuildProgress, OttoMessage, OttoPlan, OttoScreen, OttoStarter, ScreenDataPayload,
} from '../../../../types/otto';
import type { Localized } from '../../../../types/apps';

interface Props {
  datasetId: string;
  /** null on /apps/new — the draft is created on the first message. */
  screenId: string | null;
  baseURL?: string;
  /** Replace the URL once the draft exists, so a reload reopens it. */
  onDraftCreated: (id: string) => void;
  /** After publish — the shelf redirects to the app's own page. */
  onPublished: (id: string) => void;
  onExit: () => void;
}

type Phase = 'talk' | 'plan' | 'building';
interface StepDone { key: string; seconds: number }

const POLL_MS = 1400;

export function OttoBuilder({ datasetId, screenId, baseURL, onDraftCreated, onPublished, onExit }: Props) {
  const { t, language } = useLanguage();
  const { userId } = useUserContext();
  const { startTask } = useJobs();
  const lang = language === 'he' ? 'he' : 'en';

  const [screen, setScreen] = useState<OttoScreen | null>(null);
  const [starters, setStarters] = useState<OttoStarter[]>([]);
  const [messages, setMessages] = useState<OttoMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<Phase>('talk');
  const [thinking, setThinking] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [readyToPlan, setReadyToPlan] = useState(false);
  const [plan, setPlan] = useState<OttoPlan | null>(null);
  const [preview, setPreview] = useState<ScreenDataPayload | null>(null);
  const [build, setBuild] = useState<BuildProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<Localized | null>(null);
  const [steps, setSteps] = useState<StepDone[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmOpen, setConfirmOpen] = useState<'publish' | 'delete' | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [statusOpen, setStatusOpen] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const loadedFor = useRef<string | null>(null);
  const stepStart = useRef<number>(Date.now());

  const markStep = useCallback((key: string) => {
    const seconds = Math.max(1, Math.round((Date.now() - stepStart.current) / 1000));
    stepStart.current = Date.now();
    setSteps(s => [...s.slice(-5), { key, seconds }]);
  }, []);

  // ── load: starters always; the draft when reopening one ──
  useEffect(() => {
    const key = `${datasetId}/${screenId ?? 'new'}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;

    // The prop flips null → id when THIS instance just created the draft
    // (the router keeps us mounted). We already hold the live state —
    // reloading here would read the not-yet-persisted conversation back as
    // empty and visually "reload the page" mid-reply (first live-test bug).
    if (screenId && screen?.id === screenId) return;

    ottoService.listScreens(datasetId, baseURL)
      .then(r => setStarters(r.starters))
      .catch(() => {});

    if (!screenId) return;
    ottoService.getScreen(datasetId, screenId, baseURL)
      .then(s => {
        setScreen(s);
        setMessages(s.conversation || []);
        if (s.plan && (s.plan as OttoPlan).title) setPlan(s.plan as OttoPlan);
        if (s.screenSpec) {
          ottoService.getData(datasetId, screenId, baseURL)
            .then(setPreview)
            .catch(() => setError(t('otto.error.dataFailed')));
        }
        // Re-attach to a build that survived a reload.
        ottoService.latestBuild(datasetId, screenId, baseURL)
          .then(b => { if (b?.status === 'running') { setPhase('building'); void watchBuild(s); } })
          .catch(() => {});
      })
      .catch(() => setError(t('otto.error.loadFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, screenId, baseURL]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, plan, phase]);

  // ── the loop ──
  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || thinking || phase === 'building') return;

    setDraft('');
    setThinking(true);
    setError(null);
    setPhase('talk');
    const next: OttoMessage[] = [...messages, { role: 'user', content: clean }];
    setMessages(next);

    try {
      let current = screen;
      if (!current) {
        // The draft exists from the FIRST exchange (owner flow D4) — it
        // appears on the shelf and a closed tab loses nothing.
        current = await ottoService.createScreen(datasetId, userId, baseURL);
        setScreen(current);
        onDraftCreated(current.id);
      }
      const r = await ottoService.chat(datasetId, current.id, next, lang, baseURL);
      setMessages([...next, { role: 'assistant', content: r.reply }]);
      setReadyToPlan(r.readyToPlan);
      setStatusLine(r.state?.en ? r.state : null);
      markStep('understood');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('otto.error.chatFailed'));
      setMessages(next); // the user's message stays; retry is one click
    } finally {
      setThinking(false);
    }
  }, [messages, thinking, phase, screen, datasetId, userId, baseURL, lang, onDraftCreated, markStep, t]);

  const preparePlan = useCallback(async () => {
    if (!screen || thinking) return;
    setPlanning(true);
    setThinking(true);
    setError(null);
    try {
      const p = await ottoService.draftPlan(datasetId, screen.id, messages, baseURL);
      setPlan(p);
      setPhase('plan');
      markStep('planDrafted');
      // The plan names the draft — refresh our copy so the canvas title follows.
      setScreen(s => (s ? { ...s, title: p.title, summary: p.summary, icon: p.icon || s.icon } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('otto.error.planFailed'));
    } finally {
      setThinking(false);
      setPlanning(false);
    }
  }, [screen, thinking, datasetId, messages, baseURL, markStep, t]);

  const watchBuild = useCallback(async (forScreen: OttoScreen) => {
    // The polling loop runs inside a shell TASK so the header pill shows
    // the same numbers (M4) — one progress, two places, no drift.
    await new Promise<void>(resolve => {
      startTask(datasetId, t('otto.pill.label'), async (report) => {
        for (;;) {
          await new Promise(r => setTimeout(r, POLL_MS));
          let b: BuildProgress | null = null;
          try {
            b = await ottoService.latestBuild(datasetId, forScreen.id, baseURL);
          } catch { continue; }
          if (!b) continue;
          setBuild(b);
          report(b.percent, t(`otto.stage.${b.stage}`) || b.stage);
          if (b.status !== 'running') {
            resolve();
            if (b.status === 'failed') throw new Error(b.report?.reason || 'build failed');
            return;
          }
        }
      });
    });
  }, [datasetId, baseURL, startTask, t]);

  const approveAndBuild = useCallback(async () => {
    if (!screen || !plan) return;
    setPhase('building');
    setError(null);
    setBuild(null);
    markStep('approved');
    try {
      const started = await ottoService.startBuild(datasetId, screen.id, baseURL);
      if (!('buildId' in started)) throw new Error('build not started');
      await watchBuild(screen);
      const final = await ottoService.latestBuild(datasetId, screen.id, baseURL);
      setBuild(final);
      if (final?.status === 'succeeded') {
        const [s, d] = await Promise.all([
          ottoService.getScreen(datasetId, screen.id, baseURL),
          ottoService.getData(datasetId, screen.id, baseURL),
        ]);
        setScreen(s);
        setPreview(d);
        setPhase('talk');
        setReadyToPlan(false);
        markStep('built');
        setMessages(m => [...m, { role: 'assistant', content: t('otto.msg.built') }]);
      } else {
        setPhase('talk');
        setError(final?.report?.reason || t('otto.error.buildFailed'));
      }
    } catch (err) {
      setPhase('talk');
      setError(err instanceof Error ? err.message : t('otto.error.buildFailed'));
    }
  }, [screen, plan, datasetId, baseURL, watchBuild, markStep, t]);

  const doPublish = useCallback(async () => {
    if (!screen) return;
    setConfirmOpen(null);
    try {
      await ottoService.publish(datasetId, screen.id, baseURL);
      onPublished(screen.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('otto.error.publishFailed'));
    }
  }, [screen, datasetId, baseURL, onPublished, t]);

  const doDelete = useCallback(async () => {
    if (!screen) return;
    setConfirmOpen(null);
    try {
      await ottoService.deleteDraft(datasetId, screen.id, baseURL);
      onExit();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('otto.error.deleteFailed'));
    }
  }, [screen, datasetId, baseURL, onExit, t]);

  const saveRename = useCallback(async () => {
    const value = renameValue.trim();
    setRenaming(false);
    if (!screen || !value) return;
    const title: Localized = { ...screen.title, [lang]: value } as Localized;
    try {
      const s = await ottoService.rename(datasetId, screen.id, title, undefined, baseURL);
      setScreen(s);
    } catch { /* the old name stands; nothing was promised */ }
  }, [renameValue, screen, datasetId, lang, baseURL]);

  // ── derived ──
  const title = screen ? (screen.title[lang] || screen.title.en) : t('otto.newScreen');
  const built = Boolean(screen?.screenSpec && preview);
  const statusBadge = phase === 'building' ? 'building' : built ? 'ready' : 'draft';

  const figure: OttoFigureState =
    phase === 'building' ? 'build'
      : thinking || planning ? 'think'
        : error ? 'error'
          : built && steps[steps.length - 1]?.key === 'built' ? 'done'
            : 'idle';

  const stepStates = useMemo(() => {
    const done = new Set(steps.map(s => s.key));
    return [
      { key: 'chat', label: t('otto.step.chat'), done: done.has('understood') || Boolean(plan), now: thinking && !planning },
      { key: 'plan', label: t('otto.step.plan'), done: Boolean(plan), now: planning },
      { key: 'approve', label: t('otto.step.approve'), done: done.has('approved') || built, now: phase === 'plan' },
      { key: 'build', label: t('otto.step.build'), done: built, now: phase === 'building' },
    ];
  }, [steps, plan, thinking, planning, phase, built, t]);

  const statusNow =
    phase === 'building' ? t(`otto.stage.${build?.stage || 'reading_plan'}`)
      : thinking ? t('otto.status.thinking')
        : phase === 'plan' ? t('otto.status.awaitApproval')
          : built ? t('otto.status.readyForReview')
            : readyToPlan ? t('otto.status.readyToPlan')
              : t('otto.status.listening');

  const loc = (l: Localized) => l[lang] || l.en;

  return (
    <div className={styles.page}>
      {/* ── rail: the conversation ── */}
      <aside className={`${styles.rail} ${railOpen ? '' : styles.railClosed}`}>
        <div className={styles.railHead}>
          <div className={styles.railWho}>
            <span className={styles.railAvatar}><OttoFigureMini /></span>
            <div>
              <p className={styles.railName}>OTTO</p>
              <p className={styles.railRole}>{t('otto.role')}</p>
            </div>
            <button type="button" className={styles.collapse} onClick={() => setRailOpen(false)} aria-label={t('otto.collapse')}>«</button>
          </div>
          <div className={styles.stepsRow}>
            {stepStates.map(s => (
              <span key={s.key} className={`${styles.step} ${s.done ? styles.stepDone : ''} ${s.now ? styles.stepNow : ''}`}>
                <span className={styles.stepDot} aria-hidden="true">{s.done ? '✓' : ''}</span>
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className={styles.messages} ref={scrollRef}>
          {messages.length === 0 && (
            <div className={`${styles.msg} ${styles.msgBot}`}>
              {t('otto.opening')}
              <div className={styles.chips}>
                {starters.map((s, i) => (
                  <button key={i} type="button" className={styles.chip}
                    onClick={() => { setDraft(loc(s.text)); inputRef.current?.focus(); }}>
                    {loc(s.text)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}>
              {m.content}
            </div>
          ))}
          {thinking && !planning && <div className={styles.typing}>{t('otto.typing')}</div>}

          {plan && phase === 'plan' && (
            <div className={styles.planCard}>
              <p className={styles.planKicker}>{t('otto.plan.kicker')}</p>
              <p className={styles.planTitle}>{loc(plan.title)}</p>
              <p className={styles.planSummary}>{loc(plan.summary)}</p>

              {plan.isChange && plan.changes.length > 0 && (
                <PlanRow label={t('otto.plan.changes')} chips={plan.changes.map(loc)} accent />
              )}
              <PlanRow label={t('otto.plan.sources')} chips={plan.sources.map(s => loc(s.label))} />
              {plan.filters.length > 0 && <PlanRow label={t('otto.plan.filters')} chips={plan.filters.map(f => loc(f.label))} />}
              <PlanRow label={t('otto.plan.columns')} chips={plan.columns.map(c => loc(c.label))} />
              {plan.kpis.length > 0 && <PlanRow label={t('otto.plan.kpis')} chips={plan.kpis.map(k => loc(k.label))} />}
              {plan.actions.length > 0 && <PlanRow label={t('otto.plan.actions')} chips={plan.actions.map(a => loc(a.label))} />}
              {plan.notes.length > 0 && (
                <div className={styles.planNotes}>
                  <p>{t('otto.plan.notes')}</p>
                  <ul>{plan.notes.map((n, i) => <li key={i}>{loc(n)}</li>)}</ul>
                </div>
              )}

              <div className={styles.planActions}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void approveAndBuild()}>
                  {plan.isChange ? t('otto.plan.approveChange') : t('otto.plan.approve')}
                </button>
                <button type="button" className={styles.btn} onClick={() => setPhase('talk')}>
                  {t('otto.plan.backToChat')}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              {error}
              <button type="button" className={styles.errorClose} onClick={() => setError(null)}>×</button>
            </div>
          )}
        </div>

        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
            placeholder={built ? t('otto.composer.change') : t('otto.composer.new')}
            disabled={thinking || phase === 'building'}
            rows={2}
          />
          <div className={styles.composerRow}>
            <button type="button" className={styles.btn}
              disabled={!draft.trim() || thinking || phase === 'building'}
              onClick={() => void send(draft)}>
              {t('otto.composer.send')}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={!readyToPlan || thinking || phase !== 'talk'}
              onClick={() => void preparePlan()}>
              {built ? t('otto.composer.changePlan') : t('otto.composer.toPlan')}
            </button>
          </div>
        </div>
      </aside>
      {!railOpen && (
        <button type="button" className={styles.reopen} onClick={() => setRailOpen(true)} aria-label={t('otto.expand')}>»</button>
      )}

      {/* ── status: what Otto is doing + the figure ── */}
      <aside className={`${styles.status} ${statusOpen ? '' : styles.statusClosed}`}>
        <div className={styles.statusHead}>
          <span className={styles.statusKicker}>{t('otto.status.title')}</span>
          <button type="button" className={styles.collapse} onClick={() => setStatusOpen(false)} aria-label={t('otto.collapse')}>«</button>
        </div>
        <div className={styles.statusCard} aria-live="polite">
          <p className={styles.statusNow}>
            <span className={`${styles.dot} ${phase === 'building' || thinking ? styles.dotWork : error ? styles.dotRisk : styles.dotWait}`} />
            {statusNow}
          </p>
          {statusLine && <p className={styles.statusDetail}>{loc(statusLine)}</p>}
          {steps.length > 0 && (
            <ul className={styles.checklist}>
              {steps.map((s, i) => (
                <li key={i}>
                  <span className={styles.checkMark}>✓</span>
                  {t(`otto.done.${s.key}`)}
                  <span className={styles.checkTime}>{s.seconds}{t('otto.seconds')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.figureBox}>
          <OttoFigure state={figure} size={200} />
        </div>
      </aside>
      {!statusOpen && (
        <button type="button" className={styles.reopen} onClick={() => setStatusOpen(true)} aria-label={t('otto.expand')}>»</button>
      )}

      {/* ── canvas ── */}
      <main className={styles.canvas}>
        <div className={styles.canvasHead}>
          {renaming ? (
            <input
              className={styles.renameInput}
              value={renameValue}
              autoFocus
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => void saveRename()}
              onKeyDown={e => { if (e.key === 'Enter') void saveRename(); if (e.key === 'Escape') setRenaming(false); }}
            />
          ) : (
            <h1 className={styles.canvasTitle}>
              {title}
              {screen && (
                <button type="button" className={styles.renameBtn}
                  onClick={() => { setRenameValue(title); setRenaming(true); }} aria-label={t('otto.rename')}>✎</button>
              )}
            </h1>
          )}
          <span className={`${styles.badge} ${styles[`badge_${statusBadge}`]}`}>{t(`otto.badge.${statusBadge}`)}</span>
          <div className={styles.spacer} />
          {screen && phase !== 'building' && (
            <button type="button" className={styles.btn} onClick={() => setConfirmOpen('delete')}>
              {t('otto.deleteDraft')}
            </button>
          )}
          {built && phase !== 'building' && (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setConfirmOpen('publish')}>
              ✓ {t('otto.saveToApps')}
            </button>
          )}
        </div>
        <p className={styles.canvasSub}>
          {phase === 'building' ? t('otto.canvas.building')
            : built ? t('otto.canvas.ready')
              : t('otto.canvas.notBuilt')}
        </p>

        <div className={styles.canvasBody}>
          {phase === 'building' && (
            <div className={styles.buildBox}>
              <p className={styles.buildKicker}>{t('otto.build.kicker')}</p>
              <p className={styles.buildTitle}>{title}</p>
              <div className={styles.buildBarTrack} role="progressbar"
                aria-valuenow={build?.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
                <span className={styles.buildBarFill} style={{ width: `${build?.percent ?? 3}%` }} />
              </div>
              <div className={styles.stages}>
                {['reading_plan', 'composing_screen', 'querying_data', 'validating_totals'].map((stage, i) => {
                  const order = ['reading_plan', 'composing_screen', 'querying_data', 'validating_totals'];
                  const at = order.indexOf(build?.stage || 'reading_plan');
                  const state = i < at ? 'done' : i === at ? 'now' : 'next';
                  return (
                    <div key={stage} className={`${styles.stage} ${state === 'done' ? styles.stageDone : ''} ${state === 'now' ? styles.stageNow : ''}`}>
                      <span className={styles.stageNum}>{state === 'done' ? '✓' : i + 1}</span>
                      <span className={styles.stageLabel}>{t(`otto.stage.${stage}`)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase !== 'building' && built && screen?.screenSpec && preview && (
            <ScreenRenderer spec={screen.screenSpec} data={preview} />
          )}

          {phase !== 'building' && !built && (
            <div className={styles.empty}>
              <span className={styles.emptyGlyph}><ScreenIcon name={screen?.icon || 'grid'} size={28} /></span>
              <p className={styles.emptyTitle}>{t('otto.empty.title')}</p>
              <p className={styles.emptyText}>{t('otto.empty.text')}</p>
              <div className={styles.chips}>
                {starters.map((s, i) => (
                  <button key={i} type="button" className={styles.chip}
                    onClick={() => { setDraft(loc(s.text)); inputRef.current?.focus(); }}>
                    {loc(s.text)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── confirmations ── */}
      {confirmOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.dialog}>
            <p className={styles.dialogTitle}>
              {confirmOpen === 'publish' ? t('otto.confirm.publishTitle') : t('otto.confirm.deleteTitle')}
            </p>
            <p className={styles.dialogText}>
              {confirmOpen === 'publish' ? t('otto.confirm.publishText') : t('otto.confirm.deleteText')}
            </p>
            <div className={styles.dialogActions}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void (confirmOpen === 'publish' ? doPublish() : doDelete())}>
                {confirmOpen === 'publish' ? t('otto.saveToApps') : t('otto.confirm.deleteYes')}
              </button>
              <button type="button" className={styles.btn} onClick={() => setConfirmOpen(null)}>
                {t('otto.confirm.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanRow({ label, chips, accent }: { label: string; chips: string[]; accent?: boolean }) {
  return (
    <div className={styles.planRow}>
      <span className={styles.planRowLabel}>{label}</span>
      <span className={styles.planChips}>
        {chips.map((c, i) => (
          <span key={i} className={`${styles.planChip} ${accent ? styles.planChipAccent : ''}`}>{c}</span>
        ))}
      </span>
    </div>
  );
}

/** The head-only Orb at rail-avatar size. */
function OttoFigureMini() {
  return (
    <svg viewBox="70 72 120 120" width={34} height={34} aria-hidden="true">
      <circle cx="130" cy="132" r="58" fill="var(--ai-surface, #fbfbfd)" stroke="var(--ai-border, #dfe2ec)" strokeWidth="4" />
      <circle cx="130" cy="132" r="45" fill="#171a23" />
      <rect x="106" y="116" width="14" height="32" rx="7" fill="#eef2ff" />
      <rect x="140" y="116" width="14" height="32" rx="7" fill="#eef2ff" />
    </svg>
  );
}
