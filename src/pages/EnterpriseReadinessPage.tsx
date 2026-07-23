import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * מענה לשאלון בדיקת נאותות טכנולוגית (קופת חולים / בנק) — מסמך Q&A.
 * ------------------------------------------------------------------
 * מקור השאלון: Frida.xlsx (שאלון שהופנה כאשר הפרויקט היה בתחום גיל המעבר
 * בלבד). המענה כאן מתייחס לפלטפורמת Lybi הכללית (Builder v2.0, מבוסס Addons).
 *
 * כללי המסמך:
 *  1. נענים רק הסעיפים הטכניים. סעיפים מסחריים/כלליים (מאפייני חברה, לקוחות,
 *     SLA, הדרכה, Customer Success) מצוטטים ונשארים ריקים להשלמה.
 *  2. שפת המענה כשפת המסמך — עברית.
 *  3. תשתית טכנולוגית מנוסחת "ניתן לספק את שתי האפשרויות" היכן שרלוונטי.
 *  עיצוב: בהיר בלבד, בסגנון Lybi.
 */

const PURPLE = '#680662';
const BG = '#FAF7F7';
const INK = '#1C1917';
const MUTED = '#78716C';
const FAINT = '#a8a29e';
const BORDER = '#E7E5E4';

// a === undefined ⇒ סעיף לא-טכני, ריק להשלמה.
// tag: 'adapt' ⇒ יכולת שנוכל להתאים אך אינה קיימת ככה בקוד היום (עבודת התאמה/DevOps).
// ברירת המחדל לסעיף שנענה היא 'live' — קיים ועובד היום.
type Item = { q: string; a?: string; tag?: 'adapt'; link?: { to: string; label: string } };
type Section = { cat: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    cat: 'מאפייני החברה',
    items: [
      { q: 'רקע — שנת הקמה, מייסדים וכד׳' },
      { q: 'האם לחברה יש ידע בטכנולוגיות רפואיות' },
      { q: 'מחזור כספי ב-3 השנים האחרונות — ממוצע שנתי (נתוני החברה בלבד, ללא חברת אם)' },
      { q: 'מספר עובדים כולל' },
      { q: 'גודל מחלקת הפיתוח (עובדים טכנולוגיים בלבד)' },
      { q: 'חברה ישראלית?' },
      { q: 'פעילות בינלאומית' },
      { q: 'שיתופי פעולה אסטרטגיים' },
    ],
  },
  {
    cat: 'לקוחות',
    items: [
      { q: 'מספר לקוחות בארץ' },
      { q: 'מספר לקוחות בחו״ל' },
      { q: 'מספר לקוחות אנטרפרייז בארץ ובחו״ל' },
      { q: 'לקוחות בעולמות ה-Healthcare' },
      { q: 'מגמות — כמות לקוחות חדשים ב-3 השנים האחרונות' },
    ],
  },
  {
    cat: 'מוצרים',
    items: [
      {
        q: 'כמה מוצרים לחברה? אילו אלגוריתמים פותחו בדגש רפואי? מהם הנכסים הפיתוחיים?',
        a: 'הליבה היא פלטפורמת Builder v2.0 לבניית סוכני AI, מבוססת תוספים (Addons). כל שיחה מורכבת מ"צוות" (Crew) של שלבים, וכל שלב הוא Addon ייעודי עם מודל ופרומפט משלו: חילוץ שדות (Field Extractor), חשיבה והסקה (Thinker / Field Reasoner), חילוץ הקשר רגשי (Vibe Extractor), תמצות (Summarizer), אחזור ידע (KB Retriever), ניתוב בין שלבים (Transition Router) ומענה למשתמש (Talker). ה-Addons רצים במסלולים (main / background / offline), התצורה נשמרת כ-JSON עם ניהול גרסאות מלא, ולצד הבנייה יש עוזר AI ("Alfred"). הנכס המרכזי הוא מנוע ה"מוח" הזה — המרכיב סוכן דומיין בטוח וניתן-לבקרה ללא קוד. בתחום הרפואי (Freeda) פותחו סיווג סימפטומים (רגשי / קוגניטיבי / פיזי) ואחזור מעוגן בהנחיות קליניות.',
      },
      {
        q: 'איזה ידע יש לחברה בשימוש ב-GenAI',
        a: 'GenAI הוא תחום הליבה: ניתוב רב-ספקי בין OpenAI‏ (GPT-4o / GPT-5), Anthropic‏ (Claude Sonnet / Opus) ו-Google‏ (Gemini), עם fallback אוטומטי בין הספקים; RAG מבוסס וקטורים (Pinecone וכן Vector Stores); קריאות פונקציה/כלים; סטרימינג בזמן אמת (SSE); תמלול (Whisper); ומערכת בדיקות אוטומטית לסוכנים.',
      },
      {
        q: 'על אילו בעיות נותנים מענה',
        a: 'שיחות דומיין רב-שלביות עם זיכרון ומצב, שצ׳אטבוט גנרי אינו יכול לבצע בבטחה: קבלת פנים והנחיה מודרכת, איסוף מידע מדיבור טבעי, מענה מעוגן במקורות (grounded), והעברות בין שלבים מתמחים — עם תיעוד (audit) מלא של כל צעד.',
      },
      {
        q: 'תיאור המוצרים הרלוונטיים לקופה',
        a: 'פלטפורמת בניית סוכנים למענה מול חברי הקופה: אינטייק/תשאול מובנה, סוכני-מלווה למצבים רפואיים (כדוגמת Freeda בתחום גיל המעבר), ומענה על זכאות/הטבות מעוגן במסמכי הקופה — הכול ב-White-Label במיתוג הקופה ובסביבה מבודדת.',
      },
    ],
  },
  {
    cat: 'ארכיטקטורה, אבטחת מידע ויישום',
    items: [
      {
        q: 'SaaS / On-prem',
        a: 'המערכת בנויה כך שנוכל לספק את שתי האפשרויות: כ-SaaS מנוהל שלנו על Google Cloud, או כהתקנה ייעודית בסביבת הלקוח — single-tenant בפרויקט/VPC נפרד, ובמידת הצורך On-prem. המערכת ארוזה בקונטיינרים (Docker) וחסרת-מצב (stateless), ולכן ניידת בין סביבות. (התקנה On-prem היא עבודת התאמה/DevOps קטנה יחסית לפי סביבת הלקוח — התאמת קונפיגורציה, לא שינוי מוצר.)',
        tag: 'adapt',
      },
      {
        q: 'שירותי ענן: שם ומיקום השרתים, ספק הענן, מיקום גיאוגרפי של מידע המטופלים (כולל גיבויים), והפרדה מלקוחות אחרים',
        a: 'ספק הענן: Google Cloud Platform. כיום האזור הוא europe-west1 (בלגיה, האיחוד האירופי), והמידע והגיבויים שמורים באותו אזור. לצורכי ריבונות נתונים ניתן לפרוס באזור הישראלי של GCP‏ (me-west1, תל אביב), כך שהמידע והגיבויים אינם יוצאים מישראל. הפרדת לקוחות: כיום הפרדה לוגית (כל רשומה משויכת ל-tenant); ללקוח מוסדי נספק מסד נתונים ומופע ייעודיים — הפרדה פיזית מלקוחות אחרים.',
      },
      {
        q: 'רכיבי אבטחת מידע בענן; האם המידע נשמר מוצפן?',
        a: 'הצפנה בתעבורה (TLS/HTTPS בכל הערוצים, כולל ה-SSE) ובמנוחה כברירת מחדל — Cloud SQL ו-Cloud Storage מצפינים את כל המידע ב-AES-256; ניתן להשתמש במפתחות בניהול הלקוח (CMEK). סודות מנוהלים ב-Secret Manager ולא בקוד; גישה נשלטת דרך IAM וחיבור פרטי למסד הנתונים.',
      },
      {
        q: 'האם יש הסמכה לתקנים ומבדקים של ספק שירותי הענן',
        a: 'Google Cloud מוסמך ל-ISO/IEC 27001, 27017 ו-27018, ל-SOC 1/2/3, ל-PCI DSS, ותומך בעומסי עבודה תואמי-HIPAA (כולל חתימת BAA). ההסמכות חלות על שכבת התשתית של הפריסה שלנו.',
      },
      {
        q: 'באילו טכנולוגיות המוצר משתמש? שפות פיתוח, מסדי נתונים וכו׳',
        a: 'Backend: Node.js 22 + Express 5. Frontend: React 19 + TypeScript + Vite. מסד נתונים: PostgreSQL‏ (Cloud SQL) עם Drizzle ORM. מסד וקטורי: Pinecone (וכן Vector Stores של OpenAI ו-Google). אחסון אובייקטים: Google Cloud Storage. תעבורה: HTTPS ו-Server-Sent Events.',
      },
      {
        q: 'ניהול משתמשים וקבוצות כולל סנכרון ל-AD, וסנכרון ממקורות שונים',
        a: 'אימות כיום דרך Firebase Auth. חיבור לזהות ארגונית — SAML/OIDC, הקצאה אוטומטית ב-SCIM וסנכרון קבוצות מ-Active Directory / LDAP (כולל ממספר מקורות) — נתמך במסגרת הטמעה מוסדית.',
        tag: 'adapt',
      },
      {
        q: 'SSO',
        a: 'נתמך במסגרת הטמעה מוסדית — SSO מבוסס SAML 2.0 / OIDC‏ (Azure AD‏ / Okta‏ / Google Workspace).',
        tag: 'adapt',
      },
      {
        q: 'עומסים — באילו עומסים המערכת עומדת? האם יש יכולת גידול תשתיתי פשוטה ומהירה?',
        a: 'שכבת האפליקציה חסרת-מצב ורצה על Cloud Run עם התאמת-עומס (autoscaling) אופקית אוטומטית ובדיקות בריאות; הגדלת עומס היא שינוי תצורה ולא בנייה מחדש. PostgreSQL מתרחב אנכית ובאמצעות read replicas; שכבת ה-LLM מאזנת עומסים ועושה fallback בין שלושה ספקים.',
      },
      {
        q: 'סטנדרטיזציה — האם הרכיבים עומדים בסטנדרטים המקובלים ומעודכנים בגרסאות?',
        a: 'הרכיבים בגרסאות עדכניות/LTS: Node.js 22, Express 5, React 19, PostgreSQL, Vite. פרוטוקולים תקניים בלבד (HTTPS, REST, JSON, SSE, ובזהות SAML/OIDC) — ללא פרוטוקול קנייני.',
      },
      { q: 'סרטיפיקציית SOC / ISO' },
      {
        q: 'יכולת התאמת המוצר ללקוח — פונקציונליות ו-UI',
        a: 'התאמה עמוקה: כל סוכן ניתן ל-White-Label (לוגו, צבעים, טיפוגרפיה וטקסטים — כתצורה לכל סוכן); הפרסונה, מבנה ה-Crew, ה-Addons וה-KB ניתנים להגדרה ללא קוד דרך ה-Builder. הפונקציונליות מורכבת מ-Addons, כך שזרימה ייחודית לקופה היא עניין של הגדרה ולא פיתוח נפרד.',
      },
      {
        q: 'נתונים — מה נדרש לשמור, איפה נשמר? אילו בסיסי נתונים נתמכים (רלציוני ו-No-SQL)?',
        a: 'רלציוני (PostgreSQL): סוכנים, משתמשים, שיחות, הודעות, הקשר, מטא-דאטה של KB, משוב ושימוש. וקטורי (Pinecone / מאגרי הספקים): מקטעי ידע מוטמעים. אובייקטים (GCS): מסמכי מקור. בתוך PostgreSQL נעשה שימוש ב-JSONB למטא-דאטה גמיש (בגישת No-SQL). מינימיזציית מידע: נשמר רק הנדרש לשיחה, ומדיניות שמירה/מחיקה מוגדרת לכל לקוח.',
      },
      {
        q: 'תיאור כללי של הארכיטקטורה וצירוף תרשימים',
        a: 'ארכיטקטורה דו-שירותית: קליינט React על Firebase Hosting ושרת Node/Express על Cloud Run, מחוברים ל-Cloud SQL, ל-GCS, ל-Pinecone ולשלושת ספקי ה-LLM. תרשים מלא של המערכת ושל מנוע השיחה (Builder v2.0) בדף הארכיטקטורה.',
        link: { to: '/lybi/architecture', label: 'לצפייה בדף הארכיטקטורה' },
      },
    ],
  },
  {
    cat: 'אינטגרציה',
    items: [
      {
        q: 'יכולת חשיפה מהירה של שירותים (Endpoints) בפורמט אחיד (JSON)',
        a: 'כן. השרת חושף נקודות קצה REST ו-SSE, כולן ב-JSON. הוספת נקודת קצה חדשה מהירה — שעות עד ימים.',
      },
      {
        q: 'יכולת צריכה של Web Services מכל מערכת אחרת',
        a: 'כן — השרת כבר צורך שירותים חיצוניים (ממשקי LLM, WhatsApp Business, דוא״ל, תמלול). חיבור לשירות REST/SOAP של הקופה הוא עבודה סטנדרטית.',
      },
      {
        q: 'תמיכה ב-REST API',
        a: 'כן — REST הוא סגנון ה-API המרכזי, עם JSON, פעלי HTTP וקודי סטטוס תקניים.',
      },
      {
        q: 'יכולת אינהרנטית להתממשקות ל-Kafka',
        a: 'התממשקות ל-Kafka (הפקה וצריכה) נתמכת באמצעות connector כחלק מהטמעה; ארכיטקטורת event-streaming נבנית לפי דרישת הלקוח המוסדי.',
        tag: 'adapt',
      },
    ],
  },
  {
    cat: 'יתירות',
    items: [
      {
        q: 'אילו יכולות redundancy המערכת ממשת לצורך שרידות? באילו רכיבים?',
        a: 'שכבת אפליקציה: Cloud Run חסר-מצב עם ריבוי מופעים, autoscaling והפעלה-מחדש לפי בדיקות בריאות. מסד נתונים: Cloud SQL תומך ב-High-Availability אזורי (standby סינכרוני + failover אוטומטי), גיבויים אוטומטיים ושחזור נקודתי (PITR). אחסון: GCS עודף מובנה. שכבת LLM: fallback אוטומטי בין שלושה ספקים — אין ספק AI יחיד כנקודת כשל.',
      },
    ],
  },
  {
    cat: 'לוגים',
    items: [
      {
        q: 'איזו תשתית ויכולות ניהול לוגים קיימות (תשתיתיים ואפליקטיביים)? באיזה פורמט? התממשקות ל-Elastic?',
        a: 'לוגים תשתיתיים ואפליקטיביים זורמים ל-Google Cloud Logging (JSON מובנה, ניתן לתחקור ולשמירה). ברמת האפליקציה קיים audit עשיר: כל קריאת LLM נרשמת (ספק, מודל, טוקנים, זמן), וכל תור שיחה מתעד את שלבי החשיבה וההעברות בין השלבים. Elastic/SIEM: ניתן להזרים מ-Cloud Logging ל-Elastic או לכל SIEM דרך Pub/Sub log sink — במסגרת אינטגרציה.',
      },
    ],
  },
  {
    cat: 'דוחות ומשוב',
    items: [
      {
        q: 'מודול דוחות כחלק אינטגרלי מהכלי',
        a: 'כן — לוח הניהול כולל אנליטיקת שימוש/עלות LLM, דוחות מגמות שיחה, ומשוב ברמת ההודעה עם תיוג — מובנים במוצר.',
      },
      {
        q: 'הגדרת שאילתות (Self-Service)',
        a: 'סינון self-service בלוח הבקרה (לפי סוכן, שלב ותאריך); בונה שאילתות/דוחות self-service מלא מתוכנן.',
      },
      {
        q: 'מענה לפיתוח דוחות חדשים',
        a: 'כן — פיתוח דוחות חדשים מהיר מעל מבנה הנתונים ב-PostgreSQL; דוחות מותאמים לפי דרישה.',
      },
    ],
  },
  {
    cat: 'הדרכה והכשרה',
    items: [
      { q: 'אילו יכולות הדרכה והכשרה החברה מספקת?' },
    ],
  },
  {
    cat: 'SLA וטיפול בתקלות, מענה מקצועי',
    items: [
      { q: 'תמיכה שוטפת, טיפול בתקלות — SLA' },
    ],
  },
  {
    cat: 'Customer Success',
    items: [
      { q: 'מהי שיטת ההתקשרות והתמיכה' },
    ],
  },
];

