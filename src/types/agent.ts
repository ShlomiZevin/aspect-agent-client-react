export interface QuickQuestion {
  icon: string;
  text: string;
  question: string;
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
    hasKnowledgeBase: boolean;
    kbToggleable: boolean;
    hasLogoUpload: boolean;
    hasFileUpload: boolean;
    hasChatHistory: boolean;
  };

  // Theming
  themeClass: string;
}
