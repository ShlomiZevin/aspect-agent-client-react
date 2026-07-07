import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const tevanaotConfig: AgentConfig = {
  agentName: 'Teva Naot',
  displayName: 'Teva Naot Intelligence',
  storagePrefix: 'tevanaot_',
  baseURL: BASE_URL,

  pageTitle: 'Teva Naot - C2A',
  favicon: '/img/tevanaot-logo.svg',
  metaDescription: 'AI-powered C2A for Teva Naot footwear retail — sales, products, stores, inventory.',

  logo: {
    src: '/img/tevanaot-logo.svg',
    alt: 'Teva Naot Logo',
  },
  headerTitle: 'Teva Naot',
  headerSubtitle: 'AI-powered C2A',
  welcomeIcon: '/img/tevanaot-logo.svg',
  welcomeTitle: 'Welcome to Teva Naot C2A',
  welcomeMessage: 'Ask me anything about sales, products, stores, and inventory.',
  inputPlaceholder: 'Ask about your business...',

  quickQuestions: [
    { icon: '💰', textKey: 'quick.tevanaot.revenue.text',    questionKey: 'quick.tevanaot.revenue.question' },
    { icon: '👟', textKey: 'quick.tevanaot.topModels.text',  questionKey: 'quick.tevanaot.topModels.question' },
    { icon: '🏪', textKey: 'quick.tevanaot.topStores.text',  questionKey: 'quick.tevanaot.topStores.question' },
    { icon: '📦', textKey: 'quick.tevanaot.inventory.text',  questionKey: 'quick.tevanaot.inventory.question' },
    { icon: '📈', textKey: 'quick.tevanaot.monthly.text',    questionKey: 'quick.tevanaot.monthly.question' },
    { icon: '🛒', textKey: 'quick.tevanaot.avgBasket.text',  questionKey: 'quick.tevanaot.avgBasket.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your business question',
      'Accessing Teva Naot data',
      'Analyzing metrics and trends',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against Teva Naot database',
      'Calculating key metrics',
      'Crafting your report',
    ],
    [
      'Evaluating your request',
      'Gathering product and store data',
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

  themeClass: 'theme-tevanaot',

  database: {
    schema: 'tevanaot',
    enableQueryLogging: true,
  },
};
