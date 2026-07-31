/**
 * AddonRunCard — one addon's run, live or historical. Same shape
 * either way:
 *   - status: running | success | error
 *   - prompt (assembled), raw output, memory writes (with parse
 *     errors collapsed into the same section)
 *   - expandable to show details
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { getPlugin } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { KbRetrieverRunBody, type KbParsed } from './KbRetrieverRunBody';
import styles from './AddonRunCard.module.css';

const KB_RETRIEVER_PLUGIN_ID = 'kb-retriever';

// Live Brain / Profiler panels are internal plugins (no client descriptor),
// so give them a family accent + fallback icon here instead of the ugly "?".
const PANEL_FAMILY: Record<string, { accent: string; icon: string }> = {
  'live-brain-panel': { accent: '#E0198A', icon: '🧠' },
  'profiler-panel':   { accent: '#7C3AED', icon: '👤' },
};

/** Split a leading emoji off a label so it can be the card's icon tile
 *  (and not repeated in the name). */
function splitLabelEmoji(label?: string): { emoji?: string; rest: string } {
  const s = (label ?? '').trim();
  try {
    const m = s.match(/^([\p{Extended_Pictographic}‍️]+)\s*(.*)$/u);
    if (m) return { emoji: m[1], rest: m[2] || '' };
  } catch { /* older engine */ }
  return { rest: s };
}

export interface AddonRunSnapshot {
  instanceId: string;
  pluginId: string;
  label?: string;
  /** Lane this addon ran in. `'main'` (blocking), `'background'`, or
   *  `'offline'`. Drives the "offline" badge on the card so the user
   *  can tell at a glance that the run happened after the user-facing
   *  response streamed. Filled from addon.start / addon.output events
   *  (the server includes `lane` in both). */
  lane?: string;
  /** Human-readable provider + model name pair. Resolved server-side
   *  from the addon's config against services/models.service.js so
   *  the card can render them directly. Null when the addon has no
   *  model (Transition Router) or the configured modelId isn't in
   *  the registry. */
  modelLabel?: { providerName: string; modelName: string } | null;
  status: 'running' | 'success' | 'error' | 'skipped';
  /** When `status === 'skipped'`: discriminated union describing
   *  why this turn was skipped. Two kinds today:
   *   - `kind: 'cap'` — the addon hit its per-conversation cap;
   *     `cap` and `seen` describe the count. No mode, no eval list.
   *   - `kind: 'conditions'` — the configured conditions didn't
   *     pass the polarity check; `mode` + `evaluations` describe
   *     which conditions failed.
   *  Legacy rows (before the discriminator) may carry just `mode`
   *  + `evaluations`; the card treats that as the `'conditions'`
   *  kind for compat. */
  filter?:
    | { kind: 'cap'; cap: number; seen: number }
    | {
        kind?: 'conditions';
        mode: 'include' | 'exclude';
        evaluations: Array<{ type: string; ok: boolean; why: string }>;
      };
  skipReason?: string;
  prompt?: string;
  rawOutput?: string;
  parsedOutput?: unknown;
  memoryWrites?: Array<{ domain: string | null; field: string; value: unknown }>;
  parseError?: string;
  /** How many raw messages reached the LLM as history on this run.
   *  Filled from the `addon.prompt` event (live) or the persisted
   *  `addon_runs.run_data` (historical). Rendered as a header pill
   *  so the user can see at a glance whether the addon got any
   *  prior conversation context. */
  historyCount?: number;
  /** Resolution record from the server. Lets the card explain WHY
   *  the count is what it is — especially useful when the
   *  `since_summarizer` / `since_transition` mode falls back to
   *  `all` (the prompt is suddenly the whole conversation, and the
   *  author should see why). */
  historyMode?: {
    requestedMode: string;
    effectiveMode: string;
    fallbackReason?: string;
    count: number;
  };
  /** Set by the Transition Router when conditions matched and the engine wrote a new currentCrewId. */
  transition?: { to: string; reason?: string };
  /** Set by the Transition Router with onMatch:'break' — engine skipped the rest of the chain. */
  broke?: boolean;
  durationMs?: number;
  /** Time-to-first-token for streaming plugins (Talker). Perceived latency. */
  firstTokenMs?: number;
  error?: { code: string; message: string };
}

