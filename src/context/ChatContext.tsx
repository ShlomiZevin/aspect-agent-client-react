import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useChat, useConversation, useCrew, type UseChatReturn, type UseConversationReturn } from '../hooks';
import { useAgentContext } from './AgentContext';
import { useUserContext } from './UserContext';
import type { CrewMember } from '../types/crew';

interface ChatContextValue extends UseChatReturn, Omit<UseConversationReturn, 'switchToChat'> {
  switchToChat: (chatId: string) => Promise<void>;
  // Crew state
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  selectedOverride: string | null;
  setSelectedOverride: (crewName: string | null) => void;
  hasCrew: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { config } = useAgentContext();
  const { userId } = useUserContext();
  const useKB = config.features.hasKnowledgeBase;

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

  const chat = useChat({
    config,
    conversationId: conversation.conversationId,
    userId,
    useKnowledgeBase: useKB,
    overrideCrewMember: crew.selectedOverride,
    onCrewInfo: crew.setCurrentCrew,
    onCrewTransition: (transition) => {
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

  // Override switchToChat to also load messages
  const switchToChat = useCallback(async (chatId: string) => {
    const messages = await conversation.switchToChat(chatId);
    if (messages.length > 0) {
      chat.loadHistory(chatId);
    } else {
      chat.newChat(chatId);
    }
  }, [conversation, chat]);

  // Handle new chat creation
  const handleCreateNewChat = useCallback(() => {
    const newId = conversation.createNewChat();
    chat.newChat(newId);
    return newId;
  }, [conversation, chat]);

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
