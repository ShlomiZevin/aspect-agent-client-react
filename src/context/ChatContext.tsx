import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useChat, useConversation, useCrew, useDebugShortcut, type UseChatReturn, type UseConversationReturn } from '../hooks';
import { useAgentContext } from './AgentContext';
import { useUserContext } from './UserContext';
import type { CrewMember, CrewJourneyStep } from '../types/crew';

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
  // Debug
  debugMode: boolean;
  toggleDebug: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { config } = useAgentContext();
  const { userId } = useUserContext();
  const useKB = config.features.hasKnowledgeBase;

  // Debug mode (Ctrl+Shift+D easter egg)
  const [debugMode, setDebugMode] = useState(false);
  const toggleDebug = useCallback(() => setDebugMode(prev => !prev), []);
  useDebugShortcut(toggleDebug);

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
  });

  // Journey modal state
  const [isJourneyModalOpen, setIsJourneyModalOpen] = useState(false);
  const openJourneyModal = useCallback(() => setIsJourneyModalOpen(true), []);
  const closeJourneyModal = useCallback(() => setIsJourneyModalOpen(false), []);

  const chat = useChat({
    config,
    conversationId: conversation.conversationId,
    userId,
    useKnowledgeBase: useKB,
    overrideCrewMember: crew.selectedOverride,
    debug: debugMode,
    onCrewInfo: crew.setCurrentCrew,
    onCrewTransition: (transition) => {
      // Record the departing crew as visited
      crew.addVisitedCrew(transition.from);
      // Find the new crew member and update current
      const newCrew = crew.crewMembers.find(c => c.name === transition.to);
      if (newCrew) {
        crew.setCurrentCrew(newCrew);
      }
    },
  });

  // Track message count to detect when a new message is sent
  const prevMessageCount = useRef(chat.messages.length);
  const initialLoadDone = useRef(false);

  // On mount: load history for the stored conversation ID
  useEffect(() => {
    if (!initialLoadDone.current && conversation.conversationId) {
      initialLoadDone.current = true;
      // Try to load history for the stored conversation
      chat.loadHistory(conversation.conversationId);
    }
  }, [conversation.conversationId, chat]);

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

  // Override switchToChat to also load messages
  const switchToChat = useCallback(async (chatId: string) => {
    crew.resetJourney();
    hasRestoredCrew.current = false;
    const messages = await conversation.switchToChat(chatId);
    if (messages.length > 0) {
      chat.loadHistory(chatId);
    } else {
      chat.newChat(chatId);
    }
  }, [conversation, chat, crew]);

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

    // Conversation state
    conversationId: conversation.conversationId,
    conversations: conversation.conversations,
    createNewChat: handleCreateNewChat,
    switchToChat,
    deleteChat: conversation.deleteChat,
    updateTitle: conversation.updateTitle,
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

    // Debug
    debugMode,
    toggleDebug,
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
