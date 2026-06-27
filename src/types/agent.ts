export interface QuickQuestion {
  icon: string;
  text?: string;
  question?: string;
  textKey?: string;
  questionKey?: string;
}

export interface AgentTheme {
  id: string;
  name: string;
  logo: string;
  colors: {
    primary: string;
    secondary: string;
  };
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
    /** Show data freshness bar (last sync run + last data date) — requires database.schema */
    showDataStatus?: boolean;
    /** Hide quick-question clicks from the chat UI (still sent to server). For BI agents where the question buttons act as shortcuts rather than user utterances. */
    hideQuickQuestionsInUI?: boolean;
    /** Hide per-message actions (delete / delete-from-here). For agents whose backend has no message deletion. */
    hideMessageActions?: boolean;
    /** Hide conversation delete actions (delete chat / delete all) in the history sidebar. */
    hideHistoryManagement?: boolean;
    /** Hide the debug-mode toggle button in the header (customer-facing surfaces). */
    hideDebugToggle?: boolean;
  };

  // Theming
  themeClass: string;

  // Themes (optional — agents without themes work as before)
  themes?: AgentTheme[];
  defaultTheme?: string;

  // Database connection (enables Query Optimizer in dashboard)
  database?: {
    schema: string;           // e.g. 'zer4u'
    enableQueryLogging?: boolean;
  };

  // Profile panel schema — when set, shows a user profile builder panel alongside the chat
  profileSchema?: import('./profile').ProfileSchema;
}
