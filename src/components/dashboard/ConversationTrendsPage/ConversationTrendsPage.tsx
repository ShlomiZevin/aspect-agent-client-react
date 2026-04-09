import { useEffect, useMemo, useState } from 'react';
import styles from './ConversationTrendsPage.module.css';

/* ============================================================
   LYBI — Conversation Trends Dashboard (full mockup)
   Implements every spec block + technical settings (5.x).
   ============================================================ */

type RangeKey = '7d' | '30d' | 'q' | 'custom';
type RoleKey = 'retail-head' | 'digital-channels' | 'product-manager';
type BranchKey = 'all' | 'tel-aviv' | 'haifa' | 'jerusalem' | 'beer-sheva' | 'online';
type SegmentKey = 'all' | 'students' | 'professionals' | 'families' | 'self-employed';
type ProductKey = 'all' | 'checking' | 'savings' | 'credit-card' | 'mortgage' | 'investments';

interface RangeData {
  kpis: { label: string; value: string; delta: string; up: boolean }[];
  bubbles: { name: string; count: number }[];
  questions: { q: string; pct: number }[];
  dropoff: { id: string; label: string; value: number; color: string }[];
  dropoffTotal: string;
  signals: { name: string; desc: string; pct: number; icon: string }[];
  segments: { emoji: string; label: string; value: string; delta: string }[];
  weekDays: string[];
  weekValues: number[];
  products: { label: string; pct: number; color: string }[];
  insights: { tag: string; tagClass: 'tagOpportunity' | 'tagFriction' | 'tagProfile'; desc: string; action: string }[];
}

const BUBBLE_POSITIONS: Array<{ x: number; y: number }> = [
  { x: 38, y: 42 }, { x: 65, y: 30 }, { x: 18, y: 35 }, { x: 78, y: 58 },
  { x: 50, y: 70 }, { x: 30, y: 70 }, { x: 12, y: 65 }, { x: 62, y: 78 },
  { x: 80, y: 14 }, { x: 8, y: 14 },  { x: 90, y: 80 }, { x: 47, y: 18 },
  { x: 22, y: 88 }, { x: 88, y: 38 },
];

const BUBBLE_GRADIENTS = [
  'radial-gradient(circle at 30% 30%, #F948C6, #9D1687 70%, #680662)',
  'radial-gradient(circle at 35% 30%, #9D1687, #680662 75%)',
  'radial-gradient(circle at 30% 30%, #F948C6, #680662)',
  'radial-gradient(circle at 35% 25%, #c52ba6, #9D1687 80%)',
  'radial-gradient(circle at 30% 30%, #F948C6 5%, #9D1687 80%)',
];

const ICONS = {
  price: 'M12 2v20M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6',
  convenience: 'M5 13l4 4L19 7',
  multiProduct: 'M20 7L9 18l-5-5M14 3h7v7',
  switch: 'M7 16l-4-4 4-4M3 12h14M17 8l4 4-4 4',
};

/* ============================================================
   ROLES, BRANCHES, SEGMENTS, PRODUCTS
   ============================================================ */
const ROLES: Record<RoleKey, { label: string; canSeeDropoff: boolean; canDownload: boolean }> = {
  'retail-head':      { label: 'ראש חטיבת קמעונאות', canSeeDropoff: true,  canDownload: true  },
  'digital-channels': { label: 'מנהל ערוצים דיגיטליים', canSeeDropoff: true,  canDownload: false },
  'product-manager':  { label: 'מנהל מוצר בנקאי',     canSeeDropoff: false, canDownload: false },
};

const BRANCHES: { value: BranchKey; label: string }[] = [
  { value: 'all', label: 'כל הסניפים' },
  { value: 'tel-aviv', label: 'תל אביב — מרכז' },
  { value: 'haifa', label: 'חיפה' },
  { value: 'jerusalem', label: 'ירושלים' },
  { value: 'beer-sheva', label: 'באר שבע' },
  { value: 'online', label: 'ערוץ דיגיטלי בלבד' },
];

const SEGMENTS: { value: SegmentKey; label: string }[] = [
  { value: 'all', label: 'כל הסגמנטים' },
  { value: 'students', label: 'סטודנטים (עד 26)' },
  { value: 'professionals', label: 'אנשי מקצוע (26–35)' },
  { value: 'families', label: 'משפחות (36–45)' },
  { value: 'self-employed', label: 'עצמאים' },
];

const PRODUCTS: { value: ProductKey; label: string }[] = [
  { value: 'all', label: 'כל המוצרים' },
  { value: 'checking', label: 'עו״ש דיגיטלי' },
  { value: 'savings', label: 'חיסכון' },
  { value: 'credit-card', label: 'כרטיס אשראי' },
  { value: 'mortgage', label: 'משכנתא' },
  { value: 'investments', label: 'השקעות' },
];

/* ============================================================
   DATA SETS — different per range
   ============================================================ */
