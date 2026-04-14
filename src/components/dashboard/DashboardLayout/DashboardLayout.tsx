import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  agentName: string;
  agentDisplayName: string;
  agentLogo: string;
  basePath: string;
  showQueryOptimizer?: boolean;
  showPodcast?: boolean;
  showConversationTrends?: boolean;
  children: ReactNode;
}

const BASE_NAV_ITEMS = [
  { path: 'feedback', label: 'Feedback', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { path: 'users', label: 'Users', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { path: 'crew', label: 'Crew', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { path: 'crew-editor', label: 'Crew Editor', icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
  { path: 'playground', label: 'Playground', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
  { path: 'knowledge-base', label: 'Knowledge Base', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z' },
  { path: 'dynamic-kb', label: 'Dynamic KB Files', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  { path: 'library', label: 'Library', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' },
];

const QUERY_OPTIMIZER_ITEM = {
  path: 'query-optimizer',
  label: 'Query Optimizer',
  icon: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M9 17l2-2 4-4',
};

const DATA_LOADER_ITEM = {
  path: 'data-loader',
  label: 'Data Loader',
  icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
};

const CONVERSATION_TRENDS_ITEM = {
  path: 'conversation-trends',
  label: 'Conversation Trends',
  icon: 'M3 3v18h18 M7 14l4-4 4 4 5-5',
};

const PODCAST_ITEM = {
  path: 'podcast',
  label: 'Podcast',
  icon: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8',
};

const TEST_RUNNER_ITEM = {
  path: 'test-runner',
  label: 'Test Runner',
  icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
};

const BILLING_ITEM = {
  path: 'billing',
  label: 'Billing',
  icon: 'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
};

const API_KEYS_ITEM = {
  path: 'api-keys',
  label: 'API Keys',
  icon: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
};

const LLM_USAGE_ITEM = {
  path: 'llm-usage',
  label: 'LLM Usage',
  icon: 'M18 20V10 M12 20V4 M6 20v-6',
};

export function DashboardLayout({ agentDisplayName, agentLogo, basePath, showQueryOptimizer, showPodcast, showConversationTrends, children }: DashboardLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(showQueryOptimizer ? [QUERY_OPTIMIZER_ITEM, DATA_LOADER_ITEM] : []),
    ...(showPodcast ? [PODCAST_ITEM] : []),
    ...(showConversationTrends ? [CONVERSATION_TRENDS_ITEM] : []),
    TEST_RUNNER_ITEM,
    BILLING_ITEM,
    LLM_USAGE_ITEM,
    API_KEYS_ITEM,
  ];

  return (
    <div className={styles.layout}>
      {menuOpen && <div className={styles.sidebarBackdrop} onClick={() => setMenuOpen(false)} />}
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <img src={agentLogo} alt={agentDisplayName} className={styles.logo} />
          <div>
            <div className={styles.agentName}>{agentDisplayName}</div>
            <div className={styles.dashboardLabel}>Dashboard</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to={`${basePath}/task-board`}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
            }
            onClick={() => setMenuOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            <span>Task Board</span>
          </NavLink>
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', margin: '4px 12px' }} />
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={`${basePath}/${item.path}`}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <NavLink to={`/${basePath.split('/')[1]}`} className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Chat</span>
          </NavLink>
        </div>
      </aside>

      <main className={styles.content}>
        {children}
      </main>

      <button className={styles.burgerBtn} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
        ☰
      </button>
    </div>
  );
}
