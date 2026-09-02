import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

/**
 * הסופר החברתי — The Social Supermarket.
 *
 * The Histadrut's members-only online grocery (super-hist.co.il). An order
 * business, not a shop: the quick questions below are about orders, members and
 * subsidy, and deliberately include none about stores, categories or margin —
 * the data holds no store dimension, no usable product category and no cost
 * side, and a quick question that cannot be answered is worse than one fewer.
 */
export const superhistConfig: AgentConfig = {
  agentName: 'SuperHist',
  displayName: 'The Social Supermarket Intelligence',
  storagePrefix: 'superhist_',
  baseURL: BASE_URL,

  pageTitle: 'הסופר החברתי - Business Intelligence',
  favicon: '/img/superhist-logo.png',
  metaDescription: 'AI-powered business intelligence for The Social Supermarket — orders, products, members and subsidy.',

  logo: {
    src: '/img/superhist-logo.png',
    alt: 'The Social Supermarket Logo',
  },
  headerTitle: 'הסופר החברתי',
  headerSubtitle: 'AI-powered business intelligence',
  welcomeIcon: '/img/superhist-logo.png',
  welcomeTitle: 'Welcome to The Social Supermarket BI',
  welcomeMessage: 'Ask me about orders, products, members and subsidy.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '💰', textKey: 'quick.superhist.revenue.text',    questionKey: 'quick.superhist.revenue.question' },
    { icon: '📦', textKey: 'quick.superhist.orders.text',     questionKey: 'quick.superhist.orders.question' },
    { icon: '🏆', textKey: 'quick.superhist.topItems.text',   questionKey: 'quick.superhist.topItems.question' },
    { icon: '🤝', textKey: 'quick.superhist.subsidy.text',    questionKey: 'quick.superhist.subsidy.question' },
    { icon: '👥', textKey: 'quick.superhist.repeat.text',     questionKey: 'quick.superhist.repeat.question' },
    { icon: '🧺', textKey: 'quick.superhist.basket.text',     questionKey: 'quick.superhist.basket.question' },
    { icon: '📈', textKey: 'quick.superhist.trend.text',      questionKey: 'quick.superhist.trend.question' },
    { icon: '💳', textKey: 'quick.superhist.payment.text',    questionKey: 'quick.superhist.payment.question' },
    { icon: '🚚', textKey: 'quick.superhist.shipping.text',   questionKey: 'quick.superhist.shipping.question' },
    { icon: '🐢', textKey: 'quick.superhist.slow.text',       questionKey: 'quick.superhist.slow.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing Social Supermarket data',
      'Analyzing metrics and trends',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against the orders database',
      'Calculating key metrics',
      'Crafting your report',
    ],
    [
      'Evaluating your request',
      'Gathering order and member data',
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

  themeClass: 'theme-superhist',

  database: {
    schema: 'superhist',
    enableQueryLogging: true,
  },
};
