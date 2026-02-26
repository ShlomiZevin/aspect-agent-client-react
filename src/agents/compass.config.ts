import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const compassConfig: AgentConfig = {
  agentName: 'Compass',
  displayName: 'Compass',
  storagePrefix: 'compass_',
  baseURL: BASE_URL,

  pageTitle: 'Compass — Career Change Navigator',
  favicon: '/img/compass-logo.svg',
  metaDescription: 'AI-powered career change navigator. Get a personalized transition plan based on your skills, gaps, and goals.',

  logo: {
    src: '/img/compass-logo.svg',
    alt: 'Compass Logo',
  },
  headerTitle: 'Compass',
  headerSubtitle: 'Your career change navigator',
  welcomeIcon: '🧭',
  welcomeTitle: 'Welcome to Compass',
  welcomeMessage: "I help people navigate career transitions — with a personalized assessment, a concrete plan, and expert guidance for the journey ahead.",
  inputPlaceholder: 'Tell me about your career change...',

  quickQuestions: [
    { icon: '🔄', text: 'How do I change careers?', question: 'How do I successfully change careers?' },
    { icon: '📄', text: 'Resume tips', question: 'How should I update my resume for a career change?' },
    { icon: '🤝', text: 'Networking', question: 'How do I network into a new industry?' },
    { icon: '📚', text: 'Certifications', question: 'What certifications should I get for my career change?' },
    { icon: '💬', text: 'Interviews', question: 'How do I handle career change interview questions?' },
    { icon: '💰', text: 'Salary', question: 'How does salary change when I switch industries?' },
  ],

  thinkingSteps: [
    [
      'Reviewing your career profile',
      'Searching career resources',
      'Building personalized guidance',
      'Preparing your transition plan',
    ],
    [
      'Analyzing your transferable skills',
      'Checking industry insights',
      'Crafting specific recommendations',
    ],
  ],

  features: {
    hasKnowledgeBase: true,
    kbToggleable: false,
    hasLogoUpload: false,
    hasFileUpload: false,
    hasChatHistory: true,
  },

  themeClass: 'theme-compass',
};
