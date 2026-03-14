import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const tiktokConfig: AgentConfig = {
  agentName: 'TikTok Comedy',
  displayName: 'TikTok Comedy',
  storagePrefix: 'tiktok_',
  baseURL: BASE_URL,

  pageTitle: 'TikTok Comedy - שותף יצירתי לקומדיה',
  favicon: '/img/lybi-logo-transparent.png',
  metaDescription: 'שותף יצירתי לסיעור מוחות קומי עבור תוכן טיקטוק - פרודיה, סאטירה, קריקטורה ומצבים מהחיים',

  logo: {
    src: '/img/lybi-logo-transparent.png',
    alt: 'TikTok Comedy',
  },
  headerTitle: 'TikTok Comedy',
  headerSubtitle: 'שותף יצירתי לקומדיה',
  welcomeIcon: '🎬',
  welcomeTitle: 'יאללה, מה נצלם היום?',
  welcomeMessage: 'אני פה לעזור לך לפתח רעיונות לסרטוני טיקטוק מצחיקים - פרודיות, סאטירה, קריקטורות ומצבים מהחיים שכולם מכירים. ספר לי על מצב, טיפוס, או רעיון גולמי ונפתח את זה ביחד.',
  inputPlaceholder: 'ספר לי על רעיון, מצב, או טיפוס...',

  quickQuestions: [
    { icon: '👨‍👩‍👧‍👦', text: 'ארוחת חג משפחתית', question: 'בוא נעשה סרטון על ארוחת חג משפחתית ישראלית טיפוסית - הדוד שתמיד שואל מתי מתחתנים, האמא שמתעקשת שלא אכלת מספיק' },
    { icon: '🏢', text: 'טיפוסים במשרד', question: 'בוא נפתח סדרת סרטונים על טיפוסים במשרד - זה שתמיד גונב אוכל מהמקרר, זאת שמדברת בווליום 100 בטלפון' },
    { icon: '🚗', text: 'נהיגה בישראל', question: 'יש לי רעיון על נהיגה בישראל - כבישי כניסה, חניה כפולה, וייזים שולח אותך בכביש עפר' },
    { icon: '📱', text: 'קבוצת וואטסאפ', question: 'בוא נעשה סרטון על קבוצת הוואטסאפ של הבניין - ההודעות על רעש, מי השאיר את הדלת פתוחה, ותמונות של חתולים' },
  ],

  thinkingSteps: [
    [
      'חושב על הזווית הכי מצחיקה...',
      'מחפש את ההגזמה הנכונה...',
      'בונה את התסריט...',
      'מחדד את הפאנצ\'ליין...',
    ],
    [
      'סוחט את הקומדיה מהמצב...',
      'חושב על הדמויות...',
      'מתזמן את ההומור...',
      'מוסיף את הטוויסט...',
    ],
    [
      'מנתח את הטיפוס...',
      'מגזים בכיוון הנכון...',
      'בונה את ה-hook...',
      'מסיים עם בום...',
    ],
  ],

  features: {
    hasKnowledgeBase: false,
    kbToggleable: false,
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
  },

  themeClass: 'theme-default',
};
