import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FloatingChatWidget } from '../components/common';
import styles from './OneZeroDashboardPage.module.css';

// ─────────────────────────────────────────────────────────────────
// Mock data — 14 ONE ZERO customers with churn signals
// ─────────────────────────────────────────────────────────────────

type Signal = {
  id: string;
  category:
    | 'activity'
    | 'outflow'
    | 'competitor'
    | 'engagement'
    | 'service'
    | 'profile'
    | 'product';
  label: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
};

type Customer = {
  id: string;
  name: string;
  age: number;
  tenureMonths: number;
  aum: number; // ₪
  segment: 'פרימיום' | 'מתקדם' | 'בסיסי' | 'חדש';
  city: string;
  occupation: string;
  churnScore: number; // 0-100
  predictedChurnDays: number;
  monthlyChange: number; // % change in churn score
  signals: Signal[];
  recommendedActions: string[];
  lastLoginDays: number;
  appLogins30d: number;
  appLoginsPrev30d: number;
  balanceTrend: number[]; // last 12 weeks
  outflowRatio: number; // 0-1
};

const CUSTOMERS: Customer[] = [
  {
    id: 'OZ-1042',
    name: 'דנה כהן',
    age: 38,
    tenureMonths: 22,
    aum: 412000,
    segment: 'פרימיום',
    city: 'תל אביב',
    occupation: 'מנהלת מוצר',
    churnScore: 92,
    predictedChurnDays: 18,
    monthlyChange: 31,
    lastLoginDays: 14,
    appLogins30d: 3,
    appLoginsPrev30d: 26,
    balanceTrend: [410, 408, 405, 400, 395, 380, 360, 320, 290, 240, 195, 152],
    outflowRatio: 0.78,
    signals: [
      { id: 's1', category: 'outflow', label: 'העברות גדולות לבית השקעות', severity: 'high', detail: '3 העברות של 80K+ ל-IBI ב-21 הימים האחרונים' },
      { id: 's2', category: 'activity', label: 'נטישת אפליקציה', severity: 'high', detail: '88% ירידה בכניסות לאפליקציה (3 ב-30 יום, היה 26)' },
      { id: 's3', category: 'product', label: 'סגירת פיקדון', severity: 'high', detail: 'פיקדון של 120K נסגר ללא הפקדה חוזרת' },
      { id: 's4', category: 'engagement', label: 'אי-פתיחת קמפיינים', severity: 'medium', detail: '0/8 הודעות שיווקיות נפתחו ב-60 יום' },
    ],
    recommendedActions: [
      'שיחה אישית עם בנקאי בכיר תוך 48 שעות',
      'הצעת ויתור על עמלות לשנה + שדרוג לפרימיום פלוס',
      'הצעת ריבית פיקדון משופרת (4.8% במקום 4.1%)',
    ],
  },
  {
    id: 'OZ-2317',
    name: 'אסף לוי',
    age: 45,
    tenureMonths: 14,
    aum: 287000,
    segment: 'פרימיום',
    city: 'הרצליה',
    occupation: 'יועץ עסקי',
    churnScore: 87,
    predictedChurnDays: 24,
    monthlyChange: 22,
    lastLoginDays: 9,
    appLogins30d: 5,
    appLoginsPrev30d: 31,
    balanceTrend: [290, 288, 285, 280, 270, 260, 250, 240, 230, 220, 210, 195],
    outflowRatio: 0.62,
    signals: [
      { id: 's1', category: 'competitor', label: 'הוראת קבע לבנק לאומי', severity: 'high', detail: 'הוראת קבע חדשה של 4,500 ש"ח לחשבון בלאומי' },
      { id: 's2', category: 'service', label: '4 פניות למוקד', severity: 'high', detail: '4 פניות ב-3 שבועות, 2 על עמלות' },
      { id: 's3', category: 'activity', label: 'הפסקת שימוש בכרטיס', severity: 'medium', detail: 'ירידה של 64% בעסקאות כרטיס אשראי' },
    ],
    recommendedActions: [
      'שיחת שירות יזומה עם מנהל קשרי לקוחות',
      'בדיקת תלונות עמלות והצעת החזר',
      'הצעת מסגרת אשראי משופרת',
    ],
  },
  {
    id: 'OZ-3091',
    name: 'נגה לוי-שמש',
    age: 52,
    tenureMonths: 31,
    aum: 856000,
    segment: 'פרימיום',
    city: 'רעננה',
    occupation: 'רופאה',
    churnScore: 84,
    predictedChurnDays: 28,
    monthlyChange: 18,
    lastLoginDays: 7,
    appLogins30d: 11,
    appLoginsPrev30d: 24,
    balanceTrend: [860, 855, 850, 840, 820, 800, 780, 760, 740, 720, 700, 680],
    outflowRatio: 0.55,
    signals: [
      { id: 's1', category: 'outflow', label: 'משיכת 200K לחשבון חיצוני', severity: 'high', detail: 'העברה למיטב דש 12.04' },
      { id: 's2', category: 'profile', label: 'מעבר דירה', severity: 'medium', detail: 'כתובת חדשה - אזור עם נוכחות חזקה לבנק מתחרה' },
      { id: 's3', category: 'product', label: 'לא חידשה כרטיס פרימיום', severity: 'medium', detail: 'הכרטיס פג ב-31.03 ולא חודש' },
    ],
    recommendedActions: [
      'פגישת VIP עם יועץ השקעות',
      'הצעת חבילת פרימיום משודרגת ללא עלות לשנה',
      'הצעה אישית להוצאת כרטיס פרימיום חדש עם בונוס הצטרפות',
    ],
  },
  {
    id: 'OZ-4211',
    name: 'יואב מזרחי',
    age: 29,
    tenureMonths: 8,
    aum: 32000,
    segment: 'בסיסי',
    city: 'באר שבע',
    occupation: 'מתכנת',
    churnScore: 79,
    predictedChurnDays: 35,
    monthlyChange: 27,
    lastLoginDays: 21,
    appLogins30d: 1,
    appLoginsPrev30d: 18,
    balanceTrend: [35, 34, 33, 32, 30, 28, 26, 22, 18, 14, 10, 8],
    outflowRatio: 0.85,
    signals: [
      { id: 's1', category: 'engagement', label: 'נטישת אפליקציה כמעט מוחלטת', severity: 'high', detail: 'כניסה אחת ב-30 יום' },
      { id: 's2', category: 'outflow', label: 'משיכת רוב היתרה', severity: 'high', detail: '76% מהיתרה נמשכה ב-45 יום' },
      { id: 's3', category: 'competitor', label: 'הנפקת כרטיס Max', severity: 'medium', detail: 'זוהו חיובים מ-Max ההון - כרטיס חיצוני חדש' },
    ],
    recommendedActions: [
      'הודעת WhatsApp אישית',
      'הצעת מסלול ללא עמלות לצעירים',
      'הצעת קאשבק 2% על כרטיס הבנק',
    ],
  },
  {
    id: 'OZ-5567',
    name: 'מיכל פרידמן',
    age: 41,
    tenureMonths: 18,
    aum: 198000,
    segment: 'מתקדם',
    city: 'מודיעין',
    occupation: 'מנהלת שיווק',
    churnScore: 73,
    predictedChurnDays: 42,
    monthlyChange: 14,
    lastLoginDays: 5,
    appLogins30d: 8,
    appLoginsPrev30d: 19,
    balanceTrend: [200, 198, 195, 192, 188, 185, 182, 178, 175, 170, 165, 160],
    outflowRatio: 0.48,
    signals: [
      { id: 's1', category: 'service', label: 'תלונה על שירות', severity: 'high', detail: 'ציון 2/10 בסקר אחרי שיחה עם מוקד' },
      { id: 's2', category: 'activity', label: 'ירידה בפעולות', severity: 'medium', detail: 'ירידה של 42% בהעברות חודשיות' },
    ],
    recommendedActions: [
      'שיחת התנצלות ממנהל שירות',
      'הצעת מענק לקוח חוזר',
    ],
  },
  {
    id: 'OZ-6680',
    name: 'אורי בן-דוד',
    age: 34,
    tenureMonths: 11,
    aum: 78000,
    segment: 'מתקדם',
    city: 'חיפה',
    occupation: 'אדריכל',
    churnScore: 68,
    predictedChurnDays: 51,
    monthlyChange: 11,
    lastLoginDays: 11,
    appLogins30d: 6,
    appLoginsPrev30d: 14,
    balanceTrend: [80, 79, 78, 76, 75, 73, 72, 70, 68, 67, 65, 62],
    outflowRatio: 0.41,
    signals: [
      { id: 's1', category: 'competitor', label: 'הוראת קבע ל-Pepper', severity: 'medium', detail: 'הוראת קבע חודשית של 1,200 ש"ח החלה לפני 6 שבועות' },
      { id: 's2', category: 'engagement', label: 'אי-פתיחת מיילים', severity: 'medium', detail: '0/12 ניוזלטרים נפתחו ב-60 יום' },
    ],
    recommendedActions: [
      'הצעת חיסכון אוטומטי עם בונוס',
      'קמפיין פרסונלי באפליקציה',
    ],
  },
  {
    id: 'OZ-7102',
    name: 'רוית אביטל',
    age: 47,
    tenureMonths: 26,
    aum: 521000,
    segment: 'פרימיום',
    city: 'גבעתיים',
    occupation: 'עו"ד',
    churnScore: 64,
    predictedChurnDays: 58,
    monthlyChange: 9,
    lastLoginDays: 4,
    appLogins30d: 14,
    appLoginsPrev30d: 22,
    balanceTrend: [525, 523, 520, 515, 512, 508, 505, 500, 495, 490, 488, 482],
    outflowRatio: 0.38,
    signals: [
      { id: 's1', category: 'outflow', label: 'העברה חודשית קבועה החוצה', severity: 'medium', detail: '15K לחודש לחשבון בבנק הפועלים' },
      { id: 's2', category: 'product', label: 'ירידה בשימוש בפיקדון', severity: 'low', detail: 'יתרת פיקדון ירדה ב-12%' },
    ],
    recommendedActions: [
      'בדיקת מטרת ההעברה החיצונית',
      'הצעת פיקדון מובנה תחרותי',
    ],
  },
  {
    id: 'OZ-8845',
    name: 'אבי שלום',
    age: 56,
    tenureMonths: 35,
    aum: 1240000,
    segment: 'פרימיום',
    city: 'רמת השרון',
    occupation: 'יזם',
    churnScore: 61,
    predictedChurnDays: 62,
    monthlyChange: 7,
    lastLoginDays: 8,
    appLogins30d: 9,
    appLoginsPrev30d: 13,
    balanceTrend: [1240, 1235, 1232, 1228, 1225, 1220, 1215, 1212, 1208, 1205, 1202, 1198],
    outflowRatio: 0.34,
    signals: [
      { id: 's1', category: 'service', label: 'בירור עמלות', severity: 'medium', detail: '2 פניות בנושא עמלות מט"ח' },
      { id: 's2', category: 'activity', label: 'ירידה קלה בכרטיס', severity: 'low', detail: 'ירידה של 18% בעסקאות' },
    ],
    recommendedActions: [
      'מענה אישי על העמלות + הצעת מודל מותאם',
      'פגישת סיכום שנתית עם בנקאי בכיר',
    ],
  },
  {
    id: 'OZ-9923',
    name: 'תמר רוזן',
    age: 33,
    tenureMonths: 7,
    aum: 54000,
    segment: 'חדש',
    city: 'תל אביב',
    occupation: 'מעצבת',
    churnScore: 58,
    predictedChurnDays: 67,
    monthlyChange: 13,
    lastLoginDays: 6,
    appLogins30d: 7,
    appLoginsPrev30d: 11,
    balanceTrend: [55, 54, 54, 53, 52, 52, 51, 50, 50, 49, 48, 47],
    outflowRatio: 0.29,
    signals: [
      { id: 's1', category: 'engagement', label: 'אי השלמת onboarding', severity: 'medium', detail: 'לא הושלמו 3 שלבי setup' },
      { id: 's2', category: 'activity', label: 'מעט פעילות יחסית', severity: 'low', detail: '11 פעולות בלבד מאז פתיחה' },
    ],
    recommendedActions: [
      'התקשרות לסיוע ב-onboarding',
      'הצעת מבצע "לקוח חדש"',
    ],
  },
  {
    id: 'OZ-1188',
    name: 'יוסי גולן',
    age: 61,
    tenureMonths: 28,
    aum: 645000,
    segment: 'פרימיום',
    city: 'כפר סבא',
    occupation: 'פנסיונר',
    churnScore: 54,
    predictedChurnDays: 75,
    monthlyChange: 6,
    lastLoginDays: 3,
    appLogins30d: 17,
    appLoginsPrev30d: 21,
    balanceTrend: [650, 648, 647, 645, 642, 640, 638, 635, 633, 630, 628, 625],
    outflowRatio: 0.31,
    signals: [
      { id: 's1', category: 'profile', label: 'שינוי בהרגלי הוצאה', severity: 'medium', detail: 'שינוי משמעותי בקטגוריות הוצאה החודש' },
    ],
    recommendedActions: [
      'שיחה אישית - האם יש שינוי בצרכים',
      'הצעת חבילת בנקאות פרטית',
    ],
  },
  {
    id: 'OZ-2244',
    name: 'שרון נחום',
    age: 39,
    tenureMonths: 16,
    aum: 145000,
    segment: 'מתקדם',
    city: 'נתניה',
    occupation: 'מורה',
    churnScore: 47,
    predictedChurnDays: 82,
    monthlyChange: 4,
    lastLoginDays: 5,
    appLogins30d: 12,
    appLoginsPrev30d: 14,
    balanceTrend: [148, 147, 146, 145, 144, 144, 143, 142, 141, 140, 139, 138],
    outflowRatio: 0.27,
    signals: [
      { id: 's1', category: 'service', label: 'ציון 6/10 בסקר', severity: 'low', detail: 'ירידה משביעות רצון של 8/10' },
    ],
    recommendedActions: [
      'מעקב סקר חוזר',
    ],
  },
  {
    id: 'OZ-3356',
    name: 'גיא ויינברג',
    age: 27,
    tenureMonths: 6,
    aum: 18000,
    segment: 'חדש',
    city: 'ירושלים',
    occupation: 'סטודנט',
    churnScore: 43,
    predictedChurnDays: 88,
    monthlyChange: 5,
    lastLoginDays: 9,
    appLogins30d: 8,
    appLoginsPrev30d: 10,
    balanceTrend: [20, 19, 19, 18, 18, 18, 17, 17, 16, 16, 15, 15],
    outflowRatio: 0.22,
    signals: [
      { id: 's1', category: 'activity', label: 'פעילות נמוכה אך יציבה', severity: 'low', detail: 'לקוח חדש - מוקדם להעריך' },
    ],
    recommendedActions: [
      'הצעת מסלול סטודנט',
    ],
  },
  {
    id: 'OZ-4477',
    name: 'אלינור שגב',
    age: 44,
    tenureMonths: 23,
    aum: 312000,
    segment: 'פרימיום',
    city: 'רמת גן',
    occupation: 'מנהלת כספים',
    churnScore: 38,
    predictedChurnDays: 110,
    monthlyChange: -3,
    lastLoginDays: 2,
    appLogins30d: 24,
    appLoginsPrev30d: 22,
    balanceTrend: [310, 311, 312, 312, 313, 312, 313, 312, 312, 311, 312, 312],
    outflowRatio: 0.18,
    signals: [],
    recommendedActions: [
      'אין צורך בפעולה - לקוחה יציבה',
    ],
  },
  {
    id: 'OZ-5589',
    name: 'רונן ארד',
    age: 50,
    tenureMonths: 30,
    aum: 478000,
    segment: 'פרימיום',
    city: 'הוד השרון',
    occupation: 'מנכ"ל',
    churnScore: 22,
    predictedChurnDays: 180,
    monthlyChange: -8,
    lastLoginDays: 1,
    appLogins30d: 31,
    appLoginsPrev30d: 28,
    balanceTrend: [470, 472, 474, 475, 476, 477, 477, 478, 478, 478, 478, 478],
    outflowRatio: 0.14,
    signals: [],
    recommendedActions: [
      'לקוח VIP יציב - שמרו על המגע השנתי',
    ],
  },
];

