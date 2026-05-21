/**
 * VersionMenu — toolbar row that lives under the name.
 *
 *   Description · 2h ago   ⭐ Active / ⭐ Set as active   [Save] [Save as…]
 *
 * Reused for both crew and agent versioning. Takes a single
 * `EntityVersionState` prop produced by either hook.
 */

import { useState } from 'react';
import { SaveAsModal } from '../SaveAsModal/SaveAsModal';
import type { EntityVersionState } from '../../state/useEntityVersion';
import styles from './VersionMenu.module.css';

interface Props {
  state: EntityVersionState;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function VersionMenu({ state }: Props) {
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  const {
    entityLabel,
    versions,
    viewingVersionId,
    activeVersionId,
    isDirty,
    nextNumber,
    save,
    saveAs,
    setActive,
  } = state;

  const viewing = versions.find(v => v.id === viewingVersionId);
  const viewingIsActive = viewingVersionId === activeVersionId;

  return (
    <div className={styles.wrap}>
      <span className={styles.meta}>
        <span className={styles.metaDesc}>
          {viewing?.description || (isDirty ? 'Unsaved changes' : 'Current')}
        </span>
        {viewing && (
          <span className={styles.metaTime} title={new Date(viewing.createdAt).toLocaleString()}>
            · {relativeTime(viewing.createdAt)}
          </span>
        )}
      </span>

      <span className={styles.spacer} />

      {viewingIsActive ? (
        <span className={styles.activeBadge} title={`This is the active ${entityLabel}’s version`}>
          ⭐ Active
        </span>
      ) : (
        <button
          type="button"
          className={styles.setActiveBtn}
          onClick={() => setActive(viewingVersionId)}
          title="Make this the version the runtime uses"
        >
          ⭐ Set as active
        </button>
      )}

      <button
        type="button"
        className={`${styles.btn} ${isDirty ? styles.btnPrimary : ''}`}
        onClick={save}
        disabled={!isDirty}
        title={isDirty ? 'Save changes into the viewing version' : 'No changes to save'}
      >
        Save
      </button>

      <button
        type="button"
        className={styles.btn}
        onClick={() => setSaveAsOpen(true)}
      >
        Save as…
      </button>

      <SaveAsModal
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        entityLabel={entityLabel}
        nextNumber={nextNumber}
        onSubmit={saveAs}
      />
    </div>
  );
}
