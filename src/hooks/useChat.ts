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

    case 'ADD_THINKING_STEP': {
      const newThinkingSteps = [...state.thinkingSteps, action.payload];

      // If streaming already started (assistant message exists), also append
      // to the message's thinkingSteps so late-arriving steps (e.g. Google
      // file_search results from the final chunk) are not lost.
      // But skip when a transition is pending — the last message belongs to the previous crew.
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant' && !state.pendingTransitionCrew) {
        msgs[msgs.length - 1] = {
          ...last,
          thinkingSteps: [...(last.thinkingSteps || []), action.payload],
        };
      }

      return {
        ...state,
        messages: msgs,
        currentThinkingStep: action.payload.description,
        thinkingSteps: newThinkingSteps,
      };
    }

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

    case 'SET_DEBUG_DATA': {
      // If last message is a newly created transition message (empty content, no debugData),
      // attach debug data directly to it. Otherwise, store as pending for START_STREAMING.
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      // Only attach directly if it's an empty assistant message (just created by CREW_TRANSITION)
      if (lastMessage?.role === 'assistant' && !lastMessage.debugData && lastMessage.content === '') {
        messages[messages.length - 1] = {
          ...lastMessage,
          debugData: action.payload,
        };
        return { ...state, messages, pendingDebugData: null };
      }
      return {
        ...state,
        pendingDebugData: action.payload,
      };
    }

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

    case 'UPDATE_DEBUG_FALLBACK': {
      // Patch the last assistant message's debugData with actual model used info
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant' && lastMessage.debugData) {
        messages[messages.length - 1] = {
          ...lastMessage,
          debugData: {
            ...lastMessage.debugData,
            modelUsed: action.payload.modelUsed,
            fallbackUsed: action.payload.fallbackUsed,
          },
        };
      }
      // Also patch pendingDebugData in case message hasn't been created yet
      const updatedPending = state.pendingDebugData
        ? { ...state.pendingDebugData, modelUsed: action.payload.modelUsed, fallbackUsed: action.payload.fallbackUsed }
        : state.pendingDebugData;
      return { ...state, messages, pendingDebugData: updatedPending };
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

    case 'CREW_TRANSITION': {
      // Don't create the message yet — delay until first text chunk arrives.
      // This prevents showing an empty bubble + ThinkingIndicator simultaneously.
      // Store the crew name so FINALIZE_TRANSITION_THINKING can create the message later.

      // Only clear thinkingSteps if the first crew already has a message (steps are captured there).
      // In post-thinking transfers, the first crew never streamed text — no assistant message exists,
      // so the thinking steps (routing, analyzing, advisor) should carry over to the target crew's message.
      const lastMsg = state.messages[state.messages.length - 1];
      const firstCrewHasMessage = lastMsg?.role === 'assistant';

      return {
        ...state,
        pendingTransitionCrew: action.payload.displayName || action.payload.to,
        // Keep isThinking=true so ThinkingIndicator stays visible during second crew's
        // thinking phase (e.g. thinker processing). FINALIZE_TRANSITION_THINKING will
        // set it to false when the first text chunk arrives.
        isThinking: true,
        thinkingSteps: firstCrewHasMessage ? [] : state.thinkingSteps,
        currentThinkingStep: '',
      };
    }

    case 'FINALIZE_TRANSITION_THINKING': {
      // Create the transition message now (was deferred from CREW_TRANSITION to avoid
      // showing empty bubble + ThinkingIndicator simultaneously)
      const newMessage: Message = {
        id: `msg-${Date.now()}-transition`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        crewMember: state.pendingTransitionCrew || undefined,
        thinkingSteps: [...state.thinkingSteps],
        debugData: state.pendingDebugData || undefined,
      };
      return {
        ...state,
        messages: [...state.messages, newMessage],
        isThinking: false,
        pendingTransitionCrew: null,
        pendingDebugData: null,
      };
    }

    default:
      return state;
  }
}

