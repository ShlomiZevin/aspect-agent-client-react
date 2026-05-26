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

  const {
    versions,
    viewingVersionId,
    activeVersionId,
    isDirty,
    setViewing,
    deleteVersion,
    entityLabel,
  } = state;
  const viewing = versions.find(v => v.id === viewingVersionId);
  const canDeleteAny = versions.length > 1;

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

  const handleDelete = async (target: VersionMeta) => {
    // Confirm. The server enforces the same guards (last/active/viewing
    // refused with a coded 409), but we double-check client-side so the
    // user gets feedback immediately and the round-trip is skipped.
    const ok = await confirm({
      title: `Delete v${target.number}?`,
      message: (
        <>
          Permanently delete <strong>v{target.number}</strong>
          {target.description ? <> — “{target.description}”</> : null} of
          this {entityLabel}. This can’t be undone.
        </>
      ),
      confirmLabel: 'Delete version',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteVersion(target.id);
    } catch (err) {
      // Server-side guard fired (race with viewing/active flips) or a
      // genuine failure. Surface the message via the confirm modal —
      // both buttons just dismiss; we don't care about the return value.
      const msg = err instanceof Error ? err.message : 'Delete failed';
      await confirm({
        title: 'Couldn’t delete this version',
        message: msg,
        confirmLabel: 'OK',
      });
    }
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
              // Mirror the server-side guards exactly. We show the ×
              // even when it's not actionable so the affordance is
              // discoverable — but disable it and explain *why* via a
              // tooltip. Otherwise the user sees no delete and can't
              // tell whether the feature exists or which row blocks it.
              const blockReason = !canDeleteAny
                ? 'Can’t delete the only version'
                : isViewing
                  ? 'Switch to a different version to delete this one'
                  : isActive
                    ? 'Set another version as active to delete this one'
                    : null;
              return (
                <div
                  key={v.id}
                  className={`${styles.menuRow} ${isViewing ? styles.menuRowActive : ''}`}
                >
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleSwitch(v)}
                  >
                    <span className={styles.menuItemNum}>v{v.number}</span>
                    <span className={styles.menuItemDesc}>
                      {v.description || (isViewing ? 'Viewing' : 'Untitled')}
                    </span>
                    {isActive && <span className={styles.menuItemActiveTag}>active</span>}
                  </button>
                  <button
                    type="button"
                    className={styles.menuDelete}
                    onClick={e => { e.stopPropagation(); if (!blockReason) handleDelete(v); }}
                    disabled={!!blockReason}
                    title={blockReason || `Delete v${v.number}`}
                    aria-label={blockReason || `Delete v${v.number}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
