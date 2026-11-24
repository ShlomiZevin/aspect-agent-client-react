/**
 * The one navigation bar of the real-estate demo — the brief, the live board
 * and the chat all carry it, so the menu never moves between screens.
 * לידים / רוכשים / פרויקטים have no screen of their own: they ask the agent.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { askAgent } from './shared';
import { Icon } from './ui';
import styles from './RealEstateTopbar.module.css';

type Screen = 'brief' | 'board' | 'chat';

export function RealEstateTopbar({ active, extra }: { active: Screen; extra?: ReactNode }) {
  const tab = (screen: Screen) => (active === screen ? `${styles.tab} ${styles.tabActive}` : styles.tab);
  return (
    <header className={styles.topbar} dir="rtl">
      <Link to="/realestate/brief" className={styles.brand}>
        <svg className={styles.mark} viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 38V18l8-6v26M14 38V8l10-6v36M24 38V12l10 5v21M34 38V20l8 4v14M2 38h44" />
        </svg>
        <div><strong>אופק יזמות</strong><small>יזמות · פיתוח · מגורים</small></div>
      </Link>

      <nav className={styles.tabs}>
        <Link to="/realestate/brief" className={tab('brief')}>היועץ החכם שלי</Link>
        <Link to="/realestate/board" className={tab('board')}>לוח מכירות חי</Link>
        <button type="button" className={styles.tab} onClick={() => askAgent('מה מצב הלידים החודש — כמה נכנסו, מאיזה מקור, וכמה עברו לביקור במשרד?')}>לידים</button>
        <button type="button" className={styles.tab} onClick={() => askAgent('מי הרוכשים שלנו — מטרת רכישה, גיל, מקצוע ועשירון?')}>רוכשים</button>
        <button type="button" className={styles.tab} onClick={() => askAgent('מתי כל פרויקט יימכר עד הסוף בקצב הנוכחי?')}>פרויקטים</button>
        <Link to="/realestate/intelligence" className={styles.tab}>ניתוחי מכירות</Link>
        <Link to="/realestate/intelligence/center" className={styles.tab}>דוחות</Link>
        <Link to="/realestate" className={tab('chat')}><Icon name="sparkle" size={15} /> שאל את ה-AI</Link>
      </nav>

      <div className={styles.user}>{extra}</div>
    </header>
  );
}
