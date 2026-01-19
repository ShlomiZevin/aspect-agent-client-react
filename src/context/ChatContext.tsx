import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useChat, useConversation, type UseChatReturn, type UseConversationReturn } from '../hooks';
import { useAgentContext } from './AgentContext';
import { useUserContext } from './UserContext';

interface ChatContextValue extends UseChatReturn, Omit<UseConversationReturn, 'switchToChat'> {
  useKnowledgeBase: boolean;
  setUseKnowledgeBase: (value: boolean) => void;
  switchToChat: (chatId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { config } = useAgentContext();
  const { userId } = useUserContext();
  const [useKB, setUseKB] = useState(config.features.hasKnowledgeBase && config.features.kbToggleable);

  const conversation = useConversation(
    config.storagePrefix,
    config.agentName,
    userId,
    config.baseURL
  );

  const chat = useChat({
    config,
    conversationId: conversation.conversationId,
    userId,
    useKnowledgeBase: useKB,
  });

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

    // KB toggle
    useKnowledgeBase: useKB,
    setUseKnowledgeBase: setUseKB,
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
