import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useChat, useConversation, useCrew, useDebugShortcut, useLocalStorageString, type UseChatReturn, type UseConversationReturn } from '../hooks';
import { useAgentContext } from './AgentContext';
import { useUserContext } from './UserContext';
import type { CrewMember, CrewJourneyStep } from '../types/crew';
import { linkPhone as linkPhoneApi, goMobile as goMobileApi } from '../services/phoneService';

interface ChatContextValue extends UseChatReturn, Omit<UseConversationReturn, 'switchToChat'> {
  switchToChat: (chatId: string) => Promise<void>;
  // Crew state
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  selectedOverride: string | null;
  setSelectedOverride: (crewName: string | null) => void;
  hasCrew: boolean;
  // Journey state
  journeySteps: CrewJourneyStep[];
  isJourneyModalOpen: boolean;
  openJourneyModal: () => void;
  closeJourneyModal: () => void;
  // Phone linking
  linkedPhone: string | null;
  linkPhone: (phone: string) => Promise<void>;
  goMobile: (phone: string) => Promise<void>;
  // Debug
  debugMode: boolean;
  toggleDebug: () => void;
  // Debug copy selection
  selectedMessageIds: Set<string>;
  toggleMessageSelect: (id: string) => void;
  clearMessageSelection: () => void;
  copyMessages: (messageIds: string[]) => void;
  copyFromMessage: (messageId: string) => void;
  // Config (for prompt editor)
  agentName: string;
  baseURL: string;
  // Prompt overrides (debug mode)
  setPromptOverride: (crewMemberId: string, prompt: string) => void;
  setModelOverride: (crewMemberId: string, model: string) => void;
  setFallbackOverride: (crewMemberId: string, model: string) => void;
  personaOverride: string | null;
  setPersonaOverride: (persona: string | null) => void;
  setKBOverride: (crewMemberId: string, sources: string[]) => void;
  setThinkingPromptOverride: (crewMemberId: string, prompt: string) => void;
  setThinkingModelOverride: (crewMemberId: string, model: string) => void;
  thinkerDisabled: Record<string, boolean>;
  setThinkerDisabled: (crewMemberId: string, disabled: boolean) => void;
  // Fields editor
  isFieldsEditorOpen: boolean;
  setFieldsEditorOpen: (open: boolean) => void;
  canShowFieldsEditor: boolean;
  // Context editor (debug mode only)
  isContextEditorOpen: boolean;
  setContextEditorOpen: (open: boolean) => void;
  // Developer message injection (debug mode)
  injectTransitionPrompt: (content: string, crewMemberName?: string) => Promise<void>;
  // Fields refresh key (increments when fields are extracted)
  fieldsRefreshKey: number;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { config } = useAgentContext();
  const { userId, switchUser } = useUserContext();
  // Phone linking state (persisted in localStorage)
  const [linkedPhone, setLinkedPhone] = useLocalStorageString(`${config.storagePrefix}linked_phone`, null);

  // Debug mode (Ctrl+Shift+D easter egg)
  const [debugMode, setDebugMode] = useState(false);
  const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
  useDebugShortcut(toggleDebug);

