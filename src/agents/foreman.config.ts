import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

/**
 * Foreman — סוכן AI ל-ERP ומאסטר דאטה לקבלני תשתיות בישראל.
 * מפענח הצעות מחיר מספקים, מתאים מק"טי ספקים למק"ט המאסטר, מתמחר כתבי
 * כמויות (BOQ), ועונה על שאלות כלליות בנושא רכש ופיננסי בנייה.
 *
 * Crews (server-side): intake (default) → quote_parser | boq_pricer | general
 */
export const foremanConfig: AgentConfig = {
  agentName: 'Foreman',
  displayName: 'Foreman ERP',
  storagePrefix: 'foreman_',
  baseURL: BASE_URL,

  pageTitle: 'Foreman — סוכן AI ל-ERP בקבלנות תשתיות',
  favicon: '/img/foreman-logo.svg',
  metaDescription: 'סוכן AI חכם ל-ERP ומאסטר דאטה לקבלני תשתיות. מפענח הצעות מחיר מספקים, מתאים מק"טים אוטומטית למאסטר ומתמחר כתבי כמויות.',

  logo: {
    src: '/img/foreman-logo.svg',
    alt: 'Foreman ERP',
  },
  headerTitle: 'Foreman',
  headerSubtitle: 'סוכן AI ל-ERP בקבלנות תשתיות',
  welcomeIcon: '🏗️',
  welcomeTitle: 'ברוכים הבאים ל-Foreman',
  welcomeMessage: 'אני עוזר לפענח הצעות מחיר מספקים, להתאים מק"טים למאסטר ולתמחר כתבי כמויות. ניתן גם לעבוד באנגלית.',
  inputPlaceholder: 'הדבק הצעת מחיר, חפש מק"ט במאסטר, או התחל כתב כמויות…',

  quickQuestions: [
    {
      icon: '📄',
      text: 'פענוח הצעת מחיר',
      question: 'אני רוצה לפענח הצעת מחיר של ספק ולהתאים את המק"טים שלו למאסטר.',
    },
    {
      icon: '🧮',
      text: 'בניית כתב כמויות',
      question: 'אני רוצה לבנות כתב כמויות חדש לפרויקט.',
    },
    {
      icon: '🔎',
      text: 'חיפוש במאסטר',
      question: 'תחפש לי במאסטר את כל פרטי הבטון B30 ו-B40.',
    },
    {
      icon: '💸',
      text: 'תבנית 50/40/10',
      question: 'תסביר לי איך עובדת תבנית 50/40/10 על תשלומים לקבלני משנה בארץ.',
    },
    {
      icon: '📈',
      text: 'הצמדה למדד',
      question: 'איך כדאי לטפל בהצמדה למדד תשומות הבנייה בכתב כמויות פתוח?',
    },
    {
      icon: '🧾',
      text: 'מע"מ בהצעת מחיר',
      question: 'הספק נתן מחיר ש"לא ברור אם כולל מע"מ" — איך אני שואל אותו ומתעד נכון?',
    },
    {
      icon: '🛡️',
      text: 'בדיקת תקינות קבלן משנה',
      question: 'אילו אישורים אני חייב לבקש מקבלן משנה לפני שהוא נכנס לאתר?',
    },
    {
      icon: '🗄️',
      text: 'RLS ב-supplier_quotes',
      question: 'תכתוב לי RLS policy ב-Supabase שמאפשר רק למחלקת רכש לערוך את טבלת supplier_quotes.',
    },
    {
      icon: '⚙️',
      text: 'השוואת 3 הצעות',
      question: 'אני צריך לעשות השוואת 3 הצעות לבטון. מה התהליך הנכון ב-ERP?',
    },
    {
      icon: '📦',
      text: 'היגיינה במאסטר דאטה',
      question: 'איך מטפלים ב-SKU מאסטר שכפולים בלי לשבור הזמנות פתוחות?',
    },
    {
      icon: '💰',
      text: 'חישוב סך כתב כמויות',
      question: 'תחשב לי סך כתב הכמויות הפתוח כולל קונטינגנטיות 7% ומע"מ.',
    },
    {
      icon: '🏦',
      text: 'גובה ערבות בנקאית',
      question: 'איזה גובה ערבות בנקאית מקובל מקבלן משנה בפרויקט תשתית של 30 מ\' ש"ח?',
    },
  ],

  thinkingSteps: [
    [
      'מפענח את טקסט ההצעה…',
      'מחלץ שורות פריטים…',
      'בודק במאסטר קטלוג…',
      'מדרג מועמדים להתאמת מק"ט…',
      'מכין את הסקירה לאישור…',
    ],
    [
      'קורא את הקשר כתב הכמויות…',
      'מחפש במאסטר קטלוג…',
      'מחשב סיכומי שורות…',
      'מחיל מע"מ וקונטינגנטיות…',
      'בונה את הסיכום…',
    ],
    [
      'בוחן את שאלת הרכש…',
      'מצליב עם פרקטיקת קבלנות בארץ…',
      'מאמת מספרים ואחוזים…',
      'כותב תשובה תמציתית…',
    ],
    [
      'טוען הקשר פרויקט…',
      'מצליב מחיר ספק מול מאסטר…',
      'מסמן פריטים שדורשים סקירה אנושית…',
      'מנסח את התגובה…',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: true,    // Quote parser accepts pasted/extracted PDFs
    hasChatHistory: true,
    showFullJourney: true,  // 4 crews — show the whole journey for transparency
  },

  themeClass: 'theme-foreman',
};
