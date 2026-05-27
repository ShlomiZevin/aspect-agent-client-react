import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const aspectConfig: AgentConfig = {
  agentName: 'Aspect',
  displayName: 'Aspect Insight',
  storagePrefix: 'aspect_',
  baseURL: BASE_URL,

  pageTitle: 'Aspect Insight - AI Business Intelligence',
  favicon: '/img/aspect-logo-regular.png',
  metaDescription: 'AI-powered business intelligence assistant for sales, inventory, and business analytics.',

  logo: {
    src: '/img/aspect-logo-regular.png',
    alt: 'Aspect Logo',
  },
  headerTitle: 'Aspect Insight',
  headerSubtitle: 'AI-powered business intelligence at your fingertips',
  welcomeIcon: '💼',
  welcomeTitle: 'Welcome to your Aspect Assistant',
  welcomeMessage: 'Ask me anything about your business metrics, sales data, inventory, and more.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '💰', textKey: 'quick.aspect.salesOverview.text', questionKey: 'quick.aspect.salesOverview.question' },
    { icon: '📈', textKey: 'quick.aspect.topProducts.text', questionKey: 'quick.aspect.topProducts.question' },
    { icon: '🏢', textKey: 'quick.aspect.branchAnalysis.text', questionKey: 'quick.aspect.branchAnalysis.question' },
    { icon: '📦', textKey: 'quick.aspect.inventoryCheck.text', questionKey: 'quick.aspect.inventoryCheck.question' },
    { icon: '⚠️', textKey: 'quick.aspect.inventoryIssues.text', questionKey: 'quick.aspect.inventoryIssues.question' },
    { icon: '👥', textKey: 'quick.aspect.customerChurn.text', questionKey: 'quick.aspect.customerChurn.question' },
    { icon: '🎁', textKey: 'quick.aspect.inventoryPromotions.text', questionKey: 'quick.aspect.inventoryPromotions.question' },
    { icon: '🔔', textKey: 'quick.aspect.urgentReorders.text', questionKey: 'quick.aspect.urgentReorders.question' },
    { icon: '📊', textKey: 'quick.aspect.yoyComparison.text', questionKey: 'quick.aspect.yoyComparison.question' },
    { icon: '⭐', textKey: 'quick.aspect.topCustomers.text', questionKey: 'quick.aspect.topCustomers.question' },
    { icon: '🚚', textKey: 'quick.aspect.transferRecommendations.text', questionKey: 'quick.aspect.transferRecommendations.question' },
    { icon: '🐌', textKey: 'quick.aspect.slowMovers.text', questionKey: 'quick.aspect.slowMovers.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing financial data',
      'Analyzing metrics and trends',
      'Preparing insights',
      'Ensuring accuracy',
    ],
    [
      'Processing your query',
      'Consulting business intelligence',
      'Calculating key metrics',
      'Crafting your report',
    ],
    [
      'Evaluating your request',
      'Gathering sales and inventory data',
      'Formulating recommendations',
      'Preparing actionable insights',
    ],
    [
      'Analyzing business patterns',
      'Reviewing performance data',
      'Connecting to best practices',
      'Building your response',
    ],
  ],

  features: {
    hasLogoUpload: true,
    hasFileUpload: false,
    hasChatHistory: true,
    hideQuickQuestionsInUI: true,
  },

  themeClass: 'theme-aspect',

  database: {
    schema: 'zer4u',
    enableQueryLogging: true,
  },
};
