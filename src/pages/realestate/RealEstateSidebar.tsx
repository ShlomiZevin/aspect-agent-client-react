/** The dark brand rail of the AI advisor screen (design C). */
import { Link } from 'react-router-dom';
import { askAgent } from './shared';
import { Icon } from './ui';
import styles from './RealEstateSidebar.module.css';

export function RealEstateSidebar({ active }: { active: 'brief' | 'board' }) {
  return (
    <aside className={styles.rail}>
      <div className={styles.brand}>
        <svg className={styles.mark} viewBox="0 0 48 40" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M6 38V18l8-6v26M14 38V8l10-6v36M24 38V12l10 5v21M34 38V20l8 4v14M2 38h44" />
        </svg>
        <div className={styles.name}>אופק יזמות</div>
        <div className={styles.tag}>יזמות · פיתוח · מגורים</div>
      </div>

      <nav className={styles.nav}>
        <Link to="/realestate/brief" className={`${styles.item} ${active === 'brief' ? styles.active : ''}`}><Icon name="sparkle" size={18} /> היועץ החכם שלי</Link>
        <Link to="/realestate/board" className={`${styles.item} ${active === 'board' ? styles.active : ''}`}><Icon name="building" size={18} /> לוח מכירות חי</Link>
        <button type="button" className={styles.item} onClick={() => askAgent('מה מצב הלידים החודש — כמה נכנסו, מאיזה מקור, וכמה עברו לביקור במשרד?')}><Icon name="users" size={18} /> לידים</button>
        <button type="button" className={styles.item} onClick={() => askAgent('מי הרוכשים שלנו — מטרת רכישה, גיל, מקצוע ועשירון?')}><Icon name="user" size={18} /> רוכשים</button>
        <button type="button" className={styles.item} onClick={() => askAgent('מתי כל פרויקט יימכר עד הסוף בקצב הנוכחי?')}><Icon name="home" size={18} /> פרויקטים</button>
        <Link to="/realestate/intelligence" className={styles.item}><Icon name="chart" size={18} /> ניתוחי מכירות</Link>
        <Link to="/realestate/intelligence/center" className={styles.item}><Icon name="file" size={18} /> דוחות</Link>
      </nav>

      <svg className={styles.lines} viewBox="0 0 200 260" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
        <path d="M20 260V120l50-40v180M70 260V60l60-40v240M130 260V90l50 30v140" />
      </svg>

      <Link to="/realestate" className={styles.ask}><Icon name="help" size={18} /> שאל את ה-AI</Link>
    </aside>
  );
}
