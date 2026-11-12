import { useCallback, useEffect, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SignInMethods, useSession } from '../auth';
import type { Session, SignInConfig } from '../auth';
import { translations } from '../i18n/translations';
import { api } from './api';
import { firstName } from './format';
import { Icon, Loading, adminUi } from './ui';
import { useLoad } from './useLoad';
import type { Person } from './types';
import { MorningPage } from './pages/MorningPage';
import { ReportPage } from './pages/ReportPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientCardPage } from './pages/ClientCardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { QuotesPage } from './pages/QuotesPage';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { AskPage } from './pages/AskPage';
import styles from './management.module.css';

/**
 * Aspect Management at /management: the sign-in, who this person is here, and
 * the shell around the screens — in the platform's own look (the dashboard's
 * sidebar, the shared admin page frame). Hebrew only, including the sign-in.
 * See aspect-agent-server/aspect-management/README.md.
 */

// An Aspect employee's sign-in account lives on the Aspect project.
const TENANT = 'aspect';
const LOGO = '/img/aspect-logo-regular.png';

// The sign-in stays shut, offering the password form, if its config cannot be read.
const FALLBACK: SignInConfig = { enabled: true, purpose: 'gate', google: false, password: true, clientId: '' };

const hebrew = (key: string) => translations.he[key] ?? key;
const SIGN_IN_FAILED = 'לא הצלחנו להכניס אותך. בדקו את הפרטים, או בקשו מאיציק לפתוח לכם גישה.';

const NAV = [
  { to: '/management', label: 'בית', icon: 'home', end: true },
  { to: '/management/projects', label: 'פרויקטים', icon: 'projects' },
  { to: '/management/team', label: 'צוות', icon: 'team' },
  { to: '/management/clients', label: 'לקוחות', icon: 'clients' },
  { to: '/management/quotes', label: 'הצעות מחיר', icon: 'quotes' },
  { to: '/management/ask', label: 'שואלים את המערכת', icon: 'ask' },
  // Settings is always last in its group.
  { to: '/management/settings', label: 'הגדרות', icon: 'settings' },
];

export function ManagementRoute() {
  const { session, config, loading, signIn, signOut } = useSession(TENANT);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Aspect | ניהול';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className={`theme-aspect ${styles.app}`} dir="rtl" lang="he">
      {loading ? null : session
        ? <SignedIn session={session} signOut={signOut} />
        : <SignIn config={config ?? FALLBACK} onSignedIn={signIn} />}
    </div>
  );
}

/** The site's sign-in card (SignInScreen), in Hebrew. */
function SignCard({ title, sub, children, foot }: { title: string; sub: ReactNode; children?: ReactNode; foot?: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.signCard}>
        <img className={styles.signLogo} src={LOGO} alt="Aspect" />
        <h1 className={styles.signTitle}>{title}</h1>
        <p className={styles.signSub}>{sub}</p>
        {children}
        {foot && <p className={styles.signFoot}>{foot}</p>}
      </div>
    </main>
  );
}

function SignIn({ config, onSignedIn }: { config: SignInConfig; onSignedIn: (s: Session) => void }) {
  return (
    <SignCard
      title="כניסה לניהול"
      sub="התחברו כדי להמשיך"
      foot="הגישה נפתחת מראש. אם אין לכם גישה, בקשו מאיציק להוסיף אתכם."
    >
      <SignInMethods
        tenant={TENANT}
        config={config}
        onSignedIn={onSignedIn}
        t={hebrew}
        googleLocale="he"
        describeError={() => SIGN_IN_FAILED}
        emailPlaceholder=""
      />
    </SignCard>
  );
}

function SignedIn({ session, signOut }: { session: Session; signOut: () => void }) {
  // Wrapped, because `me` answers null for "not on the list" and useLoad's null
  // means "not loaded yet".
  const load = useCallback(
    () => api.me(session.email, session.name).then(person => ({ person })),
    [session.email, session.name],
  );
  const { data, error } = useLoad(load);

  if (!data) return <main className={styles.screen}><Loading error={error} /></main>;
  const { person } = data;

  if (!person) {
    return (
      <SignCard title="עוד לא ברשימה" sub={<><bdi>{session.email}</bdi> לא נמצא ברשימת הצוות. בקשו מאיציק להוסיף אתכם.</>}>
        <button type="button" className={adminUi.btn} onClick={signOut}>יציאה</button>
      </SignCard>
    );
  }

  return person.role === 'owner'
    ? <OwnerShell person={person} signOut={signOut} />
    : <DeveloperShell person={person} signOut={signOut} />;
}

/** A developer gets the report screen and nothing else. */
function DeveloperShell({ person, signOut }: { person: Person; signOut: () => void }) {
  return (
    <div className={styles.devShell}>
      <header className={styles.topBar}>
        <span className={styles.topBrand}>
          <img className={styles.brandLogo} src={LOGO} alt="" />
          Aspect
        </span>
        <span className={styles.topUser}>
          {firstName(person.name)}
          <button type="button" className={styles.linkBtn} onClick={signOut}>יציאה</button>
        </span>
      </header>
      <main className={styles.devContent}>
        <div className={styles.narrow}><ReportPage person={person} /></div>
      </main>
    </div>
  );
}

function OwnerShell({ person, signOut }: { person: Person; signOut: () => void }) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <img className={styles.brandLogo} src={LOGO} alt="" />
          <div>
            <div className={styles.brandName}>Aspect</div>
            <div className={styles.brandLabel}>ניהול העסק</div>
          </div>
        </div>
        <nav className={styles.nav} aria-label="ניווט ראשי">
          <div className={styles.groupLabel}>ניהול</div>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <div className={styles.accountId}>
              <span className={styles.accountName}>{person.name}</span>
              <span className={styles.accountEmail}>{person.email}</span>
            </div>
            <button type="button" className={styles.linkBtn} onClick={signOut}>יציאה</button>
          </div>
        </div>
      </aside>
      <main className={styles.content}>
        <Routes>
          <Route index element={<MorningPage person={person} />} />
          <Route path="report" element={<ReportPage person={person} />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientCardPage person={person} />} />
          <Route path="quotes" element={<QuotesPage />} />
          <Route path="ask" element={<AskPage person={person} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/management" replace />} />
        </Routes>
      </main>
    </div>
  );
}
