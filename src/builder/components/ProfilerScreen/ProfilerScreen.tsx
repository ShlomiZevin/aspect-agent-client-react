/**
 * ProfilerScreen — agent-level authoring of the Profiler (the SECOND
 * customer surface): a live, LLM-built customer profile shown beside the
 * chat (`/:agent/builder/profiler`). Sibling of the Live Brain screen and
 * built from the SAME pieces — panels are chips you open into a config
 * modal. Profiler adds two things over the Live Brain: a per-panel
 * PLACEMENT (header indicators vs body section) and an ASK PROFILER config
 * (talk to the profile). Stored on `agent.profiler`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { fetchProfiler, fetchProfilerRuns, askProfiler, refreshProfiler } from '../../state/builderApi';
import type { LiveBrainPanelData, LiveBrainPanelEntry, LiveBrainRun, ProfilerPanelData } from '../../state/builderApi';
import { ProfilerPanels } from '../../../live-chat/components/ProfilerPanels';
import type { AddonRunSnapshot } from '../AddonRun/AddonRunCard';
import { useConfirm } from '../Confirm/Confirm';
import { Modal } from '../Modal/Modal';
import { InlineField } from '../AddonModal/InlineField';
import { ModelPicker } from '../ModelPicker/ModelPicker';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { FilterEditor } from '../Filter/FilterEditor';
import { filterShortSummary, filterTooltip, isFilterActive } from '../Filter/filterFormat';
import { RENDER_OPTIONS, returnsFor, snippetFor, buildDisplayPanels, PanelLogs } from '../LiveBrainScreen/panelRenderers';
import { ICON_PATH, cleanLabel, type DisplayPanel } from '../LiveBrainScreen/PanelSurface';
import { PanelSheet } from '../LiveBrainScreen/LiveBrainSheet';
import type {
  ProfilerPanel, ProfilerDef, PanelRender, PanelSource, HistoryMode, ModelRef, OfflineTrigger, AddonFilter,
} from '../../types';
import styles from '../LiveBrainScreen/LiveBrainScreen.module.css';
import pstyles from './ProfilerScreen.module.css';
import addon from '../AddonModal/AddonModal.module.css';

let panelSeq = 0;
const newPanelId = () => `panel_${Date.now().toString(36)}_${(panelSeq++).toString(36)}`;

const DEFAULT_MODEL: ModelRef = { providerId: 'openai', modelId: 'gpt-4o-mini' };
const DEFAULT_ASK_MODEL: ModelRef = { providerId: 'openai', modelId: 'gpt-4o' };
/** The built-in Ask-Profiler system prompt, shown verbatim in the editor
 *  (WYSIWYG). MUST match the server default in runtimeRoute.js — if left
 *  unedited the panel stays empty and the server falls back to the same
 *  text; editing it here overrides. */
const CLIENT_DEFAULT_ASK_PROMPT =
  'You ARE this customer profile — the live understanding the assistant has built of the customer from the conversation. ' +
  'Answer the question about yourself using ONLY the profile JSON and the conversation provided: why something was inferred or classified, ' +
  "what's still missing, what to ask next, how the profile affects the next step. Be concise, specific and grounded in the data. " +
  'Never invent facts that are not supported by the profile or the conversation. Answer in the same language as the question. ' +
  "If the data doesn't support an answer, say so plainly.";
/** Default one-tap chips shown in the Ask drawer. Shown + editable here;
 *  the server falls back to the SAME list when none are set, so an
 *  untouched agent still shows them to the customer. Keep in sync with
 *  DEFAULT_ASK_CHIPS in runtimeRoute.js. */
const DEFAULT_ASK_CHIPS = [
  'What do we know about this customer so far?',
  'What is still missing from the profile?',
  'Why was the customer classified this way?',
  'What should we ask next?',
];
const DEFAULT_HISTORY: HistoryMode = { mode: 'last_n', n: 12 };
const DEFAULT_TRIGGER: OfflineTrigger = { kind: 'every_n_messages', n: 3 };
const EMPTY_FILTER: AddonFilter = { conditions: [], mode: 'include' };

