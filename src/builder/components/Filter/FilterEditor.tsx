/**
 * FilterEditor — the shared body for every filter modal in the
 * builder. Today's callers:
 *
 *   - AddonFilterSection (per-addon run filter)
 *   - SnippetFilterModal (per-snippet render filter)
 *
 * The two surfaces have the same shape — `AddonFilter` — and the
 * same three knobs (cap, conditions, polarity). The only differences
 * are word choices: "run / runs" vs "render / renders". Props let
 * each caller tune those without forking the layout.
 *
 * Visual model — three calm rows in a single section, no nested
 * boxes:
 *
 *   1. Cap row — "<Verb> at most [N] times per conversation".
 *      Inline, no card. Empty input = no cap.
 *   2. Conditions header — label · polarity toggle (right-aligned).
 *   3. Conditions list — the shared ConditionsEditor.
 *   4. Trailing hint — narrates what the configured combo does.
 *
 * A thin separator divides cap from conditions so the eye reads them
 * as two distinct axes (the cap is independent of include/exclude).
 */

import { ConditionsEditor } from '../Conditions/ConditionsEditor';
import type { AddonFilter, ID, TransitionCondition } from '../../types';
import styles from './FilterEditor.module.css';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  filter: AddonFilter;
  /** The caller decides whether the filter ever becomes `undefined`
   *  (snippet) or stays as a defined-but-empty shape (addon). We
   *  always emit a non-undefined `AddonFilter`; the caller folds. */
  onChange: (next: AddonFilter) => void;

  /**
   * Verbs woven into the UI copy. Defaults match the addon variant.
   * Snippet callers pass `'render' / 'renders'`.
   */
  verb?:  'run'  | 'render';
  verbs?: 'runs' | 'renders';

  /**
   * Full sentence appended to the hint when the addon/snippet would
   * be skipped. Caller writes a complete sentence (capitalised, ends
   * with a period) so we don't fight grammar joining a noun phrase
   * onto a clause. Example: addon = "Skipped runs show as cards in
   * the chat timeline." snippet = "Skipped renders resolve to empty."
   */
  skippedSentence: string;

  /** Shown by ConditionsEditor when no conditions are configured. */
  emptyMessage?: string;

  /**
   * Whether to surface the cap row. Addon path = true (the server's
   * `runCounts[instanceId]` already tracks per-conversation runs).
   * Snippet path = false today: snippet renders aren't counted
   * server-side yet, so exposing a UI affordance that's silently
   * not enforced would be a footgun. Flip to true once snippet
   * render-count tracking lands in the prompt assembler.
   */
  allowCap?: boolean;
}

export function FilterEditor({
  agentId, crewId, filter, onChange,
  verb = 'run', verbs = 'runs',
  skippedSentence,
  emptyMessage,
  allowCap = true,
}: Props) {
  const setConditions = (conditions: TransitionCondition[]) =>
    onChange({ ...filter, conditions });

  const setMode = (mode: AddonFilter['mode']) =>
    onChange({ ...filter, mode });

  const setCap = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') return onChange({ ...filter, cap: undefined });
    const n = Math.floor(Number(trimmed));
    if (!Number.isFinite(n) || n <= 0) return onChange({ ...filter, cap: undefined });
    onChange({ ...filter, cap: n });
  };

  const cap = typeof filter.cap === 'number' && filter.cap > 0 ? filter.cap : null;
  const hasConditions = filter.conditions.length > 0;

  // Action verb capitalised for in-sentence use (start of caption).
  const Verb = verb[0].toUpperCase() + verb.slice(1);

  return (
    <div className={styles.editor}>
      {/* ── Row 1: cap (only when allowed by the caller) ───────── */}
      {allowCap && (
        <>
          <div className={styles.capRow}>
            <span className={styles.capLabel}>{Verb} at most</span>
            <input
              type="number"
              min={1}
              step={1}
              className={styles.capInput}
              value={cap ?? ''}
              onChange={e => setCap(e.target.value)}
              placeholder="∞"
              aria-label={`Maximum ${verbs} per conversation`}
            />
            <span className={styles.capUnit}>
              {cap === 1 ? 'time per conversation' : 'times per conversation'}
            </span>
            {cap !== null && (
              <button
                type="button"
                className={styles.capClear}
                onClick={() => onChange({ ...filter, cap: undefined })}
                title="Remove the cap"
                aria-label="Clear cap"
              >
                ✕
              </button>
            )}
          </div>

          <div className={styles.separator} aria-hidden />
        </>
      )}

      {/* ── Conditions block (header + list owned by ConditionsEditor) ──
          The polarity toggle slots into ConditionsEditor's header
          row so the toggle + title + +Add all share ONE line. Saves
          two rows of vertical space versus stacking title above
          toggle above +Add. */}
      <ConditionsEditor
        conditions={filter.conditions}
        onChange={setConditions}
        agentId={agentId}
        crewId={crewId ?? ''}
        emptyMessage={emptyMessage ?? `No conditions — only the cap above gates this.`}
        headerSlot={
          <span className={styles.modePill} role="group" aria-label="Filter polarity">
            <button
              type="button"
              className={`${styles.modeBtn} ${filter.mode !== 'exclude' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('include')}
              title={`${Verb} this only when ALL conditions match.`}
            >
              {Verb} when matches
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${filter.mode === 'exclude' ? styles.modeBtnActive : ''}`}
              onClick={() => setMode('exclude')}
              title={`Skip when conditions match; ${verb} when at least one fails.`}
            >
              Skip when matches
            </button>
          </span>
        }
      />

      {/* ── Row 4: trailing hint ───────────────────────────────── */}
      {(hasConditions || (allowCap && cap !== null)) && (
        <p className={styles.hint}>
          {allowCap ? capPhrase(cap, verbs) : ''}
          {allowCap && cap !== null && hasConditions ? ' · ' : ''}
          {conditionsPhrase(hasConditions, filter.mode, verbs)}
          {(hasConditions || (allowCap && cap !== null)) ? ` ${skippedSentence}` : ''}
        </p>
      )}
    </div>
  );
}

/* ─── Hint helpers ──────────────────────────────────────────────── */

function capPhrase(cap: number | null, verbs: string): string {
  if (cap === null) return '';
  if (cap === 1) return `${verbs} once per conversation`;
  return `${verbs} at most ${cap} times per conversation`;
}

function conditionsPhrase(
  hasConditions: boolean,
  mode: AddonFilter['mode'],
  verbs: string,
): string {
  if (!hasConditions) return '';
  return mode === 'exclude'
    ? `${verbs} UNLESS every condition above matches.`
    : `${verbs} ONLY when every condition above matches.`;
}
