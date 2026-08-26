import { useEffect, useRef, useState } from 'react';
import { PageCommentsProvider, SectionComments, type CommentTokens } from '../components/common';

/**
 * זול סטוק — מלאי חכם: המסמך שהלקוח קורא. עברית, RTL, פשוט בכוונה.
 *
 * The customer-facing companion to the dev brief at /aspect/zolstock-purchasing
 * — but NOT a mirror of it, and deliberately not linked to it.
 *
 * This page exists so the client can SEE WHAT WE ARE GOING TO BUILD. It is not
 * a contract: no obligations list, no limitations schedule, no timeline. Those
 * all existed in the first draft and were cut for exactly that reason. The
 * engineering constraints live in the dev brief and the repo task file, where
 * they belong.
 *
 * Nothing here promises a mechanism we have not designed yet — the calculation
 * is described by what it answers, never by its formula. Every section ends
 * with a place for the client to leave דגשים, which is the actual point: this
 * is a conversation starter, not a sign-off document.
 */

const HE = "'Assistant', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap';
function ensureFonts() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const BG = 'var(--c-bg)';
const PANEL = 'var(--c-panel)';
const BORDER = 'var(--c-border)';
const TEXT = 'var(--c-text)';
const MUTED = 'var(--c-muted)';
const FAINT = 'var(--c-faint)';
const TEAL = 'var(--c-teal)';
const GREEN = 'var(--c-green)';
const AMBER = 'var(--c-amber)';
const BAD = 'var(--c-bad)';
const HAIRLINE = 'var(--c-hairline)';

const THEME_BG: Record<'dark' | 'light', string> = { dark: '#0B0E14', light: '#F5F7FA' };

const THEME_CSS = `
.zolClient{
  --c-bg:#0B0E14; --c-panel:#111721; --c-border:#2E3846;
  --c-text:#E4EAF1; --c-muted:#A2ADBB; --c-faint:#77828F;
  --c-teal:#5CD6DF; --c-green:#7EE787; --c-amber:#E9BC4C; --c-bad:#F2708A;
  --c-hairline:#1C2431; --c-navbg:rgba(11,14,20,0.92);
  --c-teal-bd:rgba(92,214,223,0.42);  --c-teal-bg:rgba(92,214,223,0.065);
  --c-green-bd:rgba(126,231,135,0.42);--c-green-bg:rgba(126,231,135,0.06);
  --c-amber-bd:rgba(233,188,76,0.42); --c-amber-bg:rgba(233,188,76,0.06);
  --c-bad-bd:rgba(242,112,138,0.42);  --c-bad-bg:rgba(242,112,138,0.06);
  --c-muted-bd:#3A4553; --c-muted-bg:#151C27;
  --c-rail-on:rgba(92,214,223,0.08);
  --c-note:#19212B; --c-note-bd:#33414F;
}
.zolClient[data-theme="light"]{
  --c-bg:#F5F7FA; --c-panel:#FFFFFF; --c-border:#CDD6E0;
  --c-text:#14202C; --c-muted:#4B5A6C; --c-faint:#6E7C8C;
  --c-teal:#0E7A83; --c-green:#15803D; --c-amber:#B45309; --c-bad:#BE123C;
  --c-hairline:#E5EAF0; --c-navbg:rgba(245,247,250,0.93);
  --c-teal-bd:rgba(14,122,131,0.26);  --c-teal-bg:rgba(14,122,131,0.045);
  --c-green-bd:rgba(21,128,61,0.26);  --c-green-bg:rgba(21,128,61,0.04);
  --c-amber-bd:rgba(180,83,9,0.26);   --c-amber-bg:rgba(180,83,9,0.038);
  --c-bad-bd:rgba(190,18,60,0.26);    --c-bad-bg:rgba(190,18,60,0.038);
  --c-muted-bd:#DDE4EB; --c-muted-bg:#FBFCFD;
  --c-rail-on:rgba(13,123,133,0.08);
  --c-note:#FFFFFF; --c-note-bd:#DCE4EC;
}
@media (max-width: 1000px){ .zolClientRail{ display:none !important; } }
`;

type Tone = 'teal' | 'green' | 'amber' | 'bad' | 'muted';
const TONES: Record<Tone, { fg: string; bd: string; bg: string }> = {
  teal:  { fg: TEAL,  bd: 'var(--c-teal-bd)',  bg: 'var(--c-teal-bg)' },
  green: { fg: GREEN, bd: 'var(--c-green-bd)', bg: 'var(--c-green-bg)' },
  amber: { fg: AMBER, bd: 'var(--c-amber-bd)', bg: 'var(--c-amber-bg)' },
  bad:   { fg: BAD,   bd: 'var(--c-bad-bd)',   bg: 'var(--c-bad-bg)' },
  muted: { fg: MUTED, bd: 'var(--c-muted-bd)', bg: 'var(--c-muted-bg)' },
};

