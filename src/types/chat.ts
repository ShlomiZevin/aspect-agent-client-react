export interface PostExtractionContext {
  extractedFields: Record<string, string>;
  allCollectedFields: Record<string, string>;
  remainingFields: string[];
}

// Structured transition rule evaluation result (when transitionRules are defined)
export interface TransitionRuleEval {
  id: string;
  description: string;
  fields: string[];
  passed: boolean;
  result: {
    action: 'transition' | 'stay' | 'block';
    target?: string;
  };
}

// Transition logic debug data (from SSE debug_prompt events - includes runtime evaluation)
export interface TransitionLogicData {
  transitionTo: string | null;
  oneShot: boolean;
  hasPreTransfer: boolean;
  hasPostTransfer: boolean;
  hasStructuredRules: boolean;
  // Structured rules evaluation (if transitionRules defined)
  evaluatedRules: {
    pre: TransitionRuleEval[];
    post: TransitionRuleEval[];
  } | null;
  // Raw function code fallback (if no transitionRules)
  rawCode: {
    pre: string | null;
    post: string | null;
  } | null;
  collectedFields: Record<string, string>;
}

// Transition rule definition (static, from API - no runtime evaluation)
export interface TransitionRuleDefinition {
  id: string;
  description: string;
  fields: string[];
  result: {
    action: 'transition' | 'stay' | 'block';
    target?: string;
  };
  priority: number;
}

// Transition logic from API (static crew configuration, not runtime evaluation)
export interface TransitionLogicConfig {
  transitionTo: string | null;
  oneShot: boolean;
  hasPreTransfer: boolean;
  hasPostTransfer: boolean;
  hasStructuredRules: boolean;
  // Rule definitions (if transitionRules defined)
  ruleDefinitions: {
    pre: TransitionRuleDefinition[];
    post: TransitionRuleDefinition[];
  } | null;
  // Raw function code fallback (if no transitionRules)
  rawCode: {
    pre: string | null;
    post: string | null;
  } | null;
}

export interface DebugPromptData {
  crewName: string;
  crewDisplayName: string;
  fullInstructions: string;
  promptSource?: string; // 'code', 'database', or 'session_override'
  model: string;
  modelSource?: string; // 'crew_default' or 'session_override'
  defaultModel?: string; // Original hardcoded model for comparison
  fallbackModel?: string; // Configured fallback model
  fallbackModelSource?: string; // 'crew_default' or 'session_override'
  // Populated after response completes (from model_used event)
  modelUsed?: string; // Model that actually generated the response
  fallbackUsed?: boolean; // true when fallback model was used
  maxTokens: number;
  tools: Record<string, unknown>[];
  knowledgeBase: { enabled: boolean; storeId: string | null } | null;
  processedMessage: string;
  postExtractionContext?: PostExtractionContext;
  persona?: string | null;
  personaSource?: string; // 'code', 'session_override', or 'none'
  transitionSystemPrompt?: string;
  transitionPromptInjected?: boolean;
  transitionLogic?: TransitionLogicData | null;
  thinkingAdvice?: Record<string, unknown> | null;
}

export interface Message {
  id: string;
  dbId?: number; // Database ID for feedback linking
  role: 'user' | 'assistant' | 'developer';
  content: string;
  timestamp: Date;
  thinkingSteps?: ThinkingStep[];
  crewMember?: string;
  debugData?: DebugPromptData;
  /** For developer messages: metadata about injection */
  injectionMeta?: {
    injectedForTesting: boolean;
    crewMemberName?: string;
    injectedAt: string;
  };
}

export interface ThinkingStep {
  stepType: string;
  description: string;
  stepOrder: number;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  title: string;
  messageCount: number;
  channel?: 'web' | 'whatsapp';
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationHistory {
  conversationId: string;
  messageCount: number;
  messages: Message[];
}

export type ChatState = {
  messages: Message[];
  conversationId: string;
  isLoading: boolean;
  isThinking: boolean;
  currentThinkingStep: string;
  thinkingSteps: ThinkingStep[];
  hasStartedChat: boolean;
  error: string | null;
  pendingDebugData?: DebugPromptData | null;
  pendingTransitionCrew?: string | null;
};

export type ChatAction =
  | { type: 'ADD_USER_MESSAGE'; payload: { id: string; content: string } }
  | { type: 'START_THINKING' }
  | { type: 'ADD_THINKING_STEP'; payload: ThinkingStep }
  | { type: 'COMPLETE_THINKING' }
  | { type: 'START_STREAMING'; payload: { id: string; crewMember?: string } }
  | { type: 'APPEND_CHUNK'; payload: string }
  | { type: 'COMPLETE_MESSAGE' }
  | { type: 'LOAD_HISTORY'; payload: { conversationId: string; messages: Message[] } }
  | { type: 'NEW_CHAT'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_DEBUG_DATA'; payload: DebugPromptData }
  | { type: 'UPDATE_DEBUG_CONTEXT'; payload: PostExtractionContext }
  | { type: 'UPDATE_DEBUG_FALLBACK'; payload: { modelUsed: string; fallbackUsed: boolean } }
  | { type: 'SET_MESSAGE_DB_ID'; payload: number }
  | { type: 'SET_USER_MESSAGE_DB_ID'; payload: number }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'DELETE_MESSAGES_FROM'; payload: string }
  | { type: 'ADD_DEVELOPER_MESSAGE'; payload: Message }
  | { type: 'CREW_TRANSITION'; payload: { to: string; displayName?: string } }
  | { type: 'FINALIZE_TRANSITION_THINKING' };
