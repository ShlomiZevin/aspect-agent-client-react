/**
 * LiveBrainScreen — agent-level authoring of the customer-facing Live
 * Brain (`/:agent/builder/live-brain`).
 *
 * Modelled on the builder's cortex: panels are CHIPS you click to open a
 * config MODAL built from the SAME pieces as the addon modal (InlineField
 * rows, the filter launcher → focused filter modal, the AddonModal footer
 * styling). The screen stays roomy — chip chain + a client-width preview.
 *
 * A panel is a title + a render type + a SOURCE:
 *   - `text`   — free text with `{{...}}` tokens. Plain substitution; NO LLM.
 *   - `prompt` — a non-blocking Live-Brain addon computes it, authored with
 *                the SAME pieces as a regular addon.
 *
 * Agent-level → applies to all crews. Stored on `agent.liveBrain`. See
 * docs/guides/BUILDER_V2_LIVE_BRAIN.md.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { fetchLiveBrain, fetchLiveBrainRuns } from '../../state/builderApi';
import type { LiveBrainPanelData, LiveBrainPanelEntry, LiveBrainRun } from '../../state/builderApi';
import type { AddonRunSnapshot } from '../AddonRun/AddonRunCard';
import { useConfirm } from '../Confirm/Confirm';
import { Modal } from '../Modal/Modal';
import { InlineField } from '../AddonModal/InlineField';
import { ModelPicker } from '../ModelPicker/ModelPicker';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { FilterEditor } from '../Filter/FilterEditor';
import { filterShortSummary, filterTooltip, isFilterActive } from '../Filter/filterFormat';
import { LiveBrainPreview, RENDER_OPTIONS, returnsFor, snippetFor, buildDisplayPanels } from './panelRenderers';
import { LiveBrainSheet } from './LiveBrainSheet';
import type {
  BrainPanel, PanelRender, PanelSource, HistoryMode, ModelRef, OfflineTrigger, AddonFilter,
} from '../../types';
import styles from './LiveBrainScreen.module.css';
import addon from '../AddonModal/AddonModal.module.css';

let panelSeq = 0;
const newPanelId = () => `panel_${Date.now().toString(36)}_${(panelSeq++).toString(36)}`;

const DEFAULT_MODEL: ModelRef = { providerId: 'openai', modelId: 'gpt-4o-mini' };
const DEFAULT_HISTORY: HistoryMode = { mode: 'last_n', n: 10 };
const DEFAULT_TRIGGER: OfflineTrigger = { kind: 'every_n_messages', n: 3 };
const EMPTY_FILTER: AddonFilter = { conditions: [], mode: 'include' };

/** Render-ready panel list (from the snapshot / initial fetch) → the
 *  by-id value map the preview renders. */
function panelListToMap(list: LiveBrainPanelData[]): Record<string, LiveBrainPanelEntry> {
  const map: Record<string, LiveBrainPanelEntry> = {};
  for (const p of list) {
    map[p.id] = {
      render: p.render,
      ...(p.text   !== undefined ? { text:   p.text }   : {}),
      ...(p.values !== undefined ? { values: p.values } : {}),
      ranAt: p.ranAt,
    };
  }
  return map;
}

/** A persisted / live Live-Brain run → the SAME snapshot the chat's
 *  AddonRunCard renders, so a panel's log looks identical to a chat
 *  addon's card (input prompt, output, parse error, model, timing). */
