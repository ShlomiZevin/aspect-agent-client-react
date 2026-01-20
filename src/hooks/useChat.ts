import { useReducer, useCallback, useEffect } from 'react';
import { streamChat } from '../services/chatService';
import { getConversationHistory } from '../services/conversationService';
import type { Message, ChatState, ChatAction, AgentConfig, ThinkingStep } from '../types';

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
        messages: [
          ...state.messages,
          {
            id: action.payload,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            thinkingSteps: [...state.thinkingSteps],
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

    default:
      return state;
  }
}

export interface UseChatOptions {
  config: AgentConfig;
  conversationId: string;
  userId: string | null;
  useKnowledgeBase?: boolean;
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
}

/**
 * Main chat hook - handles messaging, streaming, and thinking indicators
 */
export function useChat(options: UseChatOptions): UseChatReturn {
  const { config, conversationId, userId, useKnowledgeBase = false } = options;
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

      try {
        await streamChat(
          {
            message: text,
            conversationId: state.conversationId || conversationId,
            agentName: config.agentName,
            userId,
            useKnowledgeBase,
            baseURL: config.baseURL,
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
                dispatch({ type: 'START_STREAMING', payload: botMessageId });
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
  };
}
