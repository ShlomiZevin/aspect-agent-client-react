import { Fragment, useCallback, useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SignInMethods, useSession } from '../auth';
import type { Session, SignInConfig } from '../auth';
import { translations } from '../i18n/translations';
import { api } from './api';
import { firstName } from './format';
import { BarsMark, Icon, Loading } from './ui';
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
import styles from './ledger.module.css';

/**
 * Aspect Management at /management: the sign-in, who this person is here, and
 * the shell around the screens. Hebrew only, including the sign-in. See
 * aspect-agent-server/aspect-management/README.md.
 */

// An Aspect employee's sign-in account lives on the Aspect project.
const TENANT = 'aspect';
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@700&family=Playpen+Sans+Hebrew:wght@600&display=swap';

// The sign-in stays shut, offering the password form, if its config cannot be read.
const FALLBACK: SignInConfig = { enabled: true, purpose: 'gate', google: false, password: true, clientId: '' };

const hebrew = (key: string) => translations.he[key] ?? key;
const SIGN_IN_FAILED = 'לא הצלחנו להכניס אותך. בדקו את הפרטים, או בקשו מאיציק לפתוח לכם גישה.';

const NAV = [
  { to: '/aspect/management', label: 'בית', icon: 'home', end: true },
  { to: '/aspect/management/projects', label: 'פרויקטים', icon: 'projects' },
  { to: '/aspect/management/team', label: 'צוות', icon: 'team' },
  { to: '/aspect/management/clients', label: 'לקוחות', icon: 'clients' },
  { to: '/aspect/management/quotes', label: 'הצעות מחיר', icon: 'quotes' },
  { to: '/aspect/management/ask', label: 'שואלים את המערכת', icon: 'ask' },
  { to: '/aspect/management/settings', label: 'הגדרות', icon: 'settings' },
];

export function ManagementRoute() {
  const { session, config, loading, signIn, signOut } = useSession(TENANT);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      document.head.appendChild(link);
    }
    const previousTitle = document.title;
    document.title = 'Aspect | ניהול';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className={styles.ledger} dir="rtl" lang="he">
      {loading ? null : session
        ? <SignedIn session={session} signOut={signOut} />
        : <SignIn config={config ?? FALLBACK} onSignedIn={signIn} />}
    </div>
  );
}

function SignIn({ config, onSignedIn }: { config: SignInConfig; onSignedIn: (s: Session) => void }) {
  return (
    <main className={styles.signIn}>
      <SignInBrand />
      <h1 className={styles.title}>כניסה למערכת</h1>
      <SignInMethods
        tenant={TENANT}
        // A Google button with no OAuth client id cannot sign anyone in; offer
        // only the password form until the server has one.
        config={{ ...config, google: config.google && Boolean(config.clientId) }}
        onSignedIn={onSignedIn}
        t={hebrew}
        googleLocale="he"
        describeError={() => SIGN_IN_FAILED}
        emailPlaceholder=""
      />
      <p className={styles.signInQuiet}>אין לכם גישה? בקשו מאיציק</p>
    </main>
  );
}

/** The sign-in's wordmark (ledger-7): Aspect, the bar mark, an ochre stroke, the line. */
function SignInBrand() {
  return (
    <div className={styles.signInBrand}>
      <div className={styles.signInWordmark}>Aspect <BarsMark size={44} /></div>
      <div className={styles.signInLine}>ניהול עסק פשוט</div>
    </div>
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

  if (!data) return <main className={styles.signIn}><Loading error={error} /></main>;
  const { person } = data;

  if (!person) {
    return (
      <main className={styles.signIn}>
        <SignInBrand />
        <h1 className={styles.title}>עוד לא ברשימה</h1>
        <p className={styles.sub}>{session.email} לא נמצא ברשימת הצוות. בקשו מאיציק להוסיף אתכם.</p>
        <button type="button" className={styles.linkBtn} onClick={signOut}>יציאה</button>
      </main>
    );
  }

  return person.role === 'owner'
    ? <OwnerShell person={person} signOut={signOut} />
    : <DeveloperShell person={person} signOut={signOut} />;
}

/** A developer gets the report screen and nothing else. */
function DeveloperShell({ person, signOut }: { person: Person; signOut: () => void }) {
  return (
    <div className={styles.phoneShell}>
      <header className={styles.phoneHead}>
        <span className={styles.phoneUser}>
          <span className={styles.avatar}>{firstName(person.name)}</span>
          <button type="button" className={styles.linkBtn} onClick={signOut}>יציאה</button>
        </span>
        <span className={styles.wordmarkInk}>Aspect <BarsMark size={24} /></span>
        <span className={styles.phoneHeadSpacer} />
      </header>
      <main className={styles.phoneMain}><ReportPage person={person} /></main>
    </div>
  );
}

function OwnerShell({ person, signOut }: { person: Person; signOut: () => void }) {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="ניווט ראשי">
        <div className={styles.brand}>
          <div className={styles.wordmark}>Aspect <BarsMark /></div>
          <div className={styles.brandLine}>ניהול עסק פשוט</div>
        </div>
        {NAV.map(item => (
          <Fragment key={item.to}>
            {item.icon === 'settings' && <hr className={styles.navRule} />}
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <Icon name={item.icon} size={24} stroke={2} />
              <span>{item.label}</span>
            </NavLink>
          </Fragment>
        ))}
        <div className={styles.navUser}>
          <span className={styles.navUserName}>{person.name}</span>
          <button type="button" className={styles.navSignOut} onClick={signOut}>יציאה</button>
        </div>
      </nav>
      <main className={styles.main}>
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
          <Route path="*" element={<Navigate to="/aspect/management" replace />} />
        </Routes>
      </main>
    </div>
  );
}
