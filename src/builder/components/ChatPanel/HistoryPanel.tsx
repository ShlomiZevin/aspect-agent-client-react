/**
 * HistoryPanel — slide-over conversation list for UserChat.
 *
 * Owns:
 *   - listing past conversations (uses parent-supplied data)
 *   - inline rename (pencil → input → save on blur/enter)
 *   - per-row delete (with confirm)
 *   - "+ New chat" action at the top
 *
 * Designed as a self-contained drawer so future history-related
 * surfaces (search, filters) layer in here without cluttering the
 * main chat header.
 */

import { useState } from 'react';
import { useConfirm } from '../Confirm/Confirm';
import type { ConversationListItem } from '../../state/builderApi';
import styles from './HistoryPanel.module.css';

interface Props {
  open: boolean;
  conversations: ConversationListItem[];
  activeId: number | null;
  onClose: () => void;
  onPick: (id: number) => void;
  onNew: () => void;
  onRename: (id: number, name: string) => Promise<void> | void;
  onDelete: (id: number) => Promise<void> | void;
}

function defaultLabel(c: ConversationListItem): string {
  if (c.name && c.name.trim()) return c.name;
  return `Chat #${c.id}`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function HistoryPanel({
  open, conversations, activeId, onClose, onPick, onNew, onRename, onDelete,
}: Props) {
  const confirm = useConfirm();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const startRename = (c: ConversationListItem) => {
    setRenamingId(c.id);
    setRenameDraft(defaultLabel(c));
  };

  const submitRename = async (c: ConversationListItem) => {
    const next = renameDraft.trim();
    if (next && next !== c.name) {
      await onRename(c.id, next);
    }
    setRenamingId(null);
  };

  const handleDelete = async (c: ConversationListItem) => {
    const ok = await confirm({
      title: 'Delete this chat?',
      message: `"${defaultLabel(c)}" — every message and addon run is removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await onDelete(c.id);
  };

  return (
    <aside
      className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
      aria-hidden={!open}
    >
      <div className={styles.header}>
        <span className={styles.title}>Chats</span>
        <button type="button" className={styles.closeBtn} onClick={onClose} title="Close">
          ✕
        </button>
      </div>

      <button type="button" className={styles.newBtn} onClick={onNew}>
        + New chat
      </button>

      <div className={styles.list}>
        {conversations.length === 0 && (
          <div className={styles.empty}>No past chats yet.</div>
        )}
        {conversations.map(c => {
          const isActive = c.id === activeId;
          const isRenaming = renamingId === c.id;
          return (
            <div
              key={c.id}
              className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
            >
              {isRenaming ? (
                <input
                  className={styles.renameInput}
                  value={renameDraft}
                  autoFocus
                  onChange={e => setRenameDraft(e.target.value)}
                  onBlur={() => submitRename(c)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename(c);
                    else if (e.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={styles.rowMain}
                  onClick={() => onPick(c.id)}
                  title={defaultLabel(c)}
                >
                  <span className={styles.rowName}>{defaultLabel(c)}</span>
                  <span className={styles.rowTime}>{formatTimestamp(c.updatedAt)}</span>
                </button>
              )}
              {!isRenaming && (
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => startRename(c)}
                    title="Rename"
                  >
                    ✏
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                    onClick={() => handleDelete(c)}
                    title="Delete chat"
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
