import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

// Real-estate developer demo — Ofek Development (אופק יזמות) is fictional,
// its data synthetic (server: scripts/seed-realestate-synthetic.js).
export const realestateConfig: AgentConfig = {
  agentName: 'Real Estate',
  displayName: 'Ofek Development Intelligence',
  storagePrefix: 'realestate_',
  baseURL: BASE_URL,

  pageTitle: 'Ofek Development - Sales Intelligence',
  favicon: '/img/realestate-logo.svg',
  metaDescription: 'AI-powered sales intelligence for a residential developer — leads, buyers, apartments, campaigns.',

  logo: {
    src: '/img/realestate-logo.svg',
    alt: 'Ofek Development Logo',
  },
  headerTitle: 'Ofek Development',
  headerSubtitle: 'AI-powered sales intelligence',
  welcomeIcon: '/img/realestate-logo.svg',
  welcomeTitle: 'Welcome to Ofek Development Intelligence',
  welcomeMessage: 'Ask me anything about leads, buyers, apartments, campaigns and your sales team.',
  inputPlaceholder: 'Ask about your projects...',

  quickQuestions: [
    { icon: '📞', textKey: 'quick.realestate.callToday.text', questionKey: 'quick.realestate.callToday.question' },
    { icon: '🏢', textKey: 'quick.realestate.board.text', questionKey: 'quick.realestate.board.question' },
    { icon: '🎯', textKey: 'quick.realestate.sources.text', questionKey: 'quick.realestate.sources.question' },
    { icon: '👥', textKey: 'quick.realestate.buyers.text', questionKey: 'quick.realestate.buyers.question' },
    { icon: '🎁', textKey: 'quick.realestate.benefits.text', questionKey: 'quick.realestate.benefits.question' },
    { icon: '⏳', textKey: 'quick.realestate.stuck.text', questionKey: 'quick.realestate.stuck.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your question',
      'Reading leads and deals',
      'Analyzing the sales funnel',
      'Preparing insights',
    ],
    [
      'Processing your query',
      'Running SQL against the project data',
      'Calculating key metrics',
      'Crafting your answer',
    ],
    [
      'Evaluating your request',
      'Checking apartments and buyers',
      'Formulating a recommendation',
      'Preparing actionable insights',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
    hideQuickQuestionsInUI: true,
  },

  themeClass: 'theme-realestate',

  database: {
    schema: 'realestate',
    enableQueryLogging: true,
  },
};
