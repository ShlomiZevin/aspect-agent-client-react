/**
 * BuilderLayout — three-panel shell.
 *
 *   ┌──────────────┬──────────────────────────┬──────────────┐
 *   │  Sidebar     │  Center: crew canvas     │  Chat panel  │
 *   │  Project /   │  (prompt, spec, addons)  │  (Builder +  │
 *   │  Agent /     │                          │   User Chat) │
 *   │  Crews       │                          │              │
 *   └──────────────┴──────────────────────────┴──────────────┘
 *
 * No business logic here — just frame + slots.
 */

import type { ReactNode } from 'react';
import styles from './BuilderLayout.module.css';

interface Props {
  topBar: ReactNode;
  sidebar: ReactNode;
  center: ReactNode;
  chat: ReactNode;
}

export function BuilderLayout({ topBar, sidebar, center, chat }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.topBar}>{topBar}</div>
      <div className={styles.body}>
        <aside className={styles.sidebar}>{sidebar}</aside>
        <main className={styles.center}>{center}</main>
        <aside className={styles.chat}>{chat}</aside>
      </div>
    </div>
  );
}