function panelToEntry(p: LiveBrainPanelData): LiveBrainPanelEntry {
  return {
    render: p.render,
    ...(p.text   !== undefined ? { text:   p.text }   : {}),
    ...(p.values !== undefined ? { values: p.values } : {}),
    ranAt: p.ranAt,
  };
}
function panelListToMap(list: LiveBrainPanelData[]): Record<string, LiveBrainPanelEntry> {
  const map: Record<string, LiveBrainPanelEntry> = {};
  for (const p of list) map[p.id] = panelToEntry(p);
  return map;
}
function runToSnapshot(r: LiveBrainRun): AddonRunSnapshot {
  const d = r.runData || {};
  return {
    instanceId: r.instanceId,
    pluginId:   'profiler-panel',
    label:      d.label,
    modelLabel: d.modelLabel ?? null,
    status:     (r.status as AddonRunSnapshot['status']) || 'success',
    lane:       'offline',
    prompt:     d.prompt,
    rawOutput:  d.rawOutput,
    parsedOutput: d.parsedOutput,
    parseError: d.parseError,
    durationMs: r.durationMs ?? undefined,
  };
}

function renderLabel(r: PanelRender): string {
  return RENDER_OPTIONS.find(o => o.value === r)?.label ?? r;
}
function panelSummary(p: ProfilerPanel): string {
  const r = renderLabel(p.render);
  const where = p.placement === 'header' ? 'Header' : 'Section';
  if (p.source.kind === 'text') return `${r} · ${where} · Text`;
  const t = p.source.trigger;
  const cadence = t.kind === 'on_transition' ? 'on transition' : `every ${t.n} msg${t.n === 1 ? '' : 's'}`;
  return `${r} · ${where} · AI · ${cadence}`;
}

function histValue(h: HistoryMode | undefined): string {
  if (!h) return 'last_n:12';
  if (h.mode === 'last_n') return `last_n:${h.n}`;
  if (h.mode === 'all' || h.mode === 'full') return 'all';
  if (h.mode === 'since_transition') return 'since_transition';
  return 'all';
}
function histFromValue(v: string): HistoryMode {
  if (v === 'none') return { mode: 'none' };
  if (v === 'all') return { mode: 'all' };
  if (v === 'since_transition') return { mode: 'since_transition' };
  if (v.startsWith('last_n:')) return { mode: 'last_n', n: Number(v.slice('last_n:'.length)) || 12 };
  return DEFAULT_HISTORY;
}

const VALID_RENDERS: PanelRender[] = ['text', 'html', 'tags', 'fields', 'bars', 'cards', 'journey'];
function normalizeRender(r: unknown): PanelRender {
  return VALID_RENDERS.includes(r as PanelRender) ? (r as PanelRender) : 'text';
}
function normalizeTags(t: unknown): { mode: 'predefined' | 'generated'; labels: string[] } {
  const s = t as { mode?: string; labels?: unknown } | undefined;
  const mode = s?.mode === 'predefined' ? 'predefined' : 'generated';
  const labels = Array.isArray(s?.labels) ? s!.labels.filter((x): x is string => typeof x === 'string') : [];
  return { mode, labels };
}
function normalizeFields(f: unknown): { mode: 'predefined' | 'generated'; keys: string[] } {
  const s = f as { mode?: string; keys?: unknown } | undefined;
  const mode = s?.mode === 'generated' ? 'generated' : 'predefined';
  const keys = Array.isArray(s?.keys) ? s!.keys.filter((x): x is string => typeof x === 'string') : [];
  return { mode, keys };
}
function normalizeSource(src: unknown): PanelSource {
  const s = src as Record<string, unknown> | null | undefined;
  if (!s || typeof s !== 'object') return { kind: 'text', text: '' };
  if (s.kind === 'prompt') {
    return {
      kind: 'prompt',
      prompt: typeof s.prompt === 'string' ? s.prompt : '',
      model: (s.model as ModelRef) ?? DEFAULT_MODEL,
      history: (s.history as HistoryMode) ?? DEFAULT_HISTORY,
      trigger: (s.trigger as OfflineTrigger) ?? DEFAULT_TRIGGER,
    };
  }
  const text = typeof s.text === 'string' ? s.text : '';
  return { kind: 'text', text };
}
function normalizePanel(p: ProfilerPanel): ProfilerPanel {
  const legacyFilter = (p.source as { filter?: AddonFilter } | undefined)?.filter;
  const filter = p.filter ?? legacyFilter;
  const render = normalizeRender(p.render);
  return {
    id: p.id,
    title: p.title,
    render,
    source: normalizeSource(p.source),
    placement: p.placement === 'header' ? 'header' : 'body',
    ...(p.description ? { description: p.description } : {}),
    ...(filter ? { filter } : {}),
    ...(render === 'tags' ? { tags: normalizeTags(p.tags) } : {}),
    ...(render === 'fields' ? { fields: normalizeFields(p.fields) } : {}),
  };
}

