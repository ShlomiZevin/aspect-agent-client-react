import { useState, useCallback, useEffect } from 'react';
import { useLocalStorageString } from './useLocalStorage';
import {
  getUserConversations,
  getConversationHistory,
  deleteConversation as deleteConversationApi,
  updateConversationTitle as updateTitleApi,
} from '../services/conversationService';
import type { Conversation, Message } from '../types';

export interface UseConversationReturn {
  conversationId: string;
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  createNewChat: () => string;
  switchToChat: (chatId: string) => Promise<Message[]>;
  deleteChat: (chatId: string) => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
  loadConversations: () => Promise<void>;
}

/**
 * Hook for managing conversations
 */
export function useConversation(
  storagePrefix: string,
  agentName: string,
  userId: string | null,
  baseURL?: string
): UseConversationReturn {
  const key = `${storagePrefix}current_conversation_id`;
  const [storedConversationId, setStoredConversationId] = useLocalStorageString(key, null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize conversation ID if not present
  const conversationId = storedConversationId || crypto.randomUUID();

  // Ensure conversationId is stored
  useEffect(() => {
    if (!storedConversationId) {
      setStoredConversationId(conversationId);
    }
  }, [storedConversationId, conversationId, setStoredConversationId]);

  const loadConversations = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const convs = await getUserConversations(userId, agentName, baseURL);
      setConversations(convs);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [userId, agentName, baseURL]);

  // Load conversations on mount and when userId changes
  useEffect(() => {
    if (userId) {
      loadConversations();
    }
  }, [userId, loadConversations]);

  const createNewChat = useCallback(() => {
    const newId = crypto.randomUUID();
    setStoredConversationId(newId);
    return newId;
  }, [setStoredConversationId]);

  const switchToChat = useCallback(
    async (chatId: string): Promise<Message[]> => {
      setStoredConversationId(chatId);

      try {
        const history = await getConversationHistory(chatId, baseURL);
        return history.messages;
      } catch (err) {
        console.error('Error loading chat history:', err);
        return [];
      }
    },
    [setStoredConversationId, baseURL]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await deleteConversationApi(chatId, baseURL);
        setConversations(prev => prev.filter(c => c.id !== chatId));

        // If deleting current conversation, create a new one
        if (chatId === conversationId) {
          createNewChat();
        }
      } catch (err) {
        console.error('Error deleting conversation:', err);
        throw err;
      }
    },
    [conversationId, createNewChat, baseURL]
  );

  const updateTitle = useCallback(
    async (title: string) => {
      try {
        await updateTitleApi(conversationId, title, baseURL);
        setConversations(prev =>
          prev.map(c =>
            c.id === conversationId ? { ...c, title } : c
          )
        );
      } catch (err) {
        console.error('Error updating title:', err);
      }
    },
    [conversationId, baseURL]
  );

  return {
    conversationId,
    conversations,
    isLoading,
    error,
    createNewChat,
    switchToChat,
    deleteChat,
    updateTitle,
    loadConversations,
  };
}