const NAV_H = 53;
const strong = { color: TEXT, fontWeight: 700 } as const;

/** הערות ביקורת — שם + הערה, לכל פרק. אותו רכיב כמו בעמוד האנגלי, בעברית. */
const COMMENT_TOKENS: CommentTokens = {
  border: BORDER, text: TEXT, faint: FAINT,
  paper: 'var(--c-note)', paperBorder: 'var(--c-note-bd)', noteAccent: TEAL,
  font: HE, dir: 'rtl',
  strings: {
    one: 'הערה אחת',
    many: '{n} הערות',
    hide: 'סגירת ההערות',
    add: 'הוספת דגש או הערה',
    name: 'השם שלך',
    placeholder: 'דגשים, הערות או בקשות לגבי החלק הזה',
    send: 'שליחה',
    sending: 'שולח…',
    cancel: 'ביטול',
    remove: 'מחיקה',
    removeTitle: 'מחיקת הערה',
    removeConfirm: 'ההערה תימחק לכולם. אי אפשר לשחזר.',
    failed: 'השמירה נכשלה. נסו שוב.',
    loading: 'טוען…',
  },
};

function Head({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <>
      <div style={{
        position: 'sticky', top: NAV_H, zIndex: 20, background: BG,
        borderBottom: `1px solid ${BORDER}`, padding: '14px 0 12px',
        marginBottom: sub ? 12 : 22, display: 'flex', alignItems: 'center', gap: 13,
      }}>
        <span style={{
          flexShrink: 0, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TEAL,
          background: TONES.teal.bg, border: `1px solid ${TONES.teal.bd}`, borderRadius: 8,
          padding: '5px 10px', lineHeight: 1.1,
        }}>{n}</span>
        <h2 style={{ fontFamily: HE, fontSize: 23, fontWeight: 800, color: TEXT, margin: 0, lineHeight: 1.35, minWidth: 0 }}>{title}</h2>
      </div>
      {sub && <div style={{ fontFamily: HE, fontSize: 15.5, lineHeight: 1.85, color: FAINT, marginBottom: 22, maxWidth: 760 }}>{sub}</div>}
    </>
  );
}

function Box({ children, tone = 'muted', label }: { children: React.ReactNode; tone?: Tone; label?: string }) {
  const t = TONES[tone];
  return (
    <div style={{ border: `1px solid ${t.bd}`, background: t.bg, borderRadius: 14, padding: '16px 18px', margin: '0 0 18px' }}>
      {label && (
        <div style={{ fontFamily: HE, fontSize: 13, fontWeight: 800, color: t.fg, marginBottom: 9 }}>{label}</div>
      )}
      <div style={{ fontFamily: HE, fontSize: 15.5, lineHeight: 1.9, color: MUTED }}>{children}</div>
    </div>
  );
}

/** כרטיס ממוספר — לרשימות של שלבים או יכולות. */
function Card({ n, title, tone = 'teal', children }: { n: string; title: string; tone?: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div style={{
      border: `1px solid ${BORDER}`, background: PANEL, borderRadius: 14,
      padding: '16px 18px', margin: '0 0 12px', display: 'flex', gap: 14, alignItems: 'flex-start',
    }}>
      <span style={{
        flexShrink: 0, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: t.fg,
        background: t.bg, border: `1px solid ${t.bd}`, borderRadius: 9, padding: '5px 10px', lineHeight: 1.2,
      }}>{n}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: HE, fontSize: 17, fontWeight: 800, color: TEXT, marginBottom: 6 }}>{title}</div>
        <div style={{ fontFamily: HE, fontSize: 15.5, lineHeight: 1.9, color: MUTED }}>{children}</div>
      </div>
    </div>
  );
}

const INTRO = { id: 'top', n: '00', label: 'הרעיון' };
const SECTIONS: { id: string; n: string; label: string }[] = [
  { id: 'goal',    n: '01', label: 'המטרה' },
  { id: 'how',     n: '02', label: 'איך זה עובד' },
  { id: 'see',     n: '03', label: 'איפה תראו את זה' },
];

