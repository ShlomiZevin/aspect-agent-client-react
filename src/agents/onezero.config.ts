import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const oneZeroConfig: AgentConfig = {
  agentName: 'OneZero',
  displayName: 'ONE ZERO - יועץ נטישה',
  storagePrefix: 'onezero_',
  baseURL: BASE_URL,

  pageTitle: 'ONE ZERO - חיזוי נטישת לקוחות',
  favicon: '/img/aspect-logo-regular.png',
  metaDescription: 'מערכת AI לחיזוי ומניעת נטישת לקוחות בבנק הדיגיטלי ONE ZERO',

  logo: {
    src: '/img/aspect-logo-regular.png',
    alt: 'ONE ZERO',
  },
  headerTitle: 'ONE ZERO Churn AI',
  headerSubtitle: 'חיזוי נטישה ושימור לקוחות',
  welcomeIcon: '🏦',
  welcomeTitle: 'שלום! אני יועץ הנטישה של ONE ZERO',
  welcomeMessage: 'שאל אותי על לקוחות בסיכון נטישה, סיגנלים מדאיגים, או בקש תסריט שיחת שימור.',
  inputPlaceholder: 'מי הלקוחות הכי בסיכון השבוע?',

  quickQuestions: [
    { icon: '🚨', text: 'מי הכי בסיכון השבוע?', question: 'תן לי את 5 הלקוחות הכי בסיכון נטישה השבוע, עם ניקוד, סיבה עיקרית, והמלצה.' },
    { icon: '📉', text: 'לקוחות שנטשו את האפליקציה', question: 'מי הלקוחות שהפסיקו להיכנס לאפליקציה ב-30 הימים האחרונים? מה הסיכון?' },
    { icon: '💸', text: 'העברות כספים החוצה', question: 'מי הלקוחות שמעבירים סכומים גדולים לבנקים אחרים או לבתי השקעות?' },
    { icon: '📞', text: 'תסריט שיחת שימור', question: 'כתוב לי תסריט שיחת שימור בעברית עבור דנה כהן (OZ-1042) - לקוחה פרימיום בסיכון קריטי.' },
    { icon: '🎯', text: 'הצעות שימור מותאמות', question: 'הצע 3 הצעות שימור ממוקדות לפי פרופיל לקוחות בסיכון גבוה. תן דוגמאות קונקרטיות.' },
    { icon: '📊', text: 'איזה סגמנט הכי מסוכן?', question: 'איזה פילוח לקוחות (פרימיום/מתקדם/בסיסי/חדש) מציג את הסיכון הגבוה ביותר? למה?' },
  ],

  thinkingSteps: [
    [
      'מנתח התנהגות לקוחות',
      'מחשב ניקוד נטישה',
      'מזהה סיגנלים חריגים',
      'מכין המלצות שימור',
    ],
    [
      'סורק נתוני פעילות',
      'מזהה דפוסים חריגים',
      'בונה תובנה',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
  },

  themeClass: 'theme-aspect',
};