/** Compact tag/chip input — type, Enter (or comma) to add; Backspace on an
 *  empty field removes the last. Reused for Tags labels, Fields keys, and
 *  the Ask preset chips. */
function TagInput({ items, onChange, placeholder }: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !items.includes(t)) onChange([...items, t]);
    setDraft('');
  };
  return (
    <div className={styles.tagInput}>
      {items.map((it, i) => (
        <span key={i} className={styles.tagChip}>
          {it}
          <button type="button" className={styles.tagChipX} title="Remove"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
        </span>
      ))}
      <input
        className={styles.tagInputField}
        value={draft}
        placeholder={items.length ? 'Add another…' : placeholder}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && items.length) onChange(items.slice(0, -1));
        }}
        onBlur={() => add(draft)}
      />
    </div>
  );
}

function buildReturns(p: ProfilerPanel): string {
  if (p.render === 'tags') {
    if (p.tags?.mode === 'generated') {
      return 'Return the labels + which fit (one or more):\n\n{ "tags": ["Needs control", "Fee sensitive"], "active": ["Fee sensitive"] }';
    }
    return 'Return the label(s) that fit (one or more):\n\n{ "active": ["Fee sensitive"] }';
  }
  if (p.render === 'fields') {
    const keys = (p.fields?.keys ?? []).filter(Boolean);
    if (p.fields?.mode !== 'generated' && keys.length) {
      return `Return a value for each field:\n\n{ ${keys.map(k => `"${k}": "…"`).join(', ')} }`;
    }
    return 'Return the fields you find:\n\n{ "Employment": "Self-employed", "Main goal": "…" }';
  }
  return returnsFor(p.render);
}
function buildSnippet(p: ProfilerPanel): string {
  if (p.render === 'tags') {
    const labels = (p.tags?.labels ?? []).filter(Boolean);
    if (p.tags?.mode === 'predefined' && labels.length) {
      return `Return only this: {"active":["<any that fit, from: ${labels.join(', ')}>"]}`;
    }
    return 'Return only this: {"tags":["your","labels"],"active":["the fitting ones"]}';
  }
  if (p.render === 'fields') {
    const keys = (p.fields?.keys ?? []).filter(Boolean);
    if (p.fields?.mode !== 'generated' && keys.length) {
      return `Return only this: {${keys.map(k => `"${k}":"…"`).join(', ')}}`;
    }
  }
  return snippetFor(p.render);
}

function TriggerSelect({ trigger, onChange }: { trigger: OfflineTrigger; onChange: (t: OfflineTrigger) => void }) {
  return (
    <div className={styles.whenRow}>
      <select
        className={styles.input}
        value={trigger.kind}
        onChange={e => onChange(e.target.value === 'on_transition'
          ? { kind: 'on_transition' }
          : { kind: 'every_n_messages', n: trigger.kind === 'every_n_messages' ? trigger.n : 3 })}
      >
        <option value="every_n_messages">Every N messages</option>
        <option value="on_transition">On crew transition</option>
      </select>
      {trigger.kind === 'every_n_messages' && (
        <input
          className={styles.miniInput}
          type="number" min={1}
          value={trigger.n}
          onChange={e => onChange({ kind: 'every_n_messages', n: Math.max(1, Number(e.target.value) || 1) })}
        />
      )}
    </div>
  );
}

