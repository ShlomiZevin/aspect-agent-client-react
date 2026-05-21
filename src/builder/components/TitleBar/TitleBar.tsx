/**
 * TitleBar — single-row title.
 *
 * Layout:
 *   [crumbs]
 *   [name (auto-width)] {children}                          [📖 Spec]
 *
 * The name input shrinks to its content via the HTML `size` attribute,
 * so everything passed as `children` (version pill, description,
 * Save buttons, etc.) sits immediately to the right of the name. The
 * Spec button is anchored to the far right of the row.
 */

import { useState, type ReactNode } from 'react';
import { SpecModal } from '../SpecModal/SpecModal';
import styles from './TitleBar.module.css';

interface Props {
  crumbs: string;
  level: 'project' | 'agent' | 'crew';
  name: string;
  onNameChange: (next: string) => void;
  spec: string;
  onSpecChange: (next: string) => void;
  /** Rendered between the name and the Spec button. */
  children?: ReactNode;
}

const NAME_PLACEHOLDER: Record<Props['level'], string> = {
  project: 'Project name',
  agent: 'Agent name',
  crew: 'Crew name',
};

export function TitleBar({
  crumbs,
  level,
  name,
  onNameChange,
  spec,
  onSpecChange,
  children,
}: Props) {
  const [specOpen, setSpecOpen] = useState(false);
  const specHasContent = spec.trim().length > 0;

  const placeholder = NAME_PLACEHOLDER[level];
  // `size` is in characters. Mirrors the input length so it stays
  // hugged-to-content. Lower bound keeps it clickable when empty.
  const inputSize = Math.max(name.length, placeholder.length, 8);

  return (
    <div className={styles.wrap}>
      <span className={styles.crumbs}>{crumbs}</span>
      <div className={styles.row}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder={placeholder}
          size={inputSize}
        />
        {children}
        <button
          type="button"
          className={`${styles.specBtn} ${specHasContent ? styles.specBtnFilled : ''}`}
          onClick={() => setSpecOpen(true)}
          title={specHasContent ? 'Open spec' : 'Add spec'}
        >
          📖
          <span className={styles.specBtnLabel}>Spec</span>
          {specHasContent && <span className={styles.specDot} />}
        </button>
      </div>

      <SpecModal
        open={specOpen}
        onClose={() => setSpecOpen(false)}
        level={level}
        ownerName={name}
        value={spec}
        onChange={onSpecChange}
      />
    </div>
  );
}
