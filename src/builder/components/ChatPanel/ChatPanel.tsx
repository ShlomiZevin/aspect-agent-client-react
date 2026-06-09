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
 * LLM wiring lands in the next slice. For now the panels render
 * stub messages and the Builder Chat shows the context it would
 * send so we can validate the JSON shape end-to-end.
 */

import { useState } from 'react';
import { BuilderChat } from './BuilderChat';
import { UserChat } from './UserChat';
import styles from './ChatPanel.module.css';

type Tab = 'builder' | 'user';

export function ChatPanel() {
  // Default to User Chat — that's the surface authors reach for most
  // (test the agent they're building). Builder Chat is one tab away.
  const [tab, setTab] = useState<Tab>('user');

  return (
    <div className={styles.wrap}>
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
      </div>

      <div className={styles.body}>
        {tab === 'builder' ? <BuilderChat /> : <UserChat />}
      </div>
    </div>
  );
}
