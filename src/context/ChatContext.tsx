import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useChat, useConversation, useCrew, useDebugShortcut, useLocalStorageString, type UseChatReturn, type UseConversationReturn } from '../hooks';
import { useAgentContext } from './AgentContext';
import type { AgentTheme } from '../types';
import { useUserContext } from './UserContext';
import type { CrewMember, CrewJourneyStep } from '../types/crew';
import { linkPhone as linkPhoneApi, goMobile as goMobileApi } from '../services/phoneService';
import type { ProfileUpdateData } from '../services/chatService';
import { runProfiler } from '../services/profilerService';

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
  setTemperatureOverride: (crewMemberId: string, temperature: number | null) => void;
  setTopKOverride: (crewMemberId: string, topK: number | null) => void;
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
  // Profiler data (pushed via SSE from async profiler)
  profileData: ProfileUpdateData | null;
  // Profiler raw response (debug)
  profilerLastRaw: unknown | null;
  // Profiler fresh start (debug) — ignore existing profile, start from scratch
  profilerFreshStart: boolean;
  setProfilerFreshStart: (value: boolean) => void;
  profilerEnabled: boolean;
  setProfilerEnabled: (value: boolean) => void;
  // Manual profiler re-run
  rerunProfiler: () => Promise<void>;
  // Theme selection (brand themes)
  selectedTheme: AgentTheme | null;
  setSelectedTheme: (themeId: string | null) => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
  /** When true, hides admin/dev surfaces (debug shortcut, debug mode entry). */
  restrictedMode?: boolean;
  /**
   * Override the localStorage prefix used for chat state (conversation id,
   * linked phone, etc.). Defaults to `config.storagePrefix`. Pass an
   * isolated prefix from authenticated routes to keep their chat state
   * separate from the anonymous public path.
   */
  storagePrefix?: string;
}

export function ChatProvider({ children, restrictedMode = false, storagePrefix }: ChatProviderProps) {
  const { config, selectedTheme, setSelectedTheme } = useAgentContext();
  const { userId, switchUser } = useUserContext();
  const effectivePrefix = storagePrefix ?? config.storagePrefix;
  // Phone linking state (persisted in localStorage)
  const [linkedPhone, setLinkedPhone] = useLocalStorageString(`${effectivePrefix}linked_phone`, null);

  // Debug mode (Ctrl+Shift+D easter egg) — disabled in restricted mode and
  // forced off so leftover state can't surface admin UI for end users.
  const [internalDebugMode, setDebugMode] = useState(false);
  const debugMode = restrictedMode ? false : internalDebugMode;
  const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
  useDebugShortcut(toggleDebug, restrictedMode);

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
  const setKBOverride = useCallback((crewMemberId: string, sources: string[] | null) => {
    if (sources != null) {
      // Empty array [] = "disable KB"; non-empty = override sources
      setKBOverrides(prev => ({ ...prev, [crewMemberId]: sources }));
    } else {
      // null = remove override, revert to crew default
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

  // Temperature overrides for debug mode (session-only)
  const [temperatureOverrides, setTemperatureOverrides] = useState<Record<string, number>>({});
  const setTemperatureOverride = useCallback((crewMemberId: string, temperature: number | null) => {
    if (temperature != null) {
      setTemperatureOverrides(prev => ({ ...prev, [crewMemberId]: temperature }));
    } else {
      setTemperatureOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  // Top K overrides for debug mode (session-only)
  const [topKOverrides, setTopKOverrides] = useState<Record<string, number>>({});
  const setTopKOverride = useCallback((crewMemberId: string, topK: number | null) => {
    if (topK != null) {
      setTopKOverrides(prev => ({ ...prev, [crewMemberId]: topK }));
    } else {
      setTopKOverrides(prev => {
        const next = { ...prev };
        delete next[crewMemberId];
        return next;
      });
    }
  }, []);

  const conversation = useConversation(
    effectivePrefix,
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

  // Profiler data state (pushed via SSE from async profiler)
  const [profileData, setProfileData] = useState<ProfileUpdateData | null>(null);
  const [profilerLastRaw, setProfilerLastRaw] = useState<unknown | null>(null);
  const [profilerFreshStart, setProfilerFreshStart] = useState(true);
  // Default profiler ON for end-user (restricted) mode; OFF in admin/dev mode.
  const [profilerEnabled, setProfilerEnabled] = useState(restrictedMode);

  const rerunProfiler = useCallback(async () => {
    if (!conversation.conversationId || !config.agentName) return;
    try {
      const result = await runProfiler(config.agentName, conversation.conversationId, config.baseURL);
      if (result.data) setProfileData(result.data);
    } catch (err) {
      console.error('[Profiler] Manual re-run failed:', err);
    }
  }, [conversation.conversationId, config.agentName, config.baseURL]);

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
    temperatureOverrides: debugMode ? temperatureOverrides : undefined,
    topKOverrides: debugMode ? topKOverrides : undefined,
    profilerFreshStart: profilerFreshStart || undefined,
    profilerEnabled: profilerEnabled || undefined,
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
      // Propagate model override from departing crew to new crew so the selected
      // model persists across transitions (task #449)
      if (modelOverrides[transition.from] && !modelOverrides[transition.to]) {
        setModelOverride(transition.to, modelOverrides[transition.from]);
      }
      // Refresh fields panel to show new crew's field definitions
      setFieldsRefreshKey(prev => prev + 1);
    },
    onFieldExtracted: () => {
      // Increment refresh key to trigger FieldsEditorPanel reload
      setFieldsRefreshKey(prev => prev + 1);
    },
    onProfileUpdate: (data) => {
      setProfileData(data);
    },
    onProfilerRaw: (data) => {
      setProfilerLastRaw(data);
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
    setTemperatureOverride,
    setTopKOverride,
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
    // Profiler data (pushed via SSE from async profiler)
    profileData,
    profilerLastRaw,
    profilerFreshStart,
    setProfilerFreshStart,
    profilerEnabled,
    setProfilerEnabled,
    rerunProfiler,
    // Theme selection (brand themes)
    selectedTheme,
    setSelectedTheme,
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
