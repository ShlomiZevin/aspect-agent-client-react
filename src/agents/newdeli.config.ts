import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const newdeliConfig: AgentConfig = {
  agentName: 'NewDeli',
  displayName: 'New Deli Intelligence',
  storagePrefix: 'newdeli_',
  baseURL: BASE_URL,

  pageTitle: 'New Deli - Business Intelligence',
  favicon: '/img/newdeli-logo.png',
  metaDescription: 'AI-powered business intelligence for New Deli fast-food chain — orders, branches, revenue.',

  logo: {
    src: '/img/newdeli-logo.png',
    alt: 'New Deli Logo',
  },
  headerTitle: 'New Deli',
  headerSubtitle: 'AI-powered business intelligence',
  welcomeIcon: '/img/newdeli-logo.png',
  welcomeTitle: 'Welcome to New Deli BI',
  welcomeMessage: 'Ask me anything about orders, revenue, branches, and performance.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '💰', textKey: 'quick.newdeli.revenue.text',       questionKey: 'quick.newdeli.revenue.question' },
    { icon: '🏪', textKey: 'quick.newdeli.topBranches.text',   questionKey: 'quick.newdeli.topBranches.question' },
    { icon: '📊', textKey: 'quick.newdeli.monthlyTrend.text',  questionKey: 'quick.newdeli.monthlyTrend.question' },
    { icon: '🚀', textKey: 'quick.newdeli.orderTypes.text',    questionKey: 'quick.newdeli.orderTypes.question' },
    { icon: '🕐', textKey: 'quick.newdeli.peakHours.text',     questionKey: 'quick.newdeli.peakHours.question' },
    { icon: '💳', textKey: 'quick.newdeli.payments.text',      questionKey: 'quick.newdeli.payments.question' },
    { icon: '📅', textKey: 'quick.newdeli.weekDays.text',      questionKey: 'quick.newdeli.weekDays.question' },
    { icon: '🍔', textKey: 'quick.newdeli.topItems.text',      questionKey: 'quick.newdeli.topItems.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing New Deli order data',
      'Analyzing metrics and trends',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against New Deli database',
      'Calculating key metrics',
      'Crafting your report',
    ],
    [
      'Evaluating your request',
      'Gathering order and branch data',
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

  themeClass: 'theme-newdeli',

  database: {
    schema: 'newdeli',
    enableQueryLogging: true,
  },
};
