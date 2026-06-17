/**
 * PromptPreviewToggle — flips a prompt field between its editable
 * source (MentionTextarea) and the read-only full-prompt preview
 * (PromptPreviewView). Always available: a real addon template always
 * has tokens worth previewing.
 */

import styles from './PromptPreviewToggle.module.css';

interface Props {
  expanded: boolean;
  onToggle: (next: boolean) => void;
}

export function PromptPreviewToggle({ expanded, onToggle }: Props) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${expanded ? styles.toggleActive : ''}`}
      onClick={() => onToggle(!expanded)}
      aria-pressed={expanded}
      title={expanded
        ? 'Back to the editable source view.'
        : 'See the full assembled prompt with every {{token}} opened (read-only).'}
    >
      <span aria-hidden>{expanded ? '✎' : '👁'}</span>
      <span>{expanded ? 'Edit' : 'Preview'}</span>
    </button>
  );
}
