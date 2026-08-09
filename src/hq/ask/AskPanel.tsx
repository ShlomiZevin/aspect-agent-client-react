/**
 * HQ — the Ask panel.
 *
 * Ask lives *on top of* everything rather than being somewhere you navigate to.
 * Open it from any screen, ask, click a citation — the content opens behind the
 * panel and the conversation stays exactly where it was. Same thread as the Ask
 * tab, because both read from AskContext.
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { useAsk } from './AskContext';
import { Conversation } from './Conversation';
import { Composer } from './Composer';
import { IconAsk } from '../icons';
import styles from './AskPanel.module.css';

export function AskPanel() {
  const { panelOpen, openPanel, closePanel, togglePanel, turns } = useAsk();
  const location = useLocation();

  // On the Ask tab the full surface already shows the thread — a panel on top
  // of it would be two copies of the same conversation.
  const onAskTab = location.pathname.replace(/\/+$/, '').endsWith('/ask');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (!onAskTab) togglePanel();
      }
      if (e.key === 'Escape') closePanel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAskTab, togglePanel, closePanel]);

  if (onAskTab) return null;

  return (
    <>
      {!panelOpen && (
        <button className={styles.fab} onClick={openPanel} title="Ask HQ  (⌘K)">
          <IconAsk />
          <span className={styles.fabLabel}>Ask HQ</span>
          {turns.length > 0 && <span className={styles.fabDot} />}
        </button>
      )}

      <aside className={`${styles.panel} ${panelOpen ? styles.open : ''}`} aria-hidden={!panelOpen}>
        <header className={styles.head}>
          <span className={styles.headMark}><img src="/img/lybi-spiral.png" alt="" /></span>
          <span className={styles.headTitle}>Ask HQ</span>
          <button className={styles.close} onClick={closePanel} aria-label="Close">✕</button>
        </header>

        <div className={styles.body}>
          {turns.length === 0 ? (
            <div className={styles.empty}>
              Ask anything about our meetings, docs and decisions — without leaving this page.
            </div>
          ) : (
            <Conversation compact />
          )}
        </div>

        <div className={styles.foot}>
          <Composer compact autoFocus={panelOpen} placeholder="Ask HQ…" />
        </div>
      </aside>
    </>
  );
}
