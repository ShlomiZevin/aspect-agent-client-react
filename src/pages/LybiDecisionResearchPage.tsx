import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * Lybi — מחקר: איך לומדים מה מוביל לסגירה.
 *
 * Hebrew, RTL, knowledge-base look. The target is the OUTCOME (closed / not),
 * not the next message: an LLM proposes hypotheses about what separates closed
 * conversations from stuck ones, and close rates decide which survive.
 * Internal research page.
 */

const BG = '#FAF7F7';
const CARD = '#FFFFFF';
const BORDER = '#E7E5E4';
const INK = '#1C1917';
const MUTED = '#57534E';
const FAINT = '#A8A29E';
const PLUM = '#680662';
const PLUM_BG = 'rgba(104,6,98,0.06)';
const PLUM_BD = 'rgba(104,6,98,0.22)';
const GOLD = '#B45309';
const GOLD_BG = 'rgba(180,83,9,0.07)';
const GREEN = '#15803D';
const RED = '#9F1239';

const SERIF = "'Frank Ruhl Libre', 'Playfair Display', Georgia, serif";
const SANS = "'Assistant', 'DM Sans', ui-sans-serif, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Assistant:wght@300;400;600;700&display=swap');
.dres ::selection{background:rgba(104,6,98,0.16)}
`;

function H({ n, children, sub }: { n: string; children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: PLUM }}>{n}</span>
        <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: INK, margin: 0, lineHeight: 1.35 }}>{children}</h2>
      </div>
      {sub && <p style={{ fontFamily: SANS, fontSize: 15, color: FAINT, margin: '8px 0 0' }}>{sub}</p>}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.85, color: MUTED, margin: '0 0 16px' }}>{children}</p>;
}

function Card({ children, tint }: { children: React.ReactNode; tint?: 'plum' | 'gold' }) {
  const bg = tint === 'plum' ? PLUM_BG : tint === 'gold' ? GOLD_BG : CARD;
  const bd = tint === 'plum' ? PLUM_BD : tint === 'gold' ? 'rgba(180,83,9,0.25)' : BORDER;
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 14, padding: '22px 24px', margin: '0 0 18px' }}>{children}</div>
  );
}

function Arrow() {
  return <span style={{ color: FAINT, fontSize: 20, flexShrink: 0 }}>←</span>;
}

function Box({ title, sub, tone }: { title: string; sub?: string; tone?: 'plum' | 'plain' | 'gold' }) {
  const c = tone === 'plum' ? PLUM : tone === 'gold' ? GOLD : INK;
  const bg = tone === 'plum' ? PLUM_BG : tone === 'gold' ? GOLD_BG : CARD;
  const bd = tone === 'plum' ? PLUM_BD : tone === 'gold' ? 'rgba(180,83,9,0.25)' : BORDER;
  return (
    <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 11, padding: '11px 15px', textAlign: 'center', flexShrink: 0 }}>
      <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: c, whiteSpace: 'nowrap' }}>{title}</div>
      {sub && <div style={{ fontFamily: SANS, fontSize: 12.5, color: FAINT, marginTop: 3, whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

function Flow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap', justifyContent: 'center', padding: '2px 0' }}>{children}</div>;
}

/** Close-rate comparison — the whole method in one picture. */
function Bars({ rows }: { rows: { label: string; pct: number; strong?: boolean }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontFamily: SANS, fontSize: 14.5, color: MUTED }}>{r.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: r.strong ? PLUM : FAINT }}>{r.pct}%</span>
          </div>
          <div style={{ height: 12, background: '#EDE9EA', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${r.pct}%`, background: r.strong ? PLUM : '#C9C2C4', borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16,
      fontFamily: SANS, fontSize: 14, fontWeight: 600,
      color: ok ? GREEN : RED,
      background: ok ? 'rgba(21,128,61,0.08)' : 'rgba(159,18,57,0.07)',
      border: `1px solid ${ok ? 'rgba(21,128,61,0.25)' : 'rgba(159,18,57,0.22)'}`,
      borderRadius: 999, padding: '6px 14px',
    }}>
      <span>{ok ? '✓' : '✗'}</span>{children}
    </div>
  );
}

