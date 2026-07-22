import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import s from './TeamPlanPage.module.css';

// Loads a Hebrew webfont (Assistant) once, mirroring the intelligence/fonts.ts
// pattern — keeps the page's Hebrew typography crisp without touching global CSS.
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap';
function ensureFonts() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}

const MODE_KEY = 'aspect_team_plan_mode';
const LANG_KEY = 'aspect_team_plan_lang';

type Lang = 'he' | 'en';

interface Role {
  initial: string; name: string; title: string; color: string;
  cost: string; per: string; note: string; goal: string; gold?: boolean;
}
interface Simple { title: string; text: string; icon?: string; }
interface Month { idx: string; title: string; desc: string; }
interface AlignRow { goal: string; deliver: string; }
interface OrgGroup { label: string; gold?: boolean; members: { name: string; what: string }[]; }
interface LegendItem { name: string; amount: string; seg: string; }

interface Strings {
  docTitle: string; brandSub: string; chip: string;
  heroEyebrow: string; h1a: string; h1accent: string; heroLead: ReactNode;
  stat1Label: string; stat2Label: string; stat3Num: string; stat3Label: string;
  sitEyebrow: string; sitH2: string; sitLead: string; sitBody: ReactNode;
  calloutT: string; calloutBody: ReactNode; researchH3: string; researchP: ReactNode;
  prodEyebrow: string; prodH2: string; prodLead: string; pillars: Simple[];
  orgEyebrow: string; orgH2: string; orgLead: string; orgLeadRole: string; orgLeadSub: string; orgGroups: OrgGroup[];
  mgEyebrow: string; mgH2: string; manage: Simple[];
  teamEyebrow: string; teamH2: string; teamLead: string; roles: Role[];
  methodEyebrow: string; methodH2: string; methodLead: string;
  card1H3: string; card1P: ReactNode; card1Tag: string; card2H3: string; card2P: ReactNode; card2Tag: string;
  burnEyebrow: string; burnH2: string; burnPer: string; legend: LegendItem[]; burnNote: ReactNode; burnTag: string;
  flexEyebrow: string; flexH2: string; flexLead: string;
  flexGreenH3: string; flexGreenTiny: string; flexGreenP: string;
  flexGoldH3: string; flexGoldTiny: string; flexGoldP: string; flexBottom: ReactNode;
  planEyebrow: string; planH2: string; planNote: string; startNow: string;
  q1Tag: string; q1Txt: string; months: Month[];
  q2Tag: string; q2Title: string; q2P: string; q3Tag: string; q3Title: string; q3P: string;
  alignEyebrow: string; alignH2: string; miniGoal: string; miniDeliver: string; arrow: string; align: AlignRow[];
  closeEyebrow: string; closeH2: string; closeP: string; signName: string;
  footer1: string; footer2: string;
}

const CSHLOMI = 'var(--seg-shlomi)', CKOSTA = 'var(--seg-kosta)', CVOVA = 'var(--seg-vova)', COFIR = 'var(--seg-ofir)';

