/**
 * Lybi HQ — the shell.
 *
 * Our internal company brain. Not a product, not part of the builder, never
 * customer-facing. See aspect-agent-server/docs/guides/LYBI_HQ.md.
 *
 * Styling deliberately mirrors the customer chat (`live-chat/liveChat.css`) —
 * same palette, gradient, fonts and component language — so HQ reads as
 * unmistakably Lybi.
 */

import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import { AskScreen } from './screens/AskScreen';
import { DropScreen } from './screens/DropScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { AtomScreen } from './screens/AtomScreen';
import { IntegrationsScreen } from './screens/IntegrationsScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { AskProvider } from './ask/AskContext';
import { AskPanel } from './ask/AskPanel';
import { IconActivity, IconAsk, IconDrop, IconLibrary, IconMoon, IconPlug, IconSun } from './icons';
import { getStatus, listRuns } from './services/hqApi';
import type { HQStatus } from './types';

import './hq.css';
import styles from './HQApp.module.css';

type Theme = 'light' | 'dark';
const THEME_KEY = 'lybi_hq_theme';

/**
 * Four words, no jargon. "Sources" used to be a fifth entry listing where each
 * import came from — the same question Integrations answers from the
 * connector's side, so it moved in there and its route now redirects.
 */
const NAV = [
  { to: 'ask',          Icon: IconAsk,     label: 'Ask',          hint: 'Ask anything about Lybi',            showCount: false, sub: false },
  { to: 'add',          Icon: IconDrop,    label: 'Add',          hint: 'Paste a link, file or note',         showCount: false, sub: false },
  { to: 'knowledge',    Icon: IconLibrary, label: 'Knowledge',    hint: 'Everything HQ has read',             showCount: true,  sub: false },
  { to: 'integrations', Icon: IconPlug,    label: 'Integrations', hint: 'Notion, Drive — pick what HQ reads', showCount: false, sub: false },
  // Sits under Integrations because it's where a run you started from there
  // goes to live. It's a destination in its own right, not a footnote.
  { to: 'activity',     Icon: IconActivity, label: 'Running & history', hint: 'What HQ is doing now, and everything it has done', showCount: false, sub: true },
];

export function HQApp() {
  const [status, setStatus] = useState<HQStatus | null>(null);
  const [running, setRunning] = useState(0);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || 'light',
  );

  const refreshStatus = useCallback(() => {
    getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    document.title = 'Lybi HQ';
    refreshStatus();
  }, [refreshStatus]);

  // A live badge in the nav is the only way to notice a run from another
  // screen — runs outlive the page that started them.
  useEffect(() => {
    const check = () => listRuns(5)
      .then(rs => setRunning(rs.filter(r => r.status === 'running').length))
      .catch(() => setRunning(0));
    check();
    const timer = setInterval(check, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);

  return (
    <AskProvider>
    <div className="lybi-hq" data-theme={theme}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img className={styles.logo} src="/img/lybi-logo-transparent.png" alt="Lybi" />
          <span className={styles.brandDivider} />
          <span className={styles.brandTag}>HQ</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, Icon, label, hint, showCount, sub }) => (
            <NavLink
              key={to}
              to={to}
              title={hint}
              className={({ isActive }) =>
                `${styles.navItem} ${sub ? styles.navSub : ''} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}><Icon /></span>
              <span className={styles.navLabel}>{label}</span>
              {to === 'activity' && running > 0 && (
                <span className={styles.navLive} title={`${running} running`} />
              )}
              {showCount && status ? <span className={styles.navCount}>{status.totalAtoms}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFoot}>
          <div className={styles.statLine}>
            <span className={`${styles.dot} ${status ? styles.dotOk : styles.dotOff}`} />
            {status
              ? status.totalAtoms === 0
                ? 'HQ is empty'
                : `HQ has read ${status.totalAtoms} ${status.totalAtoms === 1 ? 'thing' : 'things'}`
              : 'connecting…'}
          </div>
          <div className={styles.statLine}>
            <span className={`${styles.dot} ${status?.notionConfigured ? styles.dotOk : styles.dotWarn}`} />
            Notion {status?.notionConfigured ? 'connected' : 'not connected'}
          </div>
          {status && status.failed > 0 && (
            <div className={styles.statLine}>
              <span className={`${styles.dot} ${styles.dotWarn}`} />
              {status.failed} couldn't be read
            </div>
          )}

          <button
            className={styles.themeBtn}
            onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Routes>
          <Route index element={<Navigate to="ask" replace />} />
          <Route path="ask" element={<AskScreen />} />
          <Route path="add" element={<DropScreen onIngested={refreshStatus} />} />
          <Route path="knowledge" element={<LibraryScreen />} />
          <Route path="knowledge/:id" element={<AtomScreen />} />
          <Route path="integrations" element={<IntegrationsScreen onChanged={refreshStatus} />} />
          <Route path="activity" element={<ActivityScreen />} />

          {/* Old names, kept so any bookmark or in-app link still lands. */}
          <Route path="drop" element={<Navigate to="../add" replace />} />
          <Route path="library" element={<Navigate to="../knowledge" replace />} />
          <Route path="library/:id" element={<AtomScreen />} />
          <Route path="connections" element={<Navigate to="../integrations" replace />} />
          <Route path="sources" element={<Navigate to="../integrations" replace />} />

          <Route path="*" element={<Navigate to="ask" replace />} />
        </Routes>
      </main>

      {/* Ask sits on top of every screen — never something you navigate away to. */}
      <AskPanel />
    </div>
    </AskProvider>
  );
}
