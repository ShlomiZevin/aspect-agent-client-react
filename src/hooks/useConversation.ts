import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLocalStorageString } from './useLocalStorage';
import {
  getUserConversations,
  getConversationHistory,
  deleteConversation as deleteConversationApi,
  deleteAllConversations as deleteAllConversationsApi,
  updateConversationTitle as updateTitleApi,
  duplicateConversation as duplicateConversationApi,
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
  deleteAllChats: () => Promise<void>;
  duplicateChat: (chatId: string, title?: string) => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
  updateChatTitle: (chatId: string, title: string) => Promise<void>;
  loadConversations: () => Promise<void>;
}

/**
 * Hook for managing conversations with URL-based routing
 */
export function useConversation(
  storagePrefix: string,
  agentName: string,
  userId: string | null,
  baseURL?: string
): UseConversationReturn {
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const key = `${storagePrefix}current_conversation_id`;
  const [storedConversationId, setStoredConversationId] = useLocalStorageString(key, null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've done initial URL sync
  const hasInitialized = useRef(false);

  // Derive the base path from current location (e.g., /freeda or /aspect)
  const getBasePath = useCallback(() => {
    const pathParts = location.pathname.split('/');
    // First non-empty part is the agent path
    const agentPath = pathParts[1] || '';
    return `/${agentPath}`;
  }, [location.pathname]);

  // Determine the active conversation ID (URL takes precedence)
  const conversationId = urlConversationId || storedConversationId || crypto.randomUUID();

  // Sync URL with conversation ID on initial load
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // If no URL conversation ID but we have a stored one, update URL
    if (!urlConversationId && storedConversationId) {
      const basePath = getBasePath();
      navigate(`${basePath}/conversations/${storedConversationId}`, { replace: true });
    }
    // If no URL conversation ID and no stored one, create new and update URL
    else if (!urlConversationId && !storedConversationId) {
      const newId = crypto.randomUUID();
      setStoredConversationId(newId);
      const basePath = getBasePath();
      navigate(`${basePath}/conversations/${newId}`, { replace: true });
    }
    // If URL has conversation ID, sync to localStorage
    else if (urlConversationId && urlConversationId !== storedConversationId) {
      setStoredConversationId(urlConversationId);
    }
  }, [urlConversationId, storedConversationId, setStoredConversationId, navigate, getBasePath]);

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
    const basePath = getBasePath();
    navigate(`${basePath}/conversations/${newId}`);
    return newId;
  }, [setStoredConversationId, navigate, getBasePath]);

  const switchToChat = useCallback(
    async (chatId: string): Promise<Message[]> => {
      setStoredConversationId(chatId);
      const basePath = getBasePath();
      navigate(`${basePath}/conversations/${chatId}`);

      try {
        const history = await getConversationHistory(chatId, baseURL);
        return history.messages;
      } catch (err) {
        console.error('Error loading chat history:', err);
        return [];
      }
    },
    [setStoredConversationId, navigate, getBasePath, baseURL]
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

  const deleteAllChats = useCallback(
    async () => {
      if (!userId) return;

      try {
        await deleteAllConversationsApi(userId, agentName, baseURL);
        setConversations([]);
        createNewChat();
      } catch (err) {
        console.error('Error deleting all conversations:', err);
        throw err;
      }
    },
    [userId, agentName, baseURL, createNewChat]
  );

  const duplicateChat = useCallback(
    async (chatId: string, title?: string) => {
      try {
        const newConv = await duplicateConversationApi(chatId, baseURL, title);
        setConversations(prev => [newConv, ...prev]);
      } catch (err) {
        console.error('Error duplicating conversation:', err);
        throw err;
      }
    },
    [baseURL]
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

  const updateChatTitle = useCallback(
    async (chatId: string, title: string) => {
      try {
        await updateTitleApi(chatId, title, baseURL);
        setConversations(prev =>
          prev.map(c =>
            c.id === chatId ? { ...c, title } : c
          )
        );
      } catch (err) {
        console.error('Error updating chat title:', err);
        throw err;
      }
    },
    [baseURL]
  );

  return {
    conversationId,
    conversations,
    isLoading,
    error,
    createNewChat,
    switchToChat,
    deleteChat,
    deleteAllChats,
    duplicateChat,
    updateTitle,
    updateChatTitle,
    loadConversations,
  };
}
