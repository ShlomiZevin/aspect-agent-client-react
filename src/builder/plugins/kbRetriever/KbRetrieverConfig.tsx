/**
 * KB Retriever — config screen.
 *
 * One-liner rows (InlineField) in the builder's general style. The two
 * CORE axes (When / What) stay compact: a toggle plus, when set to LLM,
 * an "edit ✎" button that opens a focused MODAL for the model + prompt —
 * so the panel never becomes a wall of textareas. History mode shows the
 * message count inline so the connection is obvious.
 *
 * Mirrors Thinker's name/domain split: Name = card label, Writes to =
 * the {{kb:DOMAIN}} slot. See docs/guides/KB_V2_RETRIEVER.md.
 */

import { useEffect, useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import { getAgentKbs, linkKb, type AgentKb } from '../../../services/pineconeService';
import { useSlotRenameCascade } from '../../state/useSlotRenameCascade';
import type { PluginConfigProps } from '../../registry/plugins';
import type { HistoryMode, KbRetrieverConfig, ModelRef } from '../../types';
import styles from './KbRetrieverConfig.module.css';

function Toggle({ value, options, onChange }: {
  value: string; options: [string, string][]; onChange: (v: string) => void;
}) {
  return (
    <div className={styles.toggle}>
      {options.map(([v, label]) => (
        <button key={v} type="button"
          className={`${styles.toggleBtn} ${value === v ? styles.toggleBtnActive : ''}`}
          onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

/** Small "?" with an explanatory tooltip. */
function Help({ text }: { text: string }) {
  return <span className={styles.help} title={text}>?</span>;
}

function modelId(m: ModelRef | undefined): string {
  return (m && (typeof m === 'string' ? m : m.modelId)) || 'configure';
}

// Per-step history — a small subset of HistoryMode (the planner rarely
// needs since_* / transition modes).
function encodeHist(h: HistoryMode | undefined): string {
  if (!h) return 'all';
  if (h.mode === 'none') return 'none';
  if (h.mode === 'last_n') return `last_n:${h.n}`;
  return 'all';
}
function decodeHist(v: string): HistoryMode {
  if (v === 'none') return { mode: 'none' };
  if (v.startsWith('last_n:')) return { mode: 'last_n', n: Number(v.slice(7)) || 5 };
  return { mode: 'all' };
}
function HistorySelect({ value, onChange }: { value: HistoryMode | undefined; onChange: (h: HistoryMode) => void }) {
  return (
    <select className={styles.input} value={encodeHist(value)} onChange={e => onChange(decodeHist(e.target.value))}>
      <option value="none">Current message only</option>
      <option value="last_n:3">Last 3 messages</option>
      <option value="last_n:5">Last 5 messages</option>
      <option value="last_n:10">Last 10 messages</option>
      <option value="all">Full conversation</option>
    </select>
  );
}

/** Live, read-only preview of an LLM step — model + the prompt's first
 *  line. Click to open the modal. Hover for the full prompt. */
function PromptPill({ model, prompt, onClick }: { model: ModelRef; prompt: string; onClick: () => void }) {
  const first = (prompt || '').trim().split('\n')[0];
  const snippet = first.length > 52 ? `${first.slice(0, 52)}…` : first;
  return (
    <button type="button" className={styles.pill} onClick={onClick} title={prompt || '(no prompt set)'}>
      <span className={styles.pillModel}>🤖 {modelId(model)}</span>
      <span className={styles.pillPrompt}>{snippet || '(no prompt)'}</span>
      <span className={styles.pillEdit}>✎</span>
    </button>
  );
}

/** The locked output-format contract. Always appended to the prompt at
 *  runtime, so it's shown here as a fixed, read-only line. Double-click
 *  to unlock for editing — behind a red danger notice, because a broken
 *  contract silently breaks the step's parse (a decider that doesn't
 *  return a clean yes/no, a rewriter that wraps the query in prose). */
function LockedContract({ value, danger, onChange }: {
  value: string; danger: string; onChange: (v: string) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        Output format <span className={styles.lockTag}>{unlocked ? '🔓 unlocked' : '🔒 locked'}</span>
      </span>
      {unlocked ? (
        <>
          <div className={styles.contractDanger}>⚠ {danger}</div>
          <textarea className={styles.input} rows={2} value={value} onChange={e => onChange(e.target.value)} />
          <button type="button" className={styles.relock} onClick={() => setUnlocked(false)}>Re-lock</button>
        </>
      ) : (
        <div className={styles.contractLocked} title="Double-click to edit (advanced)"
          onDoubleClick={() => setUnlocked(true)}>
          {value || '(no format contract)'}
        </div>
      )}
    </div>
  );
}

/** Focused modal for an LLM step (model + full prompt). Reused by both axes. */
function LlmStepModal({ title, hint, model, prompt, history, contract, contractDanger, placeholder, mentionOptions, storageKey, onModel, onPrompt, onHistory, onContract, onClose }: {
  title: string; hint: string; model: ModelRef; prompt: string; history: HistoryMode | undefined; placeholder: string;
  contract: string; contractDanger: string;
  mentionOptions: ReturnType<typeof useMentionOptions>; storageKey: string;
  onModel: (m: ModelRef) => void; onPrompt: (p: string) => void; onHistory: (h: HistoryMode) => void;
  onContract: (c: string) => void; onClose: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>{title}</span>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Done">✕</button>
        </div>
        <p className={styles.modalHint}>{hint}</p>
        <InlineField label="Model" hint="A cheap model is usually plenty for this step.">
          <ModelPicker value={model} onChange={onModel} />
        </InlineField>
        <div className={styles.field}>
          <span className={styles.label}>Prompt</span>
          <MentionTextarea value={prompt} onChange={onPrompt} options={mentionOptions} rows={8}
            placeholder={placeholder} storageKey={storageKey} />
        </div>
        <LockedContract value={contract} danger={contractDanger} onChange={onContract} />
        <InlineField label="History" hint="How much of the conversation this LLM call sees.">
          <HistorySelect value={history} onChange={onHistory} />
        </InlineField>
        <div className={styles.modalFooter}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export function KbRetrieverConfigComponent({ config, onChange, agentId }: PluginConfigProps<KbRetrieverConfig>) {
  const patch = (next: Partial<KbRetrieverConfig>) => onChange({ ...config, ...next });
  const patchTrigger = (next: Partial<KbRetrieverConfig['trigger']>) => patch({ trigger: { ...config.trigger, ...next } });
  const patchQuery = (next: Partial<KbRetrieverConfig['query']>) => patch({ query: { ...config.query, ...next } });
  const mentionOptions = useMentionOptions(agentId);
  const domainRename = useSlotRenameCascade(agentId, 'kbDomain');
  const [editing, setEditing] = useState<null | 'trigger' | 'query'>(null);

  // KBs are scoped to THIS agent (the many-to-many link layer). Default
  // shows only the agent's linked KBs; "Show all" reveals every KB so a
  // shared one can be pulled in — selecting an unlinked KB links it.
  const [kbs, setKbs] = useState<AgentKb[]>([]);
  const [loadingKbs, setLoadingKbs] = useState(true);
  // show-all toggle temporarily hidden — re-add `setShowAll` + the button
  // below to restore the "link a shared KB" affordance.
  const [showAll] = useState(false);
  useEffect(() => {
    let live = true;
    setLoadingKbs(true);
    getAgentKbs(agentId, showAll ? 'all' : 'linked')
      .then(list => { if (live) setKbs(list); })
      .catch(() => { if (live) setKbs([]); })
      .finally(() => { if (live) setLoadingKbs(false); });
    return () => { live = false; };
  }, [agentId, showAll]);

  const selected = config.kbNamespaces ?? [];
  const domain = config.domain || 'knowledge';
  const n = config.query.n ?? 1;
  const toggleKb = (kb: AgentKb) => {
    const isOn = selected.includes(kb.namespace);
    // Selecting a not-yet-linked KB (only reachable in "show all") links
    // it to this agent so it stays visible without "show all" next time.
    if (!isOn && !kb.linked) {
      linkKb(agentId, kb.namespace).catch(() => {});
      setKbs(prev => prev.map(k => k.namespace === kb.namespace ? { ...k, linked: true } : k));
    }
    patch({ kbNamespaces: isOn ? selected.filter(x => x !== kb.namespace) : [...selected, kb.namespace] });
  };

  // Selected KBs live in the agent JSON → show them immediately even
  // before the fetch settles. A selected KB absent from the fetched list
  // (deleted/renamed, or simply not linked) still shows, flagged
  // (vectorCount -1 = missing), so it can be fixed not silently dangle.
  const fetched = new Set(kbs.map(x => x.namespace));
  const kbOptions: AgentKb[] = [
    ...selected.filter(s => !fetched.has(s)).map(namespace =>
      ({ namespace, vectorCount: -1, fileCount: 0, chunkCount: 0, cost: 0, linked: true } as AgentKb)),
    ...kbs,
  ];

  return (
    <div className={styles.wrap}>
      <InlineField label="Name" hint="Shown on the chain card. Leave empty to use the plugin name.">
        <input className={styles.input} value={config.name ?? ''} onChange={e => patch({ name: e.target.value })} placeholder="e.g. Policy lookup (optional)" />
      </InlineField>

      <InlineField label="Writes to" hint={`Inject the result downstream with {{kb:${domain}}}.`}>
        <input className={styles.input} value={config.domain ?? ''} onChange={e => patch({ domain: e.target.value })}
          {...domainRename} placeholder="knowledge" />
      </InlineField>

      <InlineField label="Knowledge bases" hint="Only KBs linked to this agent are shown. “Show all” to link a shared KB. Manage in Admin → Knowledge Base.">
        <div className={styles.chips}>
          {loadingKbs ? (
            <span className={styles.muted}>Loading knowledge bases…</span>
          ) : kbOptions.length === 0 ? (
            <span className={styles.muted}>
              {showAll ? 'No knowledge bases found.' : 'No KBs linked to this agent yet.'}
            </span>
          ) : kbOptions.map(kb => {
            // Only meaningful once loaded — `fetched` is empty mid-load, so
            // we never flag "missing" until the live list has arrived.
            const on = selected.includes(kb.namespace);
            const missing = kb.vectorCount < 0;
            // In "show all", an unlinked KB belongs to another agent —
            // mark it so it reads as "linkable", not already yours.
            const unlinked = !missing && !kb.linked;
            return (
              <button key={kb.namespace} type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ''} ${missing ? styles.chipMissing : ''} ${unlinked ? styles.chipUnlinked : ''}`}
                title={missing ? 'Selected but not found in the index (renamed or deleted).'
                  : unlinked ? 'Not linked to this agent yet — select to link it.' : undefined}
                onClick={() => toggleKb(kb)}>
                {unlinked && <span className={styles.chipLink}>+ </span>}
                {kb.namespace}<span className={styles.chipCount}>{missing ? 'missing' : kb.vectorCount.toLocaleString()}</span>
              </button>
            );
          })}
          {/* Temporarily hidden — restore with `setShowAll` (see useState above).
          {!loadingKbs && (
            <button type="button" className={styles.showAll} onClick={() => setShowAll(v => !v)}>
              {showAll ? 'Show linked only' : 'Show all KBs'}
            </button>
          )} */}
        </div>
      </InlineField>

      {/* ── Core axis 1: When ── */}
      <InlineField label="When to retrieve" hint="Search every turn, or let a cheap LLM decide per turn (skips “hi”, “thanks”).">
        <div className={styles.axis}>
          <Toggle value={config.trigger.mode} options={[['always', 'Every turn'], ['llm', 'LLM decides']]}
            onChange={m => patchTrigger({ mode: m as KbRetrieverConfig['trigger']['mode'] })} />
          {config.trigger.mode === 'llm' && (
            <PromptPill model={config.trigger.model} prompt={config.trigger.prompt} onClick={() => setEditing('trigger')} />
          )}
        </div>
      </InlineField>

      {/* ── Core axis 2: What ── */}
      <InlineField label="What to ask" hint="Use recent messages as-is, or have an LLM rewrite them into a standalone query.">
        <div className={styles.axis}>
          <Toggle value={config.query.mode} options={[['history', 'Recent messages'], ['llm', 'LLM rewrite']]}
            onChange={m => patchQuery({ mode: m as KbRetrieverConfig['query']['mode'] })} />
          {config.query.mode === 'history' ? (
            <span className={styles.inlineNote}>
              using the last
              <input type="number" className={styles.miniNum} min={1} max={20} value={n}
                onChange={e => patchQuery({ n: parseInt(e.target.value) || 1 })} />
              message{n === 1 ? '' : 's'}
            </span>
          ) : (
            <PromptPill model={config.query.model} prompt={config.query.prompt} onClick={() => setEditing('query')} />
          )}
        </div>
      </InlineField>

      {/* ── Retrieval (labelled knobs) ── */}
      <InlineField label="Retrieval" hint="How retrieval is tuned (same as the admin Test panel).">
        <div className={styles.knobRow}>
          <label className={styles.knobField}><span className={styles.knobLabel}>Results</span>
            <input type="number" className={styles.knob} min={1} max={20} value={config.topK}
              onChange={e => patch({ topK: parseInt(e.target.value) || 1 })} /></label>
          <label className={styles.knobField}><span className={styles.knobLabel}>Min score</span>
            <input type="number" className={styles.knob} min={0} max={1} step={0.05} value={config.minScore}
              onChange={e => patch({ minScore: parseFloat(e.target.value) || 0 })} /></label>
          <label className={styles.knobField}><span className={styles.knobLabel}>Max tokens</span>
            <input type="number" className={styles.knob} min={500} max={10000} step={500} value={config.maxTokens}
              onChange={e => patch({ maxTokens: parseInt(e.target.value) || 500 })} /></label>
        </div>
      </InlineField>

      {/* ── Output ── */}
      <InlineField label="Format" hint="How the injected text is shaped.">
        <div className={styles.axis}>
          <Toggle value={config.format} options={[['text', 'Text'], ['structured', 'With scores']]}
            onChange={m => patch({ format: m as KbRetrieverConfig['format'] })} />
          <Help text={'Text:\n### From: contract.pdf\n<chunk text>\n\nWith scores:\n### From: contract.pdf (relevance: 0.82)\n<chunk text>'} />
        </div>
      </InlineField>
      <InlineField label="When nothing is found" hint="Clear shows the message below; Keep last leaves the previous result.">
        <Toggle value={config.onNoRetrieval} options={[['clear', 'Clear'], ['keep', 'Keep last']]}
          onChange={m => patch({ onNoRetrieval: m as KbRetrieverConfig['onNoRetrieval'] })} />
      </InlineField>
      <InlineField label="Empty message" hint={`What {{kb:${domain}}} renders when nothing was retrieved.`}>
        <input className={styles.input} value={config.emptyText ?? ''} onChange={e => patch({ emptyText: e.target.value })}
          placeholder="No relevant information was found in the knowledge base." />
      </InlineField>

      {editing === 'trigger' && (
        <LlmStepModal
          title="When to retrieve — decision step"
          hint="A small LLM call each turn that answers yes/no: should the knowledge base be searched?"
          model={config.trigger.model} prompt={config.trigger.prompt} history={config.trigger.history}
          contract={config.trigger.outputContract ?? ''}
          contractDanger="If the decider doesn't return a clean yes/no, retrieval will misfire. Edit only if you know what you're doing."
          placeholder="Reply yes or no — should the knowledge base be searched for the latest message?"
          mentionOptions={mentionOptions} storageKey={`kb-trigger:${agentId}`}
          onModel={model => patchTrigger({ model })} onPrompt={prompt => patchTrigger({ prompt })}
          onHistory={history => patchTrigger({ history })} onContract={outputContract => patchTrigger({ outputContract })}
          onClose={() => setEditing(null)} />
      )}
      {editing === 'query' && (
        <LlmStepModal
          title="What to ask — query rewrite"
          hint="An LLM call that rewrites the conversation into a single standalone search query."
          model={config.query.model} prompt={config.query.prompt} history={config.query.history}
          contract={config.query.outputContract ?? ''}
          contractDanger="If the rewriter returns anything but the bare query (quotes, preamble), search quality drops. Edit only if you know what you're doing."
          placeholder="Rewrite the conversation into a single standalone search query. Output only the query."
          mentionOptions={mentionOptions} storageKey={`kb-query:${agentId}`}
          onModel={model => patchQuery({ model })} onPrompt={prompt => patchQuery({ prompt })}
          onHistory={history => patchQuery({ history })} onContract={outputContract => patchQuery({ outputContract })}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
