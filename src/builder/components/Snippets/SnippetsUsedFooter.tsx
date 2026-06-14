/**
 * SnippetsUsedFooter — small reveal under a MentionTextarea that lists
 * every `{{snippet:NAME}}` token referenced in the current value and
 * surfaces the snippet's content + filter state on hover. Pill-row
 * only — the expand/collapse toggle lives at the prompt label level
 * (see `ExpandPromptToggle` + `ExpandedPromptView`).
 *
 * Each pill shows the snippet name; hover surfaces a preview and the
 * filter state; click opens the SnippetModal so the author can edit
 * content or filter without leaving the page. Missing names render as
 * a red `(missing)` chip — unresolved tokens have to jump out.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { SnippetModal } from './SnippetModal';
import { conditionLine } from '../Filter/filterFormat';
import type { AddonFilter, ID, SnippetDef } from '../../types';
import styles from './SnippetsUsedFooter.module.css';

interface Props {
  agentId: ID;
  /** Current prompt text — scanned for `{{snippet:NAME}}` tokens. */
  text: string;
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

function extractSnippetRefs(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const re = /\{\{snippet:([a-z][a-z0-9_]*)\}\}/g;
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function SnippetsUsedFooter({ agentId, text }: Props) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const refs = useMemo(() => extractSnippetRefs(text), [text]);

  const byName = useMemo(() => {
    const map = new Map<string, SnippetDef>();
    for (const s of agent?.snippets ?? []) map.set(s.name, s);
    return map;
  }, [agent?.snippets]);

  const [editing, setEditing] = useState<SnippetDef | null>(null);

  if (refs.length === 0) return null;

  return (
    <div className={styles.footer}>
      <span className={styles.label}>Snippets used here ·</span>
      {refs.map(name => {
        const snip = byName.get(name);
        if (!snip) {
          return (
            <span
              key={name}
              className={`${styles.pill} ${styles.pillMissing}`}
              title={`No snippet named "${name}" exists on this agent. The token will resolve to empty.`}
            >
              {name} <span className={styles.pillBadge}>missing</span>
            </span>
          );
        }
        const gated = !!snip.filter
          && Array.isArray(snip.filter.conditions)
          && snip.filter.conditions.length > 0;
        const preview = snip.content
          ? snip.content.slice(0, 200) + (snip.content.length > 200 ? '…' : '')
          : '(empty)';
        const tip = gated
          ? `${snippetFilterShort(snip.filter)}\n\n${preview}`
          : preview;
        return (
          <button
            key={name}
            type="button"
            className={`${styles.pill} ${gated ? styles.pillGated : ''}`}
            onClick={() => setEditing(snip)}
            title={tip}
          >
            {name}
            {gated && <span className={styles.pillBadge}>▽</span>}
          </button>
        );
      })}

      <SnippetModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        agentId={agentId}
        initial={editing}
      />
    </div>
  );
}