export interface UseChatOptions {
  config: AgentConfig;
  conversationId: string;
  userId: string | null;
  overrideCrewMember?: string | null;
  debug?: boolean;
  promptOverrides?: Record<string, string>; // Session overrides: { crewName: prompt }
  modelOverrides?: Record<string, string>;  // Session overrides: { crewName: modelName }
  fallbackOverrides?: Record<string, string>; // Session overrides: { crewName: fallbackModelName }
  personaOverride?: string; // Session override for agent-level persona
  kbOverrides?: Record<string, string[]>;  // Session overrides: { crewName: string[] }
  thinkingPromptOverrides?: Record<string, string>; // Session overrides: { crewName: thinkingPrompt }
  thinkerDisabled?: Record<string, boolean>; // Session overrides: { crewName: true } to disable thinker
  onCrewInfo?: (crew: CrewMember) => void;
  onCrewTransition?: (transition: CrewTransition) => void;
  onFieldExtracted?: (field: string, value: string) => void;
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
  loadHistory: (conversationId: string) => Promise<{ currentCrewMember?: string | null }>;
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
  const { config, conversationId, userId, overrideCrewMember, debug, promptOverrides, modelOverrides, fallbackOverrides, personaOverride, kbOverrides, thinkingPromptOverrides, thinkerDisabled, onCrewInfo, onCrewTransition, onFieldExtracted } = options;
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
      let pendingTransitionTo: string | null = null; // Track crew transition waiting for crew_info
      let transitionNeedsThinking = false; // Track if we need to finalize thinking on first chunk after transition

      try {
        await streamChat(
          {
            message: text,
            conversationId: state.conversationId || conversationId,
            agentName: config.agentName,
            userId,
            baseURL: config.baseURL,
            overrideCrewMember,
            debug,
            promptOverrides,
            modelOverrides,
            fallbackOverrides,
            personaOverride,
            kbOverrides,
            thinkingPromptOverrides,
            thinkerDisabled,
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
              } else if (transitionNeedsThinking) {
                // First chunk after transition - finalize thinking with all accumulated steps
                dispatch({ type: 'FINALIZE_TRANSITION_THINKING' });
                transitionNeedsThinking = false;
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
              // Check if this is crew_info after a transition - create message with displayName
              if (pendingTransitionTo && crew.name === pendingTransitionTo) {
                // DON'T complete thinking yet - crew B's thinking steps may follow
                // Instead, mark that we need to finalize thinking when first chunk arrives
                dispatch({
                  type: 'CREW_TRANSITION',
                  payload: {
                    to: crew.name,
                    displayName: crew.displayName,
                  },
                });
                pendingTransitionTo = null;
                // Mark as streaming so onChunk doesn't create another message via START_STREAMING
                hasStartedStreaming = true;
                // Mark that we need to finalize thinking when content starts
                transitionNeedsThinking = true;
              }
              currentCrewDisplayName = crew.displayName;
              onCrewInfo?.(crew);
            },
            onCrewTransition: (transition) => {
              // Don't create message yet - wait for crew_info to get displayName
              pendingTransitionTo = transition.to;
              // Call the external callback for context updates
              onCrewTransition?.(transition);
            },
            onDebugData: (data) => {
              dispatch({ type: 'SET_DEBUG_DATA', payload: data });
            },
            onModelUsed: (data) => {
              dispatch({ type: 'UPDATE_DEBUG_FALLBACK', payload: { modelUsed: data.modelUsed, fallbackUsed: data.fallbackUsed } });
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
            onFieldExtracted,
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
      overrideCrewMember,
      debug,
      promptOverrides,
      modelOverrides,
      fallbackOverrides,
      kbOverrides,
      thinkingPromptOverrides,
      thinkerDisabled,
      onCrewInfo,
      onCrewTransition,
      onFieldExtracted,
    ]
  );

  const loadHistory = useCallback(
    async (convId: string): Promise<{ currentCrewMember?: string | null }> => {
      try {
        const history = await getConversationHistory(convId, config.baseURL);
        dispatch({
          type: 'LOAD_HISTORY',
          payload: { conversationId: convId, messages: history.messages },
        });
        return { currentCrewMember: history.currentCrewMember };
      } catch (error) {
        console.error('Error loading history:', error);
        dispatch({ type: 'LOAD_HISTORY', payload: { conversationId: convId, messages: [] } });
        return { currentCrewMember: null };
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
