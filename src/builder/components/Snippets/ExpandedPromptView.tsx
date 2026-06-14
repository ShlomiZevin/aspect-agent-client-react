/**
 * ExpandedPromptView — read-only inline render of a prompt with
 * `{{snippet:NAME}}` tokens replaced by styled blocks.
 *
 * Drop-in replacement for a `<MentionTextarea>` when the host's
 * snippet-expand toggle is on. The author SEES the prompt the way the
 * runtime sees it — prose with snippet content inlined and the filter
 * shown as a short summary on each block. Clicking a block opens the
 * SnippetModal so content and filter can be edited there (the inline
 * view itself is never editable — by design, so the author always
 * knows that typing happens in source mode and snippet edits happen in
 * the modal).
 *
 * The companion `ExpandPromptToggle` lives next to the prompt label
 * and controls the parent's `expanded` state; this component is just
 * the rendered view.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { SnippetModal } from './SnippetModal';
import { conditionLine } from '../Filter/filterFormat';
import type { AddonFilter, ID, SnippetDef } from '../../types';
import styles from './ExpandedPromptView.module.css';

interface Props {
  agentId: ID;
  /** Current prompt text — `{{snippet:NAME}}` tokens are expanded. */
  text: string;
  /** Pass the same `rows` value the sibling MentionTextarea uses so
   *  the expanded view occupies the same vertical space and toggling
   *  doesn't shift the surrounding layout. The pixel height is
   *  derived from MentionTextarea's actual metrics (line-height 1.55,
   *  font-size 12.5px, padding 10px) so the two views are
   *  pixel-comparable. Defaults to 10 rows when omitted. */
  rows?: number;
  /** When provided, the saved drag-resized height under this key
   *  (written by MentionTextarea) overrides the rows-based default.
   *  Pass the SAME key the sibling MentionTextarea uses so the
   *  expanded view honours the author's last resize. */
  storageKey?: string;
}

/** Mirrors MentionTextarea's CSS metrics so the expanded view's
 *  height matches the textarea it replaces. Edit alongside
 *  `MentionTextarea.module.css` if those numbers change. */
const TEXTAREA_FONT_SIZE  = 12.5;     // .textarea font-size
const TEXTAREA_LINE_RATIO = 1.55;     // .textarea line-height
const TEXTAREA_V_PADDING  = 20;       // 10px top + 10px bottom
const TEXTAREA_BORDER     = 2;        // 1px top + 1px bottom
const TEXTAREA_MIN_HEIGHT = 110;      // .textarea min-height

/** Same prefix MentionTextarea uses to persist drag-resized heights. */
const MTA_HEIGHT_KEY_PREFIX = 'mta:height:';

function computeHeight(rows: number | undefined, storageKey: string | undefined): number {
  if (storageKey) {
    try {
      const raw = localStorage.getItem(`${MTA_HEIGHT_KEY_PREFIX}${storageKey}`);
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    } catch {
      /* private mode / quota — fall through to rows-based default */
    }
  }
  const r = rows && rows > 0 ? rows : 10;
  const px = Math.round(r * TEXTAREA_FONT_SIZE * TEXTAREA_LINE_RATIO)
    + TEXTAREA_V_PADDING + TEXTAREA_BORDER;
  return Math.max(TEXTAREA_MIN_HEIGHT, px);
}

type Segment =
  | { kind: 'prose';   text: string }
  | { kind: 'snippet'; name: string };

function segmentPrompt(text: string): Segment[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const re = /\{\{snippet:([a-z][a-z0-9_]*)\}\}/g;
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ kind: 'prose', text: text.slice(last, m.index) });
    }
    out.push({ kind: 'snippet', name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'prose', text: text.slice(last) });
  return out;
}

function snippetFilterShort(filter: AddonFilter | undefined): string {
  if (!filter || !Array.isArray(filter.conditions) || filter.conditions.length === 0) {
    return 'No filter — always renders';
  }
  const verb = filter.mode === 'exclude' ? 'Skip when' : 'Render when';
  const first = conditionLine(filter.conditions[0]);
  if (filter.conditions.length === 1) return `${verb} ${first}`;
  const extra = filter.conditions.length - 1;
  return `${verb} ${first} (+${extra} more)`;
}

export function ExpandedPromptView({ agentId, text, rows, storageKey }: Props) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  const byName = useMemo(() => {
    const map = new Map<string, SnippetDef>();
    for (const s of agent?.snippets ?? []) map.set(s.name, s);
    return map;
  }, [agent?.snippets]);

  const segments = useMemo(() => segmentPrompt(text), [text]);
  const [editing, setEditing] = useState<SnippetDef | null>(null);

  // Lock the surface to the textarea's height so toggling doesn't
  // jolt the surrounding layout. Computed once per mount — toggling
  // out and back in re-reads any newly-saved drag height.
  const height = useMemo(
    () => computeHeight(rows, storageKey),
    [rows, storageKey],
  );

  return (
    <div
      className={styles.surface}
      style={{ height }}
      role="region"
      aria-label="Prompt with snippets expanded (read-only)"
    >
      <div className={styles.banner}>
        <span className={styles.bannerIcon} aria-hidden>👁</span>
        <span>Inline view — read-only. Click a snippet to edit it; switch back to source to type.</span>
      </div>
      <div className={styles.body}>
        {segments.length === 0 ? (
          <span className={styles.emptyHint}>(prompt is empty)</span>
        ) : (
          segments.map((seg, i) => {
            if (seg.kind === 'prose') {
              if (seg.text.length === 0) return null;
              return (
                <span key={i} className={styles.prose}>
                  {seg.text}
                </span>
              );
            }
            const snip = byName.get(seg.name);
            if (!snip) {
              return (
                <span
                  key={i}
                  className={`${styles.block} ${styles.blockMissing}`}
                  title={`No snippet named "${seg.name}" exists on this agent.`}
                >
                  <span className={styles.blockHeader}>
                    <span className={styles.blockSigil}>+</span>
                    <span className={styles.blockName}>{seg.name}</span>
                    <span className={styles.blockFilter}>missing — resolves to empty</span>
                  </span>
                </span>
              );
            }
            const gated = !!snip.filter
              && Array.isArray(snip.filter.conditions)
              && snip.filter.conditions.length > 0;
            return (
              <button
                key={i}
                type="button"
                className={`${styles.block} ${gated ? styles.blockGated : styles.blockOpen}`}
                onClick={() => setEditing(snip)}
                title="Click to edit this snippet"
              >
                <span className={styles.blockHeader}>
                  <span className={styles.blockSigil}>+</span>
                  <span className={styles.blockName}>
                    {snip.name}
                    {snip.displayName && (
                      <span className={styles.blockDisplayName}> · {snip.displayName}</span>
                    )}
                  </span>
                  <span className={styles.blockFilter}>{snippetFilterShort(snip.filter)}</span>
                  <span className={styles.blockEditHint}>edit ↗</span>
                </span>
                <span className={styles.blockBody}>
                  {snip.content || <span className={styles.blockEmpty}>(empty)</span>}
                </span>
              </button>
            );
          })
        )}
      </div>

      <SnippetModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        agentId={agentId}
        initial={editing}
      />
    </div>
  );
}