const STR: Record<Lang, Strings> = {
  he: {
    docTitle: 'Aspect — תוכנית צוות ותקציב',
    brandSub: 'בינה עסקית לעסקים קטנים',
    chip: 'מסמך פנימי · לדיון',
    heroEyebrow: 'תוכנית צוות ותקציב · Q1–Q3',
    h1a: 'צוות קטן ומנוהל —',
    h1accent: 'לתפעול, מוצר ומחקר במקביל',
    heroLead: <>היום כל הפעילות נשענת על אדם אחד. כדי לתת שירות אמין להרבה לקוחות, לבנות את מוצר ה-AI הבא, וגם להריץ מחקר — צריך עוד ידיים, שאני מנהל. המסמך מסביר <strong>מי, למה, כמה, ולפי איזו תוכנית</strong>. כל שקל מחובר ליעד של המשקיעים.</>,
    stat1Label: 'קצב שריפה חודשי — כוח אדם',
    stat2Label: 'אנשים — צוות רזה, מנוהל על ידי שלומי',
    stat3Num: 'רוב ההוצאה גמישה',
    stat3Label: 'אפשר להגדיל או לעצור לפי העומס',
    sitEyebrow: 'נקודת הפתיחה',
    sitH2: 'המצב היום: הכל על אדם אחד',
    sitLead: 'טעינת נתונים, מוצר, תשתית ותמיכה — הכל יושב כרגע על שלומי בלבד. זו נקודת כשל יחידה, וזו גם התקרה של כמה אפשר לגדול.',
    sitBody: <>אם רוצים לצרף עשרות לקוחות, לבנות מוצר חדש, <strong>וגם להריץ מחקר</strong> — במקביל — יד אחת פשוט לא מספיקה. לא כדי להחליף אותי, אלא כדי שאני <strong>אנהל</strong> צוות שמבצע, כך שנרוץ מהר ובבטחה בו-זמנית.</>,
    calloutT: 'כל הפעילות — על אדם אחד',
    calloutBody: <>טעינת נתונים · מוצר · תשתית · תמיכה — <strong>הכל תלוי באדם יחיד.</strong> כל עוד זה כך, כל צירוף לקוח חדש וכל פיתוח מתחרים על אותן שעות.</>,
    researchH3: 'ומחקר הוא סיפור בפני עצמו',
    researchP: <>מחקר הוא <strong>ניסוי וטעייה</strong>: חלק גדול מהניסיונות לא יעבדו — וזה בסדר, ככה בדיוק מגיעים לתובנות שמייצרות ערך. בגלל זה הוא דורש מישהו שמוקדש לו <strong>במאה אחוז</strong>, לא ״בין לבין״ בין משימות פיתוח. זה בדיוק התפקיד של הדאטה סיינס.</>,
    prodEyebrow: 'המוצר',
    prodH2: 'הדור הבא של הבינה העסקית — לא עוד דשבורד',
    prodLead: 'אנחנו בונים את הדור הבא של פתרונות ה-BI והאייג׳נטים לעולם הבינה העסקית: במקום דשבורד שמישהו הגדיר פעם אחת, מוצר שחוקר את הנתונים בעצמו ומחזיר תשובות ותובנות אמיתיות — מבוסס על המחקר והמודלים שלנו. זה הלב של מה שאנחנו מוכרים.',
    pillars: [
      { icon: '❓', title: 'כל שאלה עסקית, בשפה חופשית', text: 'לא מוגבלים למה שמישהו הגדיר מראש — שואלים כל דבר, ומקבלים תשובה אמיתית מהנתונים.' },
      { icon: '✦', title: 'חוקר לבד, מחזיר תובנות', text: 'תשובה מהירה — מייד; משהו שדורש מחקר — רץ ברקע ומחזיר כשמוכן, כמו לתת משימה לאנליסט.' },
      { icon: '🔬', title: 'מבוסס על המחקר שלנו', text: 'המודלים והמחקר של הצוות הם הליבה — זה מה שמפריד אותנו מדשבורד רגיל, ואי אפשר להעתיק.' },
    ],
    orgEyebrow: 'מבנה הצוות',
    orgH2: 'כל הפן הטכנולוגי — תחת אחריות אחת',
    orgLead: 'שלומי אחראי על כל הצד הטכנולוגי: ניהול הפיתוח והמחקר, כולל hands-on לפי הצורך. הצוות מחולק לשתי דיסציפלינות — פיתוח ודאטה סיינס. קטן, חד ומנוסה: ה-A-Team של Aspect.',
    orgLeadRole: 'שלומי · CTO',
    orgLeadSub: 'מוביל, מנהל, ואחראי מקצועית',
    orgGroups: [
      { label: 'פיתוח', members: [{ name: 'Kosta', what: 'טעינת נתונים וערוצים' }, { name: 'Vova', what: 'מוצר ה-AI הבא' }] },
      { label: 'דאטה סיינס', gold: true, members: [{ name: 'אופיר', what: 'מחקר ומודלים' }] },
    ],
    mgEyebrow: 'ניהול שוטף',
    mgH2: 'איך מנהלים את הצוות',
    manage: [
      { icon: '📅', title: 'פגישות יומיות', text: 'סנכרון יומי עם הצוות — מה נעשה, מה תקוע, ומה הבא.' },
      { icon: '🗂️', title: 'מערכת ניהול משימות', text: 'המטלות מנוהלות במערכת ניהול טאסקים מובנית — שכבר פיתחנו בתוך המוצר עצמו.' },
      { icon: '🔄', title: 'סנכרון שבועי', text: 'פגישת סנכרון שבועית עם איציק והמשקיעים — שקיפות מלאה על ההתקדמות.' },
    ],
    teamEyebrow: 'הצוות והעלות',
    teamH2: 'מי עושה מה — וכמה זה עולה',
    teamLead: 'כל תפקיד פותח יכולת אחת שחסרה לנו היום כדי לגדול.',
    roles: [
      { initial: 'ש', name: 'שלומי', title: 'CTO as a Service · הובלה', color: CSHLOMI, cost: '35,000', per: '/ חודש · לפני עלויות מודלים וענן', note: 'מוביל את הצוות, הארכיטקטורה וכיוון המוצר, ונשאר האחריות המקצועית הכוללת של הפעילות.', goal: 'יעד: כל התמונה' },
      { initial: 'K', name: 'Kosta', title: 'פיתוח · טעינת נתונים וערוצים', color: CKOSTA, cost: '≈ 20,000', per: '/ חודש', note: 'הופך את טעינת הנתונים לאוטומטית, אמינה ועמידה — כדי שנוכל לצרף עוד ועוד לקוחות בלי שהכל יישבר.', goal: 'יעד: צירוף לקוחות בקנה מידה' },
      { initial: 'V', name: 'Vova', title: 'פיתוח · מוצר ה-AI הבא', color: CVOVA, cost: '≈ 20,000', per: '/ חודש', note: 'בונה את המנוע של המוצר החדש: משימות שרצות אוטומטית ע״י מודלים — הכנה, שאילתות ואפילו סקריפטים.', goal: 'יעד: המוצר מהדור הבא' },
      { initial: 'א', name: 'אופיר', title: 'דאטה סיינס · מחקר ומודלים', color: COFIR, cost: '20,000', per: '/ חודש · תמורה נמוכה במיוחד', note: 'מוקדשת במאה אחוז למחקר: מריצה מודלים שמוצאים את התובנות עצמן, ומכינה סקריפטים למוצר ה-BI.', goal: 'יעד: התובנות שמוכרות', gold: true },
    ],
    methodEyebrow: 'שיטת העבודה',
    methodH2: 'צוות קטן שבונה גדול ומהר — עם Claude Code',
    methodLead: 'מנצלים את Claude Code ואת ה-AI כדי שצוות קטן יספק כמו צוות גדול: לבנות דברים גדולים, ומהר.',
    card1H3: 'כולם עובדים עם Claude Code',
    card1P: <>כל אנשי הצוות עובדים עם <strong>Claude Code</strong> — מנוי חודשי של כ-<strong>$100 לאדם</strong>, שנותן לצרכים שלנו שימוש כמעט אינסופי בטוקנים. עלות זניחה מול המשכורות, שמכפילה את מה שכל אחד מספיק לעשות. בהמשך נבחן מנוי אחר לפי הצורך.</>,
    card1Tag: '~$100 לאדם / חודש · תפוקה × כמה מונים',
    card2H3: 'אין תפקיד QA נפרד',
    card2P: <>עם Claude Code עבודת המפתח הופכת <strong>ניהולית</strong>: לוודא שמה שמוסרים ל-Claude מבוצע נכון — גם ברמת הקוד וגם ברמת המוצר. הבקרה הזו מוטמעת בתוך העבודה עצמה, ולכן אין צורך בשלב או בתפקיד QA נפרד.</>,
    card2Tag: 'בקרה מוטמעת — לא עוד משרה',
    burnEyebrow: 'קצב השריפה',
    burnH2: 'כמה זה עולה בחודש',
    burnPer: 'לחודש · כוח אדם בלבד',
    legend: [
      { name: 'שלומי', amount: '35,000 ₪', seg: CSHLOMI },
      { name: 'Kosta', amount: '≈ 20,000 ₪', seg: CKOSTA },
      { name: 'Vova', amount: '≈ 20,000 ₪', seg: CVOVA },
      { name: 'אופיר', amount: '20,000 ₪', seg: COFIR },
    ],
    burnNote: <><strong>עלויות התשתית (מודלים + ענן) הן בנפרד</strong> — לפי צריכה בפועל ובשקיפות מלאה. היום הן ״מוסתרות״ בתוך התשלום החודשי שלי; בתוכנית הזו הן גלויות וברורות, כך שרואים בדיוק לאן הולך כל שקל. (מנויי Claude Code — כ-$100 לאדם — זניחים ונכללים בתשתית.)</>,
    burnTag: 'זה קצב שריפה חודשי — לא התחייבות שנתית. הצוות גדל או מתכווץ לפי הקצב שנכתיב.',
    flexEyebrow: 'שליטה בהוצאה',
    flexH2: 'רוב הכסף גמיש — לא נעול',
    flexLead: 'מבנה שמאפשר להאיץ כשצריך, ולהאט בלי כאב אם צריך.',
    flexGreenH3: 'גמיש',
    flexGreenTiny: 'ניתן לעצור מיידית — ללא הודעה מוקדמת',
    flexGreenP: 'פרילנסרים שאני עובד איתם שנים — אמינים לחלוטין. אפשר להאיץ, להאט או לעצור בכל רגע, בלי הודעה מוקדמת ובלי פיצויים. ההוצאה נצמדת בדיוק לעומס בפועל. התשלום יכול לעבור דרכי או ישירות אליהם — והם מתחילים גם בלי מקדמה, אמון מלא בינינו.',
    flexGoldH3: 'מחויבות',
    flexGoldTiny: 'עובדת — הודעה מוקדמת רגילה',
    flexGoldP: 'עובדת שכירה (מהמשרד / היברידי). ההתחייבות היחידה בתוכנית — ותמורה יוצאת דופן: מוסמכת/דוקטורנטית בדאטה סיינס שרוצה דריסת רגל בשוק, בעלות נמוכה במיוחד.',
    flexBottom: <><span className={s.g}>מינוף גבוה</span> · <span className={s.y}>נעילה נמוכה</span></>,
    planEyebrow: 'התוכנית',
    planH2: 'רבעון ראשון מפורט — שניים הבאים בקווים כלליים',
    planNote: 'זו תוכנית עבודה — כיוון וקצב לעבוד לפיהם, שממשיכים לעדכן תוך כדי.',
    startNow: 'כל האנשים זמינים — מתחילים מייד.',
    q1Tag: 'רבעון 1',
    q1Txt: 'לבנות בסיס יציב — ולהוכיח שהמכונה עובדת',
    months: [
      { idx: 'חודש 01', title: 'תשתית טעינה + הרחבה אוטומטית', desc: 'להפוך את צירוף הלקוחות לאמין וניתן לחזרה, ולהניח את תשתית ה-DevOps שתאפשר הרחבה אוטומטית של לקוחות. Kosta נכנס לעניינים והלקוחות הקיימים יציבים.' },
      { idx: 'חודש 02', title: 'יסודות המוצר + תחילת מחקר', desc: 'Vova בונה את מנוע התובנות הגנרטיבי. אופיר מתחילה להריץ מודלים ראשונים על דאטה אמיתי.' },
      { idx: 'חודש 03', title: 'תובנות אוטומטיות ראשונות בשטח', desc: 'לקוחות פיילוט מקבלים תובנות שנוצרות אוטומטית. מצרפים מכה של לקוחות חדשים מקצה לקצה — להוכיח שהמכונה עובדת.' },
    ],
    q2Tag: 'רבעון 2', q2Title: 'קנה מידה',
    q2P: 'צירוף אוטומטי של הרבה יותר לקוחות; המוצר מתרחב לעוד סוגי דאטה; ספריית התובנות גדלה ומשתכללת.',
    q3Tag: 'רבעון 3', q3Title: 'המוח המשותף',
    q3P: 'בינה חוצת-לקוחות: השוואות (benchmarks) על פני כל ה-Long Tail, שירות עצמי, ואריזה מסחרית למכירה.',
    alignEyebrow: 'התאמה ליעד',
    alignH2: 'מה הצוות מספק — מול היעדים של המשקיעים',
    miniGoal: 'יעד המשקיעים',
    miniDeliver: 'מה הצוות מספק',
    arrow: '←',
    align: [
      { goal: 'מוח משותף מהרבה עסקים קטנים', deliver: 'מנוע ה-AI של Vova + המודלים של אופיר' },
      { goal: 'לצרף הרבה לקוחות בלי שהכל יישבר', deliver: 'תהליך הטעינה האמין של Kosta' },
      { goal: 'תובנות אמיתיות שמוכרות', deliver: 'המחקר והדאטה סיינס של אופיר' },
      { goal: 'מוצר מהדור הבא לעולם הבינה העסקית', deliver: 'הובלת המוצר של שלומי, על בסיס המחקר של הצוות' },
    ],
    closeEyebrow: 'הבקשה',
    closeH2: 'לאשר את תוכנית הצוות והתקציב החודשי',
    closeP: 'כדי לעבור מ״אדם אחד שמחזיק את הכל״ לצוות מנוהל שמריץ תפעול, מוצר ומחקר במקביל. זה מה שצריך כדי לממש את מה שהמשקיעים קנו: מוח משותף שמשרת את ה-Long Tail — באמינות, ובקצב. כל האנשים זמינים להתחלה מיידית — אפשר לצאת לדרך עכשיו.',
    signName: 'שלומי',
    footer1: 'Aspect · בינה עסקית לעסקים קטנים',
    footer2: 'מסמך פנימי — לדיון בלבד',
  },
  en: {
    docTitle: 'Aspect — Team & Budget Plan',
    brandSub: 'business intelligence for small businesses',
    chip: 'Internal · for discussion',
    heroEyebrow: 'Team & budget plan · Q1–Q3',
    h1a: 'A small, managed team —',
    h1accent: 'for operations, product & research in parallel',
    heroLead: <>Today the entire operation rests on one person. To reliably serve many customers, build the next-gen AI product, and run research too — we need more hands, that I manage. This document explains <strong>who, why, how much, and on what plan</strong>. Every shekel is tied to the investors&rsquo; goal.</>,
    stat1Label: 'Monthly burn — people',
    stat2Label: 'people — a lean team, managed by Shlomi',
    stat3Num: 'Most spend is flexible',
    stat3Label: 'scale up or stop by workload',
    sitEyebrow: 'Starting point',
    sitH2: 'Today: everything on one person',
    sitLead: 'Data loading, product, infrastructure and support — all of it currently sits on Shlomi alone. That is a single point of failure, and the ceiling on how much we can grow.',
    sitBody: <>To onboard dozens of customers, build a new product, <strong>and run research too</strong> — in parallel — one pair of hands simply isn&rsquo;t enough. Not to replace me, but so that I <strong>manage</strong> a team that executes, so we move fast and safely at the same time.</>,
    calloutT: 'The whole operation — on one person',
    calloutBody: <>Data · product · infrastructure · support — <strong>all of it depends on a single person.</strong> As long as that is true, every new customer and every feature compete for the same hours.</>,
    researchH3: 'And research is its own story',
    researchP: <>Research is <strong>trial and error</strong>: many attempts won&rsquo;t work — and that&rsquo;s fine, that&rsquo;s exactly how you reach insights that create value. That&rsquo;s why it needs someone dedicated to it <strong>100%</strong>, not &ldquo;in between&rdquo; development tasks. That is exactly the data-science role.</>,
    prodEyebrow: 'The product',
    prodH2: 'The next generation of business intelligence — not another dashboard',
    prodLead: 'We are building the next generation of BI and agent solutions for the business-intelligence world: instead of a dashboard someone configured once, a product that investigates the data on its own and returns real answers and insights — powered by our own research and models. This is the heart of what we sell.',
    pillars: [
      { icon: '❓', title: 'Any business question, in plain language', text: 'Not limited to what someone predefined — ask anything, and get a real answer from the data.' },
      { icon: '✦', title: 'Investigates on its own, returns insights', text: 'A quick answer — instantly; something that needs research — runs in the background and returns when ready, like assigning a task to an analyst.' },
      { icon: '🔬', title: 'Powered by our research', text: 'The team&rsquo;s models and research are the core — that is what sets us apart from a regular dashboard, and it cannot be copied.' },
    ],
    orgEyebrow: 'Team structure',
    orgH2: 'The entire technology side — under one owner',
    orgLead: 'Shlomi owns the entire technology side: managing development and research, hands-on when needed. The team splits into two disciplines — development and data science. Small, sharp and experienced: the Aspect A-Team.',
    orgLeadRole: 'Shlomi · CTO',
    orgLeadSub: 'Leads, manages, and owns it professionally',
    orgGroups: [
      { label: 'Development', members: [{ name: 'Kosta', what: 'Data loading & channels' }, { name: 'Vova', what: 'Next AI product' }] },
      { label: 'Data science', gold: true, members: [{ name: 'Ofir', what: 'Research & models' }] },
    ],
    mgEyebrow: 'Day-to-day management',
    mgH2: 'How the team is run',
    manage: [
      { icon: '📅', title: 'Daily standups', text: 'A daily sync with the team — what is done, what is stuck, and what is next.' },
      { icon: '🗂️', title: 'Task-management system', text: 'Work is managed in a structured task system — one we already built into the product itself.' },
      { icon: '🔄', title: 'Weekly sync', text: 'A weekly sync with Itzik and the investors — full transparency on progress.' },
    ],
    teamEyebrow: 'The team & cost',
    teamH2: 'Who does what — and what it costs',
    teamLead: 'Each role unlocks one capability we are missing today in order to grow.',
    roles: [
      { initial: 'S', name: 'Shlomi', title: 'CTO as a Service · leadership', color: CSHLOMI, cost: '35,000', per: '/ month · before model & cloud costs', note: 'Leads the team, the architecture and product direction, and remains the overall professional owner of the operation.', goal: 'Goal: the whole picture' },
      { initial: 'K', name: 'Kosta', title: 'Development · data loading & channels', color: CKOSTA, cost: '≈ 20,000', per: '/ month', note: 'Makes data loading automatic, reliable and robust — so we can onboard more and more customers without everything breaking.', goal: 'Goal: onboarding at scale' },
      { initial: 'V', name: 'Vova', title: 'Development · next AI product', color: CVOVA, cost: '≈ 20,000', per: '/ month', note: 'Builds the engine of the new product: tasks that run automatically via models — preparation, querying, even scripts.', goal: 'Goal: the next-gen product' },
      { initial: 'O', name: 'Ofir', title: 'Data science · research & models', color: COFIR, cost: '20,000', per: '/ month · exceptional value', note: 'Dedicated 100% to research: runs models that find the insights themselves, and prepares scripts for the BI product.', goal: 'Goal: the insights that sell', gold: true },
    ],
    methodEyebrow: 'How we work',
    methodH2: 'A small team that builds big, fast — with Claude Code',
    methodLead: 'We leverage Claude Code and AI so a small team delivers like a big one: building big things, fast.',
    card1H3: 'Everyone works with Claude Code',
    card1P: <>Every team member works with <strong>Claude Code</strong> — a monthly subscription of about <strong>$100 per person</strong>, which for our needs gives near-unlimited token usage. A negligible cost next to salaries, that multiplies what each person gets done. We will evaluate a different plan later as needed.</>,
    card1Tag: '~$100 per person / month · output × several',
    card2H3: 'No separate QA role',
    card2P: <>With Claude Code the developer&rsquo;s work becomes <strong>managerial</strong>: making sure what is handed to Claude is done right — at both the code and the product level. That control is embedded in the work itself, so there is no need for a separate QA stage or role.</>,
    card2Tag: 'Embedded control — not another headcount',
    burnEyebrow: 'Monthly burn',
    burnH2: 'What it costs per month',
    burnPer: '/ month · people only',
    legend: [
      { name: 'Shlomi', amount: '35,000 ₪', seg: CSHLOMI },
      { name: 'Kosta', amount: '≈ 20,000 ₪', seg: CKOSTA },
      { name: 'Vova', amount: '≈ 20,000 ₪', seg: CVOVA },
      { name: 'Ofir', amount: '20,000 ₪', seg: COFIR },
    ],
    burnNote: <><strong>Infrastructure costs (models + cloud) are separate</strong> — by actual usage and fully transparent. Today they are &ldquo;hidden&rdquo; inside my monthly payment; in this plan they are visible and clear, so you see exactly where every shekel goes. (Claude Code subscriptions — about $100 per person — are negligible and included in infrastructure.)</>,
    burnTag: 'This is a monthly burn rate — not an annual commitment. The team grows or shrinks by the pace we set.',
    flexEyebrow: 'Spend control',
    flexH2: 'Most of the money is flexible — not locked',
    flexLead: 'A structure that lets us accelerate when needed, and slow down painlessly if needed.',
    flexGreenH3: 'Flexible',
    flexGreenTiny: 'Can stop immediately — no notice',
    flexGreenP: 'Freelancers I have worked with for years — completely reliable. We can accelerate, slow down or stop at any moment, with no notice and no severance. Spend tracks the actual workload exactly. Payment can go through me or directly to them — and they will start even without an advance; full mutual trust.',
    flexGoldH3: 'Commitment',
    flexGoldTiny: 'Employee — standard notice',
    flexGoldP: 'A salaried employee (office / hybrid). The only commitment in the plan — and exceptional value: a data-science graduate looking for a foothold in the market, at an especially low cost.',
    flexBottom: <><span className={s.g}>High leverage</span> · <span className={s.y}>low lock-in</span></>,
    planEyebrow: 'The plan',
    planH2: 'First quarter detailed — the next two at a high level',
    planNote: 'This is a working plan — a direction and pace to work by, updated as we go.',
    startNow: 'Everyone is available — we start immediately.',
    q1Tag: 'Quarter 1',
    q1Txt: 'Build a stable base — and prove the machine works',
    months: [
      { idx: 'Month 01', title: 'Loading infra + auto-scaling', desc: 'Make customer onboarding reliable and repeatable, and lay the DevOps infrastructure for automatic customer scaling. Kosta gets up to speed and existing customers are stable.' },
      { idx: 'Month 02', title: 'Product foundations + research begins', desc: 'Vova builds the generative insights engine. Ofir starts running first models on real data.' },
      { idx: 'Month 03', title: 'First automated insights in the field', desc: 'Pilot customers receive automatically generated insights. We onboard a batch of new customers end-to-end — proving the machine works.' },
    ],
    q2Tag: 'Quarter 2', q2Title: 'Scale',
    q2P: 'Automatic onboarding of many more customers; the product expands to more data types; the insight library grows and matures.',
    q3Tag: 'Quarter 3', q3Title: 'The shared brain',
    q3P: 'Cross-customer intelligence: benchmarks across the entire long tail, self-serve, and commercial packaging for sale.',
    alignEyebrow: 'Alignment',
    alignH2: 'What the team delivers — against the investors&rsquo; goals',
    miniGoal: 'Investor goal',
    miniDeliver: 'What the team delivers',
    arrow: '→',
    align: [
      { goal: 'A shared brain from many small businesses', deliver: 'Vova&rsquo;s AI engine + Ofir&rsquo;s models' },
      { goal: 'Onboard many customers without breaking', deliver: 'Kosta&rsquo;s reliable loading pipeline' },
      { goal: 'Real insights that sell', deliver: 'Ofir&rsquo;s research and data science' },
      { goal: 'A next-gen product for business intelligence', deliver: 'Shlomi&rsquo;s product leadership, built on the team&rsquo;s research' },
    ],
    closeEyebrow: 'The ask',
    closeH2: 'Approve the team plan and monthly budget',
    closeP: 'To move from "one person holding everything" to a managed team that runs operations, product and research in parallel. This is what it takes to realize what the investors bought: a shared brain serving the long tail — reliably, and at pace. Everyone is available to start immediately — we can set off now.',
    signName: 'Shlomi',
    footer1: 'Aspect · business intelligence for small businesses',
    footer2: 'Internal document — for discussion only',
  },
};