  // Debug copy selection
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const toggleMessageSelect = useCallback((id: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearMessageSelection = useCallback(() => setSelectedMessageIds(new Set()), []);

  // Clear selection when debug mode is turned off
  useEffect(() => {
    if (!debugMode) setSelectedMessageIds(new Set());
  }, [debugMode]);

  // Prompt overrides for debug mode (session-only)
  const [promptOverrides, setPromptOverrides] = useState<Record<string, string>>({});
  const setPromptOverride = useCallback((crewMemberId: string, prompt: string) => {
    if (prompt) {
      setPromptOverrides(prev => ({ ...prev, [crewMemberId]: prompt }));
    } else {
      // Clear override when empty string passed
      setPromptOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  // Model overrides for debug mode (session-only)
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  const setModelOverride = useCallback((crewMemberId: string, model: string) => {
    if (model) {
      setModelOverrides(prev => ({ ...prev, [crewMemberId]: model }));
    } else {
      setModelOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  // Fallback model overrides for debug mode (session-only)
  const [fallbackOverrides, setFallbackOverrides] = useState<Record<string, string>>({});
  const setFallbackOverride = useCallback((crewMemberId: string, model: string) => {
    if (model) {
      setFallbackOverrides(prev => ({ ...prev, [crewMemberId]: model }));
    } else {
      setFallbackOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  // KB overrides for debug mode (session-only)
  const [kbOverrides, setKBOverrides] = useState<Record<string, string[]>>({});
  const setKBOverride = useCallback((crewMemberId: string, sources: string[]) => {
    if (sources && sources.length > 0) {
      setKBOverrides(prev => ({ ...prev, [crewMemberId]: sources }));
    } else {
      setKBOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  // Thinker disabled overrides for debug mode (session-only)
  const [thinkerDisabled, setThinkerDisabledState] = useState<Record<string, boolean>>({});
  const setThinkerDisabled = useCallback((crewMemberId: string, disabled: boolean) => {
    setThinkerDisabledState(prev => {
      if (disabled) return { ...prev, [crewMemberId]: true };
      const next = { ...prev };
      delete next[crewMemberId];
      return next;
    });
  }, []);

  // Thinking prompt overrides for debug mode (session-only)
  const [thinkingPromptOverrides, setThinkingPromptOverrides] = useState<Record<string, string>>({});
  const setThinkingPromptOverride = useCallback((crewMemberId: string, prompt: string) => {
    if (prompt) {
      setThinkingPromptOverrides(prev => ({ ...prev, [crewMemberId]: prompt }));
    } else {
      setThinkingPromptOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  const [thinkingModelOverrides, setThinkingModelOverrides] = useState<Record<string, string>>({});
  const setThinkingModelOverride = useCallback((crewMemberId: string, model: string) => {
    if (model) {
      setThinkingModelOverrides(prev => ({ ...prev, [crewMemberId]: model }));
    } else {
      setThinkingModelOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  const conversation = useConversation(
    config.storagePrefix,
    config.agentName,
    userId,
    config.baseURL
  );

  // Crew state management
  const crew = useCrew({
    agentName: config.agentName,
    baseURL: config.baseURL,
    showFullJourney: config.features.showFullJourney,
  });

  // Journey modal state
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState(false);
  const openJourneyModal = useCallback(() => setIsJourneyModalOpen(true), []);
  const closeJourneyModal = useCallback(() => setIsJourneyModalOpen(false), []);

  // Fields editor state
  const [isFieldsEditorOpen, setFieldsEditorOpen] = useState(false);
  const [fieldsRefreshKey, setFieldsRefreshKey] = useState(0);

  // Context editor state (debug mode only)
  const [isContextEditorOpen, setContextEditorOpen] = useState(false);

  // Persona override for debug mode (session-only, agent-level)
  const [personaOverride, setPersonaOverride] = useState<string | null>(null);

  const chat = useChat({
    config,
    conversationId: conversation.conversationId,
    userId,
    overrideCrewMember: crew.selectedOverride,
    debug: debugMode,
    promptOverrides: debugMode ? promptOverrides : undefined, // Only use in debug mode
    modelOverrides: debugMode ? modelOverrides : undefined,
    fallbackOverrides: debugMode ? fallbackOverrides : undefined,
    personaOverride: debugMode ? (personaOverride || undefined) : undefined,
    kbOverrides: debugMode ? kbOverrides : undefined,
    thinkingPromptOverrides: debugMode ? thinkingPromptOverrides : undefined,
    thinkingModelOverrides: debugMode ? thinkingModelOverrides : undefined,
    thinkerDisabled: debugMode ? thinkerDisabled : undefined,
    onCrewInfo: (crewInfo) => {
      crew.setCurrentCrew(crewInfo);
      // Refresh fields panel when crew is set (including initial crew)
      setFieldsRefreshKey(prev => prev + 1);
    },
    onCrewTransition: (transition) => {
      // Record the departing crew as visited
      crew.addVisitedCrew(transition.from);
      // Find the new crew member and update current
      const newCrew = crew.crewMembers.find(c => c.name === transition.to);
      if (newCrew) {
        crew.setCurrentCrew(newCrew);
      }
      // Refresh fields panel to show new crew's field definitions
      setFieldsRefreshKey(prev => prev + 1);
    },
    onFieldExtracted: () => {
      // Increment refresh key to trigger FieldsEditorPanel reload
      setFieldsRefreshKey(prev => prev + 1);
    },
  });

  // Debug copy helpers (need chat.messages)
  const formatMessagesForCopy = useCallback((ids: string[]) => {
    const ordered = chat.messages.filter(m => ids.includes(m.id) && m.role !== 'developer');
    return ordered.map(m => `${m.role === 'user' ? 'user' : 'agent'}: ${m.content}`).join('\n\n');
  }, [chat.messages]);

  const copyMessages = useCallback((ids: string[]) => {
    const text = formatMessagesForCopy(ids);
    if (text) navigator.clipboard.writeText(text);
  }, [formatMessagesForCopy]);

  const copyFromMessage = useCallback((messageId: string) => {
    const idx = chat.messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const ids = chat.messages.slice(idx).filter(m => m.role !== 'developer').map(m => m.id);
    copyMessages(ids);
  }, [chat.messages, copyMessages]);

  // Track message count and loading state for conversation list refresh
  const prevMessageCount = useRef(chat.messages.length);
  const wasLoading = useRef(false);
  const initialLoadDone = useRef(false);

  // On mount: load history for the stored conversation ID
  useEffect(() => {
    if (!initialLoadDone.current && conversation.conversationId) {
      initialLoadDone.current = true;
      // Try to load history for the stored conversation and restore crew state
      chat.loadHistory(conversation.conversationId).then(({ currentCrewMember }) => {
        if (currentCrewMember && crew.crewMembers.length > 0) {
          const match = crew.crewMembers.find(c => c.name === currentCrewMember);
          if (match) {
            crew.setCurrentCrew(match);
            hasRestoredCrew.current = true;
          }
        }
      });
    }
  }, [conversation.conversationId, chat, crew]);

  // Refresh conversation list when a message exchange completes
  useEffect(() => {
    // Detect when loading transitions from true to false (message exchange completed)
    const loadingJustFinished = wasLoading.current && !chat.isLoading;
    const hasNewMessages = chat.messages.length > prevMessageCount.current;

    if (loadingJustFinished && hasNewMessages) {
      // Message exchange completed - refresh conversation list
      // Small delay ensures server has time to persist new conversations
      setTimeout(() => conversation.loadConversations(), 300);
      prevMessageCount.current = chat.messages.length;
    }

    // Update tracking refs
    wasLoading.current = chat.isLoading;

    // Also update prevMessageCount when not loading (e.g., after history load)
    if (!chat.isLoading) {
      prevMessageCount.current = chat.messages.length;
    }
  }, [chat.messages.length, chat.isLoading, conversation]);

  // Sync current crew from loaded message history (e.g., on page refresh or conversation switch)
  const hasRestoredCrew = useRef(false);
  useEffect(() => {
    if (hasRestoredCrew.current || crew.crewMembers.length === 0 || chat.messages.length === 0) return;

    // Find the last assistant message that has a crewMember tag
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const msg = chat.messages[i];
      if (msg.role === 'assistant' && msg.crewMember) {
        const match = crew.crewMembers.find(c => c.displayName === msg.crewMember);
        if (match) {
          crew.setCurrentCrew(match);
          hasRestoredCrew.current = true;
        }
        break;
      }
    }
  }, [chat.messages, crew.crewMembers, crew]);

  // Override switchToChat to also load messages and restore crew state
  const switchToChat = useCallback(async (chatId: string) => {
    crew.resetJourney();
    hasRestoredCrew.current = false;
    const messages = await conversation.switchToChat(chatId);
    if (messages.length > 0) {
      const { currentCrewMember } = await chat.loadHistory(chatId);
      // Restore crew state from conversation's currentCrewMember
      if (currentCrewMember) {
        const match = crew.crewMembers.find(c => c.name === currentCrewMember);
        if (match) {
          crew.setCurrentCrew(match);
          hasRestoredCrew.current = true;
        }
      }
    } else {
      chat.newChat(chatId);
    }
  }, [conversation, chat, crew]);

  // Link phone number: switch session to WhatsApp user
  const linkPhone = useCallback(async (phone: string) => {
    const result = await linkPhoneApi(phone, config.agentName, config.baseURL);

    // Switch to the WhatsApp user
    switchUser(result.userId);
    setLinkedPhone(phone);

    // Reset crew journey for the new session
    crew.resetJourney();
    hasRestoredCrew.current = false;

    // If there are conversations, switch to the most recent one
    if (result.conversations.length > 0) {
      const latest = result.conversations[0]; // sorted by updatedAt desc
      const chatId = latest.id;
      const messages = await conversation.switchToChat(String(chatId));
      if (messages.length > 0) {
        const { currentCrewMember } = await chat.loadHistory(String(chatId));
        if (currentCrewMember) {
          const match = crew.crewMembers.find(c => c.name === currentCrewMember);
          if (match) {
            crew.setCurrentCrew(match);
            hasRestoredCrew.current = true;
          }
        }
      } else {
        chat.newChat(String(chatId));
      }
    }

    // Reload conversations for the new user (will happen via useEffect on userId change too)
    setTimeout(() => conversation.loadConversations(), 500);
  }, [config.agentName, config.baseURL, switchUser, crew, conversation, chat]);

  // Go Mobile: link current conversation to a phone number
  const goMobile = useCallback(async (phone: string) => {
    if (!conversation.conversationId) {
      throw new Error('No active conversation to link');
    }

    const result = await goMobileApi(phone, conversation.conversationId, config.baseURL);

    // Switch to the WhatsApp user
    switchUser(result.userId);
    setLinkedPhone(phone);

    // Update the conversation ID to the new one (wa_<phone>_<uuid>)
    crew.resetJourney();
    hasRestoredCrew.current = false;

    // Switch to the newly linked conversation
    const messages = await conversation.switchToChat(result.conversationId);
    if (messages.length > 0) {
      const { currentCrewMember } = await chat.loadHistory(result.conversationId);
      if (currentCrewMember) {
        const match = crew.crewMembers.find(c => c.name === currentCrewMember);
        if (match) {
          crew.setCurrentCrew(match);
          hasRestoredCrew.current = true;
        }
      }
    } else {
      chat.newChat(result.conversationId);
    }

    setTimeout(() => conversation.loadConversations(), 500);
  }, [conversation.conversationId, config.baseURL, switchUser, crew, conversation, chat]);

  // Handle new chat creation
  const handleCreateNewChat = useCallback(() => {
    const newId = conversation.createNewChat();
    chat.newChat(newId);
    crew.resetJourney();
    hasRestoredCrew.current = false;
    return newId;
  }, [conversation, chat, crew]);

  const value: ChatContextValue = {
    // Chat state
    messages: chat.messages,
    isLoading: chat.isLoading,
    isThinking: chat.isThinking,
    currentThinkingStep: chat.currentThinkingStep,
    thinkingSteps: chat.thinkingSteps,
    hasStartedChat: chat.hasStartedChat,
    error: chat.error,
    sendMessage: chat.sendMessage,
    loadHistory: chat.loadHistory,
    newChat: chat.newChat,
    clearError: chat.clearError,
    deleteMessage: chat.deleteMessage,
    deleteMessagesFrom: chat.deleteMessagesFrom,

    // Conversation state
    conversationId: conversation.conversationId,
    conversations: conversation.conversations,
    createNewChat: handleCreateNewChat,
    switchToChat,
    deleteChat: conversation.deleteChat,
    deleteAllChats: conversation.deleteAllChats,
    duplicateChat: conversation.duplicateChat,
    updateTitle: conversation.updateTitle,
    updateChatTitle: conversation.updateChatTitle,
    loadConversations: conversation.loadConversations,

    // Crew state
    crewMembers: crew.crewMembers,
    currentCrew: crew.currentCrew,
    selectedOverride: crew.selectedOverride,
    setSelectedOverride: crew.setSelectedOverride,
    hasCrew: crew.hasCrew,

    // Journey state
    journeySteps: crew.journeySteps,
    isJourneyModalOpen,
    openJourneyModal,
    closeJourneyModal,

    // Phone linking
    linkedPhone,
    linkPhone,
    goMobile,

    // Debug
    debugMode,
    toggleDebug,
    selectedMessageIds,
    toggleMessageSelect,
    clearMessageSelection,
    copyMessages,
    copyFromMessage,
    // Config (for prompt editor)
    agentName: config.agentName,
    baseURL: config.baseURL,
    // Prompt overrides (debug mode)
    setPromptOverride,
    setModelOverride,
    setFallbackOverride,
    personaOverride,
    setPersonaOverride,
    setKBOverride,
    setThinkingPromptOverride,
    setThinkingModelOverride,
    thinkerDisabled,
    setThinkerDisabled,
    // Fields editor
    isFieldsEditorOpen,
    setFieldsEditorOpen,
    // Show fields editor for form mode crews OR in debug mode
    canShowFieldsEditor: debugMode || (crew.currentCrew?.extractionMode === 'form'),
    // Context editor (debug mode only)
    isContextEditorOpen,
    setContextEditorOpen,
    // Developer message injection (debug mode)
    injectTransitionPrompt: chat.addDeveloperMessage,
    addDeveloperMessage: chat.addDeveloperMessage,
    // Fields refresh key (increments when fields are extracted)
    fieldsRefreshKey,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
