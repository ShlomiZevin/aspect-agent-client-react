/**
 * Bottom tab bar — the mobile navigation for Aspect Intelligence (< 640px).
 *
 * Replaces both the header's `.nav` row and the floating chat orb on phones:
 * one always-visible menu, each tab a full screen, active tab in the brand
 * colour. Hidden on desktop by its own CSS (`display: none` above 640px), so
 * the shell can render it unconditionally.
 *
 * "Report history" and "Report detail" are children of the Reports tab — they
 * keep Reports lit, reached via a back row, not their own tab.
 */
import { useLanguage } from '../../context/LanguageContext';
import styles from './MobileTabBar.module.css';

type View = 'home' | 'reports' | 'history' | 'detail' | 'chat' | 'apps' | 'app';

interface Props {
  view: View;
  hasApps: boolean;
  runningJobs: number;
  onHome: () => void;
  onReports: () => void;
  onChat: () => void;
  onApps: () => void;
}

export function MobileTabBar({ view, hasApps, runningJobs, onHome, onReports, onChat, onApps }: Props) {
  const { t } = useLanguage();

  const reportsActive = view === 'reports' || view === 'history' || view === 'detail';
  const appsActive = view === 'apps' || view === 'app';

  return (
    <nav className={styles.bar} aria-label={t('intel.nav.home')}>
      <button
        type="button"
        className={`${styles.tab} ${view === 'home' ? styles.active : ''}`}
        aria-current={view === 'home' ? 'page' : undefined}
        onClick={onHome}
      >
        <span className={styles.icon}>
          <Glyph name="home" />
          {runningJobs > 0 && <span className={styles.badge}>{runningJobs > 9 ? '9+' : runningJobs}</span>}
        </span>
        {t('intel.nav.home')}
      </button>

      <button
        type="button"
        className={`${styles.tab} ${reportsActive ? styles.active : ''}`}
        aria-current={reportsActive ? 'page' : undefined}
        onClick={onReports}
      >
        <span className={styles.icon}><Glyph name="reports" /></span>
        {t('intel.nav.reports')}
      </button>

      <button
        type="button"
        className={`${styles.tab} ${view === 'chat' ? styles.active : ''}`}
        aria-current={view === 'chat' ? 'page' : undefined}
        onClick={onChat}
      >
        <span className={styles.icon}><Glyph name="chat" /></span>
        {t('intel.nav.chat')}
      </button>

      {hasApps && (
        <button
          type="button"
          className={`${styles.tab} ${appsActive ? styles.active : ''}`}
          aria-current={appsActive ? 'page' : undefined}
          onClick={onApps}
        >
          <span className={styles.icon}><Glyph name="apps" /></span>
          {t('apps.title')}
        </button>
      )}
    </nav>
  );
}

function Glyph({ name }: { name: 'home' | 'reports' | 'chat' | 'apps' }) {
  const c = {
    width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.9,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'home':
      return <svg {...c}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
    case 'reports':
      return <svg {...c}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
    case 'chat':
      return <svg {...c}><path d="M12 3 13.9 8.1 19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg>;
    case 'apps':
      return <svg {...c}><path d="M3 6h2l2.4 10.2a1.4 1.4 0 0 0 1.37 1.08h7.9a1.4 1.4 0 0 0 1.36-1.05L20 8H6.2" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></svg>;
  }
}