const DATA: Record<Exclude<RangeKey, 'custom'>, RangeData> = {
  '7d': {
    kpis: [
      { label: 'שיעור השלמה', value: '71%', delta: '↑ 8 נקודות לעומת שבוע קודם', up: true },
      { label: 'ממוצע מוצרים לשיחה', value: '2.4', delta: '↑ 0.3 לעומת שבוע קודם', up: true },
      { label: 'Zero-Party Data שנאסף', value: '89%', delta: '↑ 12 נקודות לעומת טופס רגיל', up: true },
      { label: 'משך שיחה ממוצע', value: '6:40', delta: '↓ 45 שניות לעומת שבוע קודם', up: false },
    ],
    bubbles: [
      { name: 'עמלות', count: 340 }, { name: 'פתיחת חשבון', count: 310 },
      { name: 'עו"ש', count: 290 }, { name: 'דיגיטלי', count: 240 },
      { name: 'חיסכון', count: 210 }, { name: 'כרטיס אשראי', count: 190 },
      { name: 'מסמכים נדרשים', count: 180 }, { name: 'מעבר מבנק', count: 155 },
      { name: 'משכנתא', count: 130 }, { name: 'ריבית', count: 120 },
      { name: 'סטודנטים', count: 95 }, { name: 'השקעות', count: 85 },
      { name: 'הלוואה', count: 75 }, { name: 'אפליקציה', count: 65 },
    ],
    questions: [
      { q: 'אילו עמלות יחולו על החשבון?', pct: 42 },
      { q: 'האם אפשר לפתוח חשבון לגמרי באונליין?', pct: 38 },
      { q: 'מה ההטבות לסטודנטים?', pct: 31 },
      { q: 'כמה זמן לוקח להעביר פעילות מבנק אחר?', pct: 27 },
      { q: 'מה הריבית על הלוואה לרכב?', pct: 22 },
      { q: 'אילו מסמכים נדרשים לפתיחת חשבון לעצמאי?', pct: 18 },
    ],
    dropoff: [
      { id: 'docs', label: 'מסמכים לא זמינים', value: 34, color: '#680662' },
      { id: 'fees', label: 'חשש מעמלות', value: 26, color: '#9D1687' },
      { id: 'human', label: 'בקשת נציג אנושי', value: 18, color: '#F948C6' },
      { id: 'long', label: 'תהליך ארוך מדי', value: 14, color: '#c576b6' },
      { id: 'other', label: 'אחר', value: 8, color: '#e5b8d8' },
    ],
    dropoffTotal: '29%',
    signals: [
      { name: 'רגיש למחיר', desc: 'שאל על עמלות, ביקש הנחה, או השווה לבנק אחר', pct: 47, icon: ICONS.price },
      { name: 'מחפש נוחות', desc: 'התמקד בתהליך הדיגיטלי ובשירות עצמי', pct: 62, icon: ICONS.convenience },
      { name: 'ריבוי מוצרים', desc: 'הביע עניין ביותר ממוצר אחד', pct: 38, icon: ICONS.multiProduct },
      { name: 'מעבר ממתחרה', desc: 'ציין שקל להעביר פעילות קיימת', pct: 29, icon: ICONS.switch },
    ],
    segments: [
      { emoji: '💼', label: 'אנשי מקצוע (26–35)', value: '38%', delta: '↑ 4 נקודות' },
      { emoji: '👨‍👩‍👧', label: 'משפחות (36–45)', value: '27%', delta: '↑ 2 נקודות' },
      { emoji: '🎓', label: 'סטודנטים (עד 26)', value: '21%', delta: '↑ 6 נקודות' },
      { emoji: '🛠️', label: 'עצמאים', value: '14%', delta: '↑ 3 נקודות' },
    ],
    weekDays: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
    weekValues: [58, 64, 70, 73, 78, 68, 62],
    products: [
      { label: 'עו"ש דיגיטלי', pct: 94, color: '#680662' },
      { label: 'חיסכון', pct: 67, color: '#9D1687' },
      { label: 'כרטיס אשראי', pct: 48, color: '#F948C6' },
      { label: 'השקעות', pct: 31, color: '#c576b6' },
      { label: 'משכנתא', pct: 19, color: '#e5b8d8' },
    ],
    insights: [
      { tag: 'הזדמנות מזוהה', tagClass: 'tagOpportunity', desc: '28% מהמסיימים הביעו עניין במשכנתא ללא שאלה ישירה', action: 'הצע מודול משכנתא ייעודי בסוף השיחה' },
      { tag: 'חיכוך חוזר', tagClass: 'tagFriction', desc: 'שאלות על עמלות עולות ב-34% מהשיחות; ניתן לפתור עם דף תנאים מובנה', action: 'הוסף מסך תנאים שקוף בשלב פתיחת החשבון' },
      { tag: 'פרופיל חדש', tagClass: 'tagProfile', desc: 'עצמאים עם שאלות ייחודיות על אשראי; מומלץ לפתח זרם שיחה ייעודי', action: 'בנה זרם אונבורדינג ייחודי לעצמאים' },
    ],
  },

  '30d': {
    kpis: [
      { label: 'שיעור השלמה', value: '68%', delta: '↑ 5 נקודות לעומת חודש קודם', up: true },
      { label: 'ממוצע מוצרים לשיחה', value: '2.6', delta: '↑ 0.4 לעומת חודש קודם', up: true },
      { label: 'Zero-Party Data שנאסף', value: '91%', delta: '↑ 14 נקודות לעומת טופס רגיל', up: true },
      { label: 'משך שיחה ממוצע', value: '7:05', delta: '↓ 1:20 לעומת חודש קודם', up: false },
    ],
    bubbles: [
      { name: 'עמלות', count: 1480 }, { name: 'פתיחת חשבון', count: 1320 },
      { name: 'עו"ש', count: 1180 }, { name: 'דיגיטלי', count: 1050 },
      { name: 'חיסכון', count: 940 }, { name: 'כרטיס אשראי', count: 820 },
      { name: 'מסמכים נדרשים', count: 760 }, { name: 'מעבר מבנק', count: 690 },
      { name: 'משכנתא', count: 605 }, { name: 'ריבית', count: 540 },
      { name: 'סטודנטים', count: 420 }, { name: 'השקעות', count: 380 },
      { name: 'הלוואה', count: 320 }, { name: 'אפליקציה', count: 290 },
    ],
    questions: [
      { q: 'אילו עמלות יחולו על החשבון?', pct: 45 },
      { q: 'האם אפשר לפתוח חשבון לגמרי באונליין?', pct: 41 },
      { q: 'כמה זמן לוקח להעביר פעילות מבנק אחר?', pct: 33 },
      { q: 'מה הריבית על הלוואה לרכב?', pct: 28 },
      { q: 'אילו מסמכים נדרשים לפתיחת חשבון לעצמאי?', pct: 24 },
      { q: 'מה ההטבות לסטודנטים?', pct: 22 },
    ],
    dropoff: [
      { id: 'docs', label: 'מסמכים לא זמינים', value: 31, color: '#680662' },
      { id: 'fees', label: 'חשש מעמלות', value: 28, color: '#9D1687' },
      { id: 'human', label: 'בקשת נציג אנושי', value: 17, color: '#F948C6' },
      { id: 'long', label: 'תהליך ארוך מדי', value: 16, color: '#c576b6' },
      { id: 'other', label: 'אחר', value: 8, color: '#e5b8d8' },
    ],
    dropoffTotal: '32%',
    signals: [
      { name: 'רגיש למחיר', desc: 'שאל על עמלות, ביקש הנחה, או השווה לבנק אחר', pct: 51, icon: ICONS.price },
      { name: 'מחפש נוחות', desc: 'התמקד בתהליך הדיגיטלי ובשירות עצמי', pct: 65, icon: ICONS.convenience },
      { name: 'ריבוי מוצרים', desc: 'הביע עניין ביותר ממוצר אחד', pct: 42, icon: ICONS.multiProduct },
      { name: 'מעבר ממתחרה', desc: 'ציין שקל להעביר פעילות קיימת', pct: 33, icon: ICONS.switch },
    ],
    segments: [
      { emoji: '💼', label: 'אנשי מקצוע (26–35)', value: '36%', delta: '↑ 2 נקודות' },
      { emoji: '👨‍👩‍👧', label: 'משפחות (36–45)', value: '29%', delta: '↑ 3 נקודות' },
      { emoji: '🎓', label: 'סטודנטים (עד 26)', value: '23%', delta: '↑ 5 נקודות' },
      { emoji: '🛠️', label: 'עצמאים', value: '12%', delta: '↑ 1 נקודה' },
    ],
    weekDays: ['ש׳1', 'ש׳2', 'ש׳3', 'ש׳4'],
    weekValues: [62, 67, 70, 68],
    products: [
      { label: 'עו"ש דיגיטלי', pct: 92, color: '#680662' },
      { label: 'חיסכון', pct: 71, color: '#9D1687' },
      { label: 'כרטיס אשראי', pct: 52, color: '#F948C6' },
      { label: 'השקעות', pct: 35, color: '#c576b6' },
      { label: 'משכנתא', pct: 24, color: '#e5b8d8' },
    ],
    insights: [
      { tag: 'הזדמנות מזוהה', tagClass: 'tagOpportunity', desc: '31% מהמסיימים הביעו עניין במשכנתא — מגמה עקבית לאורך החודש', action: 'בנה משפך משכנתא אוטומטי' },
      { tag: 'חיכוך חוזר', tagClass: 'tagFriction', desc: 'נושא העמלות גורם לנשירה של 28% מהשיחות בשלב הסיום', action: 'הקדם את שלב המידע על עמלות' },
      { tag: 'פרופיל חדש', tagClass: 'tagProfile', desc: 'גידול של 23% במספר הסטודנטים — צריך תוכן ממוקד', action: 'הוסף זרם הטבות לסטודנטים' },
    ],
  },

  'q': {
    kpis: [
      { label: 'שיעור השלמה', value: '64%', delta: '↑ 11 נקודות לעומת רבעון קודם', up: true },
      { label: 'ממוצע מוצרים לשיחה', value: '2.8', delta: '↑ 0.6 לעומת רבעון קודם', up: true },
      { label: 'Zero-Party Data שנאסף', value: '93%', delta: '↑ 17 נקודות לעומת טופס רגיל', up: true },
      { label: 'משך שיחה ממוצע', value: '7:32', delta: '↓ 2:10 לעומת רבעון קודם', up: false },
    ],
    bubbles: [
      { name: 'עמלות', count: 4320 }, { name: 'פתיחת חשבון', count: 3980 },
      { name: 'דיגיטלי', count: 3540 }, { name: 'עו"ש', count: 3360 },
      { name: 'חיסכון', count: 2890 }, { name: 'משכנתא', count: 2410 },
      { name: 'כרטיס אשראי', count: 2350 }, { name: 'מעבר מבנק', count: 2180 },
      { name: 'מסמכים נדרשים', count: 2020 }, { name: 'ריבית', count: 1740 },
      { name: 'השקעות', count: 1320 }, { name: 'סטודנטים', count: 1180 },
      { name: 'הלוואה', count: 980 }, { name: 'אפליקציה', count: 820 },
    ],
    questions: [
      { q: 'אילו עמלות יחולו על החשבון?', pct: 48 },
      { q: 'האם אפשר לפתוח חשבון לגמרי באונליין?', pct: 44 },
      { q: 'מה הריבית על משכנתא היום?', pct: 36 },
      { q: 'כמה זמן לוקח להעביר פעילות מבנק אחר?', pct: 35 },
      { q: 'אילו מסמכים נדרשים לפתיחת חשבון לעצמאי?', pct: 29 },
      { q: 'מה ההבדל בין מסלולי החיסכון?', pct: 26 },
    ],
    dropoff: [
      { id: 'docs', label: 'מסמכים לא זמינים', value: 29, color: '#680662' },
      { id: 'fees', label: 'חשש מעמלות', value: 30, color: '#9D1687' },
      { id: 'human', label: 'בקשת נציג אנושי', value: 19, color: '#F948C6' },
      { id: 'long', label: 'תהליך ארוך מדי', value: 14, color: '#c576b6' },
      { id: 'other', label: 'אחר', value: 8, color: '#e5b8d8' },
    ],
    dropoffTotal: '36%',
    signals: [
      { name: 'רגיש למחיר', desc: 'שאל על עמלות, ביקש הנחה, או השווה לבנק אחר', pct: 54, icon: ICONS.price },
      { name: 'מחפש נוחות', desc: 'התמקד בתהליך הדיגיטלי ובשירות עצמי', pct: 69, icon: ICONS.convenience },
      { name: 'ריבוי מוצרים', desc: 'הביע עניין ביותר ממוצר אחד', pct: 48, icon: ICONS.multiProduct },
      { name: 'מעבר ממתחרה', desc: 'ציין שקל להעביר פעילות קיימת', pct: 41, icon: ICONS.switch },
    ],
    segments: [
      { emoji: '💼', label: 'אנשי מקצוע (26–35)', value: '34%', delta: '↑ 1 נקודה' },
      { emoji: '👨‍👩‍👧', label: 'משפחות (36–45)', value: '31%', delta: '↑ 4 נקודות' },
      { emoji: '🎓', label: 'סטודנטים (עד 26)', value: '22%', delta: '↑ 7 נקודות' },
      { emoji: '🛠️', label: 'עצמאים', value: '13%', delta: '↑ 2 נקודות' },
    ],
    weekDays: ['חודש 1', 'חודש 2', 'חודש 3'],
    weekValues: [55, 63, 71],
    products: [
      { label: 'עו"ש דיגיטלי', pct: 90, color: '#680662' },
      { label: 'חיסכון', pct: 74, color: '#9D1687' },
      { label: 'כרטיס אשראי', pct: 56, color: '#F948C6' },
      { label: 'השקעות', pct: 39, color: '#c576b6' },
      { label: 'משכנתא', pct: 32, color: '#e5b8d8' },
    ],
    insights: [
      { tag: 'הזדמנות מזוהה', tagClass: 'tagOpportunity', desc: 'עניין במשכנתא צמח ב-68% רבעון על רבעון — אות מוקדם לפלח חדש', action: 'הקצה תקציב ייעודי לאוטומציית משכנתאות' },
      { tag: 'חיכוך חוזר', tagClass: 'tagFriction', desc: 'נושא העמלות חוזר באופן עקבי לאורך הרבעון, עם השפעה ישירה על שיעורי השלמה', action: 'בנה דף תנאים שקוף ופתיחה אוטומטית בשלב הרלוונטי' },
      { tag: 'פרופיל חדש', tagClass: 'tagProfile', desc: 'מגמה ברורה של מעבר לקוחות מהמתחרים — אוכלוסייה חדשה לבנק', action: 'בנה תהליך ייעודי "מעבר חכם" עם תמריצים' },
    ],
  },
};

