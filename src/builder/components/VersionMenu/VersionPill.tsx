/**
 * VersionPill — generic version-switcher chip. Reused for both crew
 * and agent versions; takes a `EntityVersionState` blob produced by
 * either `useCrewVersion` or `useAgentVersion`.
 *
 * Click → dropdown of versions. Picking one switches the *viewing*
 * version (with dirty-confirm). The active version is marked with a
 * small `active` tag inside the dropdown — promoting active happens
 * elsewhere (the Set-as-active button in VersionMenu).
 */

import { useState } from 'react';
import { useConfirm } from '../Confirm/Confirm';
import type { EntityVersionState } from '../../state/useEntityVersion';
import type { VersionMeta } from '../../types';
import styles from './VersionPill.module.css';

interface Props {
  state: EntityVersionState;
}

export function VersionPill({ state }: Props) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);

  const { versions, viewingVersionId, activeVersionId, isDirty, setViewing } = state;
  const viewing = versions.find(v => v.id === viewingVersionId);

  const handleSwitch = async (target: VersionMeta) => {
    setOpen(false);
    if (target.id === viewingVersionId) return;
    if (isDirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: (
          <>
            You have unsaved edits on <strong>v{viewing?.number}</strong>.
            Switching to <strong>v{target.number}</strong> will discard them.
          </>
        ),
        confirmLabel: 'Discard & switch',
        cancelLabel: 'Cancel',
        danger: true,
      });
      if (!ok) return;
    }
    setViewing(target.id);
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.pill} ${isDirty ? styles.pillDirty : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Switch version"
      >
        <span className={styles.label}>v{viewing?.number ?? '?'}</span>
        {isDirty && <span className={styles.dot} />}
        <span className={styles.caret}>▾</span>
      </button>

      {open && (
        <div className={styles.menu} onMouseLeave={() => setOpen(false)}>
          <div className={styles.menuHeader}>Versions</div>
          {versions
            .slice()
            .sort((a, b) => b.number - a.number)
            .map(v => {
              const isViewing = v.id === viewingVersionId;
              const isActive = v.id === activeVersionId;
              return (
                <button
                  key={v.id}
                  type="button"
                  className={`${styles.menuItem} ${isViewing ? styles.menuItemActive : ''}`}
                  onClick={() => handleSwitch(v)}
                >
                  <span className={styles.menuItemNum}>v{v.number}</span>
                  <span className={styles.menuItemDesc}>
                    {v.description || (isViewing ? 'Viewing' : 'Untitled')}
                  </span>
                  {isActive && <span className={styles.menuItemActiveTag}>active</span>}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
