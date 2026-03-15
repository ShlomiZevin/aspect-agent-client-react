import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const bankingOnboarderV2Config: AgentConfig = {
  agentName: 'Banking Onboarder V2',
  displayName: 'מערכת פתיחת חשבון V2',
  storagePrefix: 'banking_onboarder_v2_',
  baseURL: BASE_URL,

  pageTitle: 'פתיחת חשבון V2 - מודל חשיבה',
  favicon: '/img/banking-logo.svg',
  metaDescription: 'פתיחת חשבון בנק עם עוזר חכם המונע בינה מלאכותית.',

  logo: {
    src: '/img/banking-logo.svg',
    alt: 'לוגו מערכת פתיחת חשבון',
  },
  headerTitle: 'פתיחת חשבון V2',
  headerSubtitle: 'מודל חשיבה',
  welcomeIcon: '/img/banking-welcome.svg',
  welcomeTitle: 'ברוכים הבאים',
  welcomeMessage: 'אני כאן כדי לעזור לך למצוא את החשבון המושלם עבורך.',
  inputPlaceholder: 'הקלד את תשובתך...',

  quickQuestions: [
    { icon: '🏦', textKey: 'quick.banking.startOnboarding.text', questionKey: 'quick.banking.startOnboarding.question' },
    { icon: '📋', textKey: 'quick.banking.whatDoINeed.text', questionKey: 'quick.banking.whatDoINeed.question' },
  ],

  thinkingSteps: [
    [
      'Processing your information...',
      'Analyzing your profile...',
      'Preparing recommendation...',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
    showFullJourney: true,
  },

  themeClass: 'theme-banking-onboarder',
};