function runToSnapshot(r: LiveBrainRun): AddonRunSnapshot {
  const d = r.runData || {};
  return {
    instanceId: r.instanceId,
    pluginId:   'live-brain-panel',
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
function panelSummary(p: BrainPanel): string {
  const r = renderLabel(p.render);
  if (p.source.kind === 'text') return `${r} · Text`;
  const t = p.source.trigger;
  const cadence = t.kind === 'on_transition' ? 'on transition' : `every ${t.n} msg${t.n === 1 ? '' : 's'}`;
  return `${r} · AI · ${cadence}`;
}

function histValue(h: HistoryMode | undefined): string {
  if (!h) return 'last_n:10';
  if (h.mode === 'last_n') return `last_n:${h.n}`;
  if (h.mode === 'all' || h.mode === 'full') return 'all';
  if (h.mode === 'since_transition') return 'since_transition';
  return 'all';
}
function histFromValue(v: string): HistoryMode {
  if (v === 'none') return { mode: 'none' };
  if (v === 'all') return { mode: 'all' };
  if (v === 'since_transition') return { mode: 'since_transition' };
  if (v.startsWith('last_n:')) return { mode: 'last_n', n: Number(v.slice('last_n:'.length)) || 10 };
  return DEFAULT_HISTORY;
}

const VALID_RENDERS: PanelRender[] = ['text', 'html', 'tags', 'fields', 'bars', 'cards'];
function normalizeRender(r: unknown): PanelRender {
  return VALID_RENDERS.includes(r as PanelRender) ? (r as PanelRender) : 'text';
}
function normalizeTags(t: unknown): { mode: 'predefined' | 'generated'; labels: string[] } {
  const s = t as { mode?: string; labels?: unknown } | undefined;
  // Default to generated — the simplest path (no labels to author).
  const mode = s?.mode === 'predefined' ? 'predefined' : 'generated';
  const labels = Array.isArray(s?.labels) ? s!.labels.filter((x): x is string => typeof x === 'string') : [];
  return { mode, labels };
}
function normalizeFields(f: unknown): { mode: 'predefined' | 'generated'; keys: string[] } {
  const s = f as { mode?: string; keys?: unknown } | undefined;
  // Default predefined — you decide the rows (Noa's Fields spec).
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
  const text = typeof s.text === 'string' ? s.text : typeof s.token === 'string' ? s.token : '';
  return { kind: 'text', text };
}
function normalizePanel(p: BrainPanel): BrainPanel {
  // Migrate a legacy filter that used to live on the prompt source up to
  // the panel (where it now belongs — filter is addon-level).
  const legacyFilter = (p.source as { filter?: AddonFilter } | undefined)?.filter;
  const filter = p.filter ?? legacyFilter;
  const render = normalizeRender(p.render);
  return {
    id: p.id,
    title: p.title,
    render,
    source: normalizeSource(p.source),
    ...(filter ? { filter } : {}),
    ...(render === 'tags' ? { tags: normalizeTags(p.tags) } : {}),
    ...(render === 'fields' ? { fields: normalizeFields(p.fields) } : {}),
  };
}

/** Compact tag input — type a word, press Enter (or comma) to add it as a
 *  chip; Backspace on an empty field removes the last. Reused for Tags
 *  labels and Fields keys. Looks like the modal's other inputs. */
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

/** Build the example shape shown at the top of the "what to return" modal,
 *  matching the panel's actual mode (so generated Tags show `tags` too,
 *  predefined Fields show the real keys, etc). */
function buildReturns(p: BrainPanel): string {
  if (p.render === 'tags') {
    if (p.tags?.mode === 'generated') {
      return 'Return the labels + which fit (one or more):\n\n{ "tags": ["Curious", "Worried"], "active": ["Worried"] }';
    }
    return 'Return the label(s) that fit (one or more):\n\n{ "active": ["Worried"] }';
  }
  if (p.render === 'fields') {
    const keys = (p.fields?.keys ?? []).filter(Boolean);
    if (p.fields?.mode !== 'generated' && keys.length) {
      return `Return a value for each field:\n\n{ ${keys.map(k => `"${k}": "…"`).join(', ')} }`;
    }
    return 'Return the fields you find:\n\n{ "Stage": "perimenopause", "Top need": "Sleep" }';
  }
  return returnsFor(p.render);
}

/** Build the ready-to-paste "return this" snippet, filled with the panel's
 *  own predefined labels/keys when it has them. */
function buildSnippet(p: BrainPanel): string {
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

export function LiveBrainScreen() {
  const { doc, updateAgent, previewConversationId, liveBrainSnapshot } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const slug = agent?.slug;
  const mentionOptions = useMentionOptions(agent?.id ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Live values + runs for the builder's preview conversation. The
  // creator authors on the left and watches panels compute LIVE (from the
  // User Chat on the right) — values arrive on the chat stream
  // (`brain.snapshot` → context), the run logs are pulled alongside.
  const [liveValues, setLiveValues] = useState<Record<string, LiveBrainPanelEntry>>({});
  const [runSnapshots, setRunSnapshots] = useState<AddonRunSnapshot[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const ownerUserId = (typeof localStorage !== 'undefined' && localStorage.getItem('builder:ownerUserId')) || 'anon';

  // Group runs by the panel they belong to, so each panel shows its own log.
  const runsByPanel = useMemo(() => {
    const map: Record<string, AddonRunSnapshot[]> = {};
    for (const r of runSnapshots) { (map[r.instanceId] ??= []).push(r); }
    return map;
  }, [runSnapshots]);

  const loadRuns = useCallback(async () => {
    if (!slug || !previewConversationId) return;
    try {
      const res = await fetchLiveBrainRuns({ agentSlug: slug, conversationId: previewConversationId });
      setRunSnapshots((res?.runs || []).map(runToSnapshot));
    } catch { /* best-effort — keep the last logs */ }
  }, [slug, previewConversationId]);

  // Initial hydration: opening an existing conversation pulls its stored
  // values + runs ONCE (past turns didn't stream to this screen). New
  // turns then update everything live via the snapshot effect below.
  useEffect(() => {
    let cancelled = false;
    if (!slug || !previewConversationId) { setLiveValues({}); setRunSnapshots([]); return; }
    (async () => {
      try {
        const [brainRes, runsRes] = await Promise.all([
          fetchLiveBrain({ agentSlug: slug, conversationId: previewConversationId, ownerUserId, version: 'viewing' }),
          fetchLiveBrainRuns({ agentSlug: slug, conversationId: previewConversationId }),
        ]);
        if (cancelled) return;
        setLiveValues(panelListToMap(brainRes?.panels || []));
        setRunSnapshots((runsRes?.runs || []).map(runToSnapshot));
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [slug, previewConversationId, ownerUserId]);

  // Live: each turn's `brain.snapshot` swaps the values instantly (no
  // refetch); the persisted run logs are pulled on the same beat.
  useEffect(() => {
    if (!liveBrainSnapshot) return;
    setLiveValues(panelListToMap(liveBrainSnapshot.panels));
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveBrainSnapshot]);

  if (!agent) return <div className={styles.screen}>No agent loaded.</div>;

  const liveBrain = agent.liveBrain;
  const panels = (liveBrain?.panels ?? []).map(normalizePanel);
  const editing = panels.find(p => p.id === editingId) ?? null;
  const writePanels = (next: BrainPanel[]) =>
    updateAgent(agent.id, { liveBrain: { ...(liveBrain ?? {}), panels: next } });
  const patchPanel = (id: string, patch: Partial<BrainPanel>) =>
    writePanels(panels.map(p => (p.id === id ? { ...p, ...patch } : p)));
  const patchTags = (patch: Partial<NonNullable<BrainPanel['tags']>>) =>
    editing && patchPanel(editing.id, { tags: { mode: 'predefined', labels: [], ...(editing.tags ?? {}), ...patch } });
  const patchFields = (patch: Partial<NonNullable<BrainPanel['fields']>>) =>
    editing && patchPanel(editing.id, { fields: { mode: 'predefined', keys: [], ...(editing.fields ?? {}), ...patch } });

  const addPanel = () => {
    const p: BrainPanel = { id: newPanelId(), title: '🧠 New panel', render: 'text', source: { kind: 'text', text: '' } };
    writePanels([...panels, p]);
    setEditingId(p.id);
  };
  const deletePanel = async (id: string) => {
    const ok = await confirm({ title: 'Delete panel?', message: 'This removes the panel from the Live Brain.', confirmLabel: 'Delete', danger: true });
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

  // Remember the config for the source kind you're leaving, so toggling
  // Text ↔ AI prompt and back doesn't wipe what you typed. Keyed by panel
  // id; survives re-renders (a ref, not state — it's a scratch cache).
  const sourceStash = useRef<Record<string, Partial<Record<PanelSource['kind'], PanelSource>>>>({});
  const setSourceKind = (kind: PanelSource['kind']) => {
    if (!editing || editing.source.kind === kind) return;
    const stash = (sourceStash.current[editing.id] ??= {});
    stash[editing.source.kind] = editing.source; // park what we're leaving
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

  return (
    <div className={styles.screen}>
      <div className={styles.grid}>
        {/* ── panel chips (title lives here so the preview can start at
             the very top, like the real chat drawer) ── */}
        <aside className={styles.chain}>
          <div className={styles.head}>
            <h1 className={styles.h1}>🧠 Live Brain</h1>
            <p className={styles.sub}>The customer-facing brain — shown beside the chat. Applies to every crew.</p>
          </div>
          <div className={styles.listHead}>Panels</div>
          {panels.map((p, i) => (
            <div key={p.id} className={styles.chip} onClick={() => setEditingId(p.id)} role="button" tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter') setEditingId(p.id); }}>
              <span className={styles.chipBadge}>{p.source.kind === 'text' ? '📝' : '🤖'}</span>
              <div className={styles.chipMain}>
                <span className={styles.chipTitle}>{p.title || 'Untitled'}</span>
                <span className={styles.chipSummary}>{panelSummary(p)}</span>
              </div>
              <span className={styles.chipMove}>
                <button title="Move up" onClick={e => { e.stopPropagation(); move(p.id, -1); }} disabled={i === 0}>▲</button>
                <button title="Move down" onClick={e => { e.stopPropagation(); move(p.id, 1); }} disabled={i === panels.length - 1}>▼</button>
              </span>
            </div>
          ))}
          <button className={styles.addChip} onClick={addPanel}>+ Add panel</button>
        </aside>

        {/* ── preview (client width); each panel carries its own run log ── */}
        <section className={styles.preview}>
          <div className={styles.deviceFrame}>
            <LiveBrainPreview
              panels={panels}
              selectedId={editingId ?? undefined}
              liveValues={liveValues}
              runsByPanel={runsByPanel}
              showLogs={showLogs}
              headerAccessory={
                <>
                  <button
                    type="button"
                    className={styles.logToggle}
                    onClick={() => setSheetOpen(true)}
                    title="Open the full Live Brain overlay — exactly how the customer sees it"
                  >⛶ Open</button>
                  <button
                    type="button"
                    className={`${styles.logToggle} ${showLogs ? styles.logToggleOn : ''}`}
                    onClick={() => setShowLogs(s => !s)}
                    title={showLogs ? 'Hide the run logs (clean customer view)' : 'Show each panel’s run log'}
                  >🔍 Logs</button>
                </>
              }
            />
          </div>
        </section>
      </div>

      {/* ── panel config modal (addon-modal styling) ── */}
      {editing && (
        <Modal
          open
          onClose={() => setEditingId(null)}
          width={640}
          title={editing.title || 'Panel'}
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
              {/* Filter — belongs to the panel (addon), shown for BOTH Text
                  and AI. Same top launcher as the addon modal. */}
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
                  onChange={e => patchPanel(editing.id, { title: e.target.value })} placeholder="🧠 Panel title" />
              </InlineField>

              <InlineField label="Show as" hint="How this panel is drawn on the customer brain.">
                <select className={styles.inputFull} value={editing.render}
                  onChange={e => patchPanel(editing.id, { render: e.target.value as PanelRender })}>
                  {RENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
                </select>
              </InlineField>

              {/* Tags: predefined labels (author sets, AI picks active) or generated. */}
              {editing.render === 'tags' && (
                <InlineField label="Labels" hint="Predefined: you set them, the AI picks which is active. Generated: the AI invents them.">
                  <div className={styles.seg2} role="tablist" aria-label="Tag mode">
                    <button role="tab" aria-selected={editing.tags?.mode === 'predefined'} onClick={() => patchTags({ mode: 'predefined' })}>Predefined</button>
                    <button role="tab" aria-selected={editing.tags?.mode !== 'predefined'} onClick={() => patchTags({ mode: 'generated' })}>Generated</button>
                  </div>
                  {editing.tags?.mode === 'predefined' && (
                    <div className={styles.nested}>
                      <TagInput
                        items={editing.tags?.labels ?? []}
                        onChange={labels => patchTags({ labels })}
                        placeholder="Type a label, press Enter"
                      />
                      <span className={styles.nestedHint}>These labels always show; the AI just highlights whichever fits (e.g. Curious, Worried, Ready).</span>
                    </div>
                  )}
                </InlineField>
              )}

              {/* Fields: predefined keys (author sets, AI fills values) or generated. */}
              {editing.render === 'fields' && (
                <InlineField label="Keys" hint="Predefined: you set the keys, the AI fills each value. Generated: the AI invents the keys too.">
                  <div className={styles.seg2} role="tablist" aria-label="Field mode">
                    <button role="tab" aria-selected={editing.fields?.mode === 'predefined'} onClick={() => patchFields({ mode: 'predefined' })}>Predefined</button>
                    <button role="tab" aria-selected={editing.fields?.mode !== 'predefined'} onClick={() => patchFields({ mode: 'generated' })}>Generated</button>
                  </div>
                  {editing.fields?.mode !== 'generated' && (
                    <div className={styles.nested}>
                      <TagInput
                        items={editing.fields?.keys ?? []}
                        onChange={keys => patchFields({ keys })}
                        placeholder="Type a key, press Enter"
                      />
                      <span className={styles.nestedHint}>These rows always show; the AI fills a value for each (e.g. Stage, Top need).</span>
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
                    storageKey={`livebrain:${editing.id}:text`}
                  />
                  <span className={styles.sectionHint}>Write anything; type <kbd>/</kbd> to drop in a live value like a field or memory.</span>
                </div>
              ) : (
                <>
                  <InlineField label="Model" hint="LLM used for this panel's run.">
                    <ModelPicker value={editing.source.model} onChange={model => patchPrompt({ model })} />
                  </InlineField>

                  <div className={styles.section}>
                    {/* Header row: label on the left, a compact "what to
                        return" affordance on the right — inline with the
                        label instead of a bulky card below the prompt. */}
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
                      placeholder="Read the conversation and produce this panel's content…"
                      rows={5}
                      storageKey={`livebrain:${editing.id}:prompt`}
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

      {/* ── filter modal (controlled FilterEditor, addon look) ── */}
      {editing && filterOpen && (
        <Modal open onClose={() => setFilterOpen(false)} width={720} title="Filter"
          badge={editing.title || 'Panel'}
          footer={<><span className={addon.spacer} /><button type="button" className={addon.primaryBtn} onClick={() => setFilterOpen(false)}>Done</button></>}
        >
          <div className={addon.body}>
            <FilterEditor
              agentId={agent.id}
              crewId={null}
              filter={panelFilter}
              onChange={filter => patchPanel(editing.id, { filter })}
              verb="render" verbs="renders"
              skippedSentence="When skipped, the panel is hidden this turn."
              emptyMessage="No conditions — the panel always shows."
            />
          </div>
        </Modal>
      )}

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

      {/* ── NEW: full-screen Noa-styled overlay (opens on top of the page) ── */}
      <LiveBrainSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        panels={buildDisplayPanels(panels, liveValues)}
      />
    </div>
  );
}
