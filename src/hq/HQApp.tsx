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
import { TeamScreen } from './screens/TeamScreen';
import { WorkerScreen } from './screens/WorkerScreen';
import { MediaScreen } from './screens/MediaScreen';
import { UsageScreen } from './screens/UsageScreen';
import { AskProvider } from './ask/AskContext';
import { AskPanel } from './ask/AskPanel';
import {
  IconAsk, IconDrop, IconLibrary, IconMedia, IconMoon, IconPlug, IconSun, IconTeam,
} from './icons';
import { getStatus, listRuns, listWorkers } from './services/hqApi';
import type { HQStatus, Worker } from './types';

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
  { to: 'team',         Icon: IconTeam,    label: 'Team',         hint: 'The employees who do work for you',  showCount: false, sub: false },
  { to: 'media',        Icon: IconMedia,   label: 'Media',        hint: 'Everything the team has made',       showCount: false, sub: false },
  { to: 'integrations', Icon: IconPlug,    label: 'Integrations', hint: 'Notion, Drive — pick what HQ reads', showCount: false, sub: false },
];

/**
 * Entries that open. Both behave identically — same chevron, same click
 * target, same indented children — because two things that expand should not
 * need to be learned separately.
 */
const EXPANDABLE: Record<string, { people?: boolean; items?: { to: string; label: string; icon: string }[] }> = {
  // Team lists the actual employees, plus what they cost to run.
  team: { people: true, items: [{ to: 'usage', label: 'Spending', icon: '$' }] },
  integrations: { items: [{ to: 'activity', label: 'Running & history', icon: '◍' }] },
};

export function HQApp() {
  const [status, setStatus] = useState<HQStatus | null>(null);
  const [running, setRunning] = useState(0);
  // The team expands in the nav so you can go straight to a person rather than
  // through a list. Open by default — with two employees, hiding them is worse
  // than showing them.
  const [people, setPeople] = useState<Worker[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ team: true, integrations: true });
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

  /**
   * A live badge in the nav is the only way to notice a run from another
   * screen — runs outlive the page that started them.
   *
   * Deliberately slow, and paused while the tab is hidden. At 4s this polled
   * ~15 times a minute from every open tab whether or not anything was
   * running; the page that actually needs second-by-second detail (Activity)
   * polls fast on its own, and only while a run is live.
   */
  useEffect(() => {
    const check = () => {
      if (document.hidden) return;
      listRuns(5)
        .then(rs => setRunning(rs.filter(r => r.status === 'running').length))
        .catch(() => setRunning(0));
    };
    check();
    const timer = setInterval(check, 20_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  /**
   * The roster, refreshed while anyone is working.
   *
   * This used to run once on mount, so the "working" badge was a snapshot from
   * page load: it never appeared for a job started elsewhere and — worse — never
   * cleared when one finished, which needed a page reload to correct.
   *
   * Polls only while someone is actually working, so an idle HQ is silent.
   */
  useEffect(() => {
    let alive = true;
    const load = () => listWorkers()
      .then(r => { if (alive) setPeople(r.workers); })
      .catch(() => { if (alive) setPeople([]); });

    void load();
    const busy = people.some(p => p.running_jobs);
    const timer = setInterval(load, busy ? 3000 : 20000);
    return () => { alive = false; clearInterval(timer); };
  }, [people.some(p => p.running_jobs)]);

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
          {NAV.flatMap(({ to, Icon, label, hint, showCount }) => {
            const group = EXPANDABLE[to];
            const items = group?.items || [];
            const showsPeople = !!group?.people && people.length > 0;
            const expandable = !!group && (showsPeople || items.length > 0);
            const isOpen = open[to] !== false;

            return [
              <NavLink
                key={to}
                to={to}
                title={hint}
                className={({ isActive }) =>
                  `${styles.navItem} ${expandable ? styles.navGroup : ''} ${isActive ? styles.navItemActive : ''}`}
                // The whole row toggles, not just the chevron — a 12px target
                // for something you open constantly is a nuisance. Navigation
                // still happens; opening comes along with it.
                onClick={() => expandable && setOpen(o => ({ ...o, [to]: !isOpen }))}
              >
                <span className={styles.navIcon}><Icon /></span>
                <span className={styles.navLabel}>{label}</span>
                {showCount && status ? <span className={styles.navCount}>{status.totalAtoms}</span> : null}
                {expandable && (
                  <span className={`${styles.navChevron} ${isOpen ? styles.navChevronOpen : ''}`}>▾</span>
                )}
              </NavLink>,

              ...(expandable && isOpen ? [(
                <div key={`${to}-kids`} className={styles.navChildren}>
                  {showsPeople && people.map(p => (
                    <NavLink
                      key={p.slug}
                      to={`team/${p.slug}`}
                      title={`${p.name} — ${p.role_title}`}
                      className={({ isActive }) =>
                        `${styles.navItem} ${styles.navChild} ${isActive ? styles.navChildActive : ''}`}
                    >
                      <span className={styles.navIcon}>{p.avatar || '🙂'}</span>
                      <span className={styles.navLabel}>{p.name}</span>
                      {!!p.running_jobs && (
                        <span
                          className={styles.navWorking}
                          title={p.running_jobs === 1 ? 'on a job right now' : `on ${p.running_jobs} jobs right now`}
                        >
                          <span className="hqDots"><i /><i /><i /></span>
                          working
                        </span>
                      )}
                    </NavLink>
                  ))}

                  {items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `${styles.navItem} ${styles.navChild} ${isActive ? styles.navChildActive : ''}`}
                    >
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span className={styles.navLabel}>{item.label}</span>
                      {item.to === 'activity' && running > 0 && (
                        <span className={styles.navLive} title={`${running} running`} />
                      )}
                    </NavLink>
                  ))}
                </div>
              )] : []),
            ];
          })}
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
          {/* One line per source, so adding a connector needs no change here. */}
          {(status?.sources ?? []).map(s => (
            <div key={s.id} className={styles.statLine}>
              <span className={`${styles.dot} ${s.connected ? styles.dotOk : styles.dotWarn}`} />
              {s.name} {s.connected ? 'connected' : 'not connected'}
            </div>
          ))}
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
          <Route path="team" element={<TeamScreen />} />
          <Route path="team/:slug" element={<WorkerScreen />} />
          <Route path="media" element={<MediaScreen />} />
          <Route path="usage" element={<UsageScreen />} />

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
