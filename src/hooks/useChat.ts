import { useReducer, useCallback, useEffect } from 'react';
import { streamChat } from '../services/chatService';
import { getConversationHistory, deleteMessage as deleteMessageApi, deleteMessagesFrom as deleteMessagesFromApi, injectDeveloperMessage as injectDeveloperMessageApi } from '../services/conversationService';
import type { Message, ChatState, ChatAction, AgentConfig, ThinkingStep } from '../types';
import type { CrewMember } from '../types/crew';
import type { CrewTransition } from '../services/chatService';

const initialState: ChatState = {
  messages: [],
  conversationId: '',
  isLoading: false,
  isThinking: false,
  currentThinkingStep: '',
  thinkingSteps: [],
  hasStartedChat: false,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_USER_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: action.payload.id,
            role: 'user',
            content: action.payload.content,
            timestamp: new Date(),
          },
        ],
        hasStartedChat: true,
        error: null,
      };

    case 'START_THINKING':
      return {
        ...state,
        isLoading: true,
        isThinking: true,
        currentThinkingStep: '',
        thinkingSteps: [],
      };

    case 'ADD_THINKING_STEP':
      return {
        ...state,
        currentThinkingStep: action.payload.description,
        thinkingSteps: [...state.thinkingSteps, action.payload],
      };

    case 'COMPLETE_THINKING':
      return {
        ...state,
        isThinking: false,
      };

    case 'START_STREAMING':
      return {
        ...state,
        pendingDebugData: null,
        messages: [
          ...state.messages,
          {
            id: action.payload.id,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            thinkingSteps: [...state.thinkingSteps],
            crewMember: action.payload.crewMember,
            debugData: state.pendingDebugData || undefined,
          },
        ],
      };

    case 'APPEND_CHUNK': {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + action.payload,
        };
      }
      return { ...state, messages };
    }

    case 'COMPLETE_MESSAGE':
      return {
        ...state,
        isLoading: false,
        thinkingSteps: [],
      };

    case 'LOAD_HISTORY':
      return {
        ...state,
        conversationId: action.payload.conversationId,
        messages: action.payload.messages,
        hasStartedChat: action.payload.messages.length > 0,
        thinkingSteps: [],
      };

    case 'NEW_CHAT':
      return {
        ...initialState,
        conversationId: action.payload,
        thinkingSteps: [],
      };

    case 'SET_ERROR':
      return {
        ...state,
        isLoading: false,
        isThinking: false,
        error: action.payload,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_DEBUG_DATA':
      return {
        ...state,
        pendingDebugData: action.payload,
      };

    case 'UPDATE_DEBUG_CONTEXT': {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant' && lastMessage.debugData) {
        messages[messages.length - 1] = {
          ...lastMessage,
          debugData: {
            ...lastMessage.debugData,
            postExtractionContext: action.payload,
          },
        };
      }
      return { ...state, messages };
    }

    case 'SET_MESSAGE_DB_ID': {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant') {
        messages[messages.length - 1] = {
          ...lastMessage,
          dbId: action.payload,
        };
      }
      return { ...state, messages };
    }

    case 'SET_USER_MESSAGE_DB_ID': {
      // Find the most recent user message without a dbId and set it
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user' && !messages[i].dbId) {
          messages[i] = { ...messages[i], dbId: action.payload };
          break;
        }
      }
      return { ...state, messages };
    }

    case 'DELETE_MESSAGE': {
      const messages = state.messages.filter(m => m.id !== action.payload);
      return { ...state, messages };
    }

    case 'DELETE_MESSAGES_FROM': {
      const idx = state.messages.findIndex(m => m.id === action.payload);
      if (idx === -1) return state;
      const messages = state.messages.slice(0, idx);
      return { ...state, messages };
    }

    case 'ADD_DEVELOPER_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    default:
      return state;
  }
}

export interface UseChatOptions {
  config: AgentConfig;
  conversationId: string;
  userId: string | null;
  useKnowledgeBase?: boolean;
  overrideCrewMember?: string | null;
  debug?: boolean;
  promptOverrides?: Record<string, string>; // Session overrides: { crewName: prompt }
  onCrewInfo?: (crew: CrewMember) => void;
  onCrewTransition?: (transition: CrewTransition) => void;
}

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  isThinking: boolean;
  currentThinkingStep: string;
  thinkingSteps: ThinkingStep[];
  hasStartedChat: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  loadHistory: (conversationId: string) => Promise<void>;
  newChat: (conversationId: string) => void;
  clearError: () => void;
  deleteMessage: (messageId: string, dbId?: number) => Promise<void>;
  deleteMessagesFrom: (messageId: string, dbId?: number) => Promise<void>;
  /** Inject a developer message (for testing transition prompts) */
  addDeveloperMessage: (content: string, crewMemberName?: string) => Promise<void>;
}

/**
 * Main chat hook - handles messaging, streaming, and thinking indicators
 */