/* ============================================================
   ANONYMIZED DROP-OFF EXAMPLES (mock — for block 3 click)
   ============================================================ */
const DROPOFF_EXAMPLES: Record<string, { meta: string; segment: string; quote: string }[]> = {
  docs: [
    { meta: 'שיחה #A-1029', segment: 'עצמאי, גיל 34', quote: '"אני בעבודה עכשיו, אין לי גישה לאישור הכנסה. אני אחזור אחר כך" — השיחה לא חודשה.' },
    { meta: 'שיחה #A-1184', segment: 'איש מקצוע, גיל 29', quote: '"דרשתם תלוש שאין לי בטלפון. אני מעדיף לבוא לסניף עם הכל ביד."' },
    { meta: 'שיחה #A-1276', segment: 'משפחה, גיל 41', quote: '"לא מצאתי את ספח תעודת הזהות. תזכירו לי מחר?"' },
  ],
  fees: [
    { meta: 'שיחה #B-2031', segment: 'סטודנט, גיל 23', quote: '"עמלת ניהול חשבון 18 ש"ח? בבנק שלי היום זה חינם לגמרי. למה לעבור?"' },
    { meta: 'שיחה #B-2118', segment: 'איש מקצוע, גיל 31', quote: '"כל פעם שאני שואל על משהו אתם מזכירים עמלה. זה מרגיש לא שקוף."' },
    { meta: 'שיחה #B-2245', segment: 'משפחה, גיל 38', quote: '"אם אני מבין נכון, יש עמלה גם על העברה לחו״ל וגם על המרת מטבע. זה הרבה."' },
  ],
  human: [
    { meta: 'שיחה #C-3072', segment: 'משפחה, גיל 44', quote: '"אני מעדיפה לדבר עם נציגה אנושית, זה החלטה גדולה."' },
    { meta: 'שיחה #C-3119', segment: 'עצמאית, גיל 47', quote: '"אפשר טלפון של בנקאי שאני מכירה? לא נוח לי לסכם הכל בצ׳אט."' },
  ],
  long: [
    { meta: 'שיחה #D-4188', segment: 'איש מקצוע, גיל 28', quote: '"כבר עשרים דקות. אני אסיים אחר כך, לא חשבתי שזה יקח כל כך הרבה זמן."' },
    { meta: 'שיחה #D-4203', segment: 'סטודנט, גיל 25', quote: '"תהליך ארוך מדי, אני בלימודים עכשיו, אחזור."' },
  ],
  other: [
    { meta: 'שיחה #E-5101', segment: 'משפחה, גיל 39', quote: '"בעצם אני מעדיף לחשוב על זה עוד יום-יומיים."' },
  ],
};