interface Props {
  run: AddonRunSnapshot;
}

function formatDomain(domain: string | null): string {
  return domain && domain.trim() ? domain : 'general';
}

/**
 * Memory-writes list, grouped by domain. Each domain renders as one
 * subheader followed by its `field = value` rows — the domain shows
 * once at the top of its group instead of being repeated on every row.
 */
function WritesByDomain({
  writes,
}: {
  writes: Array<{ domain: string | null; field: string; value: unknown }>;
}) {
  // Preserve write order within a group while grouping by domain.
  // Map's insertion order gives us the order each domain first appeared,
  // which keeps the visual flow stable across renders.
  const groups = new Map<string, typeof writes>();
  for (const w of writes) {
    const key = formatDomain(w.domain);
    const list = groups.get(key);
    if (list) list.push(w);
    else groups.set(key, [w]);
  }

  return (
    <div className={styles.writesGroups}>
      {Array.from(groups.entries()).map(([domain, list]) => (
        <div key={domain} className={styles.writesGroup}>
          <div className={styles.writesGroupHeader}>{domain}</div>
          <ul className={styles.writesList}>
            {list.map((w, i) => (
              <WriteRow key={i} field={w.field} value={w.value} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function WriteRow({ field, value }: { field: string; value: unknown }) {
  return (
    <li className={styles.writesItem}>
      <span className={styles.writesItemHead}>
        <span className={styles.writeField}>{field}</span>
        <span className={styles.writeEq}>=</span>
      </span>
      <WriteValue value={value} />
    </li>
  );
}

/**
 * One memory write's value cell. Short scalars render as plain inline
 * text. Potentially long values render in a clamped <pre> and we
 * measure whether the clamp actually hid anything before showing the
 * Show more / Show less toggle — a 130-char string that wraps into 3
 * lines won't get a toggle because nothing is hidden.
 */
function WriteValue({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const preRef = useRef<HTMLPreElement | null>(null);

  let display: string;
  let candidateLong = false;
  if (value === null || value === undefined) {
    display = '—';
  } else if (typeof value === 'string') {
    display = value;
    candidateLong = display.includes('\n') || display.length >= 60;
  } else {
    display = JSON.stringify(value, null, 2);
    candidateLong = true;
  }

  // Measure actual overflow against the clamped pre so the toggle
  // only appears when content is really hidden. Re-runs whenever the
  // text changes; recomputes after expand→collapse so the toggle
  // stays correct if the user toggles repeatedly.
  useLayoutEffect(() => {
    if (!candidateLong || expanded) return;
    const el = preRef.current;
    if (!el) return;
    // 1px slack — sub-pixel rounding can otherwise lie about overflow.
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [display, candidateLong, expanded]);

  if (!candidateLong) {
    return <span className={styles.writeValue}>{display}</span>;
  }

  return (
    <span className={styles.writeValueLong}>
      <pre
        ref={preRef}
        className={`${styles.writeValuePre} ${expanded ? styles.writeValuePreExpanded : styles.writeValuePreClamped}`}
      >
        {display}
      </pre>
      {overflows && (
        <button
          type="button"
          className={styles.writeValueToggle}
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </span>
  );
}

/**
 * Tooltip for the history-count pill. Spells out the requested mode
 * AND the effective mode when they differ — that's the exact case
 * where the author needs the explanation ("I asked for
 * `since_summarizer:main` but I'm seeing the whole conversation —
 * why?"). We pluralise the count too because "1 msgs" reads worse
 * than spending one line on this helper.
 */
function formatHistoryTitle(
  mode: AddonRunSnapshot['historyMode'],
  count: number,
): string {
  const msgs = `${count} ${count === 1 ? 'message' : 'messages'} sent as history`;
  if (!mode) return msgs;
  const requested = describeHistoryMode(mode.requestedMode, mode);
  if (mode.effectiveMode === mode.requestedMode) {
    return `${msgs}\n\nMode: ${requested}`;
  }
  const effective = describeHistoryMode(mode.effectiveMode, mode);
  return `${msgs}\n\nRequested: ${requested}\nEffective: ${effective}${mode.fallbackReason ? `\nReason: ${mode.fallbackReason}` : ''}`;
}

/**
 * Render one history-mode value (requested or effective) into a
 * short human label. Keeps the `since_summarizer` name attached so
 * the tooltip is self-explanatory.
 */
function describeHistoryMode(
  modeName: string,
  ctx?: AddonRunSnapshot['historyMode'],
): string {
  switch (modeName) {
    case 'none':              return 'No history';
    case 'all':               return 'Full conversation';
    case 'full':              return 'Full conversation';
    case 'last_n':            return 'Last N messages';
    case 'since_transition':  return 'Since last crew transition';
    case 'since_summarizer': {
      const m = (ctx?.requestedMode === 'since_summarizer'
        ? (ctx as { summarizerName?: string }).summarizerName
        : undefined);
      return m ? `Since summarizer "${m}"` : 'Since summarizer';
    }
    default: return modeName;
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AddonRunCard({ run }: Props) {
  const [open, setOpen] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const [outputCopied, setOutputCopied] = useState(false);
  const desc = getPlugin(run.pluginId);
  const family = PANEL_FAMILY[run.pluginId];
  const accent = desc?.color || family?.accent || '#6366f1';
  // Name + icon: prefer the descriptor; for panels, pull the emoji out of
  // the label as the icon and show the rest as the name.
  const rawName = (run.label && run.label !== run.pluginId) ? run.label : (desc?.name || run.pluginId);
  const { emoji: labelEmoji, rest: labelRest } = splitLabelEmoji(rawName);
  const icon = desc?.icon || labelEmoji || family?.icon || '•';
  const displayName = labelEmoji ? (labelRest || rawName) : rawName;

  // Look up the target crew's display name from the in-memory project
  // doc. Used by the Transition section so users see "Profiler" not
  // "crew_ztrpglm". Falls back to the raw id when the crew isn't in
  // the doc (e.g. it was deleted).
  const { doc } = useBuilder();
  const crewNameById = (crewId: string): string => {
    for (const a of doc.agents) {
      const c = a.crews.find(cr => cr.id === crewId);
      if (c) return c.name;
    }
    return crewId;
  };

  // Drop control entries from the rendered list. The Field Interviewer
  // and Thinker emit a `{ kind: 'thinking', replace: true }` sentinel
  // that tells the persistence layer to wipe the thinking bucket
  // before applying the rest — it has no field/value of its own and
  // would render as a blank `INTERVIEW = —` row if left in.
  const writes = (run.memoryWrites ?? []).filter(w => {
    const anyW = w as { field?: string; replace?: boolean };
    return !anyW.replace && typeof anyW.field === 'string' && anyW.field.length > 0;
  });
  // KB Retriever renders its own step-by-step body (decide → rewrite →
  // search → write) instead of the generic Prompt/Output/Memory sections,
  // which don't fit a multi-step retrieval addon. Falls back to the
  // generic layout if the structured payload is missing (old runs).
  const isKb = run.pluginId === KB_RETRIEVER_PLUGIN_ID;
  const kbParsed = isKb && run.parsedOutput && typeof run.parsedOutput === 'object'
    && Array.isArray((run.parsedOutput as { steps?: unknown }).steps)
    ? (run.parsedOutput as KbParsed)
    : null;

  const hasWrites = writes.length > 0;
  const hasParseError = !!run.parseError;
  const showMemorySection = !kbParsed && (hasWrites || hasParseError);
  const hasTransition = !!run.transition;
  // Plugins that don't have a prompt template (Transition Router) still
  // emit an empty prompt via the engine — drop the section when empty.
  const hasPrompt = typeof run.prompt === 'string' && run.prompt.trim() !== '';

  const onCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!run.prompt) return;
    const ok = await copyToClipboard(run.prompt);
    if (ok) {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 1200);
    }
  };

  const onCopyOutput = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!run.rawOutput) return;
    const ok = await copyToClipboard(run.rawOutput);
    if (ok) {
      setOutputCopied(true);
      setTimeout(() => setOutputCopied(false), 1200);
    }
  };

  return (
    <div className={styles.card} style={{ ['--accent' as string]: accent }}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
        <span className={styles.icon} style={{ background: `${accent}22`, color: accent }}>
          {icon}
        </span>
        {/* Name: descriptor name for known plugins; for panels, the label
            with its leading emoji lifted into the icon tile above. */}
        <span className={styles.name}>{displayName}</span>
        {/* Offline-lane runs happen AFTER the user-facing reply
            streams, so the user-visible answer is unaffected by their
            output. Surface a small badge so the reader knows this
            card sits in the "post-reply" phase of the turn. */}
        {run.lane === 'offline' && (
          <span
            className={styles.laneBadge}
            title="Ran on the offline lane — after the user-facing reply streamed. Output affects FUTURE turns via memory writes."
          >
            offline
          </span>
        )}
        {/* History count — "5 msgs" pill so the author can see at a
            glance how much prior conversation the addon got, without
            opening the card. A 0-count run is meaningful too (None,
            or a since_X mode that filtered everything out), so we
            always show the pill when historyCount is known. */}
        {typeof run.historyCount === 'number' && (
          <span
            className={styles.historyPill}
            title={formatHistoryTitle(run.historyMode, run.historyCount)}
          >
            {run.historyCount} msg{run.historyCount === 1 ? '' : 's'}
          </span>
        )}
        <span
          className={`${styles.status} ${styles[`status_${run.status}`]}`}
          title={run.status === 'skipped' ? (run.skipReason ?? 'Skipped by filter') : undefined}
        >
          {run.status === 'running' ? '… running'
            : run.status === 'error'   ? 'error'
            : run.status === 'skipped' ? 'skipped'
            : 'done'}
        </span>
        {typeof run.durationMs === 'number' && run.status !== 'running' && (
          // Streaming plugins (Talker) get a two-number display:
          // "starts in Xms · full Yms" — TTFT is what the user actually
          // perceives; TTLT is the full compute cost. Non-streaming
          // plugins (Field Extractor, Transition Router) just show one.
          typeof run.firstTokenMs === 'number' ? (
            <span
              className={styles.duration}
              title={`First token at ${run.firstTokenMs}ms · stream ended at ${run.durationMs}ms`}
            >
              {run.firstTokenMs}ms <span className={styles.durationFull}>· {run.durationMs}ms</span>
            </span>
          ) : (
            <span className={styles.duration}>{run.durationMs}ms</span>
          )
        )}
      </button>

      {open && (
        <div className={styles.body}>
          {/* Hide the model line when the addon was skipped — no LLM
              call happened, so showing the configured model is
              misleading (it implies "this is what ran"). The model
              still lives on the snapshot for inspect/replay purposes,
              it just doesn't earn a header row on skipped cards. */}
          {run.modelLabel && run.status !== 'skipped' && (
            <div className={styles.modelLine}>
              <span className={styles.modelProvider}>{run.modelLabel.providerName}</span>
              <span className={styles.modelDot}>·</span>
              <span>{run.modelLabel.modelName}</span>
            </div>
          )}

          {/* KB Retriever's own step-by-step body. Replaces the generic
              prompt/output/memory sections below (suppressed via
              `kbParsed`). */}
          {kbParsed && <KbRetrieverRunBody parsed={kbParsed} />}

          {/* Skipped state — no LLM call happened, so no prompt / no
              output. Two kinds of skips render differently:

                - cap         → single tight line, no eval list, no
                                "(mode)" subtitle (caps don't have a
                                polarity).
                - conditions  → "Skipped by filter (mode)" header +
                                reason + per-condition evaluation
                                list. Useful for multi-condition
                                gates where the failing condition
                                isn't obvious from the reason alone.
            */}
          {run.status === 'skipped' && run.filter && (
            run.filter.kind === 'cap' ? (
              <div className={styles.skippedBlock}>
                <div className={styles.skippedHeader}>Cap reached</div>
                <div className={styles.skippedReason}>
                  {run.skipReason ?? (
                    run.filter.cap === 1
                      ? 'Already ran once this conversation.'
                      : `Ran ${run.filter.seen} of ${run.filter.cap} allowed times.`
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.skippedBlock}>
                <div className={styles.skippedHeader}>
                  Skipped by filter
                  <span className={styles.skippedMode}>({run.filter.mode})</span>
                </div>
                {run.skipReason && (
                  <div className={styles.skippedReason}>{run.skipReason}</div>
                )}
                {run.filter.evaluations.length > 0 && (
                  <ul className={styles.skippedEvals}>
                    {run.filter.evaluations.map((ev, i) => (
                      <li key={i} className={ev.ok ? styles.evalOk : styles.evalFail}>
                        <span className={styles.evalDot}>{ev.ok ? '●' : '○'}</span>
                        <span className={styles.evalWhy}>{ev.why}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          )}

          {/* History resolution line — what mode was asked for vs.
              actually applied, plus the message count. Surfaces the
              "why is this prompt huge?" answer when `since_X` modes
              fall back to `all`. Hidden when the count is unknown
              (older addon_runs rows that pre-date this field). */}
          {!kbParsed && typeof run.historyCount === 'number' && (
            <div className={styles.historyLine}>
              <span className={styles.historyLabel}>History:</span>
              <span className={styles.historyValue}>
                {describeHistoryMode(
                  run.historyMode?.effectiveMode || run.historyMode?.requestedMode || 'unknown',
                  run.historyMode,
                )} → {run.historyCount} {run.historyCount === 1 ? 'message' : 'messages'}
              </span>
              {run.historyMode && run.historyMode.effectiveMode !== run.historyMode.requestedMode && (
                <span className={styles.historyFallback}>
                  fallback from <code>{run.historyMode.requestedMode}</code>
                  {run.historyMode.fallbackReason ? ` — ${run.historyMode.fallbackReason}` : ''}
                </span>
              )}
            </div>
          )}

          {!kbParsed && hasPrompt && (
            <Section
              title="Prompt"
              actions={
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={onCopyPrompt}
                  title="Copy prompt"
                >
                  {promptCopied ? '✓ copied' : 'copy'}
                </button>
              }
            >
              <pre className={styles.pre}>{run.prompt}</pre>
            </Section>
          )}

          {!kbParsed && run.rawOutput !== undefined && run.rawOutput !== '' && (
            <Section
              title="Output"
              actions={
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={onCopyOutput}
                  title="Copy output"
                >
                  {outputCopied ? '✓ copied' : 'copy'}
                </button>
              }
            >
              <pre className={styles.pre}>{run.rawOutput}</pre>
            </Section>
          )}

          {hasTransition && (
            <Section title="Transition">
              <div className={styles.transitionBlock}>
                <div className={styles.transitionLine}>
                  → switching to <code>{crewNameById(run.transition!.to)}</code>
                  {run.broke && <span className={styles.transitionTag}>chain broken</span>}
                </div>
                {run.transition!.reason && (
                  <div className={styles.transitionReason}>{run.transition!.reason}</div>
                )}
              </div>
            </Section>
          )}

          {showMemorySection && (
            <Section title="Memory writes">
              {hasParseError && (
                <div className={styles.memoryError}>
                  ⚠ Couldn't parse JSON: {run.parseError}
                </div>
              )}
              {hasWrites && <WritesByDomain writes={writes} />}
              {!hasWrites && !hasParseError && (
                <div className={styles.memoryNote}>Nothing extracted</div>
              )}
            </Section>
          )}

          {run.error && (
            <Section title="Error">
              <pre className={`${styles.pre} ${styles.preError}`}>
                {run.error.code}: {run.error.message}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>{title}</span>
        {actions}
      </div>
      {children}
    </div>
  );
}
