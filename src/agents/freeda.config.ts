import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const freedaConfig: AgentConfig = {
  agentName: 'Freeda 2.0',
  displayName: 'Freeda.ai',
  storagePrefix: 'freeda_',
  baseURL: BASE_URL,

  pageTitle: 'Freeda - Your Menopause Companion',
  favicon: '/img/freeda-logo.png',
  metaDescription: 'Supportive AI companion for menopause wellness, symptoms management, and personalized guidance.',

  logo: {
    src: '/img/freeda-logo.png',
    alt: 'Freeda Logo',
  },
  headerTitle: 'Freeda',
  headerSubtitle: 'Your supportive menopause companion',
  welcomeIcon: '🌸',
  welcomeTitle: 'Welcome to Freeda',
  welcomeMessage: "I'm here to support you through your menopause journey with understanding, knowledge, and care.",
  inputPlaceholder: 'Ask about menopause...',

  quickQuestions: [
    { icon: '🌡️', textKey: 'quick.freeda.commonSymptoms.text', questionKey: 'quick.freeda.commonSymptoms.question' },
    { icon: '💨', textKey: 'quick.freeda.hotFlashRelief.text', questionKey: 'quick.freeda.hotFlashRelief.question' },
    { icon: '🥗', textKey: 'quick.freeda.nutritionTips.text', questionKey: 'quick.freeda.nutritionTips.question' },
    { icon: '😴', textKey: 'quick.freeda.betterSleep.text', questionKey: 'quick.freeda.betterSleep.question' },
    { icon: '🧘', textKey: 'quick.freeda.stressRelief.text', questionKey: 'quick.freeda.stressRelief.question' },
    { icon: '💪', textKey: 'quick.freeda.exerciseTips.text', questionKey: 'quick.freeda.exerciseTips.question' },
    { icon: '🧠', textKey: 'quick.freeda.brainFog.text', questionKey: 'quick.freeda.brainFog.question' },
    { icon: '💊', textKey: 'quick.freeda.treatmentOptions.text', questionKey: 'quick.freeda.treatmentOptions.question' },
    { icon: '❤️', textKey: 'quick.freeda.heartHealth.text', questionKey: 'quick.freeda.heartHealth.question' },
    { icon: '🦴', textKey: 'quick.freeda.boneHealth.text', questionKey: 'quick.freeda.boneHealth.question' },
    { icon: '😊', textKey: 'quick.freeda.moodChanges.text', questionKey: 'quick.freeda.moodChanges.question' },
    { icon: '🌙', textKey: 'quick.freeda.nightSweats.text', questionKey: 'quick.freeda.nightSweats.question' },
  ],

  thinkingSteps: [
    [
      'Understanding your question with care',
      'Accessing trusted medical knowledge',
      'Considering your unique needs',
      'Preparing personalized guidance',
      'Ensuring accuracy and empathy',
    ],
    [
      'Analyzing symptom patterns',
      'Reviewing wellness research',
      'Connecting to practical solutions',
      'Crafting supportive advice',
    ],
    [
      'Processing your health query',
      'Consulting evidence-based resources',
      'Tailoring recommendations for you',
      'Preparing helpful insights',
    ],
    [
      'Evaluating your wellness question',
      'Gathering menopause expertise',
      'Formulating compassionate guidance',
      'Ensuring clarity and support',
    ],
  ],

  features: {
    hasLogoUpload: false,
    hasFileUpload: true,
    hasChatHistory: true,
  },

  themeClass: 'theme-freeda',
};
