import { useEffect, useCallback, useState } from 'react';
import s from './PitchDeckPage.module.css';

const TOTAL_SLIDES = 17;

export function PitchDeckPage() {
  const [current, setCurrent] = useState(0);
  const [light, setLight] = useState(false);

  const go = useCallback((dir: 1 | -1) => {
    setCurrent(prev => Math.max(0, Math.min(TOTAL_SLIDES - 1, prev + dir)));
  }, []);

  useEffect(() => {
    document.title = 'Aspect — Pitch Deck';
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    // lock body scroll
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'Backspace') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = orig;
      document.documentElement.lang = 'en';
      document.documentElement.dir = 'ltr';
    };
  }, [go]);

  const sl = (i: number) => `${s.slide} ${current === i ? s.active : ''}`;

  return (
    <div className={`${s.deck} ${light ? s.light : ''}`}>
      {/* Progress bar */}
      <div className={s.progress}>
        <div className={s.progressBar} style={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%` }} />
      </div>

      {/* ═══ SLIDE 0 — TITLE ═══ */}
      <div className={`${sl(0)} ${s.centered}`}>
        <span className={`${s.badge} ${s.badgeCyan}`}>פלטפורמת AI Agents</span>
        <h1 className={s.gradientText}>Aspect</h1>
        <p style={{ fontSize: '1.4rem', maxWidth: 700 }}>
          אנחנו לא סתם בונים אייג׳נטים.<br />
          <strong>אנחנו בונים אייג׳נטים שבאמת חושבים.</strong>
        </p>
        <p className={s.smallText} style={{ marginTop: '1.5em' }}>הפלטפורמה למערכות Multi-Agent לעסקים מונחי-דאטה</p>
      </div>

      {/* ═══ SLIDE 1 — GOLD RUSH ═══ */}
      <div className={sl(1)}>
        <span className={`${s.badge} ${s.badgeAmber}`}>המציאות בשוק</span>
        <h2>ברוכים הבאים לבהלת<br />הזהב של ה-AI Agents</h2>
        <div className={s.split} style={{ marginTop: '0.8em' }}>
          <div>
            <p>
              בדיוק כמו שכל סוכנות דיגיטל הקימה "אתרים" עם וורדפרס —
              <strong> היום כל אחד חושב שהוא יודע לבנות AI Agent.</strong>
            </p>
            <div className={s.divider} />
            <ul className={`${s.dotList} ${s.dotAmber}`}>
              <li>"בונים אייג׳נטים" עם גרירה ושחרור בלי שום הבנה</li>
              <li>אפליקציות עטיפה שסתם קוראות ל-ChatGPT עם הוראה</li>
              <li>אפס הבנה ביכולות ובמגבלות של המודלים</li>
              <li>אפס מומחיות בדאטה, אופטימיזציה וארכיטקטורה</li>
              <li>תבניות הוראה מוכנות שנמכרות בתור "פתרון מותאם"</li>
            </ul>
          </div>
          <div>
            <div className={`${s.card} ${s.borderAmber}`}>
              <span className={s.cardIcon}>⚠️</span>
              <h4>התוצאה?</h4>
              <p className={s.accentAmber}>
                עסקים משקיעים באייג׳נטים שנשברים על מקרי קצה,
                לא מסוגלים לחשיבה רב-שלבית, שוכחים הקשר בין הודעות,
                ונותנים <strong className={s.accentRed}>תשובות גנריות</strong> שאפשר לקבל מ-ChatGPT בחינם.
              </p>
            </div>
            <div className={`${s.card} ${s.mt1}`}>
              <h4 className={s.accentAmber}>נשמע מוכר?</h4>
              <p>"ניסינו צ׳אטבוט AI. הוא לא הבין את העסק. הלקוחות התבאסו. כיבנו אותו."</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 2 — WHY THEY FAIL ═══ */}
      <div className={sl(2)}>
        <span className={`${s.badge} ${s.badgeRed}`}>הבעיה</span>
        <h2>למה 90% מה-AI Agents<br />הם בסך הכל צ׳אטבוטים יקרים</h2>
        <div className={s.grid3} style={{ marginTop: '0.8em' }}>
          <div className={s.card}>
            <span className={s.cardIcon}>💬</span>
            <h4>Prompt אחד, מוח אחד</h4>
            <p>הוראת מערכת אחת שמנסה לכסות כל שיחה אפשרית. כמו עובד אחד שעושה מכירות, תמיכה, הטמעה ואנליזות. בו-זמנית.</p>
          </div>
          <div className={s.card}>
            <span className={s.cardIcon}>🧠</span>
            <h4>בלי זיכרון, בלי הקשר</h4>
            <p>המשתמש חוזר מחר? האייג׳נט לא יודע מי הוא, מה דיברו, או באיזה שלב הוא. כל שיחה מתחילה מאפס.</p>
          </div>
          <div className={s.card}>
            <span className={s.cardIcon}>🔍</span>
            <h4>לא מתמודד עם שאלות מורכבות</h4>
            <p>"השווה ביצועי סניפים ברבעון וסמן חריגות" — צ׳אטבוט רגיל פשוט נתקע. אין תכנון שאילתא, אין תזמור נתונים.</p>
          </div>
          <div className={s.card}>
            <span className={s.cardIcon}>🔒</span>
            <h4>נעילה לספק אחד</h4>
            <p>בנוי על מודל אחד? כשה-API משתנה, המחירים קופצים, או שמודל חזק יותר יוצא — תקועים. תבנו הכל מחדש.</p>
          </div>
          <div className={s.card}>
            <span className={s.cardIcon}>📊</span>
            <h4>אפס הבנת דאטה</h4>
            <p>מחברים לבסיס נתונים וקוראים לזה "AI אנליטיקס". אבל הם לא מבינים את המבנה, המינוח, או מדדי ההצלחה שלכם.</p>
          </div>
          <div className={s.card}>
            <span className={s.cardIcon}>⚙️</span>
            <h4>אפס אינטליגנציית תהליך</h4>
            <p>תהליכים אמיתיים כוללים שלבים, תנאים והסתעפויות. צ׳אטבוט לא מסוגל להוביל משתמש דרך הטמעה, הערכה או קליטה מורכבת.</p>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 3 — SECTION BREAK ═══ */}
      <div className={`${sl(3)} ${s.centered}`}>
        <span className={`${s.badge} ${s.badgeBlue}`}>הפתרון</span>
        <h2 style={{ fontSize: '3rem' }}>סוג אחר של<br />פלטפורמת אייג׳נטים</h2>
        <p style={{ fontSize: '1.2rem', maxWidth: 600 }}>
          נבנתה ע״י מהנדסים שמבינים לעומק גם את הטכנולוגיה<br />
          וגם את הנתונים שהיא צריכה לעבוד איתם.
        </p>
      </div>

      {/* ═══ SLIDE 4 — WHAT IS ASPECT ═══ */}
      <div className={sl(4)}>
        <span className={`${s.badge} ${s.badgeBlue}`}>מכירים את Aspect</span>
        <h2>AI Agents מהונדסים<br />לעסקים אמיתיים</h2>
        <div className={s.split} style={{ marginTop: '0.6em' }}>
          <div>
            <p>
              Aspect היא <strong>פלטפורמת תזמור multi-agent</strong> שבונה
              אייג׳נטים ייעודיים לתחום שלכם — עם חוכמת תהליך אמיתית,
              זיכרון מתמשך, והבנה עמוקה של הנתונים.
            </p>
            <div className={s.divider} />
            <ul className={`${s.dotList} ${s.dotGreen}`}>
              <li><strong>מערכת Crew</strong> — תתי-אייג׳נטים מומחים לכל שלב בשיחה</li>
              <li><strong>הקשר מתמשך</strong> — זוכר משתמשים בין סשנים</li>
              <li><strong>Multi-LLM</strong> — GPT-4o, GPT-5, Claude, Gemini. המודל הטוב ביותר לכל משימה</li>
              <li><strong>בסיסי ידע</strong> — vector stores ייעודיים לכל crew member</li>
              <li><strong>תזמור כלים</strong> — אייג׳נטים שעושים פעולות, לא רק מדברים</li>
              <li><strong>סטרימינג בזמן אמת</strong> — SSE עם שקיפות חשיבה</li>
            </ul>
          </div>
          <div>
            <div className={s.glowCard}>
              <h4 className={s.accentCyan} style={{ marginBottom: '0.5em' }}>ההבדל של Aspect</h4>
              <p style={{ lineHeight: 1.7 }}>
                אנחנו לא נותנים לכם כלי בנייה ומאחלים בהצלחה.<br /><br />
                אנחנו <strong>מתכננים ארכיטקטורה</strong> לאייג׳נטים שלכם
                באותה רמת רצינות שצוות תוכנה בונה מערכת ליבה.
                כל אייג׳נט <strong>תפור במדויק</strong> לתחום שלכם,
                לנתונים שלכם, לתהליכים ולמשתמשים שלכם.<br /><br />
                אנחנו מבינים את הטכנולוגיה מספיק לעומק כדי לדעת
                <strong> מה AI מסוגל ומה לא</strong> — ומתכננים
                ארכיטקטורה שעוקפת את המגבלות במקום להסתיר אותן.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 5 — CREW SYSTEM ═══ */}
      <div className={sl(5)}>
        <span className={`${s.badge} ${s.badgeCyan}`}>החדשנות המרכזית</span>
        <h2>מערכת ה-Crew</h2>
        <p style={{ marginBottom: '0.2em' }}>
          אייג׳נט אחד. מספר מוחות מומחים. העברה חלקה.
        </p>
        <div className={s.split} style={{ marginTop: '0.5em' }}>
          <div>
            <p>במקום הוראה אחת שמנסה לכסות הכל, לכל אייג׳נט Aspect יש
              <strong> צוות</strong> של יחידות מומחות שמטפלות בשלבים שונים של השיחה. המנתב מחליט אוטומטית למי להעביר.</p>
            <div className={s.flow} style={{ marginTop: '0.7em' }}>
              <span className={s.flowStep}>הודעת משתמש</span>
              <span className={s.flowArrow}>←</span>
              <span className={s.flowStepActive}>Dispatcher</span>
              <span className={s.flowArrow}>←</span>
              <span className={s.flowStep}>Crew פעיל</span>
              <span className={s.flowArrow}>←</span>
              <span className={s.flowStep}>LLM + כלים + KB</span>
              <span className={s.flowArrow}>←</span>
              <span className={s.flowStep}>תגובת סטרימינג</span>
            </div>
            <div className={s.divider} />
            <p><strong>לכל crew member יש:</strong></p>
            <ul className={`${s.dotList} ${s.dotBlue}`}>
              <li>אישיות והנחיות שיחה ייחודיות</li>
              <li>בחירת מודל LLM (אופטימיזציית עלות/איכות)</li>
              <li>כלים ופונקציות ייעודיות</li>
              <li>בסיס ידע ייעודי</li>
              <li>תנאי מעבר ל-crew members אחרים</li>
            </ul>
          </div>
          <div>
            <div className={`${s.card} ${s.borderCyan}`} style={{ padding: '1.3em' }}>
              <h4 className={s.accentCyan} style={{ marginBottom: '0.6em' }}>דוגמה: אייג׳נט בריאות</h4>
              <div className={s.timeline}>
                <div className={s.timelineItem}>
                  <h4>Crew הכרות</h4>
                  <p>קבלת פנים, בדיקת התאמה, אישור תנאים. שדות מחולצים במקביל לתגובת ה-LLM.</p>
                </div>
                <div className={s.timelineItem}>
                  <h4>Crew פרופיילר</h4>
                  <p>מיפוי מסע המשתמש — שלב, היסטוריה, טיפולים. כותב context מתמשך לכל הסשנים העתידיים.</p>
                </div>
                <div className={s.timelineItem}>
                  <h4>Crew הערכה</h4>
                  <p>מעקב סימפטומים שיטתי דרך tool calls. כל כלי מעדכן DB וקובע את המעבר הבא.</p>
                </div>
                <div className={s.timelineItem}>
                  <h4>Crew כללי</h4>
                  <p>תמיכה שוטפת עם טון מותאם לפרופיל המשתמש. גישה לכל בסיס הידע.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 6 — SMART QUERIES ═══ */}
      <div className={sl(6)}>
        <span className={`${s.badge} ${s.badgePurple}`}>שכבת אינטליגנציה</span>
        <h2>אייג׳נטים שמתכננים<br />לפני שעונים</h2>
        <div className={s.split} style={{ marginTop: '0.6em' }}>
          <div>
            <p>
              כשמנהל שואל שאלה מורכבת, האייג׳נטים שלנו לא סתם מריצים שאילתא.
              הם <strong>מתכננים אסטרטגיה</strong>, מפרקים לחלקים, מריצים במקביל, ומגבשים תובנה.
            </p>
            <div className={s.highlightBox} style={{ marginTop: '0.6em' }}>
              <p style={{ fontStyle: 'italic' }}>
                "תשווה לי את 3 הסניפים הכי חזקים ברבעון, תראה אילו קטגוריות יורדות, ותגיד לי אם זה עונתי או שמשהו השתנה."
              </p>
            </div>
            <div className={`${s.card} ${s.mt1} ${s.borderPurple}`}>
              <h4 className={s.accentPurple}>איך Aspect מטפל בזה:</h4>
              <div className={s.flow} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35em', marginTop: '0.4em' }}>
                <span className={`${s.flowStep} ${s.borderPurple} ${s.accentPurple}`}>1. פירוק — פיצול לתת-שאילתות</span>
                <span className={`${s.flowStep} ${s.borderBlue} ${s.accentBlue}`}>2. תכנון — מקורות נתונים ואסטרטגיית JOIN</span>
                <span className={`${s.flowStep} ${s.borderCyan} ${s.accentCyan}`}>3. ביצוע — שאילתות מותאמות במקביל</span>
                <span className={`${s.flowStep} ${s.borderGreen} ${s.accentGreen}`}>4. סינתזה — שילוב לתובנה מעשית</span>
              </div>
            </div>
          </div>
          <div>
            <div className={s.codeBlock}>
              <span className={s.cmt}>// משתמש שואל: "למה סניף הרצליה ירד?"</span><br /><br />
              <span className={s.cmt}>// שלב 1: האייג׳נט מפרק את השאלה</span><br />
              <span className={s.kw}>const</span> plan = {'{'}<br />
              &nbsp;&nbsp;queries: [<br />
              &nbsp;&nbsp;&nbsp;&nbsp;{'{'} <span className={s.prop}>target</span>: <span className={s.str}>"branch_sales"</span>, <span className={s.prop}>filter</span>: <span className={s.str}>"Q4, הרצליה"</span> {'}'},<br />
              &nbsp;&nbsp;&nbsp;&nbsp;{'{'} <span className={s.prop}>target</span>: <span className={s.str}>"competitor_events"</span>, <span className={s.prop}>filter</span>: <span className={s.str}>"geo:הרצליה"</span> {'}'},<br />
              &nbsp;&nbsp;&nbsp;&nbsp;{'{'} <span className={s.prop}>target</span>: <span className={s.str}>"customer_churn"</span>, <span className={s.prop}>filter</span>: <span className={s.str}>"segment:פרימיום"</span> {'}'},<br />
              &nbsp;&nbsp;],<br />
              &nbsp;&nbsp;analysis: <span className={s.str}>"cross-reference timeline"</span><br />
              {'}'};
              <br /><br />
              <span className={s.cmt}>// שלב 2: הרצה מקבילית עם סטרימינג</span><br />
              <span className={s.kw}>const</span> results = <span className={s.kw}>await</span> Promise.<span className={s.fn}>all</span>(<br />
              &nbsp;&nbsp;plan.queries.<span className={s.fn}>map</span>(q =&gt; <span className={s.fn}>execute</span>(q))<br />
              );
              <br /><br />
              <span className={s.cmt}>// "הירידה החלה ב-15/11 כשמתחרה נפתח.</span><br />
              <span className={s.cmt}>//  45% מהלקוחות שאבדו - פלח פרימיום.</span><br />
              <span className={s.cmt}>//  המלצה: תוכנית נאמנות."</span>
            </div>
            <div className={`${s.card} ${s.mt1} ${s.borderGreen}`}>
              <h4 className={s.accentGreen} style={{ fontSize: '0.72rem' }}>שלבי חשיבה גלויים למשתמש</h4>
              <p style={{ fontSize: '0.65rem' }}>
                המשתמשים רואים את תהליך החשיבה בזמן אמת —
                "מבין שאלה... גישה לנתוני מכירות... הצלבת ציר זמן... הכנת תובנות"
                — בונה אמון ושקיפות.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 7 — CONTEXT ═══ */}
      <div className={sl(7)}>
        <span className={`${s.badge} ${s.badgeGreen}`}>אינטליגנציה מתמשכת</span>
        <h2>הקשר ששורד</h2>
        <p>
          האייג׳נטים שלכם זוכרים. בין הודעות, בין שיחות, בין יחידות הצוות.
        </p>
        <div className={s.grid3} style={{ marginTop: '0.7em' }}>
          <div className={`${s.card} ${s.borderBlue}`}>
            <h4 className={s.accentBlue}>רמת הודעה</h4>
            <p>היסטוריית שיחה מלאה עם כל הפרטים — מי ענה, אילו כלים הופעלו, אילו מסמכים צוטטו.</p>
          </div>
          <div className={`${s.card} ${s.borderCyan}`}>
            <h4 className={s.accentCyan}>רמת שיחה</h4>
            <p>מצב שנשמר בתוך סשן. התקדמות הערכה, שדות שנאספו, מיקום בתהליך — הכל נשמר לאורך השיחה.</p>
          </div>
          <div className={`${s.card} ${s.borderGreen}`}>
            <h4 className={s.accentGreen}>רמת משתמש</h4>
            <p>זיכרון שחוצה שיחות. המשתמש חוזר מחר? הפרופיל, ההעדפות והמסע שלו נשמרים. בלי להתחיל מאפס.</p>
          </div>
        </div>
        <div className={s.highlightBox}>
          <div className={s.split} style={{ gap: '1em', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.8rem', margin: 0 }}>
                <strong>Crew members חולקים הקשר:</strong> ה-Profiler כותב נתוני משתמש.
                ה-General קורא אותם. ה-Assessment מעדכן אותם.
                העברות חלקות עם המשכיות מלאה —
                המשתמש אף פעם לא מרגיש שהוא מדבר עם מוח מומחה אחר.
              </p>
            </div>
            <div className={s.codeBlock} style={{ fontSize: '0.55rem', margin: 0 }}>
              <span className={s.cmt}>// Profiler כותב נתוני מסע</span><br />
              <span className={s.kw}>await</span> this.<span className={s.fn}>writeContext</span>(<span className={s.str}>'journey'</span>, {'{'}<br />
              &nbsp;&nbsp;<span className={s.prop}>stage</span>: <span className={s.str}>'peri'</span>,<br />
              &nbsp;&nbsp;<span className={s.prop}>treatments</span>: [<span className={s.str}>'HRT'</span>],<br />
              &nbsp;&nbsp;<span className={s.prop}>primaryConcern</span>: <span className={s.str}>'sleep'</span><br />
              {'}'});<br /><br />
              <span className={s.cmt}>// General crew קורא מאוחר יותר</span><br />
              <span className={s.kw}>const</span> p = <span className={s.kw}>await</span> this.<span className={s.fn}>getContext</span>(<span className={s.str}>'journey'</span>);
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 8 — MULTI-LLM ═══ */}
      <div className={sl(8)}>
        <span className={`${s.badge} ${s.badgePurple}`}>ללא נעילה</span>
        <h2>Multi-LLM מתוך עיצוב</h2>
        <p>
          לא קשורים למודל אחד. לא כבולים לספק אחד. אף פעם.
        </p>
        <div className={s.grid4} style={{ marginTop: '0.7em' }}>
          <div className={`${s.card} ${s.borderGreen}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>🎯</span>
            <h4>OpenAI</h4>
            <p>GPT-4o, GPT-5<br />הטוב ביותר לניתוח דאטה מובנה</p>
          </div>
          <div className={`${s.card} ${s.borderPurple}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>🤖</span>
            <h4>Anthropic</h4>
            <p>Claude Sonnet, Opus<br />הטוב ביותר לשיחה עדינה</p>
          </div>
          <div className={`${s.card} ${s.borderBlue}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>💡</span>
            <h4>Google</h4>
            <p>Gemini Pro, Flash<br />הטוב ביותר למהירות ועלות</p>
          </div>
          <div className={`${s.card} ${s.borderAmber}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>⚡</span>
            <h4>בחירה לכל Crew</h4>
            <p>מודל שונה לכל crew member — אופטימיזציית עלות ואיכות בכל שלב</p>
          </div>
        </div>
        <div className={s.highlightBox}>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', margin: 0 }}>
            <strong>למה זה חשוב:</strong> ה-crew הכרות משתמש במודל מהיר וזול לפתיחות.
            ה-crew אנליטיקס משתמש במודל החזק ביותר לחשיבה מורכבת.
            ה-crew ידע משתמש במודל הטוב ביותר לאחזור. <strong>אתם משלמים בדיוק מה שכל משימה שווה.</strong>
          </p>
        </div>
      </div>

      {/* ═══ SLIDE 9 — USE CASES ═══ */}
      <div className={sl(9)}>
        <span className={`${s.badge} ${s.badgeGreen}`}>מוכח בשטח</span>
        <h2>מוכח במגוון דומיינים</h2>
        <p>
          לא דמו. לא אב-טיפוס. אייג׳נטים באוויר שמשרתים משתמשים אמיתיים.
        </p>
        <div className={s.grid4} style={{ marginTop: '0.7em' }}>
          <div className={`${s.usecase} ${s.borderBlue}`}>
            <div className={`${s.usecaseDomain} ${s.accentBlue}`}>בינה עסקית</div>
            <h4>Aspect Insight</h4>
            <p>שאילתות בשפה חופשית על מכירות, מלאי, לקוחות, סניפים. זיהוי מגמות, התראות חריגים, המלצות מעשיות.</p>
          </div>
          <div className={`${s.usecase} ${s.borderPurple}`}>
            <div className={`${s.usecaseDomain} ${s.accentPurple}`}>בריאות</div>
            <h4>Freeda 2.0</h4>
            <p>מלווה גיל המעבר עם מסע crew בן 4 שלבים. מעקב סימפטומים, KB רפואי, ליווי מותאם. זוכר בין סשנים.</p>
          </div>
          <div className={`${s.usecase} ${s.borderAmber}`}>
            <div className={`${s.usecaseDomain} ${s.accentAmber}`}>שירותים פיננסיים</div>
            <h4>Banking Onboarder</h4>
            <p>תהליך KYC/AML עם 8 crews. אימות זהות, בדיקות ציות, הצעות מוצר. הטמעה רב-שלבית מונחית.</p>
          </div>
          <div className={`${s.usecase} ${s.borderCyan}`}>
            <div className={`${s.usecaseDomain} ${s.accentCyan}`}>סיכונים וציות</div>
            <h4>Byline Bank</h4>
            <p>20 crews מומחים להערכת סיכון מעבדי תשלומים. BSA/AML, נכסים דיגיטליים, בדיקת נאותות. רמת enterprise.</p>
          </div>
        </div>
        <div className={s.grid3} style={{ marginTop: '0.8em' }}>
          <div className={s.stat}>
            <div className={`${s.statNumber} ${s.accentBlue}`}>+6</div>
            <div className={s.statLabel}>אייג׳נטים בפרודקשן</div>
          </div>
          <div className={s.stat}>
            <div className={`${s.statNumber} ${s.accentCyan}`}>+36</div>
            <div className={s.statLabel}>Crew Members מומחים</div>
          </div>
          <div className={s.stat}>
            <div className={`${s.statNumber} ${s.accentGreen}`}>5</div>
            <div className={s.statLabel}>אנכי תעשייה</div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 10 — BI DEEP DIVE ═══ */}
      <div className={sl(10)}>
        <span className={`${s.badge} ${s.badgeBlue}`}>צלילה עמוקה</span>
        <h2>BI שמדבר אנושית</h2>
        <p>
          הנתונים שלכם. השפה שלכם. המינוח שלכם. תשובות מיידיות.
        </p>
        <div className={s.split} style={{ marginTop: '0.5em' }}>
          <div>
            <div className={s.chatDemo}>
              <div className={s.accentBlue} style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.6em' }}>
                💬 דוגמת שיחה חיה
              </div>
              <div className={s.chatBubbleUser}>השווה 3 סניפים מובילים ברבעון. סמן חריגות.</div>
              <div className={s.chatBubbleBot}>
                <strong>3 סניפים מובילים ברבעון:</strong><br />
                <span className={s.chatRow}><span>תל אביב — ₪2.4M</span><span className={s.chatPositive}>+18%</span></span>
                <span className={s.chatRow}><span>רמת גן — ₪1.8M</span><span className={s.chatPositive}>+12%</span></span>
                <span className={s.chatRow}><span>הרצליה — ₪1.6M</span><span className={s.chatNegative}>-3%</span></span>
                <span className={s.chatInsight}>💡 הרצליה צמח 22% עד אמצע נובמבר ואז צנח. קטגוריית פרימיום ירדה 40%. מתחרה נפתח בסביבה.</span>
              </div>
              <div className={s.chatBubbleUser}>מה ממליץ?</div>
              <div className={s.chatBubbleBot}>
                <span className={s.accentGreen}>✅ תוכנית נאמנות ללקוחות פרימיום</span><br />
                <span className={s.accentGreen}>✅ התאמת מחיר מול מבצע ההשקה ל-30 יום</span><br />
                <span className={s.accentGreen}>✅ שדרוג חוויית החנות (היתרון שלכם)</span>
              </div>
            </div>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>לא רק מספרים — אינטליגנציה</h3>
            <ul className={`${s.dotList} ${s.dotGreen}`}>
              <li><strong>זיהוי מגמות</strong> — מזהה דפוסים לפני שתשאלו</li>
              <li><strong>התראות חריגים</strong> — מסמן מה לא רגיל</li>
              <li><strong>ניתוח שורש</strong> — חוקר את ה"למה"</li>
              <li><strong>המלצות מעשיות</strong> — אומר מה לעשות</li>
              <li><strong>דאטה חוצה-מערכות</strong> — ERP + CRM + מקורות נוספים</li>
            </ul>
            <div className={s.divider} />
            <div className={`${s.card} ${s.borderGreen}`}>
              <h4 className={s.accentGreen}>מבין את העסק שלכם</h4>
              <p>
                מכיר שמות סניפים, כינויי עובדים, קטגוריות מוצרים,
                דפוסים עונתיים ודינמיקת שוק מקומית. לא כלי גנרי —
                קולגה שמכיר את העסק מבפנים.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 11 — COMPARISON TABLE ═══ */}
      <div className={sl(11)}>
        <span className={`${s.badge} ${s.badgeGreen}`}>למה אנחנו</span>
        <h2>Aspect מול השאר</h2>
        <table className={s.compareTable} style={{ marginTop: '0.6em' }}>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>יכולת</th>
              <th style={{ width: '37%' }} className={s.accentRed}>🔴 בוני אייג׳נטים גנריים</th>
              <th style={{ width: '38%' }} className={s.accentGreen}>🟢 Aspect</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>ארכיטקטורה</strong></td><td className={s.cross}>Prompt בודד + עטיפת API</td><td className={s.check}>מערכת crew עם תזמור multi-agent</td></tr>
            <tr><td><strong>זיכרון</strong></td><td className={s.cross}>סשן בלבד (או בכלל לא)</td><td className={s.check}>3 שכבות: הודעה, שיחה, משתמש</td></tr>
            <tr><td><strong>שאלות מורכבות</strong></td><td className={s.cross}>יריה אחת, לעתים נכשל</td><td className={s.check}>פירוק ← תכנון ← ביצוע ← סינתזה</td></tr>
            <tr><td><strong>תמיכת LLM</strong></td><td className={s.cross}>נעול לספק אחד</td><td className={s.check}>Multi-LLM: OpenAI, Anthropic, Google לכל crew</td></tr>
            <tr><td><strong>תהליכים</strong></td><td className={s.cross}>ליניארי או הסתעפות בסיסית</td><td className={s.check}>מעברים מבוססי-שדות וכלים, ניתוב דינמי</td></tr>
            <tr><td><strong>בסיס ידע</strong></td><td className={s.cross}>vector store משותף אחד</td><td className={s.check}>בסיסי ידע ייעודיים לכל crew</td></tr>
            <tr><td><strong>מומחיות דומיין</strong></td><td className={s.cross}>תבניות גנריות</td><td className={s.check}>תפור לדומיין, דאטה ומינוח שלכם</td></tr>
            <tr><td><strong>שקיפות</strong></td><td className={s.cross}>קופסה שחורה</td><td className={s.check}>שלבי חשיבה, ציטוטי KB, מידע crew</td></tr>
            <tr><td><strong>מהירות התפתחות</strong></td><td className={s.cross}>תלוי ב-roadmap של הספק</td><td className={s.check}>crew members חדשים בימים, לא רבעונים</td></tr>
          </tbody>
        </table>
      </div>

      {/* ═══ SLIDE 12 — VS VENDOR AI ═══ */}
      <div className={sl(12)}>
        <span className={`${s.badge} ${s.badgeAmber}`}>השוואת שוק</span>
        <h2>מול ה-"AI המובנה"<br />של הספק שלכם</h2>
        <p>
          כל ספקי BI/ERP מוסיפים AI. הנה למה זה לא מספיק.
        </p>
        <div className={s.grid3} style={{ marginTop: '0.7em' }}>
          <div className={`${s.card} ${s.borderGreen}`}>
            <span className={s.cardIcon}>🎯</span>
            <h4>ה-AI שלהם = הפלטפורמה שלהם בלבד</h4>
            <p>AI של ספק רואה רק נתונים במערכת שלו. ה-ERP לא מדבר עם ה-CRM שלא מדבר עם הגיליונות.
              <strong className={s.accentGreen}> Aspect מחבר הכל.</strong></p>
          </div>
          <div className={`${s.card} ${s.borderGreen}`}>
            <span className={s.cardIcon}>🔧</span>
            <h4>ה-AI שלהם = גנרי</h4>
            <p>אותו AI לכל לקוח. לא מכיר את המינוח, ה-KPIs, או דינמיקת השוק שלכם.
              <strong className={s.accentGreen}> Aspect נבנה לעסק שלכם.</strong></p>
          </div>
          <div className={`${s.card} ${s.borderGreen}`}>
            <span className={s.cardIcon}>🔒</span>
            <h4>ה-AI שלהם = התנאים שלהם</h4>
            <p>מעלים מחירים? מורידים פיצ׳ר? סוגרים מוצר? אתם תקועים.
              <strong className={s.accentGreen}> Aspect נותן עצמאות מלאה.</strong></p>
          </div>
        </div>
        <div className={s.highlightBox}>
          <p style={{ textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
            ספקים מוסיפים AI כי <strong>כולם מוסיפים AI</strong>. זה AI <strong className={s.accentAmber}>שלהם</strong>, לא <strong className={s.accentGreen}>שלכם</strong>.<br />
            ה-AI של Aspect נבנה במיוחד עבורכם. מכיר את העסק. ומשתפר לפי מה שאתם צריכים.
          </p>
        </div>
      </div>

      {/* ═══ SLIDE 13 — EXPERTISE ═══ */}
      <div className={sl(13)}>
        <span className={`${s.badge} ${s.badgeCyan}`}>למה לסמוך עלינו</span>
        <h2>מומחי טכנולוגיה.<br />מומחי דאטה. שניהם.</h2>
        <div className={s.split} style={{ marginTop: '0.5em' }}>
          <div>
            <h3 style={{ marginTop: 0 }}>אנחנו מבינים את הטכנולוגיה</h3>
            <ul className={`${s.dotList} ${s.dotBlue}`}>
              <li>הבנה עמוקה של יכולות LLM <strong>ומגבלותיהם</strong></li>
              <li>ארכיטקטורת מולטי-מודל — המודל הנכון לכל משימה</li>
              <li>סטרימינג, טיפול בשגיאות וסקאלה ברמת פרודקשן</li>
              <li>הנדסת prompt שחורגת מ"אתה עוזר מועיל"</li>
              <li>עיצוב כלים שמונע הזיות ומבטיח דיוק</li>
            </ul>
            <div className={s.divider} />
            <h3>אנחנו מבינים את הדאטה</h3>
            <ul className={`${s.dotList} ${s.dotGreen}`}>
              <li>הבנת סכמה, לא רק "חיבור לדאטהבייס"</li>
              <li>אופטימיזציית שאילתות לניתוח מורכב רב-טבלאות</li>
              <li>מודלינג דאטה ייעודי לדומיין והגדרות KPI</li>
              <li>מודעות לאיכות נתונים — יודעים מתי הדאטה חשוד</li>
              <li>איחוד ונרמול דאטה חוצה-מערכות</li>
            </ul>
          </div>
          <div>
            <div className={s.glowCard}>
              <h4 className={s.accentCyan} style={{ marginBottom: '0.4em' }}>
                ההבדל שמרגישים
              </h4>
              <p style={{ lineHeight: 1.65 }}>
                "מפתח שיודע לקרוא ל-API של AI" הוא לא מומחה AI.<br /><br />
                מומחה AI שלא מבין את הנתונים העסקיים שלכם
                יבנה דמואים מרשימים שנכשלים בשטח.<br /><br />
                אנחנו השילוב הנדיר:<br />
                <strong className={s.accentBlue}>מומחיות ארכיטקטורת AI</strong>
                {' + '}
                <strong className={s.accentGreen}>הבנת נתונים עמוקה</strong>
                {' + '}
                <strong className={s.accentAmber}>התאמה לתחום</strong>.<br /><br />
                לכן האייג׳נטים שלנו לא רק <em>מדברים</em> — הם <strong>מספקים</strong>.
              </p>
            </div>
            <div className={`${s.card} ${s.mt1} ${s.borderAmber}`}>
              <h4 className={s.accentAmber}>אנחנו מתכננים סביב המגבלות</h4>
              <p>
                אנחנו יודעים בדיוק איפה מודלי שפה מדמיינים, מאבדים הקשר, או נכשלים בחישובים.
                אנחנו בונים ארכיטקטורה שעוקפת את החולשות
                עם כלים ייעודיים, פלטים מובנים, והתמחות של כל יחידת צוות.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 14 — HOW WE WORK ═══ */}
      <div className={sl(14)}>
        <span className={`${s.badge} ${s.badgeBlue}`}>איך עובדים</span>
        <h2>מאפס לפרודקשן<br />בשבועות, לא חודשים</h2>
        <div className={s.grid4} style={{ marginTop: '0.8em' }}>
          <div className={`${s.card} ${s.borderTopBlue}`}>
            <span className={s.cardIcon}>🔍</span>
            <h4>1. גילוי</h4>
            <p>לומדים את הדומיין, הדאטה, המשתמשים והתהליכים שלכם. אילו שאלות שואלים? אילו החלטות מקבלים? איפה נתקעים?</p>
          </div>
          <div className={`${s.card} ${s.borderTopCyan}`}>
            <span className={s.cardIcon}>🛠️</span>
            <h4>2. ארכיטקטורה</h4>
            <p>תכנון מערכת ה-crew: אילו members, מה כל אחד מטפל, איך מעברים ביניהם, אילו נתונים חולקים. בחירת LLM אופטימלי לכל crew.</p>
          </div>
          <div className={`${s.card} ${s.borderTopPurple}`}>
            <span className={s.cardIcon}>🚀</span>
            <h4>3. בנייה ופריסה</h4>
            <p>מימוש crew members עם הנחיות, כלים ו-KB. חיבור מקורות נתונים. פריסה לפרודקשן עם סטרימינג ומוניטורינג.</p>
          </div>
          <div className={`${s.card} ${s.borderTopGreen}`}>
            <span className={s.cardIcon}>📈</span>
            <h4>4. אבולוציה</h4>
            <p>שיפור מתמיד מבוסס שימוש אמיתי. הוספת crew members, שכלול prompts, הרחבת יכולות. ימים, לא רבעונים.</p>
          </div>
        </div>
        <div className={s.highlightBox} style={{ marginTop: '1.2em' }}>
          <div className={s.grid3} style={{ textAlign: 'center' }}>
            <div>
              <div className={s.accentBlue} style={{ fontSize: '2.2rem', fontWeight: 900 }}>ימים</div>
              <p style={{ margin: 0, fontSize: '0.75rem' }}>לפרוטוטייפ עובד ראשון</p>
            </div>
            <div>
              <div className={s.accentCyan} style={{ fontSize: '2.2rem', fontWeight: 900 }}>שבועות</div>
              <p style={{ margin: 0, fontSize: '0.75rem' }}>לפריסת פרודקשן</p>
            </div>
            <div>
              <div className={s.accentGreen} style={{ fontSize: '2.2rem', fontWeight: 900 }}>רציף</div>
              <p style={{ margin: 0, fontSize: '0.75rem' }}>אבולוציה ואופטימיזציה</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SLIDE 15 — BOTTOM LINE ═══ */}
      <div className={sl(15)}>
        <span className={`${s.badge} ${s.badgeAmber}`}>השורה התחתונה</span>
        <h2>מה אתם מקבלים</h2>
        <div className={s.grid2} style={{ marginTop: '0.8em' }}>
          <div className={`${s.card} ${s.borderLeftRed}`}>
            <h4 className={s.accentRed}>בלי Aspect</h4>
            <ul className={`${s.dotList} ${s.dotRed}`} style={{ marginTop: '0.3em' }}>
              <li>צ׳אטבוט גנרי שמתסכל משתמשים</li>
              <li>פרויקט AI יקר ש"לא ממש עובד"</li>
              <li>נעולים ל-roadmap של ספק אחד</li>
              <li>חודשי פיתוח לפונקציונליות בסיסית</li>
              <li>צוות דאטה עדיין טובע בבקשות דוחות</li>
              <li>"ניסינו AI, זה לא בשבילנו"</li>
            </ul>
          </div>
          <div className={`${s.card} ${s.borderLeftGreen}`}>
            <h4 className={s.accentGreen}>עם Aspect</h4>
            <ul className={`${s.dotList} ${s.dotGreen}`} style={{ marginTop: '0.3em' }}>
              <li>אייג׳נט מומחה דומיין שמשתמשים סומכים עליו</li>
              <li>שאלות מורכבות נענות בשניות</li>
              <li>ארכיטקטורת Multi-LLM, עצמאית מספק</li>
              <li>פרודקשן בשבועות, אבולוציה בימים</li>
              <li>כל אחד בארגון עם גישה ישירה לתובנות</li>
              <li>"איך אי פעם עבדנו בלי זה?"</li>
            </ul>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5em', maxWidth: 750, alignSelf: 'center' }}>
          <span style={{ fontSize: '0.95rem' }}>השאלה היא לא אם אתם צריכים AI.</span>
          <br />
          <span className={s.gradientText} style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            השאלה היא: אתם רוצים AI שעובד?
          </span>
        </div>
      </div>

      {/* ═══ SLIDE 16 — CTA ═══ */}
      <div className={`${sl(16)} ${s.centered}`}>
        <span className={`${s.badge} ${s.badgeCyan}`}>הצעד הבא</span>
        <h2 className={s.gradientText} style={{ fontSize: '2.8rem' }}>בואו נבנה את<br />האייג׳נט שלכם ביחד</h2>
        <p style={{ fontSize: '1.1rem', maxWidth: 600, marginBottom: '0.5em' }}>
          ספרו לנו על העסק ועל הדאטה שלכם.<br />
          נראה לכם מה אפשר — על הנתונים האמיתיים שלכם, בשפה שלכם.
        </p>
        <div className={s.grid3} style={{ marginTop: '1em', maxWidth: 650 }}>
          <div className={`${s.card} ${s.borderBlue}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>💬</span>
            <h4 style={{ fontSize: '0.8rem' }}>הדגמה חיה</h4>
            <p style={{ fontSize: '0.6rem' }}>תראו את זה עובד על הדאטה שלכם</p>
          </div>
          <div className={`${s.card} ${s.borderCyan}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>🚀</span>
            <h4 style={{ fontSize: '0.8rem' }}>Proof of Concept</h4>
            <p style={{ fontSize: '0.6rem' }}>פרוטוטייפ עובד בימים</p>
          </div>
          <div className={`${s.card} ${s.borderGreen}`} style={{ textAlign: 'center' }}>
            <span className={s.cardIcon}>📈</span>
            <h4 style={{ fontSize: '0.8rem' }}>פריסת פרודקשן</h4>
            <p style={{ fontSize: '0.6rem' }}>אייג׳נט מלא בשבועות</p>
          </div>
        </div>
        <p className={s.smallText} style={{ marginTop: '1.5em' }}>
          info@aspect.co.il &nbsp;•&nbsp; aspect.co.il
        </p>
      </div>

      {/* ═══ NAVIGATION ═══ */}
      <div className={s.nav}>
        <button className={`${s.navBtn} ${s.navBtnPrev}`} onClick={() => go(-1)} title="הקודם" />
        <span className={s.slideCounter}>{current + 1} / {TOTAL_SLIDES}</span>
        <button className={`${s.navBtn} ${s.navBtnNext}`} onClick={() => go(1)} title="הבא" />
        <button className={s.themeBtn} onClick={() => setLight(v => !v)} title="החלף ערכת נושא">
          {light ? '\u{1F319}' : '\u{2600}\u{FE0F}'}
        </button>
      </div>
    </div>
  );
}
