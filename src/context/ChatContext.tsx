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
  // Config (for prompt editor)
  agentName: string;
  baseURL: string;
  // Prompt overrides (debug mode)
  setPromptOverride: (crewMemberId: string, prompt: string) => void;
  setModelOverride: (crewMemberId: string, model: string) => void;
  // Fields editor
  isFieldsEditorOpen: boolean;
  setFieldsEditorOpen: (open: boolean) => void;
  canShowFieldsEditor: boolean;
  // Developer message injection (debug mode)
  injectTransitionPrompt: (content: string, crewMemberName?: string) => Promise<void>;
  // Fields refresh key (increments when fields are extracted)
  fieldsRefreshKey: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { config } = useAgentContext();
  const { userId, switchUser } = useUserContext();
  const useKB = config.features.hasKnowledgeBase;

  // Phone linking state (persisted in localStorage)
  const [linkedPhone, setLinkedPhone] = useLocalStorageString(`${config.storagePrefix}linked_phone`, null);

  // Debug mode (Ctrl+Shift+D easter egg)
  const [debugMode, setDebugMode] = useState(false);
  const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
  useDebugShortcut(toggleDebug);

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

  const chat = useChat({
    config,
    conversationId: conversation.conversationId,
    userId,
    useKnowledgeBase: useKB,
    overrideCrewMember: crew.selectedOverride,
    debug: debugMode,
    promptOverrides: debugMode ? promptOverrides : undefined, // Only use in debug mode
    modelOverrides: debugMode ? modelOverrides : undefined,
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

  // Track message count to detect when a new message is sent
  const prevMessageCount = useRef(chat.messages.length);
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

  // Refresh conversation list when messages change (after sending a message)
  useEffect(() => {
    if (chat.messages.length > prevMessageCount.current && !chat.isLoading) {
      // A new message was added and we're not loading - refresh the conversation list
      conversation.loadConversations();
    }
    prevMessageCount.current = chat.messages.length;
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
    // Config (for prompt editor)
    agentName: config.agentName,
    baseURL: config.baseURL,
    // Prompt overrides (debug mode)
    setPromptOverride,
    setModelOverride,
    // Fields editor
    isFieldsEditorOpen,
    setFieldsEditorOpen,
    // Show fields editor for form mode crews OR in debug mode
    canShowFieldsEditor: debugMode || (crew.currentCrew?.extractionMode === 'form'),
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