export function TeamPlanPage() {
  const [mode, setMode] = useState<'light' | 'dark'>(
    () => (localStorage.getItem(MODE_KEY) as 'light' | 'dark') || 'light'
  );
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem(LANG_KEY) as Lang) || 'he'
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const t = STR[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  useEffect(() => { ensureFonts(); return () => { document.documentElement.dir = 'ltr'; }; }, []);

  useEffect(() => {
    document.title = t.docTitle;
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang, dir, t.docTitle]);

  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);

  // Scroll-reveal — only enabled when motion is allowed; content is visible by
  // default so nothing hides if the observer never runs.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) return;
    el.classList.add(s.animOn);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add(s.in); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    el.querySelectorAll(`.${s.reveal}`).forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <div className={s.page} data-mode={mode} dir={dir} ref={rootRef}>

      <div className={s.topbar}>
        <div className={`${s.wrap} ${s.topbarIn}`}>
          <div className={s.brand}>
            <div className={s.brandMark}>A</div>
            <div>
              <div className={s.brandName}>Aspect</div>
              <div className={s.brandSub}>{t.brandSub}</div>
            </div>
          </div>
          <div className={s.topRight}>
            <span className={s.chipInternal}>{t.chip}</span>
            <button
              className={s.langBtn}
              onClick={() => setLang(l => (l === 'he' ? 'en' : 'he'))}
              title="Language / שפה" aria-label="Toggle language"
            >
              {lang === 'he' ? 'EN' : 'עב'}
            </button>
            <button
              className={s.themeBtn}
              onClick={() => setMode(m => (m === 'dark' ? 'light' : 'dark'))}
              title="Theme" aria-label="Toggle theme"
            >
              {mode === 'dark' ? <SunGlyph /> : <MoonGlyph />}
            </button>
          </div>
        </div>
      </div>

      {/* HERO */}
      <header className={s.hero}>
        <div className={s.heroBg} />
        <div className={s.heroGlow} />
        <div className={`${s.wrap} ${s.heroIn}`}>
          <div className={s.eyebrow}>{t.heroEyebrow}</div>
          <h1 className={s.h1}>{t.h1a} <span className={s.accent}>{t.h1accent}</span></h1>
          <p className={s.heroLead}>{t.heroLead}</p>

          <div className={s.stats}>
            <div className={s.stat}>
              <div className={`${s.statNum} ${s.num}`}>≈ 95,000<span className={s.cur}>₪</span></div>
              <div className={s.statLabel}>{t.stat1Label}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statNum}>4</div>
              <div className={s.statLabel}>{t.stat2Label}</div>
            </div>
            <div className={s.stat}>
              <div className={s.statNum}>{t.stat3Num}</div>
              <div className={s.statLabel}>{t.stat3Label}</div>
            </div>
          </div>
        </div>
      </header>

      {/* SITUATION TODAY */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.split}>
            <div>
              <div className={s.eyebrow}>{t.sitEyebrow}</div>
              <h2 className={s.h2}>{t.sitH2}</h2>
              <p className={s.lead}>{t.sitLead}</p>
              <p className={s.bodyMax}>{t.sitBody}</p>
            </div>
            <div className={s.callout}>
              <div className={`${s.calloutTop} ${s.calloutGold}`}>
                <div className={s.k}>1</div>
                <div className={s.t}>{t.calloutT}</div>
              </div>
              <div className={s.calloutBody}>{t.calloutBody}</div>
            </div>
          </div>

          <div className={s.research}>
            <div className={s.researchIco}>🔬</div>
            <div>
              <h3>{t.researchH3}</h3>
              <p>{t.researchP}</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.prodEyebrow}</div>
          <h2 className={s.h2}>{t.prodH2}</h2>
          <p className={s.lead}>{t.prodLead}</p>
          <div className={s.pillars}>
            {t.pillars.map(p => (
              <div key={p.title} className={s.pillar}>
                <div className={s.pillarIco}>{p.icon}</div>
                <div className={s.pillarTitle}>{p.title}</div>
                <div className={s.pillarText}>{p.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ORG */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div style={{ textAlign: 'center', maxWidth: '58ch', marginInline: 'auto' }}>
            <div className={`${s.eyebrow} ${s.eyebrowCenter}`}>{t.orgEyebrow}</div>
            <h2 className={s.h2}>{t.orgH2}</h2>
            <p className={s.lead} style={{ marginInline: 'auto' }}>{t.orgLead}</p>
          </div>

          <div className={s.org}>
            <div className={s.orgLead}>
              <div className={s.leadRole}>{t.orgLeadRole}</div>
              <div className={s.leadSub}>{t.orgLeadSub}</div>
            </div>
            <div className={s.orgBranches}>
              {t.orgGroups.map(g => (
                <div key={g.label} className={`${s.orgGroup} ${g.gold ? s.gold : ''}`}>
                  <div className={s.groupLabel}>{g.label}</div>
                  <div className={s.orgMembers}>
                    {g.members.map(m => (
                      <div key={m.name} className={s.orgNode}>
                        <div className={s.who}>{m.name}</div>
                        <div className={s.what}>{m.what}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DAY-TO-DAY MANAGEMENT */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.mgEyebrow}</div>
          <h2 className={s.h2}>{t.mgH2}</h2>
          <div className={s.pillars}>
            {t.manage.map(m => (
              <div key={m.title} className={s.pillar}>
                <div className={s.pillarIco}>{m.icon}</div>
                <div className={s.pillarTitle}>{m.title}</div>
                <div className={s.pillarText}>{m.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM & COST */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.teamEyebrow}</div>
          <h2 className={s.h2}>{t.teamH2}</h2>
          <p className={s.lead}>{t.teamLead}</p>

          <div className={s.roles}>
            {t.roles.map(r => (
              <div key={r.name} className={`${s.role} ${r.gold ? s.gold : ''}`}>
                <span className={s.roleBar} style={{ background: r.color }} />
                <div className={s.roleHead}>
                  <div className={s.avatar} style={{ background: `linear-gradient(145deg, ${r.color}, color-mix(in srgb, ${r.color} 62%, #000))` }}>
                    {r.initial}
                  </div>
                  <div>
                    <div className={s.roleName}>{r.name}</div>
                    <div className={s.roleTitle}>{r.title}</div>
                  </div>
                </div>
                <div className={s.roleCost}>
                  <span className={`${s.amt} ${s.num}`}>{r.cost}<span className={s.cur}>₪</span></span>
                  <span className={s.per}>{r.per}</span>
                </div>
                <p className={s.roleNote}>{r.note}</p>
                <span className={s.roleGoal}>{r.goal}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* METHOD — tooling + no QA */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.methodEyebrow}</div>
          <h2 className={s.h2}>{t.methodH2}</h2>
          <p className={s.lead}>{t.methodLead}</p>

          <div className={s.leanGrid}>
            <div className={s.leanCard}>
              <div className={s.leanHd}>
                <div className={s.leanIco}>⌘</div>
                <h3>{t.card1H3}</h3>
              </div>
              <p>{t.card1P}</p>
              <span className={s.leanTag}>{t.card1Tag}</span>
            </div>
            <div className={s.leanCard}>
              <div className={s.leanHd}>
                <div className={s.leanIco}>✓</div>
                <h3>{t.card2H3}</h3>
              </div>
              <p>{t.card2P}</p>
              <span className={s.leanTag}>{t.card2Tag}</span>
            </div>
          </div>
        </div>
      </section>

      {/* BURN */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.burnEyebrow}</div>
          <h2 className={s.h2}>{t.burnH2}</h2>

          <div className={s.burnHero}>
            <div className={`${s.burnNum} ${s.num}`}><span className={s.approx}>≈</span>95,000<span className={s.cur}>₪</span></div>
            <div className={s.burnPer}>{t.burnPer}</div>
          </div>

          <div className={s.bar} role="img" aria-label="Monthly burn by team member">
            <span style={{ width: '36.85%', background: 'var(--seg-shlomi)' }} />
            <span style={{ width: '21.05%', background: 'var(--seg-kosta)' }} />
            <span style={{ width: '21.05%', background: 'var(--seg-vova)' }} />
            <span style={{ width: '21.05%', background: 'var(--seg-ofir)' }} />
          </div>
          <div className={s.legend}>
            {t.legend.map(l => (
              <div key={l.name} className={s.legendItem}><span className={s.dot} style={{ background: l.seg }} /><b>{l.name}</b> · {l.amount}</div>
            ))}
          </div>

          <div className={s.burnNote}>{t.burnNote}</div>
          <div className={s.burnTag}>{t.burnTag}</div>
        </div>
      </section>

      {/* FLEXIBILITY */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.flexEyebrow}</div>
          <h2 className={s.h2}>{t.flexH2}</h2>
          <p className={s.lead}>{t.flexLead}</p>

          <div className={s.flexGrid}>
            <div className={`${s.flexCol} ${s.flexGreen}`}>
              <div className={s.flexHd}>
                <div className={s.flexIco}>↕</div>
                <div>
                  <h3>{t.flexGreenH3}</h3>
                  <div className={s.tiny}>{t.flexGreenTiny}</div>
                </div>
              </div>
              <div className={s.flexWho}>
                <span className={s.pill}>Kosta</span>
                <span className={s.pill}>Vova</span>
              </div>
              <p>{t.flexGreenP}</p>
            </div>
            <div className={`${s.flexCol} ${s.flexGold}`}>
              <div className={s.flexHd}>
                <div className={s.flexIco}>★</div>
                <div>
                  <h3>{t.flexGoldH3}</h3>
                  <div className={s.tiny}>{t.flexGoldTiny}</div>
                </div>
              </div>
              <div className={s.flexWho}>
                <span className={s.pill}>{lang === 'he' ? 'אופיר' : 'Ofir'}</span>
              </div>
              <p>{t.flexGoldP}</p>
            </div>
          </div>
          <div className={s.flexBottom}>{t.flexBottom}</div>
        </div>
      </section>

      {/* QUARTER PLAN */}
      <section style={{ background: 'var(--surface-2)' }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.planEyebrow}</div>
          <h2 className={s.h2}>{t.planH2}</h2>
          <p className={s.planNote}>{t.planNote}</p>
          <p className={s.startNow}>{t.startNow}</p>

          <div className={s.qLabel}>
            <span className={s.tag}>{t.q1Tag}</span>
            <span className={s.qTxt}>{t.q1Txt}</span>
          </div>
          <div className={s.months}>
            {t.months.map(m => (
              <div key={m.idx} className={s.month}>
                <div className={s.idx}>{m.idx}</div>
                <div className={s.mtitle}>{m.title}</div>
                <div className={s.mdesc}>{m.desc}</div>
              </div>
            ))}
          </div>

          <div className={s.qSoft}>
            <div className={s.qcard}>
              <div className={s.qLabel} style={{ margin: '0 0 4px' }}><span className={`${s.tag} ${s.tagSoft}`}>{t.q2Tag}</span></div>
              <div className={s.qt}>{t.q2Title}</div>
              <p>{t.q2P}</p>
            </div>
            <div className={s.qcard}>
              <div className={s.qLabel} style={{ margin: '0 0 4px' }}><span className={`${s.tag} ${s.tagSoft}`}>{t.q3Tag}</span></div>
              <div className={s.qt}>{t.q3Title}</div>
              <p>{t.q3P}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ALIGNMENT */}
      <section>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.eyebrow}>{t.alignEyebrow}</div>
          <h2 className={s.h2}>{t.alignH2}</h2>

          <div className={s.alignList}>
            {t.align.map(a => (
              <div key={a.goal} className={s.alignRow}>
                <div className={s.alignGoal}><span className={s.mini}>{t.miniGoal}</span>{a.goal}</div>
                <div className={s.alignArrow}>{t.arrow}</div>
                <div className={s.alignDo}><span className={s.mini}>{t.miniDeliver}</span>{a.deliver}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section style={{ paddingTop: 0 }}>
        <div className={`${s.wrap} ${s.reveal}`}>
          <div className={s.closing}>
            <div className={s.eyebrow}>{t.closeEyebrow}</div>
            <h2>{t.closeH2}</h2>
            <p>{t.closeP}</p>
            <div className={s.sign}>— {t.signName} <span className={s.r}>· CTO, Aspect</span></div>
          </div>
        </div>
      </section>

      <footer className={s.footer}>
        <div className={`${s.wrap} ${s.footerIn}`}>
          <span>{t.footer1}</span>
          <span>{t.footer2}</span>
        </div>
      </footer>

    </div>
  );
}

function SunGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
function MoonGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
}
