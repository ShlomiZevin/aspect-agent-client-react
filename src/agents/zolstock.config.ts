import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const zolstockConfig: AgentConfig = {
  agentName: 'ZolStock',
  displayName: 'Zol Stock Intelligence',
  storagePrefix: 'zolstock_',
  baseURL: BASE_URL,

  pageTitle: 'Zol Stock - Business Intelligence',
  favicon: '/img/zolstock-logo.png',
  metaDescription: 'AI-powered business intelligence for Zol Stock discount retail chain — sales, customers, products, inventory.',

  logo: {
    src: '/img/zolstock-logo.png',
    alt: 'Zol Stock Logo',
  },
  headerTitle: 'Zol Stock',
  headerSubtitle: 'AI-powered business intelligence',
  welcomeIcon: '/img/zolstock-logo.png',
  welcomeTitle: 'Welcome to Zol Stock BI',
  welcomeMessage: 'Ask me anything about sales, customers, products, and inventory.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '👥', textKey: 'quick.zolstock.customers.text',     questionKey: 'quick.zolstock.customers.question' },
    { icon: '💳', textKey: 'quick.zolstock.payments.text',      questionKey: 'quick.zolstock.payments.question' },
    { icon: '🏙️', textKey: 'quick.zolstock.cities.text',        questionKey: 'quick.zolstock.cities.question' },
    { icon: '🔄', textKey: 'quick.zolstock.refunds.text',       questionKey: 'quick.zolstock.refunds.question' },
    { icon: '📦', textKey: 'quick.zolstock.suppliers.text',     questionKey: 'quick.zolstock.suppliers.question' },
    { icon: '🏷️', textKey: 'quick.zolstock.families.text',      questionKey: 'quick.zolstock.families.question' },
    { icon: '🏪', textKey: 'quick.zolstock.stores.text',        questionKey: 'quick.zolstock.stores.question' },
    { icon: '🎂', textKey: 'quick.zolstock.ages.text',          questionKey: 'quick.zolstock.ages.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing Zol Stock data',
      'Analyzing metrics and trends',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against Zol Stock database',
      'Calculating key metrics',
      'Crafting your report',
    ],
    [
      'Evaluating your request',
      'Gathering customer and product data',
      'Formulating recommendations',
      'Preparing actionable insights',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
    showDataStatus: true,
    hideQuickQuestionsInUI: true,
  },

  themeClass: 'theme-zolstock',

  database: {
    schema: 'zolstock',
    enableQueryLogging: true,
  },
};
