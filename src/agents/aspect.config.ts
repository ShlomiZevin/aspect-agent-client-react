import type { AgentConfig } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export const aspectConfig: AgentConfig = {
  agentName: 'Aspect',
  displayName: 'Aspect Insight',
  storagePrefix: 'aspect_',
  baseURL: BASE_URL,

  logo: {
    src: '/img/aspect-logo-regular.png',
    alt: 'Aspect Logo',
  },
  headerTitle: 'Aspect Insight',
  headerSubtitle: 'AI-powered business intelligence at your fingertips',
  welcomeIcon: '💼',
  welcomeTitle: 'Welcome to your Aspect Assistant',
  welcomeMessage: 'Ask me anything about your business metrics, sales data, inventory, and more.',
  inputPlaceholder: 'Ask about sales, inventory, branches, customers...',

  quickQuestions: [
    { icon: '💰', text: 'Sales Overview', question: 'What are my total sales this month?' },
    { icon: '📈', text: 'Top Products', question: 'Which product is selling the most?' },
    { icon: '🏢', text: 'Branch Analysis', question: 'Show me branch performance' },
    { icon: '📦', text: 'Inventory Check', question: 'Inventory status report' },
    { icon: '⚠️', text: 'Inventory Issues', question: 'Show me inventory problems' },
    { icon: '👥', text: 'Customer Churn Risk', question: 'Which customers are at risk of churning?' },
    { icon: '🎁', text: 'Inventory → Promotions', question: 'Which items with problematic inventory can we offer as promotions to loyalty club members?' },
    { icon: '🔔', text: 'Urgent Reorders', question: 'What products should I reorder urgently?' },
    { icon: '📊', text: 'YoY Comparison', question: 'Compare this month to last year' },
    { icon: '⭐', text: 'Top Customers', question: 'Who are my top customers?' },
    { icon: '🚚', text: 'Transfer Recommendations', question: 'Which products should I move between branches?' },
    { icon: '🐌', text: 'Slow Movers', question: 'Show me slow-moving inventory' },
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
    hasKnowledgeBase: false,
    kbToggleable: false,
    hasLogoUpload: true,
    hasFileUpload: false,
    hasChatHistory: true,
  },

  themeClass: 'theme-aspect',
};
