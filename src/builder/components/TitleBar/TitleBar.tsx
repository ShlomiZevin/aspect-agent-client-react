/**
 * TitleBar — single-row title.
 *
 * Layout:
 *   [crumbs]
 *   [name (auto-width)] {children} ········ [metaActions] [📖 Spec]
 *
 * The name input shrinks to its content via the HTML `size` attribute.
 * `children` host the version pill / version menu / Save buttons —
 * the "edit the current version" group. The metadata-actions group
 * ({ }, Spec, future Validate & Log) sits tight against the right edge
 * with its own small gap. The visual gap between the two groups is
 * created by `margin-inline-start: auto` on the metaActions wrap.
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
  /** Edit-the-version group: version pill, version menu, etc. */
  children?: ReactNode;
  /**
   * Metadata-view group rendered tightly grouped with the Spec
   * button on the right edge. Used by AgentView/CrewView for the
   * `{ }` JSON button; slice 4 will add Validate & Log here too.
   */
  metaActions?: ReactNode;
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
  metaActions,
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
        <div className={styles.metaActions}>
          {metaActions}
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