const answered = SECTIONS.flatMap(s => s.items).filter(i => i.a).length;
const pending = SECTIONS.flatMap(s => s.items).filter(i => !i.a).length;

export function EnterpriseReadinessPage() {
  useEffect(() => {
    document.title = 'שאלון בדיקת נאותות — מענה | Lybi';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    return () => { document.documentElement.style.overflow = ''; document.body.style.overflow = ''; };
  }, []);

  return (
    <div dir="rtl" style={{ fontFamily: "'DM Sans', sans-serif", background: BG, color: INK, minHeight: '100vh', overflow: 'auto' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid rgba(0,0,0,0.06)`,
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ display: 'inline-block', textDecoration: 'none' }}>
            <img src="/img/lybi-logo-transparent.png" alt="Lybi" style={{ height: 32, width: 'auto' }} />
          </Link>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: PURPLE, background: 'rgba(104,6,98,0.06)', padding: '4px 10px', borderRadius: 4 }}>
            Due Diligence
          </span>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 96px' }}>
        {/* Header */}
        <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: PURPLE, margin: '0 0 10px' }}>
          שאלון בדיקת נאותות טכנולוגית · קופת חולים / בנק
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 400, lineHeight: 1.2, color: INK, margin: '0 0 20px' }}>
          מענה לשאלון הספק
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: MUTED, margin: '0 0 14px' }}>
          מסמך זה מרכז את מענה Lybi לשאלון בדיקת הנאותות. נענו הסעיפים <strong style={{ color: INK }}>הטכניים</strong>;
          סעיפים מסחריים/כלליים (מאפייני חברה, לקוחות, SLA, הדרכה, Customer Success) מצוטטים ונשארים <strong style={{ color: INK }}>ריקים להשלמה</strong>.
        </p>

        {/* Counters */}
        <div style={{ display: 'flex', gap: 10, margin: '24px 0 8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: PURPLE }} />
            <span style={{ fontSize: 13, color: INK }}><strong>{answered}</strong> סעיפים טכניים — נענו</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: FAINT }} />
            <span style={{ fontSize: 13, color: MUTED }}><strong>{pending}</strong> סעיפים מסחריים — להשלמה</span>
          </div>
        </div>

        {/* Legend — פנימי בלבד */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: 12.5, color: MUTED }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: PURPLE, background: 'rgba(104,6,98,0.08)', border: '1px solid rgba(104,6,98,0.25)' }}>קיים היום</span>
            עובד בקוד כרגע
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, color: '#92400e', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>ניתן להתאמה</span>
            נוכל לספק — דורש עבודת התאמה/DevOps, לא רכיב מוכן
          </span>
        </div>

        {/* Sections */}
        {SECTIONS.map((sec, si) => (
          <section key={si} style={{ marginTop: 44 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${PURPLE}` }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 400, color: INK, margin: 0 }}>{sec.cat}</h2>
              <span style={{ fontSize: 12, color: FAINT }}>{sec.items.length} סעיפים</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sec.items.map((item, ii) => {
                const isAnswered = Boolean(item.a);
                return (
                  <div key={ii} style={{
                    background: '#fff',
                    border: `1px solid ${BORDER}`,
                    borderInlineStart: `4px solid ${isAnswered ? PURPLE : BORDER}`,
                    borderRadius: 10,
                    padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.6, flex: 1 }}>
                        {item.q}
                      </div>
                      {isAnswered && (
                        item.tag === 'adapt' ? (
                          <span style={{
                            flexShrink: 0, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
                            padding: '3px 9px', borderRadius: 999,
                            color: '#92400e', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                          }}>ניתן להתאמה</span>
                        ) : (
                          <span style={{
                            flexShrink: 0, fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
                            padding: '3px 9px', borderRadius: 999,
                            color: PURPLE, background: 'rgba(104,6,98,0.08)', border: '1px solid rgba(104,6,98,0.25)',
                          }}>קיים היום</span>
                        )
                      )}
                    </div>
                    {isAnswered ? (
                      <>
                        <p style={{ fontSize: 14, lineHeight: 1.85, color: '#44403C', margin: '10px 0 0' }}>
                          {item.a}
                        </p>
                        {item.link && (
                          <Link to={item.link.to} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
                            fontSize: 13, fontWeight: 600, color: PURPLE, textDecoration: 'none',
                          }}>
                            {item.link.label}
                            <span aria-hidden>←</span>
                          </Link>
                        )}
                      </>
                    ) : (
                      <div style={{
                        marginTop: 10, padding: '10px 14px',
                        border: `1px dashed ${BORDER}`, borderRadius: 8,
                        fontSize: 12.5, color: FAINT, fontStyle: 'italic',
                      }}>
                        להשלמה
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Footer note */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: `1px solid ${BORDER}`, fontSize: 12.5, color: FAINT, lineHeight: 1.7 }}>
          Lybi · המענה הטכני משקף את הפלטפורמה (Builder v2.0, מבוסס Addons) כפי שהיא פועלת כיום.
          יכולות המסומנות "במסגרת הטמעה" נמסרות כחלק מפרויקט ההטמעה המוסדי.
        </div>
      </div>
    </div>
  );
}
