/**
 * The one navigation bar of the real-estate demo, on every page. Pages and the
 * chat — the chat opens as a modal over the page (see RealEstateLayout), with
 * its own ready-made questions inside.
 */
import { Link } from 'react-router-dom';
import { useRealEstateChat } from './chatContext';
import { BRIEF_PATH, BOARD_PATH, MARKET_PATH, REPORTS_PATH } from './shared';
import { Icon } from './ui';
import styles from './RealEstateTopbar.module.css';

type Page = 'brief' | 'board' | 'market' | 'reports';

export function RealEstateTopbar({ active }: { active: Page }) {
  const { openChat } = useRealEstateChat();
  const tab = (page: Page) => (active === page ? `${styles.tab} ${styles.tabActive}` : styles.tab);
  return (
    <header className={styles.topbar} dir="rtl">
      <Link to={BRIEF_PATH} className={styles.brand}>
        <svg className={styles.mark} viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 38V18l8-6v26M14 38V8l10-6v36M24 38V12l10 5v21M34 38V20l8 4v14M2 38h44" />
        </svg>
        <div><strong>אופק יזמות</strong><small>יזמות · פיתוח · מגורים</small></div>
      </Link>

      <nav className={styles.tabs}>
        <Link to={BRIEF_PATH} className={tab('brief')}>היועץ החכם שלי</Link>
        <Link to={BOARD_PATH} className={tab('board')}>לוח מכירות חי</Link>
        <Link to={MARKET_PATH} className={tab('market')}>רוכשים ושיווק</Link>
        <Link to={REPORTS_PATH} className={tab('reports')}>דוחות</Link>
        <button type="button" className={styles.tab} onClick={() => openChat()}><Icon name="sparkle" size={15} /> שאל את ה-AI</button>
      </nav>

      <div className={styles.user} />
    </header>
  );
}