export function ProfilerScreen() {
  const { doc, updateAgent, previewConversationId, profilerPanelEvent } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const slug = agent?.slug;
  const mentionOptions = useMentionOptions(agent?.id ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);

  const [liveValues, setLiveValues] = useState<Record<string, LiveBrainPanelEntry>>({});
  const [runSnapshots, setRunSnapshots] = useState<AddonRunSnapshot[]>([]);
  const ownerUserId = (typeof localStorage !== 'undefined' && localStorage.getItem('builder:ownerUserId')) || 'anon';

  // Group runs by the panel they belong to — each panel shows its own log.
  const runsByPanel = useMemo(() => {
    const map: Record<string, AddonRunSnapshot[]> = {};
    for (const r of runSnapshots) { (map[r.instanceId] ??= []).push(r); }
    return map;
  }, [runSnapshots]);

  const loadRuns = useCallback(async () => {
    if (!slug || !previewConversationId) return;
    try {
      const res = await fetchProfilerRuns({ agentSlug: slug, conversationId: previewConversationId });
      setRunSnapshots((res?.runs || []).map(runToSnapshot));
    } catch { /* best-effort — keep the last logs */ }
  }, [slug, previewConversationId]);

  // Builder Refresh — recompute the whole profiler for the preview
  // conversation now (real, same as the customer button).
  const previewRefresh = useCallback(async () => {
    if (!slug || !previewConversationId || previewRefreshing) return;
    setPreviewRefreshing(true);
    try {
      const res = await refreshProfiler({ agentSlug: slug, conversationId: previewConversationId, ownerUserId, version: 'viewing' });
      setLiveValues(panelListToMap(res?.panels || []));
      await loadRuns();
    } catch { /* best-effort */ }
    finally { setPreviewRefreshing(false); }
  }, [slug, previewConversationId, ownerUserId, previewRefreshing, loadRuns]);

  // Initial hydration of the preview from stored values + runs (one fetch).
  useEffect(() => {
    let cancelled = false;
    if (!slug || !previewConversationId) { setLiveValues({}); setRunSnapshots([]); return; }
    (async () => {
      try {
        const [valRes, runsRes] = await Promise.all([
          fetchProfiler({ agentSlug: slug, conversationId: previewConversationId, ownerUserId, version: 'viewing' }),
          fetchProfilerRuns({ agentSlug: slug, conversationId: previewConversationId }),
        ]);
        if (cancelled) return;
        setLiveValues(panelListToMap(valRes?.panels || []));
        setRunSnapshots((runsRes?.runs || []).map(runToSnapshot));
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [slug, previewConversationId, ownerUserId]);

  // Live: merge one panel per `profiler.panel` event + refresh its logs.
  useEffect(() => {
    if (!profilerPanelEvent) return;
    const { panelId, panel } = profilerPanelEvent;
    setLiveValues(prev => {
      const next = { ...prev };
      if (panel) next[panelId] = panelToEntry(panel);
      else delete next[panelId];
      return next;
    });
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilerPanelEvent]);

  if (!agent) return <div className={styles.screen}>No agent loaded.</div>;

  const profiler = agent.profiler;
  const panels = (profiler?.panels ?? []).map(normalizePanel);
  const editing = panels.find(p => p.id === editingId) ?? null;

  const writeProfiler = (patch: Partial<ProfilerDef>) =>
    updateAgent(agent.id, { profiler: { panels: [], ...(profiler ?? {}), ...patch } });
  const writePanels = (next: ProfilerPanel[]) => writeProfiler({ panels: next });
  const patchPanel = (id: string, patch: Partial<ProfilerPanel>) =>
    writePanels(panels.map(p => (p.id === id ? { ...p, ...patch } : p)));
  const patchTags = (patch: Partial<NonNullable<ProfilerPanel['tags']>>) =>
    editing && patchPanel(editing.id, { tags: { mode: 'generated', labels: [], ...(editing.tags ?? {}), ...patch } });
  const patchFields = (patch: Partial<NonNullable<ProfilerPanel['fields']>>) =>
    editing && patchPanel(editing.id, { fields: { mode: 'generated', keys: [], ...(editing.fields ?? {}), ...patch } });

  const addPanel = () => {
    const p: ProfilerPanel = { id: newPanelId(), title: '👤 New section', render: 'fields', placement: 'body', source: { kind: 'prompt', prompt: '', model: DEFAULT_MODEL, history: DEFAULT_HISTORY, trigger: DEFAULT_TRIGGER }, fields: { mode: 'generated', keys: [] } };
    writePanels([...panels, p]);
    setEditingId(p.id);
  };
  const deletePanel = async (id: string) => {
    const ok = await confirm({ title: 'Delete panel?', message: 'This removes the panel from the Profiler.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    writePanels(panels.filter(p => p.id !== id));
    setEditingId(null);
  };
  const move = (id: string, dir: -1 | 1) => {
    const i = panels.findIndex(p => p.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= panels.length) return;
    const next = panels.slice();
    [next[i], next[j]] = [next[j], next[i]];
    writePanels(next);
  };

  const sourceStash = useRef<Record<string, Partial<Record<PanelSource['kind'], PanelSource>>>>({});
  const setSourceKind = (kind: PanelSource['kind']) => {
    if (!editing || editing.source.kind === kind) return;
    const stash = (sourceStash.current[editing.id] ??= {});
    stash[editing.source.kind] = editing.source;
    const restored = stash[kind];
    const source: PanelSource = restored
      ?? (kind === 'text'
        ? { kind: 'text', text: '' }
        : { kind: 'prompt', prompt: '', model: DEFAULT_MODEL, history: DEFAULT_HISTORY, trigger: DEFAULT_TRIGGER });
    patchPanel(editing.id, { source });
  };
  const patchText = (text: string) => editing && patchPanel(editing.id, { source: { kind: 'text', text } });
  const patchPrompt = (patch: Partial<Extract<PanelSource, { kind: 'prompt' }>>) => {
    if (!editing || editing.source.kind !== 'prompt') return;
    patchPanel(editing.id, { source: { ...editing.source, ...patch } });
  };
  const copyReturn = () => { if (editing) { navigator.clipboard?.writeText(buildSnippet(editing)); setCopied(true); } };

  const panelFilter = editing?.filter ?? EMPTY_FILTER;

  // Ask config (with defaults).
  const ask = profiler?.ask ?? { enabled: false, model: DEFAULT_ASK_MODEL, prompt: '', chips: [] as string[] };
  const patchAsk = (patch: Partial<NonNullable<ProfilerDef['ask']>>) =>
    writeProfiler({ ask: { enabled: false, model: DEFAULT_ASK_MODEL, prompt: '', chips: [], ...ask, ...patch } });

  const display = buildDisplayPanels(panels, liveValues);
  const placeById = new Map(panels.map(p => [p.id, p.placement]));
  const previewPanels: ProfilerPanelData[] = display.map(p => ({ id: p.id, title: p.title, render: p.render, text: p.text, values: p.values, placement: placeById.get(p.id) }));
  const previewAskConfig = ask.enabled
    ? { enabled: true, chips: (ask.chips && ask.chips.length ? ask.chips : DEFAULT_ASK_CHIPS) }
    : null;
  // Ask, live from the preview conversation on the right (uses the saved
  // 'viewing' version — save your edits to see them reflected).
  const previewAsk = async (question: string): Promise<string> => {
    const q = question.trim();
    if (!q) return '';
    if (!slug || !previewConversationId) return 'Start a preview chat on the right first, then ask the profile.';
    try {
      const res = await askProfiler({ agentSlug: slug, conversationId: previewConversationId, ownerUserId, question: q, version: 'viewing' });
      return res?.answer || '';
    } catch (e) { return e instanceof Error ? `Ask failed: ${e.message}` : 'Ask failed'; }
  };


  return (
    <div className={styles.screen}>
      <div className={styles.grid}>
        <aside className={`${styles.chain} ${pstyles.chainScroll}`}>
          <div className={styles.head}>
            <h1 className={styles.h1}>👤 Profiler</h1>
            <p className={styles.sub}>A live customer profile built from the conversation — shown beside the chat. Applies to every crew.</p>
          </div>
          <div className={styles.listHead}>Profile Sections</div>
          {panels.map((p, i) => (
            <div key={p.id} className={styles.chip} onClick={() => setEditingId(p.id)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') setEditingId(p.id); }}>
              <span className={styles.chipBadge} aria-hidden>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9A2295" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICON_PATH[p.render] ?? ICON_PATH.text} />
                </svg>
              </span>
              <div className={styles.chipMain}>
                <span className={styles.chipTitle}>{cleanLabel(p.title, p.render) || 'Untitled'}</span>
                <span className={styles.chipSummary}>{panelSummary(p)}</span>
              </div>
              <span className={styles.chipMove}>
                <button title="Move up" onClick={e => { e.stopPropagation(); move(p.id, -1); }} disabled={i === 0}>▲</button>
                <button title="Move down" onClick={e => { e.stopPropagation(); move(p.id, 1); }} disabled={i === panels.length - 1}>▼</button>
              </span>
            </div>
          ))}
          <button className={styles.addChip} onClick={addPanel}>+ Add section</button>

          <div className={styles.listHead} style={{ marginTop: 18 }}>Ask Profiler</div>
          <button className={styles.chip} onClick={() => setAskOpen(true)} role="button" tabIndex={0}>
            <span className={styles.chipBadge}>💬</span>
            <div className={styles.chipMain}>
              <span className={styles.chipTitle}>Ask Profiler</span>
              <span className={styles.chipSummary}>{ask.enabled ? `On · ${(ask.chips ?? []).length} chips` : 'Off'}</span>
            </div>
          </button>
        </aside>

        <section className={styles.preview}>
          <div className={styles.deviceFrame}>
            {/* The REAL customer surface — so the preview shows exactly what
                the customer sees, plus builder-only Open / Logs controls and
                a per-section run log beneath each panel. */}
            <ProfilerPanels
              panels={previewPanels}
              ask={previewAskConfig}
              onAsk={previewAsk}
              onRefresh={previewConversationId ? previewRefresh : undefined}
              refreshing={previewRefreshing}
              selectedId={editingId ?? undefined}
              headerRight={
                <>
                  <button
                    type="button"
                    className={styles.logToggle}
                    onClick={() => setSheetOpen(true)}
                    title="Open the full Profiler overlay — exactly how the customer sees it"
                  >⛶ Open</button>
                  <button
                    type="button"
                    className={`${styles.logToggle} ${showLogs ? styles.logToggleOn : ''}`}
                    onClick={() => setShowLogs(s => !s)}
                    title={showLogs ? 'Hide the run logs (clean customer view)' : 'Show each section’s run log'}
                  >🔍 Logs</button>
                </>
              }
              footerFor={showLogs
                ? (p: DisplayPanel) => {
                    const runs = runsByPanel[p.id] ?? [];
                    return runs.length ? <PanelLogs runs={runs} /> : null;
                  }
                : undefined}
            />
          </div>
        </section>
      </div>

      {/* ── panel config modal ── */}
      {editing && (
        <Modal
          open
          onClose={() => setEditingId(null)}
          width={640}
          title={editing.title || 'Section'}
          badge={editing.source.kind === 'prompt' ? 'AI' : 'text'}
          footer={
            <>
              <button type="button" className={addon.dangerBtn} onClick={() => deletePanel(editing.id)}>Delete</button>
              <span className={addon.spacer} />
              <button type="button" className={addon.primaryBtn} onClick={() => setEditingId(null)}>Done</button>
            </>
          }
        >
          <div className={addon.body}>
            <div className={styles.stableBody}>
              <div className={addon.filterLauncherRow}>
                <button
                  type="button"
                  className={`${addon.filterLauncher} ${isFilterActive(panelFilter) ? addon.filterLauncherActive : ''}`}
                  onClick={() => setFilterOpen(true)}
                  title={filterTooltip(panelFilter)}
                >
                  <span aria-hidden className={addon.filterLauncherIcon}>▽</span>
                  <span className={addon.filterLauncherText}>{filterShortSummary(panelFilter)}</span>
                  <span className={addon.filterLauncherEdit}>{isFilterActive(panelFilter) ? 'Edit' : 'Add'}</span>
                </button>
              </div>

              <InlineField label="Title" hint="Paste an emoji, a label, or both.">
                <input className={styles.inputFull} value={editing.title}
                  onChange={e => patchPanel(editing.id, { title: e.target.value })} placeholder="👤 Section title" />
              </InlineField>

              <InlineField label="Placement" hint="Header = the compact indicators strip up top (e.g. progress bars). Section = a normal card in the body.">
                <div className={styles.seg2} role="tablist" aria-label="Placement">
                  <button role="tab" aria-selected={editing.placement !== 'header'} onClick={() => patchPanel(editing.id, { placement: 'body' })}>Section</button>
                  <button role="tab" aria-selected={editing.placement === 'header'} onClick={() => patchPanel(editing.id, { placement: 'header' })}>Header</button>
                </div>
              </InlineField>

              <InlineField label="Show as" hint="How this section is drawn on the profile.">
                <select className={styles.inputFull} value={editing.render}
                  onChange={e => patchPanel(editing.id, { render: e.target.value as PanelRender })}>
                  {RENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
                </select>
              </InlineField>

              {editing.render === 'tags' && (
                <InlineField label="Labels" hint="Predefined: you set them, the AI picks which is active. Generated: the AI invents them.">
                  <div className={styles.seg2} role="tablist" aria-label="Tag mode">
                    <button role="tab" aria-selected={editing.tags?.mode === 'predefined'} onClick={() => patchTags({ mode: 'predefined' })}>Predefined</button>
                    <button role="tab" aria-selected={editing.tags?.mode !== 'predefined'} onClick={() => patchTags({ mode: 'generated' })}>Generated</button>
                  </div>
                  {editing.tags?.mode === 'predefined' && (
                    <div className={styles.nested}>
                      <TagInput items={editing.tags?.labels ?? []} onChange={labels => patchTags({ labels })} placeholder="Type a label, press Enter" />
                      <span className={styles.nestedHint}>These labels always show; the AI just highlights whichever fits.</span>
                    </div>
                  )}
                </InlineField>
              )}

              {editing.render === 'fields' && (
                <InlineField label="Keys" hint="Predefined: you set the keys, the AI fills each value. Generated: the AI invents the keys too.">
                  <div className={styles.seg2} role="tablist" aria-label="Field mode">
                    <button role="tab" aria-selected={editing.fields?.mode === 'predefined'} onClick={() => patchFields({ mode: 'predefined' })}>Predefined</button>
                    <button role="tab" aria-selected={editing.fields?.mode !== 'predefined'} onClick={() => patchFields({ mode: 'generated' })}>Generated</button>
                  </div>
                  {editing.fields?.mode !== 'generated' && (
                    <div className={styles.nested}>
                      <TagInput items={editing.fields?.keys ?? []} onChange={keys => patchFields({ keys })} placeholder="Type a key, press Enter" />
                      <span className={styles.nestedHint}>These rows always show; the AI fills a value for each.</span>
                    </div>
                  )}
                </InlineField>
              )}

              <InlineField label="Source" hint="Compose from your text, or compute with an AI prompt.">
                <div className={styles.seg2} role="tablist" aria-label="Panel source">
                  <button role="tab" aria-selected={editing.source.kind === 'text'} onClick={() => setSourceKind('text')}>📝 Text</button>
                  <button role="tab" aria-selected={editing.source.kind === 'prompt'} onClick={() => setSourceKind('prompt')}>🤖 AI prompt</button>
                </div>
              </InlineField>

              {editing.source.kind === 'text' ? (
                <div className={styles.section}>
                  <span className={styles.sectionLabel}>Text</span>
                  <MentionTextarea
                    value={editing.source.text}
                    onChange={patchText}
                    options={mentionOptions}
                    placeholder={"The customer is in {{field:stage}} and mostly wants {{field:top_need}}."}
                    rows={8}
                    storageKey={`profiler:${editing.id}:text`}
                  />
                  <span className={styles.sectionHint}>Write anything; type <kbd>/</kbd> to drop in a live value like a field or memory.</span>
                </div>
              ) : (
                <>
                  <InlineField label="Model" hint="LLM used for this section's run.">
                    <ModelPicker value={editing.source.model} onChange={model => patchPrompt({ model })} />
                  </InlineField>

                  <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                      <span className={styles.sectionLabel}>Prompt</span>
                      <button
                        type="button"
                        className={styles.returnPill}
                        onClick={() => { setReturnOpen(true); setCopied(false); }}
                        title="See the exact JSON shape this prompt must return"
                      >
                        <span className={styles.returnPillIcon}>{'{ }'}</span>
                        <span>Returns <b>{renderLabel(editing.render)}</b></span>
                        <span className={styles.returnPillCta}>Show me →</span>
                      </button>
                    </div>
                    <MentionTextarea
                      value={editing.source.prompt}
                      onChange={prompt => patchPrompt({ prompt })}
                      options={mentionOptions}
                      placeholder="Read the conversation and produce this section's content…"
                      rows={5}
                      storageKey={`profiler:${editing.id}:prompt`}
                    />
                  </div>

                  <InlineField label="History" hint="How much conversation it sees on each run.">
                    <select className={styles.inputFull} value={histValue(editing.source.history)}
                      onChange={e => patchPrompt({ history: histFromValue(e.target.value) })}>
                      <option value="none">None</option>
                      <option value="last_n:3">Last 3 messages</option>
                      <option value="last_n:5">Last 5 messages</option>
                      <option value="last_n:10">Last 10 messages</option>
                      <option value="last_n:20">Last 20 messages</option>
                      <option value="all">Full conversation</option>
                      <option value="since_transition">Since last crew transition</option>
                    </select>
                  </InlineField>

                  <InlineField label="Runs" hint="Cadence — non-blocking, off the reply path.">
                    <TriggerSelect trigger={editing.source.trigger} onChange={trigger => patchPrompt({ trigger })} />
                  </InlineField>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── filter modal ── */}
      {editing && filterOpen && (
        <Modal open onClose={() => setFilterOpen(false)} width={720} title="Filter"
          badge={editing.title || 'Section'}
          footer={<><span className={addon.spacer} /><button type="button" className={addon.primaryBtn} onClick={() => setFilterOpen(false)}>Done</button></>}
        >
          <div className={addon.body}>
            <FilterEditor
              agentId={agent.id}
              crewId={null}
              filter={panelFilter}
              onChange={filter => patchPanel(editing.id, { filter })}
              verb="render" verbs="renders"
              skippedSentence="When skipped, the section is hidden this turn."
              emptyMessage="No conditions — the section always shows."
            />
          </div>
        </Modal>
      )}

      {/* ── full-screen overlay ("Open" — how the customer sees it) ── */}
      <PanelSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        panels={previewPanels as DisplayPanel[]}
        icon="👤"
        title="Customer Profiler"
        subtitle="Live profile built from the conversation"
      />

      {/* ── "what to return" modal ── */}
      {editing && returnOpen && (
        <Modal open onClose={() => setReturnOpen(false)} width={540} title={`What to return · ${renderLabel(editing.render)}`}>
          <p className={styles.returnLead}>The AI must return exactly this shape:</p>
          <pre className={styles.returnPre}>{buildReturns(editing)}</pre>
          <p className={styles.returnLead}>Paste this line into your prompt — it tells the AI exactly what to return:</p>
          <pre className={styles.returnPre}>{buildSnippet(editing)}</pre>
          <div className={styles.returnActions}>
            <button className={styles.copyBtn} onClick={copyReturn}>{copied ? 'Copied ✓' : 'Copy prompt line'}</button>
          </div>
        </Modal>
      )}

      {/* ── Ask Profiler config modal ── */}
      {askOpen && (
        <Modal open onClose={() => setAskOpen(false)} width={620} title="Ask Profiler" badge="talk to the profile"
          footer={<><span className={addon.spacer} /><button type="button" className={addon.primaryBtn} onClick={() => setAskOpen(false)}>Done</button></>}
        >
          <div className={addon.body}>
            <div className={styles.stableBody}>
              <InlineField label="Enabled" hint="Let users ask the profile questions about itself (why it inferred something, what's missing, what to ask next).">
                <div className={styles.seg2} role="tablist" aria-label="Ask enabled">
                  <button role="tab" aria-selected={!ask.enabled} onClick={() => patchAsk({ enabled: false })}>Off</button>
                  <button role="tab" aria-selected={ask.enabled} onClick={() => patchAsk({ enabled: true })}>On</button>
                </div>
              </InlineField>

              {ask.enabled && (
                <>
                  <InlineField label="Model" hint="LLM that answers Ask-Profiler questions.">
                    <ModelPicker value={ask.model ?? DEFAULT_ASK_MODEL} onChange={model => patchAsk({ model })} />
                  </InlineField>

                  <div className={styles.section}>
                    <span className={styles.sectionLabel}>Prompt</span>
                    <MentionTextarea
                      value={ask.prompt || CLIENT_DEFAULT_ASK_PROMPT}
                      onChange={prompt => patchAsk({ prompt })}
                      options={mentionOptions}
                      placeholder="How the profile should answer questions about itself…"
                      rows={7}
                      storageKey={`profiler:ask:prompt`}
                    />
                  </div>

                  <InlineField label="Preset questions" hint="Ready-made questions shown as one-tap buttons at the top of the Ask drawer, so the user doesn't have to think one up.">
                    <TagInput
                      items={(ask.chips && ask.chips.length) ? ask.chips : DEFAULT_ASK_CHIPS}
                      onChange={chips => patchAsk({ chips })}
                      placeholder="Type a question, press Enter"
                    />
                  </InlineField>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
