import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const thestockConfig: AgentConfig = {
  agentName: 'TheStock',
  displayName: 'The Stock Intelligence',
  storagePrefix: 'thestock_',
  baseURL: BASE_URL,

  pageTitle: 'The Stock - Business Intelligence',
  favicon: '/img/thestock-logo.svg',
  metaDescription: 'AI-powered business intelligence for The Stock retail chain — customers, payments, products, inventory.',

  logo: {
    src: '/img/thestock-logo.svg',
    alt: 'The Stock Logo',
  },
  headerTitle: 'The Stock',
  headerSubtitle: 'AI-powered business intelligence',
  welcomeIcon: '/img/thestock-logo.svg',
  welcomeTitle: 'Welcome to The Stock BI',
  welcomeMessage: 'Ask me anything about customers, payments, products, and inventory.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '👥', textKey: 'quick.thestock.customers.text',     questionKey: 'quick.thestock.customers.question' },
    { icon: '💳', textKey: 'quick.thestock.payments.text',      questionKey: 'quick.thestock.payments.question' },
    { icon: '🏙️', textKey: 'quick.thestock.cities.text',        questionKey: 'quick.thestock.cities.question' },
    { icon: '🔄', textKey: 'quick.thestock.refunds.text',       questionKey: 'quick.thestock.refunds.question' },
    { icon: '📦', textKey: 'quick.thestock.suppliers.text',     questionKey: 'quick.thestock.suppliers.question' },
    { icon: '🏷️', textKey: 'quick.thestock.families.text',      questionKey: 'quick.thestock.families.question' },
    { icon: '⚠️', textKey: 'quick.thestock.negativeStock.text', questionKey: 'quick.thestock.negativeStock.question' },
    { icon: '🎂', textKey: 'quick.thestock.ages.text',          questionKey: 'quick.thestock.ages.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing The Stock data',
      'Analyzing metrics and trends',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against The Stock database',
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

  themeClass: 'theme-thestock',

  database: {
    schema: 'thestock',
    enableQueryLogging: true,
  },
};
