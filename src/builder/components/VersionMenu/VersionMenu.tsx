/**
 * VersionMenu — toolbar row that lives under the name.
 *
 *   Description · 2h ago   ⭐ Active / ⭐ Set as active   [Save] [Save as…]
 *
 * Always the AGENT's state (#923): an agent has one version number, and
 * every save, activation and publish covers the agent and all its crews.
 */

import { useState } from 'react';
import { SaveAsModal } from '../SaveAsModal/SaveAsModal';
import { SaveAttributionModal } from '../SaveAttributionModal/SaveAttributionModal';
import { useConfirm } from '../Confirm/Confirm';
import { useBuilder } from '../../state/BuilderContext';
import { useAnyDirty } from '../../hooks/useAutoSave';
import type { EntityVersionState } from '../../state/useEntityVersion';
import styles from './VersionMenu.module.css';

interface Props {
  state: EntityVersionState;
}

/** Version names the platform writes on its own (builderProjects.js,
 *  BuilderContext, draftStorage) — never shown as if someone chose them. */
const AUTO_NAMES = new Set(['Initial']);

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
  const [saveAllAsOpen, setSaveAllAsOpen]             = useState(false);
  const [attributionOpen, setAttributionOpen]         = useState(false);
  // Whether the Save▾ dropdown is open.
  const [openMenu, setOpenMenu] = useState<null | 'save'>(null);
  const confirm = useConfirm();
  const { pendingAlfredApply, resetToServerState, doc, saveAllVersionsAs, saveAllVersions, selection } = useBuilder();
  // Global dirty flag (whole doc) — drives "Save all", which commits every
  // unsaved agent + crew, independent of which entity is on screen.
  const { dirty: anyDirty } = useAnyDirty();

  const {
    entityLabel,
    versions,
    viewingVersionId,
    activeVersionId,
    publishedVersionId,
    previewVersionId,
    previewStashDirty,
    isDirty,
    nextNumber,
    hasPendingAlfred,
    setActive,
    setPublished,
    exitPreview,
    editThisVersion,
  } = state;
  // Note: `state.discard` (in-memory revert to the cached version body)
  // is intentionally unused. The Reset button below calls
  // `resetToServerState` instead so it always reflects the real DB —
  // immune to stale localStorage drafts.

  const viewing = versions.find(v => v.id === viewingVersionId);
  const entityName = entityLabel === 'crew' ? 'Crew' : 'Agent';
  // Names the system stamps by itself say nothing a number doesn't.
  const customName = viewing?.description?.trim() && !AUTO_NAMES.has(viewing.description.trim())
    ? viewing.description.trim()
    : '';
  const viewingIsActive = viewingVersionId === activeVersionId;
  const viewingIsPublished = viewingVersionId === publishedVersionId;
  const saveTooltip = anyDirty
    ? 'Saves every change — the agent and all its crews'
    : 'No changes to save';

  const agentId = selection.agentId;
  const agentForRow = agentId ? doc.agents.find(a => a.id === agentId) : undefined;
  const hasCrews = (agentForRow?.crews?.length ?? 0) > 0;

  // The primary Save is the WHOLE agent (task #873): the agent plus every
  // crew with unsaved changes, each into its current version. Saving one
  // crew at a time is what made people walk the sidebar crew by crew; it
  // stays available in the menu for the rare case it is wanted.
  // Saving one crew or only the agent's setup on its own was removed in
  // #923: those saves gave crews their own version numbers.
  const runSaveAll = () => {
    if (!agentId) return;
    if (pendingAlfredApply) {
      setAttributionOpen(true);
    } else {
      saveAllVersions(agentId);
    }
  };

  const runReset = async () => {
    const ok = await confirm({
      title:    'Reset to last saved state?',
      message:  hasPendingAlfred
        ? 'Reloads the latest version from the server, drops your unsaved edits, and drops the pending Alfred apply (no log entry). If nothing is saved yet, you\'ll get a blank agent.'
        : 'Reloads the latest version from the server and drops your unsaved edits. If nothing is saved yet, you\'ll get a blank agent.',
      confirmLabel: 'Reset',
      danger:   true,
    });
    if (ok) await resetToServerState();
  };

  return (
    <div className={styles.wrap}>
      {/* Says WHAT this is before what it is called. The chip used to show
          only the version's name — and a new project's first version is
          named "Initial", so the toolbar read "Initial · 14m ago", which
          nobody recognised as a version at all. The number is the
          identity; a name is only worth showing when a person chose it. */}
      <span
        className={styles.meta}
        title={viewing
          ? `${entityName} version ${viewing.number}${customName ? ` — “${customName}”` : ''}, saved ${new Date(viewing.createdAt).toLocaleString()}`
          : undefined}
      >
        {viewing ? (
          <>
            <span className={styles.metaVersion}>{entityName} version {viewing.number}</span>
            {customName && <span className={styles.metaDesc}>· {customName}</span>}
            <span className={styles.metaTime}>· saved {relativeTime(viewing.createdAt)}</span>
          </>
        ) : (
          <span className={styles.metaDesc}>{isDirty ? 'Unsaved changes' : 'Current'}</span>
        )}
      </span>

      {previewVersionId ? (
        // ── Read-only preview bar ──
        // You're browsing a non-active version. Your editable draft is
        // stashed and safe. Return to it, or make THIS version your
        // editable line.
        <>
          <span className={styles.previewBadge} title="You're viewing this version read-only — your editable work is safe">
            👁 Previewing v{viewing?.number ?? '?'} · read-only
          </span>
          <button
            type="button"
            className={styles.btn}
            onClick={() => exitPreview()}
            title="Return to your editable version"
          >
            ↩ Back to active
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={async () => {
              if (previewStashDirty) {
                const ok = await confirm({
                  title:        'Discard unsaved changes?',
                  message:      `Editing v${viewing?.number} makes it your working version and discards the unsaved changes on your current active ${entityLabel}. Save those first if you want to keep them.`,
                  confirmLabel: 'Discard & edit',
                  danger:       true,
                });
                if (!ok) return;
              }
              editThisVersion();
            }}
            title="Make this version your editable working line"
          >
            ✎ Edit this version
          </button>
        </>
      ) : (
      <>
      {/* ── Status cluster: which version the builder chat runs ── */}
      {viewingIsActive ? (
        <span className={styles.activeBadge} title={`This is the active ${entityLabel}’s version — what the builder chat runs`}>
          ⭐ Active
        </span>
      ) : (
        <button
          type="button"
          className={styles.setActiveBtn}
          onClick={() => setActive(viewingVersionId)}
          title="Make this the active version (the builder / admin marker)"
        >
          ⭐ Set as active
        </button>
      )}

      {/* ── Publish (customer-facing) ──
          One button for the whole agent (#923): this version of the agent
          and each crew's version of the same number. */}
      <div className={styles.split}>
        {viewingIsPublished ? (
          <button
            type="button"
            className={styles.publishedBadge}
            onClick={async () => {
              const ok = await confirm({
                title:        'Unpublish this version?',
                message:      'Customers will fall back to the active version of the agent and its crews until you publish again.',
                confirmLabel: 'Unpublish',
                danger:       true,
              });
              if (ok) setPublished(null);
            }}
            title="Customers run this version — click to unpublish"
          >
            🚀 Published
          </button>
        ) : (
          <button
            type="button"
            className={styles.publishBtn}
            onClick={async () => {
              const ok = await confirm({
                title:        `Publish version ${viewing?.number ?? ''} to customers?`,
                message:      anyDirty
                  ? 'This publishes the last SAVED state of the agent and all its crews. Unsaved edits are NOT included — Save first if you want them live.'
                  : 'Live customers will run this version of the agent and all its crews. It stays put until you publish another.',
                confirmLabel: 'Publish',
              });
              if (ok) setPublished(viewingVersionId);
            }}
            title="Make this the version live customers run"
          >
            🚀 Publish
          </button>
        )}
      </div>

      <span className={styles.divider} aria-hidden="true" />

      {/* ── Save cluster (task #873) ──
          Primary = save the WHOLE agent in place (agent + every dirty
          crew). The caret leads with "Save as new version" for the whole
          agent — which becomes active too — then the single-entity
          variants under a divider, then Reset. */}
      <div className={styles.split}>
        <button
          type="button"
          className={`${styles.btn} ${styles.splitPrimary} ${anyDirty ? styles.btnPrimary : ''}`}
          onClick={runSaveAll}
          disabled={!anyDirty}
          title={saveTooltip}
        >
          {/* "Save all", not "Save": it saves the agent AND every crew, and
              the label has to say so — nobody reads the tooltip. */}
          Save all
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.splitCaret} ${anyDirty ? styles.splitCaretPrimary : ''}`}
          onClick={() => setOpenMenu(m => (m === 'save' ? null : 'save'))}
          title="More save options"
          aria-label="More save options"
        >
          ▾
        </button>
        {openMenu === 'save' && (
          <div className={styles.splitMenu} onMouseLeave={() => setOpenMenu(null)}>
            {/* The blue button's own action, listed first and tagged, so the
                menu reads as "here are all the ways to save, and this one is
                what the button does" — without it, the first line looked like
                the default when it was the alternative. */}
            <button
              type="button"
              className={styles.menuItem}
              disabled={!anyDirty}
              onClick={() => { setOpenMenu(null); runSaveAll(); }}
            >
              <span>
                Save all <span className={styles.menuItemDefault}>Blue button</span>
              </span>
              <span className={styles.menuItemSub}>
                {hasCrews ? 'The agent and all its crews, into the current version' : 'Into the current version'}
              </span>
            </button>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => { setOpenMenu(null); setSaveAllAsOpen(true); }}
            >
              Save all as a new version…
              <span className={styles.menuItemSub}>
                {hasCrews
                  ? 'The agent and all its crews, as a new version that is used from now on'
                  : 'As a new version that is used from now on'}
              </span>
            </button>
            {anyDirty && (
              <>
                <div className={styles.menuDivider} />
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { setOpenMenu(null); runReset(); }}
                  title="Reload the last saved version from the server (blank if nothing saved)"
                >
                  ↶ Throw away unsaved changes
                </button>
              </>
            )}
          </div>
        )}
      </div>
      </>
      )}

      {/* Save-all-as: one description and ONE number (#923) for the agent
          and every crew, so the badge can show the number they all get. */}
      <SaveAsModal
        open={saveAllAsOpen}
        onClose={() => setSaveAllAsOpen(false)}
        entityLabel={hasCrews ? 'all (the agent and all its crews)' : 'all'}
        nextNumber={nextNumber}
        onSubmit={(description) => {
          const agentId = selection.agentId;
          if (!agentId) return;
          saveAllVersionsAs(agentId, description);
        }}
      />

      <SaveAttributionModal
        open={attributionOpen}
        onClose={() => setAttributionOpen(false)}
        variant="save"
        applyHeadline={pendingAlfredApply?.description}
        onChoose={(attribution) => {
          if (agentId) saveAllVersions(agentId, { attribution });
        }}
      />
    </div>
  );
}
