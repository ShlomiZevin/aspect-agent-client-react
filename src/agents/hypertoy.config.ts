import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const hypertoyConfig: AgentConfig = {
  agentName: 'HyperToy',
  displayName: 'Hyper Toy Intelligence',
  storagePrefix: 'hypertoy_',
  baseURL: BASE_URL,

  pageTitle: 'Hyper Toy - Business Intelligence',
  favicon: '/img/hypertoy-logo.svg',
  metaDescription: 'AI-powered business intelligence for Hyper Toy toy retail chain — sales, profit, inventory, customers.',

  logo: {
    src: '/img/hypertoy-logo.svg',
    alt: 'Hyper Toy Logo',
  },
  headerTitle: 'Hyper Toy',
  headerSubtitle: 'AI-powered business intelligence',
  welcomeIcon: '/img/hypertoy-logo.svg',
  welcomeTitle: 'Welcome to Hyper Toy BI',
  welcomeMessage: 'Ask me about sales, profit, products, stores, and inventory.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '💰', textKey: 'quick.hypertoy.revenue.text',      questionKey: 'quick.hypertoy.revenue.question' },
    { icon: '🏆', textKey: 'quick.hypertoy.topProducts.text',  questionKey: 'quick.hypertoy.topProducts.question' },
    { icon: '🏪', textKey: 'quick.hypertoy.topStores.text',    questionKey: 'quick.hypertoy.topStores.question' },
    { icon: '📊', textKey: 'quick.hypertoy.margin.text',       questionKey: 'quick.hypertoy.margin.question' },
    { icon: '🎯', questionKey: 'quick.hypertoy.targets.question', textKey: 'quick.hypertoy.targets.text' },
    { icon: '👤', textKey: 'quick.hypertoy.cashiers.text',     questionKey: 'quick.hypertoy.cashiers.question' },
    { icon: '📦', textKey: 'quick.hypertoy.inventory.text',    questionKey: 'quick.hypertoy.inventory.question' },
    { icon: '🤝', textKey: 'quick.hypertoy.crossBrand.text',   questionKey: 'quick.hypertoy.crossBrand.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing Hyper Toy sales data',
      'Analyzing metrics and trends',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against Hyper Toy database',
      'Calculating key metrics',
      'Crafting your report',
    ],
    [
      'Evaluating your request',
      'Gathering sales and product data',
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

  themeClass: 'theme-hypertoy',

  database: {
    schema: 'hypertoy',
    enableQueryLogging: true,
  },
};
