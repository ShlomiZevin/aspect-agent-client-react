import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './DashboardLayout.module.css';

type UserType = 'admin' | 'business';

const BUSINESS_PATHS = new Set(['knowledge-base', 'dynamic-kb', 'conversation-trends']);

interface DashboardLayoutProps {
  agentName: string;
  agentDisplayName: string;
  agentLogo: string;
  basePath: string;
  showQueryOptimizer?: boolean;
  showModules?: boolean;
  /** This client has an Aspect Intelligence dataset (enabled or not). */
  showIntelligence?: boolean;
  /** The original board in the platform DB belongs to this client. */
  showLegacyTaskBoard?: boolean;
  /** The Sign-In module is live for this client. */
  /** The Task Board module is live for this client. */
  showTaskboard?: boolean;
  showPodcast?: boolean;
  showConversationTrends?: boolean;
  /** Keep the original single flat list instead of the grouped menu. */
  flatMenu?: boolean;
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  id: string;
  label: string;
  /** Small line under the group label, e.g. that its pages aren't per-client. */
  note?: string;
  items: NavItem[];
}

const FEEDBACK_ITEM = { path: 'feedback', label: 'Feedback', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' };
const USERS_ITEM = { path: 'users', label: 'Users', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' };
const CREW_ITEM = { path: 'crew', label: 'Crew', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' };
const CREW_EDITOR_ITEM = { path: 'crew-editor', label: 'Crew Editor', icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' };
const PLAYGROUND_ITEM = { path: 'playground', label: 'Playground', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' };
const KNOWLEDGE_BASE_ITEM = { path: 'knowledge-base', label: 'Knowledge Base', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z' };
const DYNAMIC_KB_ITEM = { path: 'dynamic-kb', label: 'Dynamic KB Files', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' };
const LIBRARY_ITEM = { path: 'library', label: 'Library', icon: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5' };

// Aspect Intelligence admin for this client's dataset (see
// components/dashboard/IntelligenceAdmin) — used to be its own app at
// /intelligence/admin with a separate sidebar.
// Settings items always go LAST in their group (Settings here and
// Settings in Workspace) — the pages you use come first, the one you set up
// once comes after them.
// Intelligence Settings holds General / Prompts / Quick Questions as tabs,
// each with its own URL under this path — so the item stays highlighted on
// all three. Labelled just "Settings": the group header already says whose.
const INTELLIGENCE_SETTINGS_ITEM = { path: 'intelligence/report-settings', label: 'Settings', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' };

const INTELLIGENCE_ITEMS = [
  { path: 'intelligence/insights', label: 'Insights', icon: 'M18 20V10 M12 20V4 M6 20v-6' },
];

// Every client's dataset in one table — cross-client, so it sits in Platform.
const INTELLIGENCE_OVERVIEW_ITEM = {
  path: 'intelligence-overview',
  label: 'Intelligence Overview',
  icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
};

// THIS client's project in detail — first item of its Intelligence group.
const DATASET_OVERVIEW_ITEM = {
  path: 'intelligence/overview',
  label: 'Overview',
  icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
};

const LEGACY_TASK_BOARD_ITEM = {
  path: 'task-board',
  label: 'Task Board',
  icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
};

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

// Aspect Modules — optional per-client capabilities (Smart Replenishment is
// the first). Super-admin only; see modules/routes/modules.routes.js.
const MODULES_ITEM = {
  path: 'modules',
  label: 'Modules',
  icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z M3.27 6.96L12 12.01l8.73-5.05 M12 22.08V12',
};

// Our own task board, when the Task Board module is switched on for this
// client. Distinct from the hardcoded "Task Board" link above the list, which
// is the original board against the platform database.
const TASKBOARD_ITEM = {
  path: 'taskboard',
  label: 'Tasks',
  icon: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
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
  path: 'settings',
  label: 'Settings',
  icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

const LLM_USAGE_ITEM = {
  path: 'llm-usage',
  label: 'LLM Usage',
  icon: 'M18 20V10 M12 20V4 M6 20v-6',
};

const CLOUD_RUN_LOGS_ITEM = {
  path: 'cloud-run-logs',
  label: 'Cloud Run Logs',
  icon: 'M4 17L10 11 4 5 M12 19h8',
};


// Which groups the admin has folded, remembered across visits. Every group
// is unfolded by default; only what the admin folds by hand stays folded.
const CLOSED_GROUPS_KEY = 'adminNavClosedGroups';

function readClosedGroups(): Set<string> {
  try {
    const saved = localStorage.getItem(CLOSED_GROUPS_KEY);
    if (saved) return new Set(JSON.parse(saved) as string[]);
  } catch { /* unreadable — everything unfolded */ }
  return new Set();
}

function writeClosedGroups(groups: Set<string>) {
  try {
    localStorage.setItem(CLOSED_GROUPS_KEY, JSON.stringify([...groups]));
  } catch { /* storage blocked — the menu just won't remember */ }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function DashboardLayout({ agentDisplayName, agentLogo, basePath, showQueryOptimizer, showModules, showIntelligence, showTaskboard, showLegacyTaskBoard, showPodcast, showConversationTrends, flatMenu, children }: DashboardLayoutProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userType, setUserType] = useState<UserType>(() => (localStorage.getItem('adminUserType') as UserType) || 'admin');
  const [closedGroups, setClosedGroups] = useState<Set<string>>(readClosedGroups);

  const changeUserType = (type: UserType) => {
    setUserType(type);
    localStorage.setItem('adminUserType', type);
  };

  const allGroups: NavGroup[] = [
    {
      id: 'quality',
      label: 'Quality',
      items: [
        FEEDBACK_ITEM,
        USERS_ITEM,
        TEST_RUNNER_ITEM,
        ...(showConversationTrends || userType === 'business' ? [CONVERSATION_TRENDS_ITEM] : []),
      ],
    },
    {
      id: 'agent',
      label: 'Agent',
      items: [CREW_ITEM, CREW_EDITOR_ITEM, PLAYGROUND_ITEM],
    },
    {
      id: 'knowledge',
      label: 'Knowledge',
      items: [KNOWLEDGE_BASE_ITEM, DYNAMIC_KB_ITEM, LIBRARY_ITEM],
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      items: [
        ...(showIntelligence ? [DATASET_OVERVIEW_ITEM, ...INTELLIGENCE_ITEMS] : []),
        ...(showQueryOptimizer ? [DATA_LOADER_ITEM] : []),
        ...(showModules ? [MODULES_ITEM] : []),
        ...(showIntelligence ? [INTELLIGENCE_SETTINGS_ITEM] : []),
      ],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        // The original board, in the platform DB. Shown only where it is
        // actually used — it is LYBI's board, and Hila and Noa are the people
        // on it. Everywhere else it was a link to someone else's work.
        ...(showLegacyTaskBoard ? [LEGACY_TASK_BOARD_ITEM] : []),
        ...(showTaskboard ? [TASKBOARD_ITEM] : []),
        ...(showPodcast ? [PODCAST_ITEM] : []),
        API_KEYS_ITEM,
      ],
    },
    {
      id: 'platform',
      label: 'Platform',
      note: 'Same for all clients',
      // Query Optimizer lists slow queries of every client's schema, not this
      // one's — so it lives here, for every client, rather than per dataset.
      items: [INTELLIGENCE_OVERVIEW_ITEM, BILLING_ITEM, LLM_USAGE_ITEM, QUERY_OPTIMIZER_ITEM, CLOUD_RUN_LOGS_ITEM],
    },
  ];

  // The menu as it was before the grouping, item for item and in its order,
  // for agents that keep it (see DashboardPage). One headerless group.
  const flatGroups: NavGroup[] = [{
    id: 'flat',
    label: '',
    items: [
      ...(showLegacyTaskBoard ? [LEGACY_TASK_BOARD_ITEM] : []),
      FEEDBACK_ITEM, USERS_ITEM, CREW_ITEM, CREW_EDITOR_ITEM, PLAYGROUND_ITEM,
      KNOWLEDGE_BASE_ITEM, DYNAMIC_KB_ITEM, LIBRARY_ITEM,
      ...(showQueryOptimizer ? [QUERY_OPTIMIZER_ITEM, DATA_LOADER_ITEM] : []),
      ...(showModules ? [MODULES_ITEM] : []),
      ...(showIntelligence ? [INTELLIGENCE_SETTINGS_ITEM, ...INTELLIGENCE_ITEMS] : []),
      ...(showTaskboard ? [TASKBOARD_ITEM] : []),
      ...(showPodcast ? [PODCAST_ITEM] : []),
      ...(showConversationTrends || userType === 'business' ? [CONVERSATION_TRENDS_ITEM] : []),
      TEST_RUNNER_ITEM, BILLING_ITEM, LLM_USAGE_ITEM, API_KEYS_ITEM, CLOUD_RUN_LOGS_ITEM,
    ],
  }];

  const groups = (flatMenu ? flatGroups : allGroups)
    .map(g => userType === 'business' ? { ...g, items: g.items.filter(item => BUSINESS_PATHS.has(item.path)) } : g)
    .filter(g => g.items.length > 0);

  const isItemActive = (item: NavItem) => {
    const itemPath = `${basePath}/${item.path}`;
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
  };

  // Landing on a page inside a folded group (a link, a reload, a redirect)
  // unfolds that group, so the current page is always visible in the menu.
  // Adjusted during render rather than in an effect, and only when the
  // active group changes — so folding the current group by hand still works.
  const activeGroupId = groups.find(g => g.items.some(isItemActive))?.id;
  const [seenActiveGroupId, setSeenActiveGroupId] = useState<string | undefined>();
  if (activeGroupId !== seenActiveGroupId) {
    setSeenActiveGroupId(activeGroupId);
    if (activeGroupId && closedGroups.has(activeGroupId)) {
      const next = new Set(closedGroups);
      next.delete(activeGroupId);
      setClosedGroups(next);
    }
  }

  // A page low in the menu (the Platform group) must not leave its item
  // scrolled out of sight inside the sidebar.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector(`.${styles.navItemActive}`)?.scrollIntoView({ block: 'nearest' });
  }, [location.pathname]);

  const toggleGroup = (id: string) => {
    setClosedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeClosedGroups(next);
      return next;
    });
  };

  return (
    <div className={styles.layout}>
      {menuOpen && <div className={styles.sidebarBackdrop} onClick={() => setMenuOpen(false)} />}
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <img src={agentLogo} alt={agentDisplayName} className={styles.logo} />
          <div>
            <div className={styles.agentName}>{agentDisplayName}</div>
            <div className={styles.dashboardLabel}>Admin</div>
          </div>
        </div>

        <div style={{ padding: '8px 12px 4px' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.06)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            <button
              onClick={() => changeUserType('admin')}
              style={{
                flex: 1, padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: userType === 'admin' ? '#fff' : 'transparent',
                color: userType === 'admin' ? '#1e293b' : '#64748b',
                boxShadow: userType === 'admin' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >Admin</button>
            <button
              onClick={() => changeUserType('business')}
              style={{
                flex: 1, padding: '5px 8px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: userType === 'business' ? '#fff' : 'transparent',
                color: userType === 'business' ? '#1e293b' : '#64748b',
                boxShadow: userType === 'business' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >Business</button>
          </div>
        </div>

        <nav ref={navRef} className={styles.nav}>
          {groups.map(group => {
            const headerless = !group.label;
            const open = headerless || !closedGroups.has(group.id);
            const holdsActive = group.id === activeGroupId;
            return (
              <div key={group.id} className={styles.navGroup}>
                {!headerless && <button
                  type="button"
                  className={`${styles.groupHeader} ${!open && holdsActive ? styles.groupHeaderActive : ''}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                >
                  <ChevronIcon open={open} />
                  <span className={styles.groupLabel}>{group.label}</span>
                  {group.note && <span className={styles.groupNote}>{group.note}</span>}
                </button>}
                {open && (
                  <div className={styles.groupItems}>
                    {group.items.map(item => (
                      <Fragment key={item.path}>
                        <NavLink
                          to={`${basePath}/${item.path}`}
                          className={() => `${styles.navItem} ${isItemActive(item) ? styles.navItemActive : ''}`}
                          onClick={() => setMenuOpen(false)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={item.icon} />
                          </svg>
                          <span>{item.label}</span>
                        </NavLink>
                        {/* The flat menu keeps the legacy board set apart at the top, as before. */}
                        {headerless && item === LEGACY_TASK_BOARD_ITEM && <div className={styles.flatDivider} />}
                      </Fragment>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
