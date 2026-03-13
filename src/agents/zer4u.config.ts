import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const zer4uConfig: AgentConfig = {
  agentName: 'Zer4U',
  displayName: 'Zer4U Business Intelligence',
  storagePrefix: 'zer4u_',
  baseURL: BASE_URL,

  pageTitle: 'Zer4U - מודיעין עסקי',
  favicon: 'https://www.zakyanut-center.co.il/wp-content/uploads/2019/07/Zer4u_logo_2.png',
  metaDescription: 'מערכת מודיעין עסקי מבוססת בינה מלאכותית לניתוח מכירות, מלאי וביצועים עסקיים.',

  logo: {
    src: 'https://www.zakyanut-center.co.il/wp-content/uploads/2019/07/Zer4u_logo_2.png',
    alt: 'Zer4U Logo',
  },
  headerTitle: 'Zer4U',
  headerSubtitle: 'מודיעין עסקי מבוסס בינה מלאכותית',
  welcomeIcon: '🌿',
  welcomeTitle: 'ברוכים הבאים לסייע העסקי של Zer4U',
  welcomeMessage: 'שאל אותי כל שאלה על מכירות, מלאי, לקוחות וביצועים עסקיים.',
  inputPlaceholder: 'שאל על העסק שלך...',

  quickQuestions: [
    { icon: '💰', textKey: 'quick.zer4u.salesOverview.text', questionKey: 'quick.zer4u.salesOverview.question' },
    { icon: '📈', textKey: 'quick.zer4u.topProducts.text', questionKey: 'quick.zer4u.topProducts.question' },
    { icon: '🏪', textKey: 'quick.zer4u.storePerformance.text', questionKey: 'quick.zer4u.storePerformance.question' },
    { icon: '📦', textKey: 'quick.zer4u.inventoryCheck.text', questionKey: 'quick.zer4u.inventoryCheck.question' },
    { icon: '👥', textKey: 'quick.zer4u.topCustomers.text', questionKey: 'quick.zer4u.topCustomers.question' },
    { icon: '📊', textKey: 'quick.zer4u.yoyComparison.text', questionKey: 'quick.zer4u.yoyComparison.question' },
    { icon: '💡', textKey: 'quick.zer4u.savingsTips.text', questionKey: 'quick.zer4u.savingsTips.question' },
    { icon: '⚠️', textKey: 'quick.zer4u.inventoryIssues.text', questionKey: 'quick.zer4u.inventoryIssues.question' },
    { icon: '🎯', textKey: 'quick.zer4u.targets.text', questionKey: 'quick.zer4u.targets.question' },
    { icon: '🐌', textKey: 'quick.zer4u.slowMovers.text', questionKey: 'quick.zer4u.slowMovers.question' },
  ],

  thinkingSteps: [
    [
      'מבין את השאלה העסקית',
      'ניגש לנתונים העסקיים',
      'מנתח מדדים ומגמות',
      'מכין תובנות',
      'מוודא דיוק',
    ],
    [
      'מעבד את השאילתה',
      'מתייעץ עם מאגר הנתונים',
      'מחשב מדדי מפתח',
      'מנסח את הדוח',
    ],
    [
      'מעריך את הבקשה',
      'אוסף נתוני מכירות ומלאי',
      'מגבש המלצות',
      'מכין תובנות מעשיות',
    ],
    [
      'מנתח דפוסים עסקיים',
      'סוקר נתוני ביצועים',
      'מחבר לשיטות עבודה מומלצות',
      'בונה את התשובה',
    ],
  ],

  features: {
    hasKnowledgeBase: false,
    kbToggleable: false,
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
  },

  themeClass: 'theme-zer4u',

  database: {
    schema: 'zer4u',
    enableQueryLogging: true,
  },
};
