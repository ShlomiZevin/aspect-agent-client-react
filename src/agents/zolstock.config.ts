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
    { icon: '💰', textKey: 'quick.zolstock.revenue.text',    questionKey: 'quick.zolstock.revenue.question' },
    { icon: '🏆', textKey: 'quick.zolstock.topItems.text',   questionKey: 'quick.zolstock.topItems.question' },
    { icon: '🏪', textKey: 'quick.zolstock.topStores.text',  questionKey: 'quick.zolstock.topStores.question' },
    { icon: '👤', textKey: 'quick.zolstock.topSellers.text', questionKey: 'quick.zolstock.topSellers.question' },
    { icon: '📊', textKey: 'quick.zolstock.margin.text',     questionKey: 'quick.zolstock.margin.question' },
    { icon: '📈', textKey: 'quick.zolstock.monthly.text',    questionKey: 'quick.zolstock.monthly.question' },
    { icon: '📅', textKey: 'quick.zolstock.lastMonth.text',  questionKey: 'quick.zolstock.lastMonth.question' },
    { icon: '⭐', textKey: 'quick.zolstock.topQty.text',     questionKey: 'quick.zolstock.topQty.question' },
    { icon: '🛒', textKey: 'quick.zolstock.purchaseRec.text',   questionKey: 'quick.zolstock.purchaseRec.question' },
    { icon: '🔄', textKey: 'quick.zolstock.transfers.text',     questionKey: 'quick.zolstock.transfers.question' },
    { icon: '📦', textKey: 'quick.zolstock.replenish.text',     questionKey: 'quick.zolstock.replenish.question' },
    { icon: '🚚', textKey: 'quick.zolstock.distribution.text',  questionKey: 'quick.zolstock.distribution.question' },
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
