/**
 * PromptRepoModal — browse / save reusable prompts for one addon.
 *
 * Layout (fixed heights so the modal never resizes as you click):
 *   1. Tabs — System (undeletable) · Saved (your DB entries).
 *   2. Chip grid for the active tab — addon-card-style chips.
 *   3. Preview pane — ALWAYS present, fixed height. Shows the selected
 *      prompt or a placeholder. "Use this prompt" lives here.
 *   4. Save row — name the current prompt and store it.
 *
 * "Use this prompt" always asks for confirmation before it changes
 * the addon's prompt — the swap is the consequential step, so it's
 * gated every time (not just when the old prompt was non-empty).
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Modal } from '../Modal/Modal';
import { getPlugin } from '../../registry/plugins';
import { useConfirm } from '../Confirm/Confirm';
import {
  getPromptRepoVersion,
  listPromptEntriesForPlugin,
  saveUserPrompt,
  deleteUserPrompt,
  subscribeToPromptRepo,
  type PromptRepoEntry,
} from '../../state/promptRepo';
import styles from './PromptRepoModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  pluginId: string;
  pluginLabel?: string;
  currentPrompt: string;
  onPick: (prompt: string) => void;
}

type Tab = 'system' | 'saved';

/** Compact relative time for saved-entry meta. */
function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PromptRepoModal({
  open, onClose, pluginId, pluginLabel, currentPrompt, onPick,
}: Props) {
  const version = useSyncExternalStore(subscribeToPromptRepo, getPromptRepoVersion);
  const entries = useMemo(
    () => listPromptEntriesForPlugin(pluginId),
    [version, pluginId],
  );

  const plugin     = getPlugin(pluginId);
  const pluginIcon = plugin?.icon ?? '📝';
  const accent     = plugin?.color ?? '#6366f1';

  const confirm = useConfirm();

  const [tab, setTab]               = useState<Tab>('system');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveName, setSaveName]     = useState('');
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const seeds = useMemo(() => entries.filter(e => e.source === 'seed'), [entries]);
  const saved = useMemo(() => entries.filter(e => e.source === 'user'), [entries]);
  const tabEntries = tab === 'system' ? seeds : saved;

  // Fresh state per open. No auto-select — preview is a deliberate
  // click. Start on whichever tab has content.
  useEffect(() => {
    if (!open) return;
    setTab(seeds.length === 0 && saved.length > 0 ? 'saved' : 'system');
    setSelectedId(null);
    setSaveName('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pluginId]);

  const selected = useMemo<PromptRepoEntry | null>(
    () => entries.find(e => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const trimmedName = saveName.trim();
  const collidesOnSave = trimmedName.length > 0
    && entries.some(e => e.name === trimmedName);
  const promptEmpty = currentPrompt.trim().length === 0;
  const canSave = !busy && trimmedName.length > 0 && !promptEmpty && !collidesOnSave;

  const handleUseSelected = async (entry: PromptRepoEntry) => {
    const hasExisting = currentPrompt.trim().length > 0;
    const identical   = currentPrompt.trim() === entry.prompt.trim();
    if (identical) { onClose(); return; } // already this prompt — nothing to change

    const ok = await confirm({
      title:   'Use this prompt?',
      message: hasExisting
        ? 'This replaces the prompt currently on this addon with the one you picked. If you want to keep your current prompt, save it to the repo first.'
        : 'This sets the addon’s prompt to the one you picked.',
      confirmLabel: 'Use prompt',
      danger:       hasExisting,
    });
    if (!ok) return;
    onPick(entry.prompt);
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const created = await saveUserPrompt({
        name:   trimmedName,
        pluginId,
        prompt: currentPrompt,
      });
      setSaveName('');
      setTab('saved');
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (entry: PromptRepoEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (entry.source !== 'user') return; // system entries are undeletable
    const ok = await confirm({
      title:        `Delete "${entry.name}"?`,
      message:      'Removes this prompt from the repo for every user.',
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    try {
      await deleteUserPrompt(entry.id);
      if (selectedId === entry.id) setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const label = pluginLabel || plugin?.name || pluginId;
  const accentStyle = { '--accent': accent } as React.CSSProperties;

  const renderChip = (entry: PromptRepoEntry) => {
    const active   = entry.id === selectedId;
    const isSystem = entry.source === 'seed';
    return (
      <button
        key={entry.id}
        type="button"
        aria-pressed={active}
        className={`${styles.chip} ${active ? styles.chipActive : ''}`}
        onClick={() => setSelectedId(entry.id)}
        onDoubleClick={() => handleUseSelected(entry)}
        title={
          isSystem || !entry.createdAt
            ? `${entry.name} · ${entry.prompt.length.toLocaleString()} chars`
            : `${entry.name} · ${entry.prompt.length.toLocaleString()} chars · ${relativeTime(entry.createdAt)}`
        }
      >
        <span aria-hidden className={styles.chipIcon}>{pluginIcon}</span>
        <span className={styles.chipName}>{entry.name}</span>
        <span className={styles.chipMeta}>
          {entry.prompt.length.toLocaleString()} chars
        </span>
        {!isSystem && (
          <span
            className={styles.chipTrash}
            role="button"
            aria-label={`Delete "${entry.name}"`}
            title={`Delete "${entry.name}"`}
            onClick={e => handleDelete(entry, e)}
          >
            🗑
          </span>
        )}
      </button>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={880}
      title="📚 Prompt repo"
      badge={label}
      footer={
        <button type="button" className={styles.btnGhost} onClick={onClose}>
          Close
        </button>
      }
    >
      <div className={styles.wrap} style={accentStyle}>
        {/* ── Two columns: list (left) · preview (right) ───────── */}
        <div className={styles.split}>
          {/* Left: tabs + chip grid */}
          <div className={styles.left}>
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'system'}
                className={`${styles.tab} ${tab === 'system' ? styles.tabActive : ''}`}
                onClick={() => setTab('system')}
              >
                System <span className={styles.tabCount}>{seeds.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'saved'}
                className={`${styles.tab} ${tab === 'saved' ? styles.tabActive : ''}`}
                onClick={() => setTab('saved')}
              >
                Saved <span className={styles.tabCount}>{saved.length}</span>
              </button>
            </div>

            <div className={styles.chipArea}>
              {tabEntries.length === 0 ? (
                <div className={styles.tabEmpty}>
                  {tab === 'saved'
                    ? 'No saved prompts yet. Use “Save current as” below to add one.'
                    : 'No system prompts for this addon.'}
                </div>
              ) : (
                <div className={styles.chipGrid}>{tabEntries.map(renderChip)}</div>
              )}
            </div>
          </div>

          {/* Right: preview — always present, fills the column */}
          <div className={styles.preview}>
            {selected ? (
              <>
                <div className={styles.previewHead}>
                  <span aria-hidden className={styles.previewIcon}>{pluginIcon}</span>
                  <span className={styles.previewName}>{selected.name}</span>
                  <span
                    className={`${styles.sourceBadge} ${
                      selected.source === 'seed' ? styles.badgeSeed : styles.badgeUser
                    }`}
                  >
                    {selected.source === 'seed' ? 'System' : 'Saved'}
                  </span>
                  <span className={styles.previewSpacer} />
                  <span className={styles.previewMeta}>
                    {selected.prompt.length.toLocaleString()} chars
                  </span>
                </div>
                <pre className={styles.previewBody}>{selected.prompt}</pre>
                <div className={styles.previewActions}>
                  <button
                    type="button"
                    className={styles.usePrimary}
                    onClick={() => handleUseSelected(selected)}
                  >
                    Use this prompt
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.previewEmpty}>
                Select a prompt on the left to preview it here.
              </div>
            )}
          </div>
        </div>

        {/* ── Save row ─────────────────────────────────────────── */}
        <div className={styles.saveBar}>
          <div className={styles.saveRow}>
            <label className={styles.saveLabel}>💾 Save current as</label>
            <input
              className={styles.saveInput}
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave(); }}
              placeholder="name this prompt"
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.saveBtn}
              disabled={!canSave}
              onClick={handleSave}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
          {(collidesOnSave || (saveName.length > 0 && promptEmpty) || error) && (
            <div className={styles.saveStatus}>
              {error
                ? error
                : collidesOnSave
                  ? `A prompt named "${trimmedName}" already exists.`
                  : 'The current addon prompt is empty — nothing to save.'}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