export function LybiDecisionResearchPage() {
  useEffect(() => {
    document.title = 'מחקר · מה מוביל לסגירה | Lybi';
    // global.css pins html/body/#root to the viewport for the chat app —
    // a long-form page has to opt out or it simply cannot scroll.
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const prevBg = document.body.style.background;
    document.body.style.background = BG;
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.background = prevBg;
    };
  }, []);

  return (
    <div className="dres" dir="rtl" style={{ fontFamily: SANS, background: BG, color: INK, height: '100%', minHeight: '100vh', overflow: 'auto' }}>
      <style>{CSS}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(250,247,247,0.95)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: SANS, fontSize: 14, color: MUTED, textDecoration: 'none' }}>
            → חזרה למאגר הידע
          </Link>
          <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: PLUM, background: PLUM_BG, padding: '5px 11px', borderRadius: 4 }}>מחקר</span>
        </div>
      </nav>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '56px 24px 100px' }}>
        <p style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: PLUM, margin: '0 0 12px' }}>
          LYBI · כיוון מחקר
        </p>
        <h1 style={{ fontFamily: SERIF, fontSize: 46, fontWeight: 700, lineHeight: 1.2, color: INK, margin: '0 0 20px' }}>
          איך לומדים מה מוביל אנשים לסגירה
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 19, lineHeight: 1.75, color: MUTED, margin: 0 }}>
          לגלות אילו מצבים של אנשים — כאלה שלא נאמרים במפורש — מובילים לסגירה או תוקעים אותה,
          ומה כדאי <strong style={{ color: INK }}>לעשות</strong> בכל מצב כזה.
        </p>

        {/* 01 */}
        <section style={{ marginTop: 60 }}>
          <H n="01">מה אנחנו רוצים לקבל</H>
          <P>
            המטרה היא לדעת מה מוביל שיחה לסגירה, ומה אפשר לעשות כדי שזה יקרה יותר —
            כולל מצבים שהלקוח לא מצהיר עליהם, אלא רק משתמעים מהשיחה.
          </P>
          <Card>
            <Flow>
              <Box title="שדה" sub="מזהה סוג מסוים של אדם" tone="plum" />
              <span style={{ fontFamily: SANS, fontSize: 20, color: FAINT }}>+</span>
              <Box title="התנהגות" sub="שעובדת דווקא עליו" tone="gold" />
              <Arrow />
              <Box title="יותר סגירות" tone="plain" />
            </Flow>
          </Card>
          <P>
            כל מה שלמטה נועד לייצר את הזוג הזה, ולהוכיח שהוא באמת עובד לפני שהוא נכנס ל-Cookbook.
          </P>
        </section>

        {/* 02 */}
        <section style={{ marginTop: 56 }}>
          <H n="02">איפה אנחנו היום</H>
          <P>
            כל סוכן עובד על שדות שמישהו ישב וכתב מהניסיון שלו. זה ניחוש טוב — אבל אף אחד לא בדק
            אם אלה השדות שבאמת מזיזים אנשים לסגירה, או רק אלה שהצלחנו לחשוב עליהם.
          </P>
        </section>

        {/* 03 */}
        <section style={{ marginTop: 56 }}>
          <H n="03" sub="בלי רשת נוירונים, בלי חיזוי טקסט">הרעיון: ה-LLM מציע, המספרים שופטים</H>
          <Card>
            <Flow>
              <Box title="50 נסגרו · 50 לא" sub="מתוך השיחות שלנו" tone="plain" />
              <Arrow />
              <Box title="LLM: מה שונה?" sub="מייצר השערות" tone="gold" />
              <Arrow />
              <Box title="תיוג כל השיחות" sub="לפי כל השערה" tone="plain" />
              <Arrow />
              <Box title="השוואת אחוזי סגירה" tone="plum" />
            </Flow>
          </Card>
          <P>
            ה-LLM הוא מחולל ההשערות — הוא טוב בלראות דפוסים בטקסט חופשי. אבל הוא לא השופט.
            השופט הוא <strong style={{ color: INK }}>אחוז הסגירה</strong>: מתייגים את כל השיחות לפי ההשערה,
            ומשווים. השערה שמפרידה חזק — נשארת. השערה שלא — נזרקת.
          </P>
        </section>

        {/* 04 */}
        <section style={{ marginTop: 56 }}>
          <H n="04" sub="המספרים כאן הם להמחשה בלבד">דוגמה — משכנתה</H>

          <Card>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: GOLD, marginBottom: 10 }}>השערה 1</div>
            <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.6, color: INK, margin: '0 0 20px', fontWeight: 600 }}>
              &ldquo;מי ששאל על סיכויי אישור כבר בשלוש ההודעות הראשונות&rdquo;
            </p>
            <Bars rows={[
              { label: 'שאלו על סיכויי אישור', pct: 22 },
              { label: 'לא שאלו', pct: 61, strong: true },
            ]} />
            <Verdict ok>הפרש גדול — ההשערה נשארת</Verdict>
          </Card>

          <Card>
            <div style={{ fontFamily: MONO, fontSize: 11.5, color: GOLD, marginBottom: 10 }}>השערה 2</div>
            <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.6, color: INK, margin: '0 0 20px', fontWeight: 600 }}>
              &ldquo;מי ששאל על גובה הריבית&rdquo;
            </p>
            <Bars rows={[
              { label: 'שאלו על ריבית', pct: 41 },
              { label: 'לא שאלו', pct: 43 },
            ]} />
            <Verdict ok={false}>כמעט אותו דבר — נזרק</Verdict>
          </Card>

          <P>
            השערה 2 היא בדיוק מה שהיינו מנחשים מראש — וזה מה שיפה בשיטה: היא זורקת גם את מה שנשמע הגיוני.
            השערה 1 היא משהו שאף אחד לא היה כותב כשדה, והיא מסמנת אדם שלא מתלבט על התנאים אלא{' '}
            <strong style={{ color: INK }}>חושש שיסרבו לו</strong>.
          </P>
          <Card tint="plum">
            <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.85, color: INK, margin: 0 }}>
              וזה משנה את כל התשובה. לאדם כזה טבלת מסלולים לא עוזרת — הוא צריך לשמוע את תנאי הסף,
              ושבדיקה מקדימה לא נרשמת בשום מקום ולא פוגעת בו.
            </p>
          </Card>
          <Card>
            <Flow>
              <Box title="השערה ששרדה" tone="plain" />
              <Arrow />
              <Box title="אדם מאשר" tone="gold" />
              <Arrow />
              <Box title="נכנס ל-Cookbook" sub="שדה + התנהגות" tone="plum" />
            </Flow>
          </Card>
        </section>

        {/* 05 · HOW */}
        <section style={{ marginTop: 56 }}>
          <H n="05" sub="דף פנימי — זה החלק המעשי">איך עושים את זה בפועל</H>

          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: INK, margin: '0 0 12px' }}>א׳ · ייצור השערות</div>
          <P>
            לוקחים שתי ערימות — נסגרו ולא נסגרו — ומבקשים מה-LLM לא &ldquo;לנתח&rdquo; אלא להוציא השערות
            שאפשר להכריע לגבי כל שיחה בכן/לא. הפורמט הוא מה שהופך את זה לשמיש:
          </P>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['name', 'חשש מסירוב'],
                ['definition', 'שואל על סיכויי אישור או על תיעוד של דחייה, לפני שביקש פרטי מוצר'],
                ['detect', 'האם בהודעות הראשונות הלקוח שאל על סיכוי, אישור, דחייה או רישום?'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: PLUM, direction: 'ltr', minWidth: 88, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.7, color: INK, flex: 1, minWidth: 220 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
          <P>
            שדה <span style={{ fontFamily: MONO, fontSize: 14, direction: 'ltr', display: 'inline-block' }}>detect</span>{' '}
            הוא הקריטי — הוא הופך אחר כך לפרומפט התיוג. אם אי אפשר לנסח אותו כשאלת כן/לא, ההשערה לא בדיקה.
          </P>

          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: INK, margin: '28px 0 12px' }}>ב׳ · תיוג כל השיחות</div>
          <P>
            מריצים את שאלת ה-detect על כל השיחות במאגר, אחת-אחת, במודל זול. אבל יש כאן שתי מלכודות
            שיהרסו את התוצאה אם לא נזהרים:
          </P>
          <Card tint="gold">
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: GOLD, marginBottom: 8 }}>מלכודת 1 — המתייג רואה את התשובה</div>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.8, color: MUTED, margin: 0 }}>
              אסור שהמודל שמתייג יידע אם השיחה נסגרה. אם הוא יודע, הוא יתייג לפי זה ונקבל 100% התאמה
              שלא אומרת כלום.
            </p>
          </Card>
          <Card tint="gold">
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: GOLD, marginBottom: 8 }}>מלכודת 2 — האורך מסגיר את התוצאה</div>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.8, color: MUTED, margin: 0 }}>
              שיחה שנתקעה היא קצרה, ושיחה שנסגרה ארוכה. אם נותנים למתייג את השיחה המלאה, הוא לומד
              לזהות אורך — לא מצב. לכן <strong style={{ color: INK }}>חותכים את כל השיחות לאותה נקודה</strong>,
              למשל חמש ההודעות הראשונות, ומתייגים רק מהן.
            </p>
          </Card>
          <P>
            זה גם מה שהופך את התוצאה לשימושית: אם המצב מזוהה מחמש ההודעות הראשונות,
            אפשר להגיב עליו בזמן אמת.
          </P>

          <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: INK, margin: '28px 0 12px' }}>ג׳ · שיפוט</div>
          <P>
            משווים אחוזי סגירה בין המתויגים ללא-מתויגים. שתי שאלות שצריך לענות עליהן כאן:
          </P>
          <Card>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: INK, marginBottom: 10 }}>כמה שיחות צריך?</div>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.8, color: MUTED, margin: '0 0 14px' }}>
              תלוי בגודל ההפרש שרוצים לזהות. בגדול:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['הפרש של 20 נקודות', '‏~100 שיחות בכל קבוצה'], ['הפרש של 10 נקודות', '‏~400 שיחות בכל קבוצה'], ['הפרש של 5 נקודות', 'אלפים — כנראה לא ריאלי כרגע']].map(([a, b]) => (
                <div key={a} style={{ display: 'flex', gap: 12, alignItems: 'baseline', background: '#FBFAFA', border: `1px solid ${BORDER}`, borderRadius: 9, padding: '10px 15px' }}>
                  <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: INK, minWidth: 145 }}>{a}</span>
                  <span style={{ fontFamily: SANS, fontSize: 15, color: MUTED }}>{b}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.7, color: FAINT, margin: '14px 0 0' }}>
              לכן שווה לחפש קודם הפרשים גדולים. מצב שמזיז 5 נקודות הוא כנראה לא מה שמחפשים בשלב הזה.
            </p>
          </Card>
          <Card tint="gold">
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: GOLD, marginBottom: 8 }}>מלכודת 3 — בדיקות מרובות</div>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.8, color: MUTED, margin: '0 0 12px' }}>
              אם בודקים 30 השערות, אחת-שתיים ייראו מצוין במקרה. זה מובטח סטטיסטית.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.8, color: INK, margin: 0 }}>
              הפתרון הכי פשוט: <strong>מחלקים את השיחות לשניים.</strong> מייצרים את ההשערות על החצי
              הראשון בלבד, ובודקים אותן על החצי השני. השערה ששרדה על דאטה שהיא לא נולדה ממנו — היא אמיתית.
            </p>
          </Card>
          <Card>
            <Flow>
              <Box title="חצי א׳" sub="ייצור השערות" tone="gold" />
              <Arrow />
              <Box title="חצי ב׳" sub="בדיקה בלבד" tone="plum" />
              <Arrow />
              <Box title="מה ששרד" sub="נכנס ל-Cookbook" tone="plain" />
            </Flow>
          </Card>
        </section>

        {/* 05 */}
        <section style={{ marginTop: 56 }}>
          <H n="06" sub="uplift · CATE">ההבדל הקריטי: מה מנבא מול מה גורם</H>
          <Card tint="gold">
            <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.85, color: INK, margin: 0 }}>
              אם מי ששואל על סיכויי אישור נסגר פחות — זה <strong>לא</strong> אומר שהשאלה מזיקה.
              יכול להיות שאלה פשוט אנשים עם פרופיל חלש יותר מלכתחילה. אם נשנה התנהגות על סמך זה בלבד,
              אפשר בקלות להזיק.
            </p>
          </Card>
          <P>
            השאלה שבאמת מעניינת היא אחרת: <strong style={{ color: INK }}>בשביל אדם מהסוג הזה — האם התנהגות א׳
            סוגרת יותר מהתנהגות ב׳?</strong> לזה קוראים uplift, וזה דורש שנריץ את שתיהן ונמדוד.
          </P>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
              <Box title="זוהה: חשש מסירוב" tone="plum" />
              <span style={{ color: FAINT, fontSize: 20 }}>↓</span>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', minWidth: 200 }}>
                  <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: INK, marginBottom: 12 }}>א׳ · שולחים תנאי סף</div>
                  <Bars rows={[{ label: 'נסגר', pct: 58, strong: true }]} />
                </div>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '16px 20px', minWidth: 200 }}>
                  <div style={{ fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: INK, marginBottom: 12 }}>ב׳ · שולחים טבלת מסלולים</div>
                  <Bars rows={[{ label: 'נסגר', pct: 24 }]} />
                </div>
              </div>
            </div>
          </Card>
          <P>
            רק אחרי מדידה כזאת אפשר לכתוב ב-Cookbook &ldquo;במצב הזה — עושים א׳&rdquo;. עד אז יש רק מתאם.
          </P>
        </section>

        {/* 06 */}
        <section style={{ marginTop: 56 }}>
          <H n="07">והתוצאה — יכול להיות שכבר יש לנו</H>
          <P>
            השאלה הראשונה היא מאיפה בכלל יודעים מי &ldquo;נסגר&rdquo;. אבל לכל שיחה שמור המסלול בין הקרוז —
            ומזה אפשר לגזור התקדמות בלי שום שינוי בקוד:
          </P>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: SANS, fontSize: 13, color: GREEN, fontWeight: 700, minWidth: 62 }}>התקדם</span>
                <Box title="פתיחה" tone="plain" /><Arrow />
                <Box title="בירור" tone="plain" /><Arrow />
                <Box title="התאמה" tone="plain" /><Arrow />
                <Box title="סגירה" tone="plum" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: 0.65 }}>
                <span style={{ fontFamily: SANS, fontSize: 13, color: RED, fontWeight: 700, minWidth: 62 }}>נתקע</span>
                <Box title="פתיחה" tone="plain" /><Arrow />
                <Box title="בירור" tone="plain" />
                <span style={{ fontFamily: SANS, fontSize: 14, color: RED }}>— ולא חזר</span>
              </div>
            </div>
          </Card>
          <P>
            זו לא סגירה מלאה, אלה <strong style={{ color: INK }}>מיני-סגירות</strong> — אבל יש מהן הרבה יותר,
            כי כל מעבר שלב הוא תווית בפני עצמה. בהחלט מספיק כדי להתחיל.
          </P>
        </section>

        {/* 07 */}
        <section style={{ marginTop: 56 }}>
          <H n="08">השבוע הראשון</H>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['שולפים את השיחות הקיימות', 'ואת המסלול בין הקרוז'],
                ['מסמנים מי התקדם ומי נתקע', 'מהמסלול, בלי קוד חדש'],
                ['נותנים ל-LLM לייצר השערות', 'מה שונה בין שתי הקבוצות'],
                ['בודקים כל השערה מול המספרים', 'מה נשאר, מה נזרק'],
              ].map(([t, s], i) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', background: PLUM, color: '#fff', fontFamily: MONO, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <div style={{ flex: 1, background: '#FBFAFA', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '11px 16px' }}>
                    <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: INK }}>{t}</span>
                    <span style={{ fontFamily: SANS, fontSize: 14.5, color: FAINT }}> — {s}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <P>
            אם יוצאות מזה שתיים-שלוש השערות עם הפרש אמיתי — יש כאן משהו, ואפשר להשקיע.
            ואם הכול יוצא שטוח — גם את זה גילינו בשבוע ולא בחצי שנה.
          </P>
        </section>

        <div style={{ marginTop: 60, paddingTop: 24, borderTop: `1px solid ${BORDER}` }}>
          <Link to="/lybi/knowledge" style={{ fontFamily: SANS, fontSize: 15, color: PLUM, textDecoration: 'none' }}>
            → חזרה למאגר הידע
          </Link>
        </div>
      </div>
    </div>
  );
}
