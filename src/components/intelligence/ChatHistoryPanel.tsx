/**
 * Docked-left conversation history for the chat widget. Two pixel-accurate
 * variants pulled straight from the mockup's own inline styles (the sole
 * source of visual truth for this feature, see project memory):
 *  - 'docked' (turn 4d, windowed floating widget): 270px, "HISTORY" label +
 *    small "＋ New" text link, no per-item delete, footer says "Clear all".
 *  - 'expanded' (turn 2c, full-window widget): 300px, a full-width gradient
 *    "＋ New chat" button instead of a text link, a delete icon on every
 *    item, footer says "Clear all conversations".
 * Both share the same search box, TODAY/YESTERDAY grouping, and rounded
 * active-item card — those are identical across both mockup turns.
 * Reuses the same conversation API the real chat uses (see ChatWidget.tsx's
 * comment) — no chat code is touched or duplicated, this only reads/writes
 * through it.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Conversation } from '../../types/chat';
import { getUserConversations, deleteAllConversations, deleteConversation } from '../../services/conversationService';
import { hypertoyConfig } from '../../agents';
import styles from './ChatHistoryPanel.module.css';

interface Props {
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  /** Bumped by the parent whenever a new message might have changed the list (e.g. widget reopened). */
  refreshKey: number;
  variant: 'docked' | 'expanded';
  /** Reports the active conversation's title back up, so the expanded header can show it (mockup 2c). */
  onActiveTitleChange?: (title: string | null) => void;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function groupLabel(date: Date, today: Date, yesterday: Date): string {
  if (isSameDay(date, today)) return 'TODAY';
  if (isSameDay(date, yesterday)) return 'YESTERDAY';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase();
}

const USER_ID_KEY = `${hypertoyConfig.storagePrefix}user_id`;

export function ChatHistoryPanel({ activeConversationId, onSelect, onNew, refreshKey, variant, onActiveTitleChange }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');

  // Re-reads localStorage fresh on every call rather than capturing `userId`
  // once via a non-reactive `localStorage.getItem` at render time: the
  // anon user is created asynchronously by the iframe's own UserProvider,
  // in a different part of the tree this component has no subscription to,
  // so a value captured at mount (often still null) would never update.
  const load = () => {
    const userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) return;
    getUserConversations(userId, hypertoyConfig.agentName, hypertoyConfig.baseURL)
      .then(list => setConversations(list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())))
      .catch(() => setConversations([]));
  };

  useEffect(load, [refreshKey]);

  // The parent only bumps refreshKey when the widget opens, not on every
  // sent message - without this, a conversation started while this panel is
  // already mounted (e.g. always-open in expanded mode) would never appear,
  // and the active title would stay stuck on the generic fallback forever.
  useEffect(() => {
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onActiveTitleChange) return;
    const active = conversations.find(c => c.id === activeConversationId);
    onActiveTitleChange(active ? (active.title || 'New Chat') : null);
  }, [conversations, activeConversationId, onActiveTitleChange]);

  const clearAll = async () => {
    const userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) return;
    await deleteAllConversations(userId, hypertoyConfig.agentName, hypertoyConfig.baseURL);
    setConversations([]);
    onNew();
  };

  const removeOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id, hypertoyConfig.baseURL);
    setConversations(cs => cs.filter(c => c.id !== id));
    if (id === activeConversationId) onNew();
  };

  const groups = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const filtered = query.trim()
      ? conversations.filter(c => (c.title || 'New Chat').toLowerCase().includes(query.trim().toLowerCase()))
      : conversations;
    const byLabel = new Map<string, Conversation[]>();
    for (const c of filtered) {
      const label = groupLabel(c.updatedAt, today, yesterday);
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push(c);
    }
    return Array.from(byLabel.entries());
  }, [conversations, query]);

  const expanded = variant === 'expanded';

  return (
    <div className={`${styles.panel} ${expanded ? styles.panelExpanded : ''}`}>
      <div className={styles.top}>
        {expanded ? (
          <button className={styles.newBtnExpanded} onClick={onNew}><span>＋</span>New chat</button>
        ) : (
          <div className={styles.topRow}>
            <span className={styles.label}>HISTORY</span>
            <button className={styles.newBtn} onClick={onNew}>＋ New</button>
          </div>
        )}
        <div className={styles.search}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={expanded ? 'Search conversations…' : 'Search…'} />
        </div>
      </div>
      <div className={styles.list}>
        {groups.length === 0 && <div className={styles.empty}>No conversations yet.</div>}
        {groups.map(([label, items]) => (
          <div key={label}>
            <div className={styles.groupLabel}>{label}</div>
            <div className={styles.groupItems}>
              {items.map(c => (
                <div
                  key={c.id}
                  className={`${styles.item} ${c.id === activeConversationId ? styles.itemActive : ''}`}
                  onClick={() => onSelect(c.id)}
                >
                  <div className={styles.itemBody}>
                    <div className={styles.itemTitle}>{c.title || 'New Chat'}</div>
                    <div className={styles.itemTime}>{c.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  {expanded && (
                    <button className={styles.itemDelete} onClick={e => removeOne(e, c.id)} aria-label="Delete conversation" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.clearAll} onClick={clearAll}>
        <svg width={expanded ? 14 : 13} height={expanded ? 14 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></svg>
        {expanded ? 'Clear all conversations' : 'Clear all'}
      </div>
    </div>
  );
}