const SIGNAL_CATEGORY_META = {
  activity: { icon: '📉', label: 'ירידה בפעילות', color: '#f59e0b' },
  outflow: { icon: '💸', label: 'יציאת כספים', color: '#ef4444' },
  competitor: { icon: '🏦', label: 'שימוש במתחרים', color: '#a855f7' },
  engagement: { icon: '📱', label: 'מעורבות דיגיטלית', color: '#3b82f6' },
  service: { icon: '☎️', label: 'חוויית שירות', color: '#ec4899' },
  profile: { icon: '👤', label: 'שינויים בפרופיל', color: '#14b8a6' },
  product: { icon: '💳', label: 'ירידה במוצרים', color: '#f97316' },
};

// ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return '₪' + n.toLocaleString('he-IL');
}

function riskBand(score: number): { label: string; color: string; bg: string } {
  if (score >= 80) return { label: 'קריטי', color: '#fca5a5', bg: '#7f1d1d' };
  if (score >= 65) return { label: 'גבוה', color: '#fdba74', bg: '#7c2d12' };
  if (score >= 45) return { label: 'בינוני', color: '#fde68a', bg: '#78350f' };
  return { label: 'נמוך', color: '#86efac', bg: '#14532d' };
}

function Sparkline({ data, color = '#ef4444' }: { data: number[]; color?: string }) {
  const w = 120;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className={styles.sparkline}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

const THEME_KEY = 'onezero_theme';
const STATE_KEY = 'onezero_dash_state_v1';

// ─── Interactive demo state types ─────────────────────────────────
type CustomerStatus = 'new' | 'monitoring' | 'contacted' | 'offered' | 'saved' | 'lost';

const STATUS_META: Record<CustomerStatus, { label: string; color: string; bg: string; next: CustomerStatus | null }> = {
  new:        { label: 'לא טופל',     color: '#94a3b8', bg: '#1e293b',           next: 'monitoring' },
  monitoring: { label: 'במעקב',       color: '#fde68a', bg: 'rgba(245,158,11,0.18)', next: 'contacted' },
  contacted:  { label: 'יצרנו קשר',   color: '#7dd3fc', bg: 'rgba(56,189,248,0.18)', next: 'offered' },
  offered:    { label: 'הוצעה תוכנית', color: '#c4b5fd', bg: 'rgba(139,92,246,0.18)', next: 'saved' },
  saved:      { label: 'שומר ✔',      color: '#86efac', bg: 'rgba(34,197,94,0.18)',  next: null },
  lost:       { label: 'ננטש ✖',      color: '#fca5a5', bg: 'rgba(239,68,68,0.18)',  next: null },
};

type TimelineEntry = { ts: number; type: 'action' | 'note' | 'status'; text: string };

type DashState = {
  status: Record<string, CustomerStatus>;
  doneActions: Record<string, number[]>; // customerId -> indexes
  notes: Record<string, TimelineEntry[]>;
};

function loadState(): DashState {
  if (typeof window === 'undefined') return { status: {}, doneActions: {}, notes: {} };
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { status: {}, doneActions: {}, notes: {} };
}

function saveState(s: DashState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

function fmtRelTime(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'כעת';
  if (min < 60) return `לפני ${min} ד'`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} שעות`;
  const d = Math.floor(hr / 24);
  return `לפני ${d} ימים`;
}

// ─── Live alert ticker (cycling) ──────────────────────────────────
const TICKER_ALERTS = [
  '🚨 דנה כהן (OZ-1042) - סיכון נטישה עלה ל-92 (+7) - העברה של 80K ל-IBI הבוקר',
  '⚠️ אסף לוי (OZ-2317) - הוראת קבע חדשה לבנק לאומי 4,500 ש"ח/חודש',
  '💸 נגה לוי-שמש (OZ-3091) - משיכת 200K לחשבון מיטב דש',
  '📱 יואב מזרחי (OZ-4211) - 21 ימים ללא כניסה לאפליקציה',
  '☎️ מיכל פרידמן (OZ-5567) - תלונה חדשה במוקד שירות, ציון 2/10',
  '✅ הושלם: שיחת שימור עם יוסי גולן - הצעה התקבלה',
  '🎯 מודל זיהה 3 לקוחות חדשים בסיכון בינוני - דורש מעקב',
];

export function OneZeroDashboardPage() {
  const [selectedId, setSelectedId] = useState<string>(CUSTOMERS[0].id);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
  });
  const setTheme = (t: 'dark' | 'light') => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };

  // ── Interactive demo state ─────────────────────────────────────
  const [search, setSearch] = useState('');
  const [signalCatFilter, setSignalCatFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [dashState, setDashState] = useState<DashState>(loadState);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; tone: 'success' | 'info' | 'warn' }>>([]);
  const [tickerIdx, setTickerIdx] = useState(0);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => { saveState(dashState); }, [dashState]);
  useEffect(() => {
    const i = setInterval(() => setTickerIdx((x) => (x + 1) % TICKER_ALERTS.length), 4500);
    return () => clearInterval(i);
  }, []);

  const pushToast = (text: string, tone: 'success' | 'info' | 'warn' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const getStatus = (id: string): CustomerStatus => dashState.status[id] || 'new';

  const advanceStatus = (id: string) => {
    const cur = getStatus(id);
    const next = STATUS_META[cur].next;
    if (!next) return;
    setDashState((s) => ({
      ...s,
      status: { ...s.status, [id]: next },
      notes: {
        ...s.notes,
        [id]: [{ ts: Date.now(), type: 'status', text: `סטטוס שונה: ${STATUS_META[cur].label} → ${STATUS_META[next].label}` }, ...(s.notes[id] || [])],
      },
    }));
    pushToast(`סטטוס עודכן: ${STATUS_META[next].label}`);
  };

  const setStatusExplicit = (id: string, next: CustomerStatus) => {
    const cur = getStatus(id);
    if (cur === next) return;
    setDashState((s) => ({
      ...s,
      status: { ...s.status, [id]: next },
      notes: {
        ...s.notes,
        [id]: [{ ts: Date.now(), type: 'status', text: `סטטוס שונה: ${STATUS_META[cur].label} → ${STATUS_META[next].label}` }, ...(s.notes[id] || [])],
      },
    }));
    pushToast(`סטטוס: ${STATUS_META[next].label}`);
  };

  const markActionDone = (customerId: string, actionIdx: number, actionText: string) => {
    setDashState((s) => {
      const done = new Set(s.doneActions[customerId] || []);
      if (done.has(actionIdx)) {
        done.delete(actionIdx);
        pushToast('הפעולה בוטלה', 'info');
      } else {
        done.add(actionIdx);
        pushToast(`✓ ${actionText.slice(0, 40)}${actionText.length > 40 ? '...' : ''}`);
      }
      const newDone = { ...s.doneActions, [customerId]: Array.from(done) };
      const newNotes = done.has(actionIdx)
        ? { ...s.notes, [customerId]: [{ ts: Date.now(), type: 'action' as const, text: actionText }, ...(s.notes[customerId] || [])] }
        : s.notes;
      return { ...s, doneActions: newDone, notes: newNotes };
    });
  };

  const addNote = (customerId: string) => {
    const text = noteDraft.trim();
    if (!text) return;
    setDashState((s) => ({
      ...s,
      notes: { ...s.notes, [customerId]: [{ ts: Date.now(), type: 'note', text }, ...(s.notes[customerId] || [])] },
    }));
    setNoteDraft('');
    pushToast('הערה נוספה');
  };

  const resetDemoState = () => {
    if (!confirm('לאפס את כל הסטטוסים, הפעולות וההערות?')) return;
    setDashState({ status: {}, doneActions: {}, notes: {} });
    pushToast('ה-state אופס', 'info');
  };

  const exportCSV = (rows: Customer[]) => {
    const headers = ['id', 'name', 'segment', 'aum', 'churnScore', 'status', 'predictedChurnDays', 'topSignal'];
    const csv = [
      headers.join(','),
      ...rows.map((c) =>
        [
          c.id,
          c.name,
          c.segment,
          c.aum,
          c.churnScore,
          STATUS_META[getStatus(c.id)].label,
          c.predictedChurnDays,
          (c.signals[0]?.label || '').replace(/,/g, ''),
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onezero-churn-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`יוצאו ${rows.length} לקוחות ל-CSV`);
  };

  useEffect(() => {
    document.title = 'ONE ZERO - חיזוי נטישת לקוחות';
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CUSTOMERS.filter((c) => {
      if (filter === 'critical' && c.churnScore < 80) return false;
      if (filter === 'high' && (c.churnScore < 65 || c.churnScore >= 80)) return false;
      if (filter === 'medium' && (c.churnScore < 45 || c.churnScore >= 65)) return false;
      if (segmentFilter !== 'all' && c.segment !== segmentFilter) return false;
      if (statusFilter !== 'all' && getStatus(c.id) !== statusFilter) return false;
      if (signalCatFilter && !c.signals.some((s) => s.category === signalCatFilter)) return false;
      if (q && !(c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.occupation.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => b.churnScore - a.churnScore);
  }, [filter, segmentFilter, statusFilter, signalCatFilter, search, dashState]);

  const selected = CUSTOMERS.find((c) => c.id === selectedId) || CUSTOMERS[0];

  // ── Aggregate KPIs ────────────────────────────────────────────
  const totalCustomers = CUSTOMERS.length;
  const atRisk = CUSTOMERS.filter((c) => c.churnScore >= 65).length;
  const critical = CUSTOMERS.filter((c) => c.churnScore >= 80).length;
  const aumAtRisk = CUSTOMERS.filter((c) => c.churnScore >= 65).reduce((s, c) => s + c.aum, 0);
  const savedThisMonth = 7 + Object.values(dashState.status).filter((s) => s === 'saved').length;
  const savedAum = 1840000 + CUSTOMERS.filter((c) => dashState.status[c.id] === 'saved').reduce((s, c) => s + c.aum, 0);
  const todaysActions = Object.values(dashState.doneActions).reduce((sum, arr) => sum + arr.length, 0);

  // ── Segment breakdown ────────────────────────────────────────
  const segments = ['פרימיום', 'מתקדם', 'בסיסי', 'חדש'] as const;
  const segmentStats = segments.map((seg) => {
    const inSeg = CUSTOMERS.filter((c) => c.segment === seg);
    const avg = inSeg.length ? Math.round(inSeg.reduce((s, c) => s + c.churnScore, 0) / inSeg.length) : 0;
    return { seg, count: inSeg.length, avg, atRisk: inSeg.filter((c) => c.churnScore >= 65).length };
  });

  // ── Signal category aggregation ──────────────────────────────
  const signalCounts: Record<string, number> = {};
  CUSTOMERS.forEach((c) => {
    c.signals.forEach((s) => {
      signalCounts[s.category] = (signalCounts[s.category] || 0) + 1;
    });
  });

  return (
    <div className={`${styles.container} ${theme === 'light' ? styles.light : ''}`}>
      {/* Top nav */}
      <header className={styles.topNav}>
        <div className={styles.brandWrap}>
          <div className={styles.brandLogo}>0</div>
          <div>
            <div className={styles.brandName}>ONE ZERO</div>
            <div className={styles.brandSub}>Churn Intelligence · Powered by Aspect AI</div>
          </div>
        </div>
        <nav className={styles.navLinks}>
          <a className={styles.navActive}>נטישה</a>
          <a onClick={() => pushToast('מודול "סקירה" - בקרוב', 'info')}>סקירה</a>
          <a onClick={() => pushToast('מודול "מוצרים" - בקרוב', 'info')}>מוצרים</a>
          <a onClick={() => pushToast('מודול "קמפיינים" - בקרוב', 'info')}>קמפיינים</a>
          <a onClick={() => pushToast('מודול "דוחות" - בקרוב', 'info')}>דוחות</a>
        </nav>
        <div className={styles.navRight}>
          <button
            className={styles.themeBtn}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="החלף ערכת נושא"
            title="החלף ערכת נושא"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className={styles.userPill}>
            <span className={styles.userAvatar}>ש</span>
            <span>שירה - אנליסטית בכירה</span>
          </div>
        </div>
      </header>

      <div className={styles.pageTitle}>
        <div>
          <h1>חיזוי נטישת לקוחות</h1>
          <p className={styles.subtitle}>
            המודל סורק את כל החשבונות מדי יום ומזהה לקוחות בסיכון לפני שהם עוזבים. עדכון אחרון: היום, 09:24
          </p>
        </div>
        <div className={styles.titleActions}>
          <button className={styles.ghostBtn} onClick={resetDemoState} title="איפוס דמו">↺ איפוס</button>
          <button className={styles.ghostBtn} onClick={() => exportCSV(filtered)}>⬇ ייצוא CSV</button>
          <div className={styles.modelBadge}>
            <span className={styles.modelDot} /> מודל פעיל · גרסה 2.4
          </div>
        </div>
      </div>

      {/* Live alert ticker */}
      <div className={styles.ticker}>
        <span className={styles.tickerLabel}>LIVE</span>
        <div className={styles.tickerContent} key={tickerIdx}>
          {TICKER_ALERTS[tickerIdx]}
        </div>
      </div>

      {/* KPI strip */}
      <section className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>לקוחות פעילים</div>
          <div className={styles.kpiValue}>{totalCustomers.toLocaleString('he-IL')}</div>
          <div className={styles.kpiTrendUp}>+2.1% החודש</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>בסיכון נטישה</div>
          <div className={styles.kpiValue}>{atRisk}</div>
          <div className={styles.kpiTrendDown}>{critical} ברמה קריטית</div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCritical}`}>
          <div className={styles.kpiLabel}>נכסים בסיכון</div>
          <div className={styles.kpiValue}>{fmtCurrency(aumAtRisk)}</div>
          <div className={styles.kpiTrendDown}>חשיפה ב-90 יום</div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiGood}`}>
          <div className={styles.kpiLabel}>שומרו החודש</div>
          <div className={styles.kpiValue}>{savedThisMonth} לקוחות</div>
          <div className={styles.kpiTrendUp}>{fmtCurrency(savedAum)} נכסים</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>פעולות היום</div>
          <div className={styles.kpiValue}>{todaysActions}</div>
          <div className={styles.kpiTrendUp}>על ידי הצוות</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>דיוק המודל</div>
          <div className={styles.kpiValue}>87.4%</div>
          <div className={styles.kpiTrendUp}>+1.8 ל-AUC</div>
        </div>
      </section>

      {/* Signal category quick filter chips */}
      <section className={styles.chipBar}>
        <span className={styles.chipBarLabel}>סנן לפי סיגנל:</span>
        <button
          className={`${styles.chipFilter} ${signalCatFilter === null ? styles.chipFilterActive : ''}`}
          onClick={() => setSignalCatFilter(null)}
        >
          הכל
        </button>
        {Object.entries(SIGNAL_CATEGORY_META).map(([key, meta]) => (
          <button
            key={key}
            className={`${styles.chipFilter} ${signalCatFilter === key ? styles.chipFilterActive : ''}`}
            onClick={() => setSignalCatFilter(signalCatFilter === key ? null : key)}
            style={signalCatFilter === key ? { background: meta.color + '33', color: meta.color, borderColor: meta.color } : undefined}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </section>

      {/* Main grid: list + detail */}
      <section className={styles.mainGrid}>
        {/* Left: customer list */}
        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div className={styles.listHeaderTop}>
              <h2>לקוחות בסיכון <span className={styles.listCount}>({filtered.length})</span></h2>
            </div>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="🔍 חפש לפי שם, מזהה, עיר או עיסוק..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.filters}>
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={styles.select}>
                <option value="all">כל הרמות</option>
                <option value="critical">קריטי בלבד</option>
                <option value="high">סיכון גבוה</option>
                <option value="medium">סיכון בינוני</option>
              </select>
              <select value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)} className={styles.select}>
                <option value="all">כל הפילוחים</option>
                <option value="פרימיום">פרימיום</option>
                <option value="מתקדם">מתקדם</option>
                <option value="בסיסי">בסיסי</option>
                <option value="חדש">חדש</option>
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CustomerStatus | 'all')} className={styles.select}>
                <option value="all">כל הסטטוסים</option>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.listScroll}>
            {filtered.map((c) => {
              const band = riskBand(c.churnScore);
              const isSelected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`${styles.listRow} ${isSelected ? styles.listRowSelected : ''}`}
                >
                  <div className={styles.rowMain}>
                    <div>
                      <div className={styles.rowName}>
                        {c.name}
                        <span
                          className={styles.statusPill}
                          style={{ color: STATUS_META[getStatus(c.id)].color, background: STATUS_META[getStatus(c.id)].bg }}
                        >
                          {STATUS_META[getStatus(c.id)].label}
                        </span>
                      </div>
                      <div className={styles.rowMeta}>
                        {c.id} · {c.segment} · {fmtCurrency(c.aum)}
                      </div>
                    </div>
                    <div className={styles.rowScoreWrap}>
                      <div className={styles.rowScore} style={{ color: band.color, background: band.bg }}>
                        {c.churnScore}
                      </div>
                      <div className={styles.rowBand}>{band.label}</div>
                    </div>
                  </div>
                  <div className={styles.rowSignals}>
                    {c.signals.slice(0, 3).map((s) => (
                      <span key={s.id} className={styles.signalChip} title={s.detail}>
                        {SIGNAL_CATEGORY_META[s.category].icon} {s.label}
                      </span>
                    ))}
                    {c.signals.length === 0 && <span className={styles.noSignal}>אין סיגנלים חריגים</span>}
                  </div>
                  <div className={styles.rowFooter}>
                    <span>צפי נטישה: {c.predictedChurnDays} יום</span>
                    <span className={c.monthlyChange > 0 ? styles.upBad : styles.downGood}>
                      {c.monthlyChange > 0 ? '↑' : '↓'} {Math.abs(c.monthlyChange)}% החודש
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <div className={styles.detailName}>{selected.name}</div>
              <div className={styles.detailMeta}>
                {selected.id} · {selected.age} · {selected.occupation} · {selected.city}
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusRowLabel}>סטטוס:</span>
                {(Object.keys(STATUS_META) as CustomerStatus[]).map((st) => {
                  const active = getStatus(selected.id) === st;
                  return (
                    <button
                      key={st}
                      className={`${styles.statusOpt} ${active ? styles.statusOptActive : ''}`}
                      style={active ? { color: STATUS_META[st].color, background: STATUS_META[st].bg, borderColor: STATUS_META[st].color } : undefined}
                      onClick={() => setStatusExplicit(selected.id, st)}
                    >
                      {STATUS_META[st].label}
                    </button>
                  );
                })}
                {STATUS_META[getStatus(selected.id)].next && (
                  <button className={styles.advanceBtn} onClick={() => advanceStatus(selected.id)}>
                    קדם →
                  </button>
                )}
              </div>
            </div>
            <div className={styles.detailScoreBlock}>
              <div className={styles.detailScoreRing} style={{ background: `conic-gradient(${riskBand(selected.churnScore).color} ${selected.churnScore * 3.6}deg, #1e293b 0)` }}>
                <div className={styles.detailScoreInner}>
                  <div className={styles.detailScoreNum}>{selected.churnScore}</div>
                  <div className={styles.detailScoreLbl}>נטישה</div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.detailStats}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>נכסים מנוהלים</div>
              <div className={styles.statValue}>{fmtCurrency(selected.aum)}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>ותק</div>
              <div className={styles.statValue}>{selected.tenureMonths} חודשים</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>פילוח</div>
              <div className={styles.statValue}>{selected.segment}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>צפי נטישה</div>
              <div className={styles.statValue}>{selected.predictedChurnDays} יום</div>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>מגמת יתרה (12 שבועות אחרונים)</h3>
            <div className={styles.bigChart}>
              <Sparkline data={selected.balanceTrend} color={selected.churnScore >= 65 ? '#ef4444' : '#10b981'} />
              <div className={styles.bigChartStats}>
                <span>שבוע 1: {fmtCurrency(selected.balanceTrend[0] * 1000)}</span>
                <span>שבוע 12: {fmtCurrency(selected.balanceTrend[selected.balanceTrend.length - 1] * 1000)}</span>
                <span className={styles.upBad}>
                  Δ {Math.round(((selected.balanceTrend[selected.balanceTrend.length - 1] - selected.balanceTrend[0]) / selected.balanceTrend[0]) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>סיגנלים מזוהים ({selected.signals.length})</h3>
            <div className={styles.signalsList}>
              {selected.signals.map((s) => {
                const meta = SIGNAL_CATEGORY_META[s.category];
                return (
                  <div key={s.id} className={`${styles.signalCard} ${styles[`sev_${s.severity}`]}`}>
                    <div className={styles.signalHead}>
                      <span className={styles.signalIcon} style={{ background: meta.color + '22', color: meta.color }}>
                        {meta.icon}
                      </span>
                      <div>
                        <div className={styles.signalLbl}>{s.label}</div>
                        <div className={styles.signalCat}>{meta.label}</div>
                      </div>
                      <span className={styles.signalSev}>{s.severity === 'high' ? 'חמור' : s.severity === 'medium' ? 'בינוני' : 'קל'}</span>
                    </div>
                    <div className={styles.signalDetail}>{s.detail}</div>
                  </div>
                );
              })}
              {selected.signals.length === 0 && <div className={styles.emptyState}>אין סיגנלים חריגים — לקוח/ה יציב/ה</div>}
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>פעולות שימור מומלצות</h3>
            <div className={styles.actionsList}>
              {selected.recommendedActions.map((a, i) => {
                const done = (dashState.doneActions[selected.id] || []).includes(i);
                return (
                  <div key={i} className={`${styles.actionCard} ${done ? styles.actionCardDone : ''}`}>
                    <div className={styles.actionNum}>{done ? '✓' : i + 1}</div>
                    <div className={styles.actionText}>{a}</div>
                    <button
                      className={done ? styles.actionBtnDone : styles.actionBtn}
                      onClick={() => markActionDone(selected.id, i, a)}
                    >
                      {done ? 'בוטל' : 'בצע'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>הערות וטיימליין ({(dashState.notes[selected.id] || []).length})</h3>
            <div className={styles.noteInputRow}>
              <input
                className={styles.noteInput}
                placeholder="הוסף הערה ללקוח/ה (Enter לשליחה)..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNote(selected.id)}
              />
              <button className={styles.actionBtn} onClick={() => addNote(selected.id)}>הוסף</button>
            </div>
            <div className={styles.timeline}>
              {(dashState.notes[selected.id] || []).length === 0 && (
                <div className={styles.emptyState}>אין רשומות עדיין — פעולות, שינויי סטטוס והערות יופיעו כאן</div>
              )}
              {(dashState.notes[selected.id] || []).map((n, i) => (
                <div key={i} className={styles.timelineRow}>
                  <span className={styles.timelineIcon}>
                    {n.type === 'action' ? '✓' : n.type === 'status' ? '🔄' : '📝'}
                  </span>
                  <div className={styles.timelineBody}>
                    <div className={styles.timelineText}>{n.text}</div>
                    <div className={styles.timelineTime}>{fmtRelTime(n.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.detailSection}>
            <h3>מדדי מעורבות דיגיטלית</h3>
            <div className={styles.engagementGrid}>
              <div className={styles.engBox}>
                <div className={styles.engLabel}>כניסות לאפליקציה (30 יום)</div>
                <div className={styles.engValue}>{selected.appLogins30d}</div>
                <div className={styles.engPrev}>היה: {selected.appLoginsPrev30d}</div>
              </div>
              <div className={styles.engBox}>
                <div className={styles.engLabel}>ימים מהכניסה האחרונה</div>
                <div className={styles.engValue}>{selected.lastLoginDays}</div>
              </div>
              <div className={styles.engBox}>
                <div className={styles.engLabel}>יחס יציאות</div>
                <div className={styles.engValue}>{Math.round(selected.outflowRatio * 100)}%</div>
                <div className={styles.engPrev}>מסך תנועות הכסף</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom analytics */}
      <section className={styles.bottomGrid}>
        <div className={styles.analyticsCard}>
          <h3>פילוח סיכון לפי סגמנט</h3>
          <div className={styles.segmentList}>
            {segmentStats.map((s) => (
              <div key={s.seg} className={styles.segmentRow}>
                <div className={styles.segmentName}>{s.seg}</div>
                <div className={styles.segmentBar}>
                  <div
                    className={styles.segmentBarFill}
                    style={{ width: `${s.avg}%`, background: s.avg >= 65 ? '#ef4444' : s.avg >= 45 ? '#f59e0b' : '#10b981' }}
                  />
                </div>
                <div className={styles.segmentStat}>{s.avg} ממוצע</div>
                <div className={styles.segmentCount}>{s.atRisk}/{s.count} בסיכון</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.analyticsCard}>
          <h3>סיגנלים נפוצים</h3>
          <div className={styles.signalCategoryList}>
            {Object.entries(signalCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, count]) => {
                const meta = SIGNAL_CATEGORY_META[cat as keyof typeof SIGNAL_CATEGORY_META];
                return (
                  <div key={cat} className={styles.signalCategoryRow}>
                    <span className={styles.signalCatIcon} style={{ background: meta.color + '22', color: meta.color }}>
                      {meta.icon}
                    </span>
                    <span className={styles.signalCatLbl}>{meta.label}</span>
                    <span className={styles.signalCatCount}>{count} לקוחות</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className={styles.analyticsCard}>
          <h3>פעולות שננקטו השבוע</h3>
          <div className={styles.actionLog}>
            <div className={styles.logRow}>
              <span className={styles.logIcon}>📞</span>
              <div className={styles.logText}>שיחה אישית - דנה כהן</div>
              <span className={styles.logTime}>היום, 11:30</span>
            </div>
            <div className={styles.logRow}>
              <span className={styles.logIcon}>💌</span>
              <div className={styles.logText}>הצעה אישית - אסף לוי</div>
              <span className={styles.logTime}>אתמול</span>
            </div>
            <div className={styles.logRow}>
              <span className={styles.logIcon}>🎁</span>
              <div className={styles.logText}>שדרוג חבילה - נגה לוי-שמש</div>
              <span className={styles.logTime}>אתמול</span>
            </div>
            <div className={styles.logRow}>
              <span className={styles.logIcon}>💰</span>
              <div className={styles.logText}>החזר עמלות - יוסי גולן</div>
              <span className={styles.logTime}>2 ימים</span>
            </div>
            <div className={styles.logRow}>
              <span className={styles.logIcon}>📞</span>
              <div className={styles.logText}>שיחת התנצלות - מיכל פרידמן</div>
              <span className={styles.logTime}>3 ימים</span>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>ONE ZERO Bank · Demo Environment · Powered by</span>
        <Link to="/aspect/ai" className={styles.footerLink}>Aspect AI Platform</Link>
      </footer>

      {/* Toasts */}
      <div className={styles.toastStack}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[`toast_${t.tone}`]}`}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Embedded chat */}
      <FloatingChatWidget
        iframeSrc="/onezero?embed=true"
        title="ONE ZERO Churn AI"
        accentColor="#3b82f6"
        buttonText="שאל את ה-AI"
        buttonIcon="🤖"
        position="bottom-left"
        width={460}
      />
    </div>
  );
}
