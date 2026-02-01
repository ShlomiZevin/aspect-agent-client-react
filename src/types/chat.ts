export interface PostExtractionContext {
  extractedFields: Record<string, string>;
  allCollectedFields: Record<string, string>;
  remainingFields: string[];
}

export interface DebugPromptData {
  crewName: string;
  crewDisplayName: string;
  fullInstructions: string;
  model: string;
  maxTokens: number;
  tools: Record<string, unknown>[];
  knowledgeBase: { enabled: boolean; storeId: string | null } | null;
  processedMessage: string;
  postExtractionContext?: PostExtractionContext;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinkingSteps?: ThinkingStep[];
  crewMember?: string;
  debugData?: DebugPromptData;
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
  | { type: 'UPDATE_DEBUG_CONTEXT'; payload: PostExtractionContext };