export function useChat(options: UseChatOptions): UseChatReturn {
  const { config, conversationId, userId, useKnowledgeBase = false, overrideCrewMember, debug, promptOverrides, onCrewInfo, onCrewTransition } = options;
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialState,
    conversationId,
  });

  // Update conversationId when it changes externally
  useEffect(() => {
    if (conversationId !== state.conversationId) {
      dispatch({ type: 'NEW_CHAT', payload: conversationId });
    }
  }, [conversationId, state.conversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const messageId = crypto.randomUUID();
      dispatch({ type: 'ADD_USER_MESSAGE', payload: { id: messageId, content: text } });

      // Start thinking - steps will come from server
      dispatch({ type: 'START_THINKING' });

      const botMessageId = crypto.randomUUID();
      let hasStartedStreaming = false;
      let currentCrewDisplayName: string | undefined;

      try {
        await streamChat(
          {
            message: text,
            conversationId: state.conversationId || conversationId,
            agentName: config.agentName,
            userId,
            useKnowledgeBase,
            baseURL: config.baseURL,
            overrideCrewMember,
            debug,
            promptOverrides,
          },
          {
            onThinkingStep: (step) => {
              dispatch({ type: 'ADD_THINKING_STEP', payload: step });
            },
            onThinkingComplete: () => {
              // Server finished thinking - but we'll keep showing until streaming starts
            },
            onChunk: (chunk) => {
              if (!hasStartedStreaming) {
                dispatch({ type: 'COMPLETE_THINKING' });
                dispatch({ type: 'START_STREAMING', payload: { id: botMessageId, crewMember: currentCrewDisplayName } });
                hasStartedStreaming = true;
              }
              dispatch({ type: 'APPEND_CHUNK', payload: chunk });
            },
            onComplete: () => {
              dispatch({ type: 'COMPLETE_THINKING' });
              dispatch({ type: 'COMPLETE_MESSAGE' });
            },
            onError: (error) => {
              dispatch({ type: 'COMPLETE_THINKING' });
              dispatch({ type: 'SET_ERROR', payload: error.message });
            },
            onCrewInfo: (crew) => {
              currentCrewDisplayName = crew.displayName;
              onCrewInfo?.(crew);
            },
            onCrewTransition,
            onDebugData: (data) => {
              dispatch({ type: 'SET_DEBUG_DATA', payload: data });
            },
            onDebugContextUpdate: (data) => {
              dispatch({ type: 'UPDATE_DEBUG_CONTEXT', payload: data });
            },
            onMessageSaved: (messageId) => {
              dispatch({ type: 'SET_MESSAGE_DB_ID', payload: messageId });
            },
            onUserMessageSaved: (messageId) => {
              dispatch({ type: 'SET_USER_MESSAGE_DB_ID', payload: messageId });
            },
          }
        );
      } catch (error) {
        dispatch({ type: 'COMPLETE_THINKING' });
        dispatch({
          type: 'SET_ERROR',
          payload: error instanceof Error ? error.message : 'An error occurred',
        });
      }
    },
    [
      config,
      state.conversationId,
      conversationId,
      userId,
      useKnowledgeBase,
      overrideCrewMember,
      debug,
      promptOverrides,
      onCrewInfo,
      onCrewTransition,
    ]
  );

  const loadHistory = useCallback(
    async (convId: string) => {
      try {
        const history = await getConversationHistory(convId, config.baseURL);
        dispatch({
          type: 'LOAD_HISTORY',
          payload: { conversationId: convId, messages: history.messages },
        });
      } catch (error) {
        console.error('Error loading history:', error);
        dispatch({ type: 'LOAD_HISTORY', payload: { conversationId: convId, messages: [] } });
      }
    },
    [config.baseURL]
  );

  const newChat = useCallback((convId: string) => {
    dispatch({ type: 'NEW_CHAT', payload: convId });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const deleteMessage = useCallback(
    async (messageId: string, dbId?: number) => {
      // Delete from server if we have a database ID
      if (dbId) {
        try {
          await deleteMessageApi(state.conversationId || conversationId, dbId, config.baseURL);
        } catch (error) {
          console.error('Error deleting message from server:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to delete message' });
          return;
        }
      }
      // Remove from local state
      dispatch({ type: 'DELETE_MESSAGE', payload: messageId });
    },
    [state.conversationId, conversationId, config.baseURL]
  );

  const deleteMessagesFrom = useCallback(
    async (messageId: string, dbId?: number) => {
      // Delete from server if we have a database ID
      if (dbId) {
        try {
          await deleteMessagesFromApi(state.conversationId || conversationId, dbId, config.baseURL);
        } catch (error) {
          console.error('Error deleting messages from server:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to delete messages' });
          return;
        }
      }
      // Remove from local state
      dispatch({ type: 'DELETE_MESSAGES_FROM', payload: messageId });
    },
    [state.conversationId, conversationId, config.baseURL]
  );

  const addDeveloperMessage = useCallback(
    async (content: string, crewMemberName?: string) => {
      try {
        const result = await injectDeveloperMessageApi(
          state.conversationId || conversationId,
          content,
          crewMemberName,
          config.baseURL
        );

        // Add to local state
        const message: Message = {
          id: String(result.id),
          dbId: result.id,
          role: 'developer',
          content: result.content,
          timestamp: new Date(result.createdAt),
          injectionMeta: {
            injectedForTesting: result.metadata.injectedForTesting,
            crewMemberName: result.metadata.crewMemberName || undefined,
            injectedAt: result.metadata.injectedAt,
          },
        };
        dispatch({ type: 'ADD_DEVELOPER_MESSAGE', payload: message });
      } catch (error) {
        console.error('Error injecting developer message:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to inject developer message' });
      }
    },
    [state.conversationId, conversationId, config.baseURL]
  );

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    isThinking: state.isThinking,
    currentThinkingStep: state.currentThinkingStep,
    thinkingSteps: state.thinkingSteps,
    hasStartedChat: state.hasStartedChat,
    error: state.error,
    sendMessage,
    loadHistory,
    newChat,
    clearError,
    deleteMessage,
    deleteMessagesFrom,
    addDeveloperMessage,
  };
}
