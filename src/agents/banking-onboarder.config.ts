import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const bankingOnboarderConfig: AgentConfig = {
  agentName: 'Banking Onboarder',
  displayName: 'מערכת פתיחת חשבון',
  storagePrefix: 'banking_onboarder_',
  baseURL: BASE_URL,

  pageTitle: 'מערכת פתיחת חשבון - תהליך קליטת לקוחות חדשים',
  favicon: '/img/banking-logo.svg',
  metaDescription: 'השלימו את תהליך פתיחת חשבון הבנק שלכם עם העוזר החכם שלנו המונע בינה מלאכותית.',

  logo: {
    src: '/img/banking-logo.svg',
    alt: 'לוגו מערכת פתיחת חשבון',
  },
  headerTitle: 'מערכת פתיחת חשבון',
  headerSubtitle: 'העוזר הבנקאי האישי שלך',
  welcomeIcon: '/img/banking-welcome.svg',
  welcomeTitle: 'ברוכים הבאים למסע הבנקאי שלך',
  welcomeMessage: 'אני כאן כדי להדריך אותך בפתיחת חשבון הבנק החדש שלך. התהליך פשוט, מאובטח ומותאם לצרכים שלך.',
  inputPlaceholder: 'הקלד את תשובתך...',

  quickQuestions: [
    { icon: '🏦', textKey: 'quick.banking.startOnboarding.text', questionKey: 'quick.banking.startOnboarding.question' },
    { icon: '📋', textKey: 'quick.banking.whatDoINeed.text', questionKey: 'quick.banking.whatDoINeed.question' },
    { icon: '⏱️', textKey: 'quick.banking.howLong.text', questionKey: 'quick.banking.howLong.question' },
    { icon: '❓', textKey: 'quick.banking.accountTypes.text', questionKey: 'quick.banking.accountTypes.question' },
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
