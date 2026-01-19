import { useReducer, useCallback, useEffect, useRef } from 'react';
import { streamChat } from '../services/chatService';
import { getConversationHistory } from '../services/conversationService';
import type { Message, ChatState, ChatAction, AgentConfig } from '../types';

const initialState: ChatState = {
  messages: [],
  conversationId: '',
  isLoading: false,
  isThinking: false,
  currentThinkingStep: '',
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
        currentThinkingStep: action.payload,
      };

    case 'UPDATE_THINKING_STEP':
      return {
        ...state,
        currentThinkingStep: action.payload,
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
      };

    case 'LOAD_HISTORY':
      return {
        ...state,
        conversationId: action.payload.conversationId,
        messages: action.payload.messages,
        hasStartedChat: action.payload.messages.length > 0,
      };

    case 'NEW_CHAT':
      return {
        ...initialState,
        conversationId: action.payload,
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

  const thinkingIntervalRef = useRef<number | null>(null);

  // Update conversationId when it changes externally
  useEffect(() => {
    if (conversationId !== state.conversationId) {
      dispatch({ type: 'NEW_CHAT', payload: conversationId });
    }
  }, [conversationId, state.conversationId]);

  // Get random thinking steps from config
  const getRandomThinkingSteps = useCallback(() => {
    const stepsArray = config.thinkingSteps;
    return stepsArray[Math.floor(Math.random() * stepsArray.length)];
  }, [config.thinkingSteps]);

  // Start cycling through thinking steps
  const startThinkingAnimation = useCallback(() => {
    const steps = getRandomThinkingSteps();
    let stepIndex = 0;

    dispatch({ type: 'START_THINKING', payload: steps[0] });

    thinkingIntervalRef.current = window.setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      dispatch({ type: 'UPDATE_THINKING_STEP', payload: steps[stepIndex] });
    }, 2000);
  }, [getRandomThinkingSteps]);

  // Stop thinking animation
  const stopThinkingAnimation = useCallback(() => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    dispatch({ type: 'COMPLETE_THINKING' });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const messageId = crypto.randomUUID();
      dispatch({ type: 'ADD_USER_MESSAGE', payload: { id: messageId, content: text } });

      startThinkingAnimation();

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
            onChunk: (chunk) => {
              if (!hasStartedStreaming) {
                stopThinkingAnimation();
                dispatch({ type: 'START_STREAMING', payload: botMessageId });
                hasStartedStreaming = true;
              }
              dispatch({ type: 'APPEND_CHUNK', payload: chunk });
            },
            onComplete: () => {
              stopThinkingAnimation();
              dispatch({ type: 'COMPLETE_MESSAGE' });
            },
            onError: (error) => {
              stopThinkingAnimation();
              dispatch({ type: 'SET_ERROR', payload: error.message });
            },
          }
        );
      } catch (error) {
        stopThinkingAnimation();
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
      startThinkingAnimation,
      stopThinkingAnimation,
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
    hasStartedChat: state.hasStartedChat,
    error: state.error,
    sendMessage,
    loadHistory,
    newChat,
    clearError,
  };
}
