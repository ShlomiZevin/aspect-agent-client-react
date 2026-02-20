import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  agentName: string;
  agentDisplayName: string;
  agentLogo: string;
  basePath: string;
  showQueryOptimizer?: boolean;
  children: ReactNode;
}

const BASE_NAV_ITEMS = [
  { path: 'feedback', label: 'Feedback', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
  { path: 'users', label: 'Users', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75' },
  { path: 'crew', label: 'Crew', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
];

const QUERY_OPTIMIZER_ITEM = {
  path: 'query-optimizer',
  label: 'Query Optimizer',
  icon: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M9 17l2-2 4-4',
};

export function DashboardLayout({ agentDisplayName, agentLogo, basePath, showQueryOptimizer, children }: DashboardLayoutProps) {
  const navItems = showQueryOptimizer
    ? [...BASE_NAV_ITEMS, QUERY_OPTIMIZER_ITEM]
    : BASE_NAV_ITEMS;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <img src={agentLogo} alt={agentDisplayName} className={styles.logo} />
          <div>
            <div className={styles.agentName}>{agentDisplayName}</div>
            <div className={styles.dashboardLabel}>Dashboard</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={`${basePath}/${item.path}`}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <NavLink to={`/${basePath.split('/')[1]}`} className={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to Chat
          </NavLink>
        </div>
      </aside>

      <main className={styles.content}>
        {children}
      </main>
    </div>
  );
}
