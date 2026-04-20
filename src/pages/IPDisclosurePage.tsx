import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './IPDisclosurePage.module.css';

export function IPDisclosurePage() {
  useEffect(() => {
    document.title = 'Aspect — Company Unregistered Intellectual Property';
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
    <div className={styles.container}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link to="/" className={styles.navLogo}>
            <img src="/img/aspect-logo-regular.png" alt="Aspect" />
          </Link>
          <div className={styles.navLinks}>
            <a href="#bi">פעילות BI</a>
            <a href="#ai-platform">פלטפורמת AI</a>
            <a href="#ip-components">רכיבי IP</a>
            <a href="#ownership">בעלות</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className={styles.hero}>
        <h1>קניין רוחני <span>לא רשום</span></h1>
        <p className={styles.heroSub}>
          תיאור הקניין הרוחני הלא רשום של החברה בהתאם לסעיף 4.10(k) —
          כולל ידע, מתודולוגיות, תהליכים וכלים קנייניים המהותיים לפעילות העסקית.
        </p>
        <div className={styles.heroMeta}>
          <span>Company Unregistered Intellectual Property</span>
          <span>אפריל 2026</span>
        </div>
      </header>

      <div className={styles.document}>

        {/* ═══════════════════════════════════
            SECTION 1 — BI ACTIVITY
            ═══════════════════════════════════ */}
        <section id="bi" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>1</span>
            <h2 className={styles.sectionTitle}>פעילות BI ואנליטיקה</h2>
          </div>

          <p className={styles.paragraph}>
            החברה מפתחת מודלי BI ו-AI גנריים, וכן ידע, מתודולוגיות, תהליכים וכלים, לצורך ניהול, עיבוד
            וניתוח מידע של לקוחות (רשתות קמעונאיות), עבור שימושים שונים כגון: ניהול מלאי, ניהול מועדון
            לקוחות וצרכים עסקיים ותפעוליים נוספים.
          </p>
          <p className={styles.paragraph}>
            המודלים והכלים נבנים, מותאמים ופועלים על גבי פלטפורמות של צדדים שלישיים שבהן החברה משתמשת
            (בעיקר <strong>פלטפורמת Qlik</strong>). הקניין הרוחני הלא רשום בתחום זה מתייחס בעיקר
            למודלים, לידע ולמתודולוגיות שפותחו על ידי החברה, אשר מהווים רכיב מהותי בפעילותה העסקית.
          </p>
        </section>

        <hr className={styles.divider} />

        {/* ═══════════════════════════════════
            SECTION 2 — AI PLATFORM INTRO
            ═══════════════════════════════════ */}
        <section id="ai-platform" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>2</span>
            <h2 className={styles.sectionTitle}>פלטפורמת AI לתשאול מידע עסקי</h2>
          </div>

          <p className={styles.paragraph}>
            בנוסף לפעילות ה-BI, החברה פיתחה <strong>פלטפורמת תוכנה קניינית המאפשרת לארגונים לתשאל,
            לנתח ולקבל תובנות מהמידע העסקי שלהם באמצעות שפה טבעית</strong> (בעברית ובאנגלית).
            הפלטפורמה מתחברת למקורות המידע של הלקוח, מפענחת שאלות עסקיות, ומחזירה תשובות מנותחות —
            ללא צורך בידע טכני מצד המשתמש.
          </p>

          <p className={styles.paragraph}>
            הפלטפורמה בנויה כולה <strong>בקוד מקור מקורי שנכתב על ידי עובדי החברה</strong>.
            החברה אינה מפתחת או מאמנת מודלי AI — כל ההסקה (inference) מתבצעת באמצעות
            קריאות API לספקי צד שלישי (OpenAI, Anthropic, Google).
          </p>

          <div className={styles.calloutBlue}>
            <strong>הבידול העסקי:</strong> הערך הקנייני של הפלטפורמה אינו במודלי השפה עצמם (שהם של צדדים
            שלישיים), אלא ביכולת לחבר בין מקורות מידע עסקיים לבין מודלי שפה, לאנדקס מידע אוטומטית,
            לתרגם שאלות בשפה חופשית לשאילתות מידע, ולהחזיר תשובות מנותחות בזמן אמת.
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ═══════════════════════════════════
            SECTION 3 — IP COMPONENTS
            ═══════════════════════════════════ */}
        <section id="ip-components" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>3</span>
            <h2 className={styles.sectionTitle}>רכיבי הקניין הרוחני — פלטפורמת ה-AI</h2>
          </div>

          <p className={styles.paragraph}>
            הקניין הרוחני הלא רשום הנוגע לפלטפורמה כולל, בין היתר, את הרכיבים הבאים:
          </p>

          <div className={styles.ipGrid}>
            {/* (א) Auto Schema Indexing & SQL Engine */}
            <div className={styles.ipCard}>
              <div className={styles.ipCardHeader}>
                <div className={styles.ipCardLetter}>א</div>
                <div>
                  <span className={styles.ipCardTitle}>אינדוקס אוטומטי ומנוע שאילתות דינמי</span>
                  <span className={styles.ipCardTitleEn}>Auto-Indexing & Natural Language to SQL</span>
                </div>
              </div>
              <p className={styles.ipCardDesc}>
                מערכת הסורקת ומאנדקסת אוטומטית את מבנה המידע (סכמות, טבלאות, עמודות) של לקוחות,
                ממירה שאלות בשפה טבעית (בעברית ובאנגלית) לשאילתות SQL, מריצה אותן מול בסיסי הנתונים
                של הלקוח, ומחזירה תשובות מנותחות. כולל תיאור סכמות אוטומטי, אופטימיזציית שאילתות,
                וניטור ביצועים.
              </p>
              <div className={styles.techTags}>
                <span className={styles.tagAmber}>Auto Schema Discovery</span>
                <span className={styles.tagAmber}>SQL Generation</span>
                <span className={styles.tagAmber}>Query Optimizer</span>
                <span className={styles.tagAmber}>Performance Monitoring</span>
              </div>
            </div>

            {/* (ב) Multi-Provider Infrastructure */}
            <div className={styles.ipCard}>
              <div className={styles.ipCardHeader}>
                <div className={styles.ipCardLetter}>ב</div>
                <div>
                  <span className={styles.ipCardTitle}>תשתית חיבור מרובת ספקי AI</span>
                  <span className={styles.ipCardTitleEn}>Multi-Provider AI Infrastructure</span>
                </div>
              </div>
              <p className={styles.ipCardDesc}>
                תשתית המאפשרת חיבור והפעלה של מספר ספקי מודלי שפה (OpenAI, Anthropic, Google)
                באופן אחיד ושקוף. כוללת ממשק אחיד לשליחת בקשות, קבלת תגובות, הפעלת כלים
                (function calling), וניהול בסיסי ידע — ללא תלות בספק יחיד ועם יכולת החלפה גמישה.
              </p>
              <div className={styles.techTags}>
                <span className={styles.tag}>OpenAI</span>
                <span className={styles.tag}>Anthropic</span>
                <span className={styles.tag}>Google Gemini</span>
                <span className={styles.tag}>Provider-Agnostic API</span>
              </div>
            </div>

            {/* (ג) Knowledge Base */}
            <div className={styles.ipCard}>
              <div className={styles.ipCardHeader}>
                <div className={styles.ipCardLetter}>ג</div>
                <div>
                  <span className={styles.ipCardTitle}>מערכת אינדוקס וחיפוש מסמכים</span>
                  <span className={styles.ipCardTitleEn}>Document Indexing & Search System</span>
                </div>
              </div>
              <p className={styles.ipCardDesc}>
                מערכת המאפשרת העלאת מסמכים עסקיים (PDF, CSV, XLSX, DOCX, XML), אינדוקס אוטומטי שלהם
                במנועי חיפוש וקטוריים של מספר ספקים, ושליפת מידע רלוונטי בזמן שיחה.
                מסמך מועלה פעם אחת ונגיש לחיפוש דרך כל אחד מהספקים — ללא כפילות ידנית.
              </p>
              <div className={styles.techTags}>
                <span className={styles.tagPurple}>Vector Search</span>
                <span className={styles.tagPurple}>Auto-Indexing</span>
                <span className={styles.tagPurple}>Cross-Provider Sync</span>
                <span className={styles.tagPurple}>RAG</span>
              </div>
            </div>

            {/* (ד) Real-Time Streaming */}
            <div className={styles.ipCard}>
              <div className={styles.ipCardHeader}>
                <div className={styles.ipCardLetter}>ד</div>
                <div>
                  <span className={styles.ipCardTitle}>תשתית הזרמה בזמן אמת</span>
                  <span className={styles.ipCardTitleEn}>Real-Time Streaming Infrastructure</span>
                </div>
              </div>
              <p className={styles.ipCardDesc}>
                תשתית הזרמה קניינית להעברת תגובות בזמן אמת מהשרת ללקוח — כולל טקסט,
                תוצאות חיפוש, קריאות כלים ומטא-דאטה — כאירועים מסווגים המוזרמים במקביל לעיבוד.
              </p>
              <div className={styles.techTags}>
                <span className={styles.tag}>Server-Sent Events</span>
                <span className={styles.tag}>Typed Events</span>
                <span className={styles.tag}>Real-Time</span>
              </div>
            </div>

            {/* (ה) Data Integration Layer */}
            <div className={styles.ipCard}>
              <div className={styles.ipCardHeader}>
                <div className={styles.ipCardLetter}>ה</div>
                <div>
                  <span className={styles.ipCardTitle}>שכבת חיבור למקורות מידע</span>
                  <span className={styles.ipCardTitleEn}>Data Source Integration Layer</span>
                </div>
              </div>
              <p className={styles.ipCardDesc}>
                מנגנוני חיבור למקורות מידע מגוונים — בסיסי נתונים רלציוניים, קבצי אקסל, CSV, XML,
                קבצי QVD — כולל יבוא, נרמול ותיאור אוטומטי של המידע לצורך תשאול בשפה טבעית.
              </p>
              <div className={styles.techTags}>
                <span className={styles.tagGreen}>PostgreSQL</span>
                <span className={styles.tagGreen}>CSV / XLSX / XML</span>
                <span className={styles.tagGreen}>QVD Import</span>
                <span className={styles.tagGreen}>Auto-Normalization</span>
              </div>
            </div>
          </div>
        </section>

        <hr className={styles.divider} />

        {/* ═══════════════════════════════════
            SECTION 4 — OWNERSHIP
            ═══════════════════════════════════ */}
        <section id="ownership" className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>4</span>
            <h2 className={styles.sectionTitle}>בעלות ומקוריות</h2>
          </div>

          <div className={styles.calloutGreen}>
            <strong>קוד מקור מקורי:</strong> הפלטפורמה בנויה כולה בקוד מקור מקורי שנכתב על ידי
            עובדי החברה. החברה אינה מפתחת או מאמנת מודלי AI — כל ההסקה מתבצעת באמצעות קריאות
            API לספקי צד שלישי.
          </div>

          <p className={styles.paragraph}>
            <strong>שימוש בצדדים שלישיים:</strong> הפלטפורמה צורכת שירותי API מספקי מודלי שפה
            (OpenAI, Anthropic, Google) בהתאם לתנאי השימוש הסטנדרטיים של כל ספק.
            ספקים אלו מספקים את יכולת ההסקה (inference) בלבד — כל שכבות האינדוקס, השאילתות,
            החיבור למקורות מידע, והתשתית הם קניין של החברה.
          </p>

          <p className={styles.paragraph}>
            <strong>אי-שימוש ב-AI ליצירת IP:</strong> החברה לא השתמשה בכלי AI גנרטיביים לפיתוח
            קוד מקור קנייני, קניין רוחני או תוכן שהחברה מתכוונת לשמור כקנייני.
            כל קוד המקור של הפלטפורמה נכתב על ידי עובדי החברה.
          </p>

          <p className={styles.paragraph}>
            <strong>היעדר תביעות:</strong> נכון למועד גילוי זה, לא הועלתה כל טענת בעלות על ידי
            צד שלישי ביחס למוצרי ה-AI של החברה, ולא התקיים כל סכסוך או תכתובת בנוגע לשימוש
            בטכנולוגיית AI או בעלות על מוצרי החברה.
          </p>
        </section>

      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>
          מסמך גילוי קניין רוחני לא רשום — אספקט מערכות — אפריל 2026
        </p>
      </footer>
    </div>
  );
}
