/**
 * AddStepModal — pick what to add to the chosen lane.
 *
 *   Tabs:
 *     - Fresh      → blank instance of a plugin with default config
 *     - From Library → copy-in an existing curated config
 *
 * The lane was already chosen by clicking + on a specific lane in
 * the chain canvas; it's shown as a badge for clarity.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { listPlugins, getPlugin } from '../../registry/plugins';
import {
  listLibraryEntries,
  subscribeToLibrary,
  type LibraryEntry,
} from '../../state/addonLibrary';
import type { AddonLane } from '../../types';
import styles from './AddStepModal.module.css';

export type AddStepChoice =
  | { kind: 'fresh'; pluginId: string }
  | { kind: 'library'; entryId: string };

interface Props {
  open: boolean;
  onClose: () => void;
  lane: AddonLane;
  onPick: (choice: AddStepChoice) => void;
  /** Where these addons will live. Drives which plugins the picker
   *  surfaces — at agent scope, Talker and Transition Router don't
   *  belong (no crew context to speak from or transition between). */
  scope?: 'agent' | 'crew';
}

/** Plugin IDs hidden from the picker when `scope === 'agent'`.
 *  Exported — MoveAddonModal applies the same rule to move targets. */
export const AGENT_FORBIDDEN_PLUGINS: ReadonlySet<string> = new Set([
  'talker',
  'transition-router',
]);

const LANE_LABEL: Record<AddonLane, string> = {
  main: 'Blocking',
  background: 'Background',
  offline: 'Offline',
};

type Tab = 'blank' | 'repository';

export function AddStepModal({ open, onClose, lane, onPick, scope = 'crew' }: Props) {
  const [tab, setTab] = useState<Tab>('blank');
  const [entries, setEntries] = useState<LibraryEntry[]>(() => listLibraryEntries());

  // Re-read repository when entries change (e.g. after an Export).
  useEffect(() => {
    return subscribeToLibrary(() => setEntries(listLibraryEntries()));
  }, []);

  // Reset to Blank tab whenever the modal opens.
  useEffect(() => {
    if (open) setTab('blank');
  }, [open]);

  const plugins = listPlugins().filter(p =>
    scope === 'agent' ? !AGENT_FORBIDDEN_PLUGINS.has(p.id) : true,
  );
  const visibleEntries = entries.filter(e =>
    scope === 'agent' ? !AGENT_FORBIDDEN_PLUGINS.has(e.pluginId) : true,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title="Add step"
      badge={LANE_LABEL[lane]}
    >
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'blank' ? styles.tabActive : ''}`}
          onClick={() => setTab('blank')}
        >
          Blank
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'repository' ? styles.tabActive : ''}`}
          onClick={() => setTab('repository')}
        >
          Repository
          <span className={styles.tabCount}>{visibleEntries.length}</span>
        </button>
      </div>

      {tab === 'blank' ? (
        <div className={styles.section}>
          {plugins.length === 0 && <div className={styles.empty}>No plugins available at this scope.</div>}
          {plugins.map(p => (
            <button
              key={p.id}
              type="button"
              className={styles.item}
              onClick={() => {
                onPick({ kind: 'fresh', pluginId: p.id });
                onClose();
              }}
            >
              <span
                className={styles.icon}
                style={{ background: `${p.color}22`, color: p.color }}
              >
                {p.icon}
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{p.name}</span>
                <span className={styles.desc}>{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.section}>
          {visibleEntries.length === 0 && (
            <div className={styles.empty}>
              Nothing in the repository yet. Open an addon and use{' '}
              <strong>Export to repository</strong> to share a good config.
            </div>
          )}
          {visibleEntries.map(e => {
            const p = getPlugin(e.pluginId);
            return (
              <button
                key={e.id}
                type="button"
                className={styles.item}
                onClick={() => {
                  onPick({ kind: 'library', entryId: e.id });
                  onClose();
                }}
              >
                <span
                  className={styles.icon}
                  style={{
                    background: `${p?.color ?? '#9ca3af'}22`,
                    color: p?.color ?? '#6b7280',
                  }}
                >
                  {p?.icon ?? '?'}
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>
                    {e.name}
                    <span className={styles.pluginTag}>{p?.name ?? e.pluginId}</span>
                  </span>
                  {e.description && <span className={styles.desc}>{e.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
