import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const bankingOnboarderConfig: AgentConfig = {
  agentName: 'Banking Onboarder',
  displayName: 'Banking Onboarder',
  storagePrefix: 'banking_onboarder_',
  baseURL: BASE_URL,

  pageTitle: 'Banking Onboarder - New Customer Onboarding',
  favicon: '/img/banking-logo.svg',
  metaDescription: 'Complete your bank account opening process with our AI-powered onboarding assistant.',

  logo: {
    src: '/img/banking-logo.svg',
    alt: 'Banking Onboarder Logo',
  },
  headerTitle: 'Banking Onboarder',
  headerSubtitle: 'Your Personal Banking Assistant',
  welcomeIcon: '/img/banking-welcome.svg',
  welcomeTitle: 'Welcome to Your Banking Journey',
  welcomeMessage: 'I\'m here to guide you through opening your new bank account. The process is simple, secure, and tailored to your needs.',
  inputPlaceholder: 'Type your response...',

  quickQuestions: [
    { icon: '🏦', text: 'Start Onboarding', question: 'I\'m ready to open a new bank account.' },
    { icon: '📋', text: 'What Do I Need?', question: 'What information do I need to provide?' },
    { icon: '⏱️', text: 'How Long?', question: 'How long does the account opening process take?' },
    { icon: '❓', text: 'Account Types', question: 'What types of accounts can I open?' },
  ],

  thinkingSteps: [
    [
      'Processing your information...',
      'Verifying details...',
      'Preparing next steps...',
      'Updating your profile...',
    ],
    [
      'Reviewing your response...',
      'Checking requirements...',
      'Personalizing guidance...',
      'Continuing onboarding...',
    ],
    [
      'Analyzing your needs...',
      'Validating information...',
      'Preparing recommendations...',
      'Moving forward...',
    ],
  ],

  features: {
    hasKnowledgeBase: false,
    kbToggleable: false,
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
    showFullJourney: true,
  },

  themeClass: 'theme-banking-onboarder',
};