/* ============================================================
   ANONYMIZED TOPIC EXAMPLES (mock — for block 1.5 bubble click)
   ============================================================ */
const TOPIC_EXAMPLES: Record<string, { meta: string; segment: string; quote: string }[]> = {
  'עמלות': [
    { meta: 'שיחה #T-7012', segment: 'איש מקצוע, גיל 32', quote: '"כמה תעלה לי עמלת ניהול חשבון בחודש? יש מסלול בלי עמלות בכלל?"' },
    { meta: 'שיחה #T-7188', segment: 'משפחה, גיל 41', quote: '"אני רוצה להבין את כל העמלות מראש — גם המוסתרות. אני שונא הפתעות בסוף החודש."' },
    { meta: 'שיחה #T-7245', segment: 'סטודנט, גיל 24', quote: '"בבנק שלי סטודנטים פטורים מעמלות. מה אתם נותנים?"' },
  ],
  'פתיחת חשבון': [
    { meta: 'שיחה #T-7301', segment: 'איש מקצוע, גיל 28', quote: '"רוצה לפתוח חשבון בלי לבוא לסניף. כמה זמן זה לוקח מההתחלה לסוף?"' },
    { meta: 'שיחה #T-7344', segment: 'עצמאי, גיל 36', quote: '"אפשר לפתוח חשבון עסקי ופרטי באותו תהליך?"' },
  ],
  'עו"ש': [
    { meta: 'שיחה #T-7401', segment: 'משפחה, גיל 39', quote: '"מה ההבדל בין מסלול עו״ש רגיל לדיגיטלי? למה שאני אבחר באחד על פני השני?"' },
    { meta: 'שיחה #T-7422', segment: 'איש מקצוע, גיל 30', quote: '"האם יש משיכת יתר אוטומטית בעו״ש?"' },
  ],
  'דיגיטלי': [
    { meta: 'שיחה #T-7501', segment: 'סטודנט, גיל 22', quote: '"אני רוצה הכל באפליקציה — אני לא הולך לסניפים בכלל. זה אפשרי?"' },
    { meta: 'שיחה #T-7533', segment: 'איש מקצוע, גיל 27', quote: '"יש לכם פיצ׳רים שאין לבנקים אחרים? למה דווקא אתם?"' },
  ],
  'חיסכון': [
    { meta: 'שיחה #T-7601', segment: 'משפחה, גיל 42', quote: '"איזה תכניות חיסכון מתאימות לטווח של 5 שנים? אני רוצה לחסוך לילדים."' },
    { meta: 'שיחה #T-7622', segment: 'עצמאי, גיל 38', quote: '"מה הריבית על פיקדון בנקאי כיום?"' },
  ],
  'כרטיס אשראי': [
    { meta: 'שיחה #T-7701', segment: 'איש מקצוע, גיל 33', quote: '"אני רוצה כרטיס עם החזרים על קניות בסופר. מה יש לכם?"' },
    { meta: 'שיחה #T-7745', segment: 'סטודנט, גיל 25', quote: '"אפשר לקבל כרטיס אשראי בלי הכנסה קבועה?"' },
  ],
  'מסמכים נדרשים': [
    { meta: 'שיחה #T-7801', segment: 'עצמאי, גיל 44', quote: '"איזה מסמכים אני צריך להכין מראש כדי שהתהליך יהיה חלק?"' },
    { meta: 'שיחה #T-7833', segment: 'איש מקצוע, גיל 29', quote: '"אני בלי תלוש משכורת עכשיו, מה האלטרנטיבה?"' },
  ],
  'מעבר מבנק': [
    { meta: 'שיחה #T-7901', segment: 'משפחה, גיל 37', quote: '"כמה זמן לוקח להעביר את כל ההוראות קבע מהבנק הקודם? אני חוששת שמשהו ייפול בין הכיסאות."' },
    { meta: 'שיחה #T-7944', segment: 'איש מקצוע, גיל 34', quote: '"אתם עושים את כל המעבר במקומי או שאני צריך לטפל בזה?"' },
  ],
  'משכנתא': [
    { meta: 'שיחה #T-8011', segment: 'משפחה, גיל 36', quote: '"אנחנו חושבים על דירה ראשונה. אפשר לקבל אישור עקרוני למשכנתא דרככם?"' },
    { meta: 'שיחה #T-8055', segment: 'איש מקצוע, גיל 35', quote: '"מה הריבית על משכנתא במסלול קבועה צמודה?"' },
  ],
  'ריבית': [
    { meta: 'שיחה #T-8101', segment: 'עצמאי, גיל 41', quote: '"איזה ריבית יש לכם על פיקדון לשנה?"' },
    { meta: 'שיחה #T-8133', segment: 'איש מקצוע, גיל 31', quote: '"אם אני שם 50,000 ש״ח בחיסכון, כמה אני מקבל בסוף השנה?"' },
  ],
  'סטודנטים': [
    { meta: 'שיחה #T-8201', segment: 'סטודנט, גיל 21', quote: '"אני סטודנט שנה ראשונה — אתם נותנים פטור מעמלות?"' },
    { meta: 'שיחה #T-8222', segment: 'סטודנט, גיל 24', quote: '"יש הטבות מיוחדות לסטודנטים? אובר דרפט בלי ריבית או משהו?"' },
  ],
  'השקעות': [
    { meta: 'שיחה #T-8301', segment: 'איש מקצוע, גיל 33', quote: '"אני רוצה להתחיל להשקיע בקרנות מחקות. אתם נותנים פלטפורמה לזה?"' },
    { meta: 'שיחה #T-8344', segment: 'עצמאי, גיל 45', quote: '"מה העמלות על קנייה ומכירה של מניות?"' },
  ],
  'הלוואה': [
    { meta: 'שיחה #T-8401', segment: 'משפחה, גיל 38', quote: '"מה הריבית על הלוואה לרכב חדש? כמה זמן לוקח לקבל אישור?"' },
    { meta: 'שיחה #T-8433', segment: 'איש מקצוע, גיל 30', quote: '"אני צריך הלוואה של 30,000 ש״ח לשיפוץ. אפשר לקבל אישור מהיר?"' },
  ],
  'אפליקציה': [
    { meta: 'שיחה #T-8501', segment: 'סטודנט, גיל 23', quote: '"האפליקציה שלכם נוחה? אני לא רוצה משהו מבולגן כמו אצל המתחרים."' },
    { meta: 'שיחה #T-8533', segment: 'איש מקצוע, גיל 28', quote: '"האפליקציה תומכת בביומטרי? אני לא רוצה להקליד סיסמה כל פעם."' },
  ],
};

