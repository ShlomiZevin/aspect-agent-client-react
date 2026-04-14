import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FloatingChatWidget } from '../components/common';
import styles from './OneZeroLandingPage.module.css';

const THEME_KEY = 'onezero_theme';

export function OneZeroLandingPage() {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
  });
  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };

  useEffect(() => {
    document.title = 'ONE ZERO - חיזוי ומניעת נטישת לקוחות';
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    const root = document.getElementById('root');
    if (root) {
      root.style.overflow = 'auto';
      root.style.height = 'auto';
    }
    return () => {
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = '';
      document.body.style.height = '';
      if (root) {
        root.style.overflow = '';
        root.style.height = '';
      }
    };
  }, []);

  return (
    <div className={`${styles.container} ${theme === 'light' ? styles.light : ''}`}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>0</div>
          <div>
            <div className={styles.brandName}>ONE ZERO</div>
            <div className={styles.brandSub}>Churn Intelligence</div>
          </div>
        </div>
        <div className={styles.navRight}>
          <button
            className={styles.themeBtn}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="החלף ערכת נושא"
            title="החלף ערכת נושא"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/aspect/onezero/dashboard" className={styles.navCta}>כניסה למערכת ←</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.badge}>🤖 הדגמה לבנק ONE ZERO</div>
          <h1 className={styles.heroTitle}>
            תזהו לקוחות שעוזבים<br/>
            <span className={styles.highlight}>לפני שהם מבינים שהם הולכים</span>
          </h1>
          <p className={styles.heroSub}>
            מערכת AI שסורקת את כל הלקוחות מדי יום, מזהה 7 קבוצות סיגנלים מקדימים,
            ומסמנת בדיוק על מי לחזור היום, למה, ועם איזה הצעה.
          </p>
          <div className={styles.heroCtas}>
            <Link to="/aspect/onezero/dashboard" className={styles.primaryBtn}>כנסו לדמו →</Link>
            <a href="#how" className={styles.secondaryBtn}>איך זה עובד?</a>
          </div>

          <div className={styles.statBar}>
            <div>
              <div className={styles.statBig}>87%</div>
              <div className={styles.statLbl}>דיוק חיזוי</div>
            </div>
            <div>
              <div className={styles.statBig}>30-90</div>
              <div className={styles.statLbl}>ימי חיזוי מראש</div>
            </div>
            <div>
              <div className={styles.statBig}>×4.2</div>
              <div className={styles.statLbl}>שיפור בשימור</div>
            </div>
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.demoCard}>
            <div className={styles.demoCardHead}>
              <div className={styles.demoStatus}>● סריקה אוטומטית פעילה</div>
              <div className={styles.demoTime}>06:00 בכל בוקר</div>
            </div>
            <div className={styles.demoAlert}>
              <div className={styles.alertScore}>92</div>
              <div>
                <div className={styles.alertName}>דנה כהן · OZ-1042</div>
                <div className={styles.alertDesc}>
                  סיכון נטישה <strong>קריטי</strong> ב-18 הימים הקרובים
                </div>
              </div>
            </div>
            <div className={styles.signalsGrid}>
              <div className={styles.signal}>
                <span>💸</span> 3 העברות גדולות לבית השקעות
              </div>
              <div className={styles.signal}>
                <span>📉</span> 88% ירידה בכניסות לאפליקציה
              </div>
              <div className={styles.signal}>
                <span>🏦</span> סגירת פיקדון של 120K
              </div>
              <div className={styles.signal}>
                <span>📵</span> 0/8 קמפיינים נפתחו
              </div>
            </div>
            <div className={styles.recommendation}>
              <div className={styles.recHead}>💡 המלצה</div>
              <div>שיחה אישית עם בנקאי בכיר תוך 48 שעות + הצעת ויתור על עמלות לשנה</div>
            </div>
          </div>
        </div>
      </header>

      <section id="how" className={styles.how}>
        <h2>7 קבוצות סיגנלים שאנחנו עוקבים אחריהן</h2>
        <div className={styles.howGrid}>
          {[
            { icon: '📉', title: 'ירידה בפעילות', desc: 'כניסות לאפליקציה, מספר פעולות, סכומי הפקדות, שימוש בכרטיס' },
            { icon: '💸', title: 'העברת כספים החוצה', desc: 'העברות גדולות, צמצום יתרות, סגירת פיקדונות, ביטול הוראות קבע' },
            { icon: '🏦', title: 'שימוש במתחרים', desc: 'הוראות קבע לגופים פיננסיים אחרים, פתיחת חשבון נוסף' },
            { icon: '📱', title: 'מעורבות דיגיטלית', desc: 'אי-תגובה להודעות, אי-פתיחת קמפיינים, ירידה בשימוש' },
            { icon: '☎️', title: 'חוויית שירות', desc: 'ריבוי פניות למוקד, תלונות, ציוני שביעות רצון נמוכים' },
            { icon: '👤', title: 'שינויים בפרופיל', desc: 'מקום עבודה, הכנסה, מעבר דירה, סטטוס אישי' },
            { icon: '💳', title: 'שימוש במוצרים', desc: 'ביטול כרטיסים, אי-חידוש מוצרים, סגירת מסגרות' },
          ].map((s) => (
            <div key={s.title} className={styles.howCard}>
              <div className={styles.howIcon}>{s.icon}</div>
              <div className={styles.howTitle}>{s.title}</div>
              <div className={styles.howDesc}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.cta}>
        <h2>מוכנים לראות מי על סף עזיבה?</h2>
        <p>הדמו מציג נתוני משתמשים אמיתיים (אנונימיים) עם הסיגנלים שלהם, ניקוד נטישה, והמלצות לפעולה.</p>
        <Link to="/aspect/onezero/dashboard" className={styles.primaryBtnLg}>פתחו את הדאשבורד →</Link>
      </section>

      <footer className={styles.footer}>
        <span>ONE ZERO Bank · Demo by</span>
        <Link to="/aspect/ai" className={styles.footerLink}>Aspect AI</Link>
      </footer>

      <FloatingChatWidget
        iframeSrc="/onezero?embed=true"
        title="ONE ZERO Churn AI"
        accentColor="#3b82f6"
        buttonText="שאל את ה-AI"
        buttonIcon="🤖"
        position="bottom-left"
      />
    </div>
  );
}
