export interface QuickQuestion {
  icon: string;
  text?: string;
  question?: string;
  textKey?: string;
  questionKey?: string;
}

export interface AgentConfig {
  // Identity
  agentName: string;
  displayName: string;
  storagePrefix: string;

  // Server
  baseURL: string;

  // Page meta
  pageTitle: string;
  favicon: string;
  metaDescription: string;

  // UI
  logo: {
    src: string;
    alt: string;
  };
  headerTitle: string;
  headerSubtitle: string;
  welcomeIcon: string;
  welcomeTitle: string;
  welcomeMessage: string;
  quickQuestions: QuickQuestion[];
  inputPlaceholder: string;

  // Thinking
  thinkingSteps: string[][];

  // Features
  features: {
    hasLogoUpload: boolean;
    hasFileUpload: boolean;
    hasChatHistory: boolean;
    /** Show full crew journey (all upcoming crews) instead of just current + next */
    showFullJourney?: boolean;
  };

  // Theming
  themeClass: string;

  // Database connection (enables Query Optimizer in dashboard)
  database?: {
    schema: string;           // e.g. 'zer4u'
    enableQueryLogging?: boolean;
  };
}
