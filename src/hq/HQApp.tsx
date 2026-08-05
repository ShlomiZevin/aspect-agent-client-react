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
import { SourcesScreen } from './screens/SourcesScreen';
import { IconAsk, IconDrop, IconLibrary, IconMoon, IconSources, IconSun } from './icons';
import { getStatus } from './services/hqApi';
import type { HQStatus } from './types';

import './hq.css';
import styles from './HQApp.module.css';

type Theme = 'light' | 'dark';
const THEME_KEY = 'lybi_hq_theme';

const NAV = [
  { to: 'ask',     Icon: IconAsk,     label: 'Ask',     showCount: false },
  { to: 'drop',    Icon: IconDrop,    label: 'Drop',    showCount: false },
  { to: 'library', Icon: IconLibrary, label: 'Library', showCount: true  },
  { to: 'sources', Icon: IconSources, label: 'Sources', showCount: false },
];

export function HQApp() {
  const [status, setStatus] = useState<HQStatus | null>(null);
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

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);

  return (
    <div className="lybi-hq" data-theme={theme}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img className={styles.logo} src="/img/lybi-logo-transparent.png" alt="Lybi" />
          <span className={styles.brandDivider} />
          <span className={styles.brandTag}>HQ</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, Icon, label, showCount }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}><Icon /></span>
              <span>{label}</span>
              {showCount && status ? <span className={styles.navCount}>{status.totalAtoms}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFoot}>
          <div className={styles.statLine}>
            <span className={`${styles.dot} ${status ? styles.dotOk : styles.dotOff}`} />
            {status ? `${status.totalAtoms} things known` : 'connecting…'}
          </div>
          <div className={styles.statLine}>
            <span className={`${styles.dot} ${status?.notionConfigured ? styles.dotOk : styles.dotWarn}`} />
            Notion {status?.notionConfigured ? 'connected' : 'not set up'}
          </div>
          {status && status.failed > 0 && (
            <div className={styles.statLine}>
              <span className={`${styles.dot} ${styles.dotWarn}`} />
              {status.failed} failed to index
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
          <Route path="drop" element={<DropScreen onIngested={refreshStatus} />} />
          <Route path="library" element={<LibraryScreen />} />
          <Route path="library/:id" element={<AtomScreen />} />
          <Route path="sources" element={<SourcesScreen onChanged={refreshStatus} />} />
          <Route path="*" element={<Navigate to="ask" replace />} />
        </Routes>
      </main>
    </div>
  );
}
