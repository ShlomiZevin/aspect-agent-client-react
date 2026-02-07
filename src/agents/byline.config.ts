import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const bylineConfig: AgentConfig = {
  agentName: 'Byline',
  displayName: 'Byline Bank RDDA',
  storagePrefix: 'byline_',
  baseURL: BASE_URL,

  pageTitle: 'Byline Bank - Risk Due Diligence Assessment',
  favicon: '/img/byline-logo.png',
  metaDescription: 'Complete your Risk Due Diligence Assessment with Byline Bank\'s AI-powered assistant.',

  logo: {
    src: '/img/byline-logo.png',
    alt: 'Byline Bank Logo',
  },
  headerTitle: 'Byline Bank',
  headerSubtitle: 'Risk Due Diligence Assessment',
  welcomeIcon: '/img/byline-logo.png',
  welcomeTitle: 'Welcome to Byline Bank RDDA',
  welcomeMessage: 'I\'ll guide you through our Risk Due Diligence Assessment process for Third Party Payment Processors.',
  inputPlaceholder: 'Type your response...',

  quickQuestions: [
    { icon: '🏢', text: 'Start Assessment', question: 'I\'m ready to begin the RDDA assessment.' },
    { icon: '📋', text: 'What\'s Required?', question: 'What information and documents will I need for this assessment?' },
    { icon: '⏱️', text: 'How Long?', question: 'How long does the RDDA process typically take?' },
    { icon: '❓', text: 'What is RDDA?', question: 'Can you explain what the RDDA process is and why it\'s required?' },
  ],

  thinkingSteps: [
    [
      'Processing your response...',
      'Validating information...',
      'Updating assessment...',
      'Preparing next questions...',
    ],
    [
      'Reviewing your input...',
      'Recording details...',
      'Checking requirements...',
      'Continuing assessment...',
    ],
    [
      'Analyzing response...',
      'Updating records...',
      'Preparing guidance...',
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

  themeClass: 'theme-byline',
};