function SideRail({ active }: { active: string }) {
  return (
    <nav aria-label="פרקים" style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {SECTIONS.map(s => {
        const on = s.id === active;
        return (
          <a key={s.id} href={`#${s.id}`} style={{
            display: 'flex', alignItems: 'baseline', gap: 9, textDecoration: 'none',
            padding: '7px 10px', borderRadius: 7,
            borderInlineStart: `2px solid ${on ? TEAL : 'transparent'}`,
            background: on ? 'var(--c-rail-on)' : 'transparent',
            transition: 'color .2s, background .2s, border-color .2s',
          }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: on ? TEAL : FAINT }}>{s.n}</span>
            <span style={{ fontFamily: HE, fontSize: 14, fontWeight: on ? 700 : 400, color: on ? TEXT : FAINT }}>{s.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

type Theme = 'dark' | 'light';
const THEME_KEY = 'zolstock-client-theme';

export function ZolstockPurchasingClientPage() {
  const [active, setActive] = useState(INTRO.id);
  const [progress, setProgress] = useState(0);
  const [theme, setTheme] = useState<Theme>(() => {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureFonts();
    document.title = 'זול סטוק · מלאי חכם — מה אנחנו בונים';
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    const prev = document.body.style.background;
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.background = prev;
    };
  }, []);

  useEffect(() => {
    document.body.style.background = THEME_BG[theme];
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* מצב פרטי */ }
  }, [theme]);

  useEffect(() => {
    let frame = 0;
    const pick = () => {
      frame = 0;
      const line = 140;
      let current = INTRO.id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(a => (a === current ? a : current));
      const sc = scrollerRef.current;
      const box = sc && sc.scrollHeight > sc.clientHeight ? sc : document.documentElement;
      const max = box.scrollHeight - box.clientHeight;
      const pct = max > 0 ? Math.min(100, Math.max(0, (box.scrollTop / max) * 100)) : 0;
      setProgress(p => (Math.abs(p - pct) < 0.5 ? p : pct));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(pick); };
    pick();
    const scroller = scrollerRef.current;
    scroller?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const here = SECTIONS.find(s => s.id === active) ?? INTRO;

  return (
    <PageCommentsProvider pageKey="zolstock-purchasing-he" t={COMMENT_TOKENS}>
    <div ref={scrollerRef} className="zolClient" data-theme={theme} dir="rtl"
      style={{ fontFamily: HE, background: BG, color: TEXT, minHeight: '100vh', overflow: 'auto' }}>
      <style>{THEME_CSS}</style>

      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--c-navbg)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ fontFamily: HE, fontSize: 15, fontWeight: 800, color: TEXT, flexShrink: 0 }}>
            זול סטוק <span style={{ color: FAINT, fontWeight: 400 }}>· מלאי חכם</span>
          </span>
          <span style={{ color: FAINT, fontFamily: MONO, fontSize: 13, flexShrink: 0 }}>/</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: TEAL, flexShrink: 0 }}>{here.n}</span>
            <span style={{ fontFamily: HE, fontSize: 15, color: TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{here.label}</span>
          </span>
          <span style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* No link to the English dev brief — this page goes to the client,
                and the engineering document is not theirs to read. */}
            <button onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
              style={{ fontFamily: MONO, fontSize: 11, color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', lineHeight: 1.6 }}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </span>
        </div>
        <div style={{ height: 2, background: HAIRLINE }}>
          <div style={{ height: '100%', width: `${progress}%`, background: TEAL, transition: 'width .12s linear' }} />
        </div>
      </nav>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '52px 24px 110px', display: 'flex', gap: 40 }}>
        <div className="zolClientRail" style={{ width: 168, flexShrink: 0 }}><SideRail active={active} /></div>

        <div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: 880 }}>

          {/* ─────────────── פתיח ─────────────── */}
          <div id="top" style={{ scrollMarginTop: 70 }}>
            <div style={{ fontFamily: HE, fontSize: 13.5, fontWeight: 700, letterSpacing: '0.06em', color: TEAL, marginBottom: 14 }}>
              Aspect Intelligence · מרכז הבינה של זול סטוק
            </div>
            <h1 style={{ fontFamily: HE, fontSize: 38, fontWeight: 800, lineHeight: 1.25, color: TEXT, margin: '0 0 20px' }}>
              מלאי חכם — מה להזמין, כמה, ומתי
            </h1>
            <p style={{ fontFamily: HE, fontSize: 19, lineHeight: 1.9, color: MUTED, margin: '0 0 16px', maxWidth: 790 }}>
              המטרה, כפי שהוגדרה: לתת תשובה לשלוש שאלות פשוטות בכל שרשרת המלאי — מה, כמה, ומתי.
              המעבר הוא <strong style={strong}>ממערכת שמציגה נתונים בדיעבד למערכת שמקדימה את הצורך</strong>.
              <br />
              המערכת נבנית <strong style={strong}>מעל נתוני ה־BI</strong>, ולכן{' '}
              <strong style={strong}>אישור נתוני ה־BI הוא תנאי מקדים</strong> — כל מה שנבנה מסתמך עליהם.
            </p>
            <p style={{ fontFamily: HE, fontSize: 19, lineHeight: 1.9, color: MUTED, margin: '0 0 16px', maxWidth: 790 }}>
              המסמך כתוב כדי שתראו <strong style={strong}>מה אנחנו הולכים לבנות</strong> — ותוכלו להגיב.
              בסוף כל חלק אפשר להשאיר דגש או הערה, וזה ייכנס לעבודה.
            </p>

            <Box tone="amber" label="הנתון החסר כדי להשלים את החיבור">
              <strong style={strong}>זמן האספקה של כל ספק — מרגע ההזמנה ועד שהסחורה אצלנו.</strong> זה מה שהופך
              את ״מה צריך״ ל״מתי להזמין״. אין בנתונים רישום של קבלת סחורה, ולכן אי אפשר למדוד את זה מהנתונים —
              הוא יוגדר פעם אחת לכל ספק, במסך ספקים ייעודי.
            </Box>
          </div>

          {/* ─────────────── 01 ─────────────── */}
          <section id="goal" style={{ scrollMarginTop: 70 }}>
            <Head n="01" title="המטרה — שלוש שאלות בכל שרשרת המלאי"
              sub="אותן שלוש שאלות, בשלוש נקודות בשרשרת. מנוע אחד עונה על כולן, ונפתח אותן בהדרגה." />

            <Card n="1" title="רכש — מה להזמין, כמה להזמין ומתי להזמין" tone="green">
              <strong style={strong}>זה מה שנבנה עכשיו.</strong> לכל ספק שמופיע בנתונים: קצב המכירה בפועל, מה
              יש במלאי ומה כבר בדרך, ומזה — מה להזמין, כמה, ובאיזה תאריך להוציא את ההזמנה.
            </Card>
            <Card n="2" title="מחסן — מה אני מקבל, כמה ומתי; מה אני מנפיק, כמה ומתי" tone="muted">
              אותו מנוע, מנקודת המבט של המחסן. בשלב הבא.
            </Card>
            <Card n="3" title="סניפים — מה אני צריך, כמה אני צריך ומתי אני צריך" tone="muted">
              אותו מנוע ברמת הסניף. בשלב שאחרי.
            </Card>

            <Box tone="muted" label="להתחיל בקטן, לבנות לגדול">
              המערכת נבנית מלכתחילה <strong style={strong}>לכל הספקים שבנתונים</strong> — אין עבודה נוספת
              בהוספת ספק. את העבודה השוטפת אפשר להתחיל <strong style={strong}>עם ספק אחד</strong>, ללמוד את
              התהליך ולוודא שהמספרים נכונים, ומשם להרחיב בקצב שלכם.
            </Box>
          
            <SectionComments sectionId="goal" />

          </section>

          {/* ─────────────── 02 ─────────────── */}
          <section id="how" style={{ scrollMarginTop: 70 }}>
            <Head n="02" title="איך זה עובד"
              sub="שלושה חלקים. אחד מתעדכן אוטומטית מהנתונים, אחד אתם מגדירים פעם אחת, והשלישי מחשב בכל פעם שנשאלת שאלה." />

            <Box tone="muted" label="על מה זה נשען">
              המנוע החישובי הקיים כבר יודע לתת את <strong style={strong}>הצורך — בכמות ובמועד</strong>. מה
              שמתווסף כאן הוא <strong style={strong}>זמן האספקה</strong>, וזה מה שמזיז את התשובה מ״מתי אצטרך״
              ל<strong style={strong}>״מתי להוציא את ההזמנה״</strong>.
            </Box>

            <Card n="א" title="רשימת הספקים נבנית מהנתונים">
              בכל טעינת נתונים המערכת מייצרת בעצמה את רשימת הספקים — כמה פריטים לכל ספק, כמה מהם נמכרו בשנה
              האחרונה, וכמה מלאי מהספק הזה יושב במחסן. <strong style={strong}>לא צריך להזין ספקים ידנית</strong>,
              וספק חדש מופיע מעצמו.
            </Card>

            <Card n="ב" title="אתם מגדירים זמן אספקה לכל ספק" tone="amber">
              במסך הספקים תראו את כל הספקים עם זמן אספקה של <strong style={strong}>90 יום כברירת מחדל</strong>,
              ותוכלו לשנות לכל ספק את הזמן האמיתי שלו. אפשר גם לשנות את ברירת המחדל עצמה.
              <br />
              כל עוד לא הגדרתם ספק מסוים, המערכת תיתן תשובה לפי ברירת המחדל — <strong style={strong}>ותגיד לכם
              במפורש</strong> שזה מה שהיא עשתה, כדי שלא תתבלבלו בין מספר שהגדרתם לבין השערה.
            </Card>

            <Card n="ג" title="המערכת מחשבת את ההמלצה">
              בכל שאלה, המערכת לוקחת לכל פריט את קצב המכירה בפועל, את המלאי הקיים, את מה שכבר בהזמנה, ואת זמן
              האספקה של הספק — ומחשבת <strong style={strong}>מתי המלאי ייגמר</strong>, ומזה{' '}
              <strong style={strong}>מתי חייבים להזמין</strong> ו<strong style={strong}>כמה</strong>.
            </Card>

            <Box tone="teal" label="דגשים שלכם">
              דרך החישוב עצמה תיבנה יחד אתכם. אם יש שיקולים שחשוב שייכנסו — עונתיות, פריטים שמתנהגים אחרת,
              ספקים עם כללים משלהם — זה המקום להוסיף אותם.
            </Box>
          
            <SectionComments sectionId="how" />

          </section>

          {/* ─────────────── 03 ─────────────── */}
          <section id="see" style={{ scrollMarginTop: 70 }}>
            <Head n="03" title="איפה תראו את זה"
              sub="שלוש דרכים לאותה תשובה, לפי איך שנוח לעבוד. המספרים זהים בכולן — כולן קוראות מאותו מקום." />

            <Card n="1" title="מסך ייעודי — ״מה להזמין״" tone="teal">
              <strong style={strong}>לא צריך לדעת מה לשאול.</strong> המסך מציג מעצמו את מה שחורג — מה שכבר
              באיחור ומה שחורג בקרוב — ממוין לפי דחיפות. אפשר לסנן לפי ספק או קטגוריה, לפתוח שורה ולראות את
              החישוב, ולייצא לאקסל.
              <br />
              לצידו <strong style={strong}>מסך הספקים</strong>, שבו מגדירים את זמני האספקה.
            </Card>

            <Card n="2" title="שאלה חופשית בצ׳אט" tone="teal">
              אפשר פשוט לשאול — <span style={{ color: TEXT }}>״מה צריך להזמין מספק X?״</span>,{' '}
              <span style={{ color: TEXT }}>״אילו פריטים ייגמרו בחודש הקרוב?״</span> — בעברית או באנגלית, והתשובה
              חוזרת באותה שפה. אם לספק שנשאלתם עליו עוד לא הוגדר זמן אספקה, המערכת תענה לפי ברירת המחדל ותציין
              את זה, עם הפניה למסך ההגדרה.
            </Card>

            <Card n="3" title="דוח" tone="teal">
              דוח מסודר שאפשר לשמור ולשתף — כותרת עם המספרים, פירוט הפריטים הדחופים, וההסבר איך הגענו לזה.
              זה אותו מנגנון דוחות שכבר קיים במרכז הבינה.
            </Card>

            <Box tone="amber" label="התראות יזומות — בשלב הבא">
              אחרי שהמסך והסוכן יאושרו ונראה שהמספרים נכונים, נוסיף <strong style={strong}>דחיפה יזומה</strong> —
              התראות והמלצות שמגיעות אליכם בלי להיכנס למערכת. הסדר הזה מכוון: קודם מוודאים שמה שהמערכת אומרת
              נכון, ורק אז נותנים לה לפנות אליכם מעצמה.
            </Box>

            <Box tone="teal" label="דגשים שלכם">
              מה הייתם רוצים לראות במסך? אילו שדות, אילו סינונים, ואיך נוח לכם לעבוד — כתבו כאן ונבנה לפי זה.
            </Box>
          
            <SectionComments sectionId="see" />

            <div style={{ marginTop: 40, paddingTop: 22, borderTop: `1px solid ${BORDER}`, fontFamily: HE, fontSize: 14.5, color: FAINT, lineHeight: 2 }}>
              <div>Aspect Intelligence · זול סטוק · מסמך אפיון ללקוח</div>
            </div>

          </section>


        </div>
      </div>
    </div>
    </PageCommentsProvider>
  );
}
