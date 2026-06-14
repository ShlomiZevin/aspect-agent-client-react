/**
 * ExpandPromptToggle — small inline button hosts place next to their
 * prompt label.
 *
 * Toggles between source view (the MentionTextarea) and inline view
 * (the ExpandedPromptView, where `{{snippet:NAME}}` tokens are
 * replaced by styled blocks). The toggle auto-hides when the prompt
 * text has no snippet references — nothing to expand, no button
 * needed. The host owns the boolean state and renders either view
 * based on it.
 *
 * Usage:
 *
 *   <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
 *     <label>Voice prompt</label>
 *     <ExpandPromptToggle
 *       text={config.prompt}
 *       expanded={expanded}
 *       onToggle={setExpanded}
 *     />
 *   </div>
 *   {expanded
 *     ? <ExpandedPromptView agentId={agentId} text={config.prompt} />
 *     : <MentionTextarea … />}
 */

import { useEffect, useMemo } from 'react';
import styles from './ExpandPromptToggle.module.css';

interface Props {
  /** Current prompt text — scanned to decide whether the toggle is
   *  worth showing at all. */
  text: string;
  expanded: boolean;
  onToggle: (next: boolean) => void;
}

function hasSnippetRef(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0) return false;
  return /\{\{snippet:[a-z][a-z0-9_]*\}\}/.test(text);
}

export function ExpandPromptToggle({ text, expanded, onToggle }: Props) {
  const hasRefs = useMemo(() => hasSnippetRef(text), [text]);

  // Auto-collapse when the last snippet ref is removed — leaving the
  // host in expanded state with no refs would show only the banner
  // and a wall of prose, which is just the textarea minus editing.
  useEffect(() => {
    if (!hasRefs && expanded) onToggle(false);
  }, [hasRefs, expanded, onToggle]);

  if (!hasRefs) return null;

  return (
    <button
      type="button"
      className={`${styles.toggle} ${expanded ? styles.toggleActive : ''}`}
      onClick={() => onToggle(!expanded)}
      aria-pressed={expanded}
      title={
        expanded
          ? 'Switch back to the source view to edit prompt text.'
          : 'Switch to the inline view — each {{snippet:…}} token is replaced by its content (read-only).'
      }
    >
      <span aria-hidden className={styles.icon}>{expanded ? '▾' : '▸'}</span>
      <span>{expanded ? 'Collapse snippets' : 'Expand snippets'}</span>
    </button>
  );
}
