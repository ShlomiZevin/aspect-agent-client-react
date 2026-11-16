import { Fragment, useCallback, useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { SignInMethods, useSession } from '../auth';
import type { Session, SignInConfig } from '../auth';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { api } from './api';
import { firstName, useText } from './format';
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
import { ReportsPage } from './pages/ReportsPage';
import styles from './ledger.module.css';

/**
 * Aspect Management at /management: the sign-in, who this person is here, and
 * the shell around the screens. Hebrew, including the sign-in; Ctrl+Shift+E
 * (or ?lang=en on a phone) switches to a hidden English view for the Aspect
 * team, and back. See aspect-agent-server/aspect-management/README.md.
 */

// An Aspect employee's sign-in account lives on the Aspect project.
const TENANT = 'aspect';
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=Frank+Ruhl+Libre:wght@700&family=Playpen+Sans+Hebrew:wght@600&display=swap';

// The sign-in stays shut, offering the password form, if its config cannot be read.
const FALLBACK: SignInConfig = { enabled: true, purpose: 'gate', google: false, password: true, clientId: '' };

const NAV = [
  { to: '/aspect/management', label: 'nav.home', icon: 'home', end: true },
  { to: '/aspect/management/projects', label: 'nav.projects', icon: 'projects' },
  { to: '/aspect/management/team', label: 'nav.team', icon: 'team' },
  { to: '/aspect/management/clients', label: 'nav.clients', icon: 'clients' },
  { to: '/aspect/management/quotes', label: 'nav.quotes', icon: 'quotes' },
  { to: '/aspect/management/reports', label: 'nav.reports', icon: 'chart' },
  { to: '/aspect/management/ask', label: 'nav.ask', icon: 'ask' },
  { to: '/aspect/management/settings', label: 'nav.settings', icon: 'settings' },
];

export function ManagementRoute() {
  return (
    <LanguageProvider storagePrefix="aspectManagement_">
      <Management />
    </LanguageProvider>
  );
}

/** The English view has no button: the tool is Itzik's, in Hebrew; English is for the Aspect team. */
function useHiddenLanguageSwitch() {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('lang');
    if (asked === 'en' || asked === 'he') setLanguage(asked);
    // Only on arrival; the key below takes over from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // By key position, so it works whatever the keyboard layout.
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.code !== 'KeyE' || e.repeat) return;
      e.preventDefault();
      setLanguage(language === 'en' ? 'he' : 'en');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [language, setLanguage]);
}

function Management() {
  const { session, config, loading, signIn, signOut } = useSession(TENANT);
  const { language, direction } = useLanguage();
  const { t } = useText();
  useHiddenLanguageSwitch();

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      document.head.appendChild(link);
    }
  }, []);

  const title = t('shell.title');
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => { document.title = previousTitle; };
  }, [title]);

  return (
    <div className={styles.ledger} dir={direction} lang={language}>
      {loading ? null : session
        ? <SignedIn session={session} signOut={signOut} />
        : <SignIn config={config ?? FALLBACK} onSignedIn={signIn} />}
    </div>
  );
}

function SignIn({ config, onSignedIn }: { config: SignInConfig; onSignedIn: (s: Session) => void }) {
  const { t: translate, language } = useLanguage();
  const { t } = useText();
  return (
    <main className={styles.signIn}>
      <SignInBrand />
      <h1 className={styles.title}>{t('signIn.title')}</h1>
      <SignInMethods
        tenant={TENANT}
        // A Google button with no OAuth client id cannot sign anyone in; offer
        // only the password form until the server has one.
        config={{ ...config, google: config.google && Boolean(config.clientId) }}
        onSignedIn={onSignedIn}
        t={translate}
        googleLocale={language}
        describeError={() => t('signIn.failed')}
        emailPlaceholder=""
      />
      <p className={styles.signInQuiet}>{t('signIn.noAccess')}</p>
    </main>
  );
}

/** The sign-in's wordmark (ledger-7): Aspect, the bar mark, an ochre stroke, the line. */
function SignInBrand() {
  const { t } = useText();
  return (
    <div className={styles.signInBrand}>
      <div className={styles.signInWordmark}>Aspect <BarsMark size={44} /></div>
      <div className={styles.signInLine}>{t('shell.brandLine')}</div>
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
  const { t } = useText();

  if (!data) return <main className={styles.signIn}><Loading error={error} /></main>;
  const { person } = data;

  if (!person) {
    return (
      <main className={styles.signIn}>
        <SignInBrand />
        <h1 className={styles.title}>{t('signIn.notListedTitle')}</h1>
        <p className={styles.sub}>{t('signIn.notListed', { email: session.email })}</p>
        <button type="button" className={styles.linkBtn} onClick={signOut}>{t('shell.signOut')}</button>
      </main>
    );
  }

  return person.role === 'owner'
    ? <OwnerShell person={person} signOut={signOut} />
    : <DeveloperShell person={person} signOut={signOut} />;
}

/** A developer gets the report screen and nothing else. */
function DeveloperShell({ person, signOut }: { person: Person; signOut: () => void }) {
  const { t } = useText();
  return (
    <div className={styles.phoneShell}>
      <header className={styles.phoneHead}>
        <span className={styles.phoneUser}>
          <span className={styles.avatar}>{firstName(person.name)}</span>
          <button type="button" className={styles.linkBtn} onClick={signOut}>{t('shell.signOut')}</button>
        </span>
        <span className={styles.wordmarkInk}>Aspect <BarsMark size={24} /></span>
        <span className={styles.phoneHeadSpacer} />
      </header>
      <main className={styles.phoneMain}><ReportPage person={person} /></main>
    </div>
  );
}

function OwnerShell({ person, signOut }: { person: Person; signOut: () => void }) {
  const { t } = useText();
  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label={t('nav.main')}>
        <div className={styles.brand}>
          <div className={styles.wordmark}>Aspect <BarsMark /></div>
          <div className={styles.brandLine}>{t('shell.brandLine')}</div>
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
              <span>{t(item.label)}</span>
            </NavLink>
          </Fragment>
        ))}
        <div className={styles.navUser}>
          <span className={styles.navUserName}>{person.name}</span>
          <button type="button" className={styles.navSignOut} onClick={signOut}>{t('shell.signOut')}</button>
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
          <Route path="reports" element={<ReportsPage />} />
          <Route path="ask" element={<AskPage person={person} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/aspect/management" replace />} />
        </Routes>
      </main>
    </div>
  );
}
