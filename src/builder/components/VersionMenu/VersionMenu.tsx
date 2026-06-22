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
import { SaveAttributionModal } from '../SaveAttributionModal/SaveAttributionModal';
import { useConfirm } from '../Confirm/Confirm';
import { useBuilder } from '../../state/BuilderContext';
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
  const [saveAsOpen, setSaveAsOpen]                   = useState(false);
  const [saveAllAsOpen, setSaveAllAsOpen]             = useState(false);
  const [attributionOpen, setAttributionOpen]         = useState(false);
  const [attributionVariant, setAttributionVariant]   = useState<'save' | 'save-as'>('save');
  const [pendingDescription, setPendingDescription]   = useState<string | undefined>(undefined);
  const confirm = useConfirm();
  const { pendingAlfredApply, resetToServerState, doc, saveAllVersionsAs, selection } = useBuilder();

  const {
    entityLabel,
    versions,
    viewingVersionId,
    activeVersionId,
    isDirty,
    crossDirtyLabel,
    nextNumber,
    hasPendingAlfred,
    save,
    saveAs,
    setActive,
  } = state;
  // Note: `state.discard` (in-memory revert to the cached version body)
  // is intentionally unused. The Reset button below calls
  // `resetToServerState` instead so it always reflects the real DB —
  // immune to stale localStorage drafts.

  const viewing = versions.find(v => v.id === viewingVersionId);
  const viewingIsActive = viewingVersionId === activeVersionId;
  const saveTooltip = !isDirty
    ? 'No changes to save'
    : crossDirtyLabel
      ? `Saves the ${entityLabel} and the ${crossDirtyLabel} — this edit touched both.`
      : 'Save changes into the viewing version';

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
        onClick={() => {
          // If a pending Alfred apply target matches this entity, ask
          // the user how to log this save before firing it.
          if (hasPendingAlfred) {
            setAttributionVariant('save');
            setAttributionOpen(true);
          } else {
            save();
          }
        }}
        disabled={!isDirty}
        title={saveTooltip}
      >
        Save
        {crossDirtyLabel && (
          // Small suffix when this Save will also persist a sibling
          // entity (e.g. crew save also saving agent). Visual signal
          // that one click does both — keeps the user from wondering
          // "but did the agent save too?".
          <span className={styles.saveCross}> + {crossDirtyLabel}</span>
        )}
      </button>

      <button
        type="button"
        className={styles.btn}
        onClick={() => setSaveAsOpen(true)}
      >
        Save as…
      </button>

      {/* "Save all as" — create a NEW version row on the agent and on
          every crew, all sharing one description. Author picks a single
          name; the whole agent gets a synchronised snapshot. Only
          meaningful when crews exist (otherwise it'd be identical to
          plain Save as). */}
      {(() => {
        const agentId = selection.agentId;
        if (!agentId) return null;
        const agent = doc.agents.find(a => a.id === agentId);
        if (!agent || (agent.crews?.length ?? 0) === 0) return null;
        return (
          <button
            type="button"
            className={styles.btn}
            onClick={() => setSaveAllAsOpen(true)}
            title={`Create a new version on the agent and on all ${agent.crews.length} crew${agent.crews.length === 1 ? '' : 's'}, all sharing one description.`}
          >
            Save all as…
          </button>
        );
      })()}

      {isDirty && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={async () => {
            const ok = await confirm({
              title:    'Reset to last saved state?',
              message:  hasPendingAlfred
                ? 'Reloads the latest version from the server, drops your unsaved edits, and drops the pending Alfred apply (no log entry). If nothing is saved yet, you\'ll get a blank agent.'
                : 'Reloads the latest version from the server and drops your unsaved edits. If nothing is saved yet, you\'ll get a blank agent.',
              confirmLabel: 'Reset',
              danger:   true,
            });
            if (ok) await resetToServerState();
          }}
          title="Reload the last saved version from the server (blank if nothing saved)"
        >
          ↶ Reset
        </button>
      )}

      <SaveAsModal
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        entityLabel={entityLabel}
        nextNumber={nextNumber}
        onSubmit={(description) => {
          // If pending Alfred, ask for attribution AFTER the description
          // step. Otherwise commit directly with default behaviour.
          if (hasPendingAlfred) {
            setPendingDescription(description);
            setAttributionVariant('save-as');
            setAttributionOpen(true);
          } else {
            saveAs(description);
          }
        }}
      />

      {/* Save-all-as picks ONE description that lands on every entity
          (agent + every crew gets a new version row with this name).
          `nextNumber` is intentionally omitted — each entity has its
          OWN next-version number (agent might be on v3, crew A on v5,
          crew B on v2). Showing one number would be misleading, so the
          modal renders without a version badge and the button reads
          "Save as new version". */}
      <SaveAsModal
        open={saveAllAsOpen}
        onClose={() => setSaveAllAsOpen(false)}
        entityLabel="agent + every crew"
        onSubmit={(description) => {
          const agentId = selection.agentId;
          if (!agentId) return;
          saveAllVersionsAs(agentId, description);
        }}
      />

      <SaveAttributionModal
        open={attributionOpen}
        onClose={() => {
          setAttributionOpen(false);
          setPendingDescription(undefined);
        }}
        variant={attributionVariant}
        applyHeadline={pendingAlfredApply?.description}
        onChoose={(attribution) => {
          if (attributionVariant === 'save') {
            save({ attribution });
          } else {
            saveAs(pendingDescription, { attribution });
            setPendingDescription(undefined);
          }
        }}
      />
    </div>
  );
}
