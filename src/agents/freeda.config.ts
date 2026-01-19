import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const freedaConfig: AgentConfig = {
  agentName: 'Freeda 2.0',
  displayName: 'Freeda.ai',
  storagePrefix: 'freeda_',
  baseURL: BASE_URL,

  logo: {
    src: '/img/freeda-logo.png',
    alt: 'Freeda Logo',
  },
  headerTitle: 'Freeda',
  headerSubtitle: 'Your supportive menopause companion',
  welcomeIcon: '🌸',
  welcomeTitle: 'Welcome to Freeda',
  welcomeMessage: "I'm here to support you through your menopause journey with understanding, knowledge, and care.",
  inputPlaceholder: 'Ask me anything about menopause, wellness, or self-care...',

  quickQuestions: [
    { icon: '🌡️', text: 'Common Symptoms', question: 'What are the common symptoms of menopause?' },
    { icon: '💨', text: 'Hot Flash Relief', question: 'How can I manage hot flashes?' },
    { icon: '🥗', text: 'Nutrition Tips', question: 'What foods should I eat during menopause?' },
    { icon: '😴', text: 'Better Sleep', question: 'How can I improve my sleep?' },
    { icon: '🧘', text: 'Stress Relief', question: 'What are some stress management techniques?' },
    { icon: '💪', text: 'Exercise Tips', question: 'What exercises are best during menopause?' },
    { icon: '🧠', text: 'Brain Fog', question: 'How can I deal with brain fog and memory issues?' },
    { icon: '💊', text: 'Treatment Options', question: 'What treatment options are available for menopause symptoms?' },
    { icon: '❤️', text: 'Heart Health', question: 'How does menopause affect heart health?' },
    { icon: '🦴', text: 'Bone Health', question: 'How can I maintain bone health during menopause?' },
    { icon: '😊', text: 'Mood Changes', question: 'How can I manage mood swings?' },
    { icon: '🌙', text: 'Night Sweats', question: 'How can I reduce night sweats?' },
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
    hasKnowledgeBase: true,
    kbToggleable: true,
    hasLogoUpload: false,
    hasFileUpload: true,
    hasChatHistory: true,
  },

  themeClass: 'theme-freeda',
};
