import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import styles from './DashboardLayout.module.css';

interface DashboardLayoutProps {
  agentName: string;
  agentDisplayName: string;
  agentLogo: string;
  basePath: string;
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: 'feedback', label: 'Feedback', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
];

export function DashboardLayout({ agentDisplayName, agentLogo, basePath, children }: DashboardLayoutProps) {
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
          {NAV_ITEMS.map(item => (
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
