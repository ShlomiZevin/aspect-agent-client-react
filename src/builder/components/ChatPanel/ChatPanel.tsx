/**
 * ChatPanel — right column. Two tabs:
 *
 *   - Builder Chat: talk to an AI helper that knows the full JSON
 *     shape, the current doc, and the spec. Helper model is fixed
 *     to Claude Sonnet 4.6 via the central registry.
 *
 *   - User Chat: chat with the in-progress agent itself. Below the
 *     transcript, an "addon activity" panel shows what each addon
 *     did during the last turn (transparency).
 *
 * Collapsible (#737): the » chevron shrinks the whole column to a
 * thin rail so the canvas gets the full screen. The chats stay
 * MOUNTED while collapsed (display:none) — collapsing mid-preview
 * must not reset the conversation or a streaming turn.
 */

import { useState } from 'react';
import { BuilderChat } from './BuilderChat';
import { UserChat } from './UserChat';
import styles from './ChatPanel.module.css';

type Tab = 'builder' | 'user';

const COLLAPSED_KEY = 'builder:chatCollapsed';

export function ChatPanel() {
  // Default to User Chat — that's the surface authors reach for most
  // (test the agent they're building). Builder Chat is one tab away.
  const [tab, setTab] = useState<Tab>('user');
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <>
      {collapsed && (
        <div className={styles.collapsedRail}>
          <button
            type="button"
            className={styles.railBtn}
            onClick={toggleCollapsed}
            title="Show chat panel"
          >
            «
          </button>
          <span className={styles.railLabel}>💬 Chat</span>
        </div>
      )}

      <div className={`${styles.wrap} ${collapsed ? styles.wrapHidden : ''}`}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'builder' ? styles.tabActive : ''}`}
            onClick={() => setTab('builder')}
          >
            <span className={styles.tabIcon}>🛠️</span>
            <span>Builder Chat</span>
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'user' ? styles.tabActive : ''}`}
            onClick={() => setTab('user')}
          >
            <span className={styles.tabIcon}>💬</span>
            <span>User Chat</span>
          </button>
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            title="Hide chat panel — full-screen builder"
          >
            »
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'builder' ? <BuilderChat /> : <UserChat />}
        </div>
      </div>
    </>
  );
}