/* ============================================================
   HELPERS
   ============================================================ */
function donutSlices(data: { value: number; color: string }[], radius = 80, inner = 50) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  return data.map(d => {
    const start = (acc / total) * Math.PI * 2;
    acc += d.value;
    const end = (acc / total) * Math.PI * 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = 100 + radius * Math.sin(start);
    const y1 = 100 - radius * Math.cos(start);
    const x2 = 100 + radius * Math.sin(end);
    const y2 = 100 - radius * Math.cos(end);
    const xi2 = 100 + inner * Math.sin(end);
    const yi2 = 100 - inner * Math.cos(end);
    const xi1 = 100 + inner * Math.sin(start);
    const yi1 = 100 - inner * Math.cos(start);
    const path = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1}`,
      'Z',
    ].join(' ');
    return { path, color: d.color };
  });
}

function linePath(values: number[], w: number, h: number, padX = 40, padY = 30) {
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const stepX = innerW / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => ({
    x: padX + i * stepX,
    y: padY + innerH - (v / 100) * innerH,
  }));
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const cpx = (prev.x + cur.x) / 2;
    d += ` Q ${cpx} ${prev.y}, ${cpx} ${(prev.y + cur.y) / 2} T ${cur.x} ${cur.y}`;
  }
  const area = `${d} L ${points[points.length - 1].x} ${h - padY} L ${points[0].x} ${h - padY} Z`;
  return { line: d, area, points };
}

export function ConversationTrendsPage() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [customStart, setCustomStart] = useState('2026-03-09');
  const [customEnd, setCustomEnd] = useState('2026-04-09');
  const [role, setRole] = useState<RoleKey>('retail-head');
  const [branch, setBranch] = useState<BranchKey>('all');
  const [segment, setSegment] = useState<SegmentKey>('all');
  const [product, setProduct] = useState<ProductKey>('all');
  const [openExample, setOpenExample] = useState<string | null>(null);
  const [hoverSlice, setHoverSlice] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  /* When 'custom' selected, fall back to 7d data — mock */
  const dataKey: Exclude<RangeKey, 'custom'> = range === 'custom' ? '7d' : range;
  const data = DATA[dataKey];

  const roleConfig = ROLES[role];
  const showDropoff = roleConfig.canSeeDropoff;

  /* Reset modal if drop-off becomes hidden */
  useEffect(() => {
    if (!showDropoff && openExample) setOpenExample(null);
  }, [showDropoff, openExample]);

  const slices = useMemo(() => donutSlices(data.dropoff), [data.dropoff]);
  const lineW = 700;
  const lineH = 280;
  const { line, area, points } = useMemo(
    () => linePath(data.weekValues, lineW, lineH),
    [data.weekValues],
  );

  const maxBubble = Math.max(...data.bubbles.map(t => t.count));
  const minBubble = Math.min(...data.bubbles.map(t => t.count));

  const subtitleByRange: Record<RangeKey, string> = {
    '7d': 'תובנות מצטברות מכלל שיחות האונבורדינג בשבעת הימים האחרונים',
    '30d': 'תובנות מצטברות מכלל שיחות האונבורדינג ב-30 הימים האחרונים',
    'q': 'תובנות מצטברות מכלל שיחות האונבורדינג ברבעון הנוכחי',
    'custom': `תובנות מצטברות מכלל שיחות האונבורדינג בטווח ${customStart} → ${customEnd}`,
  };

  const branchLabel = BRANCHES.find(b => b.value === branch)?.label;
  const segmentLabel = SEGMENTS.find(s => s.value === segment)?.label;
  const productLabel = PRODUCTS.find(p => p.value === product)?.label;

  const activeChips = [
    branch !== 'all' && { key: 'branch', label: branchLabel!, clear: () => setBranch('all') },
    segment !== 'all' && { key: 'segment', label: segmentLabel!, clear: () => setSegment('all') },
    product !== 'all' && { key: 'product', label: productLabel!, clear: () => setProduct('all') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const handleDownload = () => {
    if (!roleConfig.canDownload) return;
    alert('הדוח יורד... (מוקאפ)');
  };

  const openSliceId = openExample;
  const openSlice = openSliceId ? data.dropoff.find(d => d.id === openSliceId) : null;
  const examples = openSliceId ? DROPOFF_EXAMPLES[openSliceId] || [] : [];

  return (
    <div className={styles.page}>
      {/* ========== HEADER ========== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            LYBI · Conversation Engine · Live
          </span>
          <h1 className={styles.title}>טרנדים מהשיחות</h1>
          <p className={styles.subtitle}>{subtitleByRange[range]}</p>
          <div className={styles.audience}>
            <span>קהל יעד:</span>
            <span className={styles.audienceItem}>ראש חטיבת קמעונאות</span>
            <span className={styles.audienceItem}>מנהל ערוצים דיגיטליים</span>
            <span className={styles.audienceItem}>מנהל מוצר בנקאי</span>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.roleBar}>
            <span className={styles.roleLabel}>תפקיד נוכחי</span>
            <select
              className={styles.roleSelect}
              value={role}
              onChange={e => setRole(e.target.value as RoleKey)}
            >
              {(Object.keys(ROLES) as RoleKey[]).map(k => (
                <option key={k} value={k}>{ROLES[k].label}</option>
              ))}
            </select>
            <button
              className={styles.downloadBtn}
              onClick={handleDownload}
              disabled={!roleConfig.canDownload}
              title={roleConfig.canDownload ? 'הורדת דוח מלא' : 'הורדה זמינה לראש חטיבה בלבד'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              הורד דוח
            </button>
          </div>

          <div className={styles.filters} role="tablist">
            {[
              { k: '7d' as RangeKey, label: '7 ימים' },
              { k: '30d' as RangeKey, label: '30 ימים' },
              { k: 'q' as RangeKey, label: 'רבעון' },
              { k: 'custom' as RangeKey, label: 'מותאם אישית' },
            ].map(opt => (
              <button
                key={opt.k}
                className={`${styles.filterBtn} ${range === opt.k ? styles.filterBtnActive : ''}`}
                onClick={() => setRange(opt.k)}
                role="tab"
                aria-selected={range === opt.k}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ========== FILTERS BAR (5.4) ========== */}
      <div className={styles.filtersBar}>
        <span className={styles.filtersLabel}>סינון</span>

        <select
          className={styles.filterSelect}
          value={branch}
          onChange={e => setBranch(e.target.value as BranchKey)}
        >
          {BRANCHES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>

        <select
          className={styles.filterSelect}
          value={segment}
          onChange={e => setSegment(e.target.value as SegmentKey)}
        >
          {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          className={styles.filterSelect}
          value={product}
          onChange={e => setProduct(e.target.value as ProductKey)}
        >
          {PRODUCTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        {range === 'custom' && (
          <div className={styles.customRangeWrap}>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className={styles.customRangeInput}
            />
            <span style={{ color: '#57534E', fontSize: 12 }}>→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className={styles.customRangeInput}
            />
          </div>
        )}

        {activeChips.length > 0 && (
          <div className={styles.activeFiltersWrap}>
            {activeChips.map(c => (
              <button key={c.key} className={styles.activeChip} onClick={c.clear}>
                {c.label}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========== KPIs ========== */}
      <div className={styles.kpiGrid}>
        {data.kpis.map(k => (
          <div key={k.label} className={styles.kpiCard}>
            <p className={styles.kpiLabel}>{k.label}</p>
            <div className={styles.kpiValue}>{k.value}</div>
            <span className={`${styles.kpiPill} ${k.up ? styles.pillUp : styles.pillDown}`}>
              {k.delta}
            </span>
          </div>
        ))}
      </div>

      {/* ========== BLOCK 1.5 — WORD BUBBLES ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>נושאים מובילים בשיחות</h2>
            <p className={styles.sectionSub}>גודל הבועה משקף את היקף האזכורים — לחץ על בועה לצפייה בדוגמאות שיחה</p>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.bubblesCloud}>
            {data.bubbles.map((t, i) => {
              const norm = (t.count - minBubble) / Math.max(maxBubble - minBubble, 1);
              const size = 70 + norm * 130;
              const fontSize = 12 + norm * 14;
              const pos = BUBBLE_POSITIONS[i];
              const grad = BUBBLE_GRADIENTS[i % BUBBLE_GRADIENTS.length];
              const delay = (i * 0.4) % 4;
              const dur = 6 + (i % 5);
              return (
                <div
                  key={t.name}
                  className={styles.bubble}
                  onClick={() => setOpenTopic(t.name)}
                  title={`לחץ לצפייה בדוגמאות שיחה שהזכירו "${t.name}"`}
                  style={{
                    width: size,
                    height: size,
                    fontSize,
                    background: grad,
                    left: `calc(${pos.x}% - ${size / 2}px)`,
                    top: `calc(${pos.y}% - ${size / 2}px)`,
                    animationDuration: `${dur}s`,
                    animationDelay: `${delay}s`,
                  }}
                >
                  <span className={styles.bubbleTopic}>{t.name}</span>
                  <span className={styles.bubbleCount}>{t.count} אזכורים</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========== BLOCK 2 — TOP QUESTIONS ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>שאלות נפוצות בשיחות</h2>
            <p className={styles.sectionSub}>זוהה אוטומטית מתוכן השיחות — ניתן לסנן בסרגל למעלה לפי סגמנט, מוצר, או סניף</p>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.questionList}>
            {data.questions.map(q => (
              <div key={q.q} className={styles.questionRow}>
                <div>
                  <p className={styles.questionText}>{q.q}</p>
                  <div className={styles.questionBarWrap}>
                    <div
                      className={styles.questionBar}
                      style={{ ['--bar' as never]: q.pct / 50 } as React.CSSProperties}
                    />
                  </div>
                </div>
                <div className={styles.questionPct}>{q.pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== ROW: BLOCK 3 + BLOCK 4 ========== */}
      <div className={styles.row3}>
        {showDropoff ? (
          <section>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>סיבות נטישה</h2>
                <p className={styles.sectionSub}>לחץ על קטגוריה לצפייה בדוגמאות שיחה אנונימיות</p>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.donutWrap}>
                <svg viewBox="0 0 200 200" className={styles.donut}>
                  {slices.map((s, i) => (
                    <path
                      key={i}
                      d={s.path}
                      fill={s.color}
                      className={styles.donutSlice}
                      onClick={() => setOpenExample(data.dropoff[i].id)}
                      onMouseEnter={() => setHoverSlice(data.dropoff[i].id)}
                      onMouseLeave={() => setHoverSlice(null)}
                      opacity={hoverSlice && hoverSlice !== data.dropoff[i].id ? 0.5 : 1}
                    />
                  ))}
                  <text x="100" y="96" textAnchor="middle" fontSize="11" fill="#57534E" fontFamily="DM Sans, Heebo, Arial">
                    שיעור נטישה
                  </text>
                  <text x="100" y="120" textAnchor="middle" fontSize="22" fontWeight="500" fill="#1C1917" fontFamily="Playfair Display, Heebo, serif">
                    {data.dropoffTotal}
                  </text>
                </svg>
                <div className={styles.legend}>
                  {data.dropoff.map(d => (
                    <div
                      key={d.id}
                      className={styles.legendItem}
                      onClick={() => setOpenExample(d.id)}
                      onMouseEnter={() => setHoverSlice(d.id)}
                      onMouseLeave={() => setHoverSlice(null)}
                    >
                      <span className={styles.legendDot} style={{ background: d.color }} />
                      <span className={styles.legendLabel}>{d.label}</span>
                      <span className={styles.legendPct}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>סיבות נטישה</h2>
                <p className={styles.sectionSub}>צפייה זמינה לראש חטיבה ולמנהל ערוצים דיגיטליים בלבד</p>
              </div>
            </div>
            <div className={styles.limitedNotice}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              נתוני נטישה אינם זמינים לתפקיד "{roleConfig.label}". פנה לראש החטיבה לקבלת גישה.
            </div>
          </section>
        )}

        <section>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>אותות כוונה</h2>
              <p className={styles.sectionSub}>זוהו מניתוח התוכן ללא שאלות ישירות</p>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.signalGrid}>
              {data.signals.map(s => (
                <div key={s.name} className={styles.signalCard}>
                  <div className={styles.signalIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={s.icon} />
                    </svg>
                  </div>
                  <p className={styles.signalName}>{s.name}</p>
                  <p className={styles.signalDesc}>{s.desc}</p>
                  <div className={styles.signalProgress}>
                    <div className={styles.signalProgressBar}>
                      <div className={styles.signalProgressFill} style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className={styles.signalPct}>{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ========== BLOCK 5 — SEGMENTS ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>פילוח לקוחות</h2>
            <p className={styles.sectionSub}>נגזר אוטומטית מ-Zero-Party Data שנאסף בשיחה</p>
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.segmentGrid}>
            {data.segments.map(s => (
              <div key={s.label} className={styles.segmentCard}>
                <div className={styles.segmentEmoji}>{s.emoji}</div>
                <p className={styles.segmentLabel}>{s.label}</p>
                <div className={styles.segmentValue}>{s.value}</div>
                <div className={styles.segmentDelta}>{s.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== ROW: BLOCK 6 + BLOCK 7 ========== */}
      <div className={styles.row2}>
        <section>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>טרנד שיעור השלמה</h2>
              <p className={styles.sectionSub}>אחוז ההשלמה לאורך הטווח שנבחר</p>
            </div>
          </div>
          <div className={styles.card}>
            <svg viewBox={`0 0 ${lineW} ${lineH}`} className={styles.lineChart}>
              <defs>
                <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#F948C6" stopOpacity="0.30" />
                  <stop offset="100%" stopColor="#9D1687" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#680662" />
                  <stop offset="100%" stopColor="#F948C6" />
                </linearGradient>
              </defs>

              {[0, 25, 50, 75, 100].map(g => {
                const y = 30 + (1 - g / 100) * (lineH - 60);
                return (
                  <g key={g}>
                    <line x1="40" x2={lineW - 40} y1={y} y2={y} stroke="#F3EFF0" strokeWidth="1" />
                    <text x="30" y={y + 4} fontSize="11" fill="#57534E" textAnchor="end" fontFamily="DM Sans, Heebo, Arial">
                      {g}%
                    </text>
                  </g>
                );
              })}

              <path d={area} fill="url(#areaGrad)" />
              <path d={line} stroke="url(#lineGrad)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />

              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="5" fill="#ffffff" stroke="#9D1687" strokeWidth="2.5" />
                  <text x={p.x} y={lineH - 10} fontSize="12" fill="#57534E" textAnchor="middle" fontFamily="DM Sans, Heebo, Arial">
                    {data.weekDays[i]}
                  </text>
                  <text x={p.x} y={p.y - 14} fontSize="11" fill="#680662" textAnchor="middle" fontFamily="DM Sans, Heebo, Arial" fontWeight="500">
                    {data.weekValues[i]}%
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </section>

        <section>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>עניין במוצרים</h2>
              <p className={styles.sectionSub}>אחוז השיחות בהן עלה כל מוצר</p>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.productList}>
              {data.products.map(p => (
                <div key={p.label} className={styles.productRow}>
                  <div className={styles.productLabel}>{p.label}</div>
                  <div className={styles.productBarWrap}>
                    <div
                      className={styles.productBar}
                      style={{
                        width: `${p.pct}%`,
                        background: `linear-gradient(90deg, ${p.color}, #F948C6)`,
                      }}
                    />
                  </div>
                  <div className={styles.productPct}>{p.pct}%</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ========== BLOCK 8 — INSIGHTS ========== */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>תובנות שנוצרו</h2>
            <p className={styles.sectionSub}>מופקות אוטומטית ע״י ה-AI על בסיס ניתוח מגמות</p>
          </div>
        </div>
        <div className={styles.insightGrid}>
          {data.insights.map(ins => (
            <div key={ins.tag} className={styles.insightCard}>
              <span className={`${styles.insightTag} ${styles[ins.tagClass]}`}>{ins.tag}</span>
              <p className={styles.insightDesc}>{ins.desc}</p>
              <div className={styles.insightAction}>
                {ins.action}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 5l-7 7 7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.footer}>
        מקור: LYBI Conversation Engine · רענון KPI כל 15 דקות · גרפים כל שעה · תובנות בחישוב לילי (00:00) · ניתוח NLP על כל שיחה לאחר סגירתה
      </div>

      {/* ========== MODAL — topic bubble examples ========== */}
      {openTopic && (
        <div className={styles.modalBackdrop} onClick={() => setOpenTopic(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>{openTopic}</h3>
                <p className={styles.modalSub}>
                  {data.bubbles.find(b => b.name === openTopic)?.count ?? 0} אזכורים בשיחות · דוגמאות אנונימיות
                </p>
              </div>
              <button className={styles.modalClose} onClick={() => setOpenTopic(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {(TOPIC_EXAMPLES[openTopic] ?? []).length === 0 && (
                <p style={{ fontSize: 13, color: '#57534E', textAlign: 'center', padding: '20px 0' }}>
                  אין דוגמאות זמינות לנושא זה.
                </p>
              )}
              {(TOPIC_EXAMPLES[openTopic] ?? []).map((ex, i) => (
                <div key={i} className={styles.exampleCard}>
                  <div className={styles.exampleMeta}>
                    <span><strong>מזהה:</strong> {ex.meta}</span>
                    <span><strong>פרופיל:</strong> {ex.segment}</span>
                  </div>
                  <p className={styles.exampleQuote}>{ex.quote}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL — anonymized examples ========== */}
      {openSlice && (
        <div className={styles.modalBackdrop} onClick={() => setOpenExample(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>{openSlice.label}</h3>
                <p className={styles.modalSub}>
                  {openSlice.value}% מסיבות הנטישה · דוגמאות שיחה אנונימיות
                </p>
              </div>
              <button className={styles.modalClose} onClick={() => setOpenExample(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              {examples.length === 0 && (
                <p style={{ fontSize: 13, color: '#57534E', textAlign: 'center', padding: '20px 0' }}>
                  אין דוגמאות זמינות לקטגוריה זו.
                </p>
              )}
              {examples.map((ex, i) => (
                <div key={i} className={styles.exampleCard}>
                  <div className={styles.exampleMeta}>
                    <span><strong>מזהה:</strong> {ex.meta}</span>
                    <span><strong>פרופיל:</strong> {ex.segment}</span>
                  </div>
                  <p className={styles.exampleQuote}>{ex.quote}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
