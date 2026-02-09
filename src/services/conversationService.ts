import { apiRequest, getBaseURL } from './api';
import type { Message, Conversation } from '../types';

interface ConversationHistoryResponse {
  conversationId: string;
  messageCount: number;
  messages: Array<{
    id: number | string;
    role: 'user' | 'assistant' | 'developer';
    content: string;
    createdAt: string;
    metadata?: {
      crewMember?: string;
      injectedForTesting?: boolean;
      crewMemberName?: string;
      injectedAt?: string;
      [key: string]: unknown;
    };
    thinkingSteps?: Array<{
      stepType: string;
      description: string;
      stepOrder: number;
      metadata?: Record<string, unknown>;
    }>;
  }>;
}

interface UserConversationsResponse {
  userId: string;
  count: number;
  conversations: Array<{
    externalId: string;
    title: string;
    messageCount: number;
    channel?: 'web' | 'whatsapp';
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function getConversationHistory(
  conversationId: string,
  baseURL?: string
): Promise<{ conversationId: string; messages: Message[] }> {
  const data = await apiRequest<ConversationHistoryResponse>(
    `/api/conversation/${conversationId}/history`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );

  return {
    conversationId: data.conversationId,
    messages: data.messages.map(msg => ({
      id: String(msg.id),
      dbId: typeof msg.id === 'number' ? msg.id : undefined,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.createdAt),
      crewMember: msg.metadata?.crewMember,
      thinkingSteps: msg.thinkingSteps?.map(step => ({
        stepType: step.stepType,
        description: step.description,
        stepOrder: step.stepOrder,
        metadata: step.metadata,
      })) || [],
      // Developer message injection metadata
      ...(msg.role === 'developer' && msg.metadata?.injectedForTesting ? {
        injectionMeta: {
          injectedForTesting: true,
          crewMemberName: msg.metadata.crewMemberName || undefined,
          injectedAt: msg.metadata.injectedAt || new Date().toISOString(),
        },
      } : {}),
    })),
  };
}

export async function getUserConversations(
  userId: string,
  agentName: string,
  baseURL?: string
): Promise<Conversation[]> {
  const data = await apiRequest<UserConversationsResponse>(
    `/api/user/${userId}/conversations?agentName=${encodeURIComponent(agentName)}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );

  return data.conversations.map(conv => ({
    id: conv.externalId,
    title: conv.title,
    messageCount: conv.messageCount,
    channel: conv.channel,
    createdAt: new Date(conv.createdAt),
    updatedAt: new Date(conv.updatedAt),
  }));
}

export async function updateConversationTitle(
  conversationId: string,
  title: string,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/conversation/${conversationId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    },
    baseURL || getBaseURL()
  );
}

export async function deleteConversation(
  conversationId: string,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/conversation/${conversationId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function deleteMessage(
  conversationId: string,
  messageId: number,
  baseURL?: string
): Promise<void> {
  await apiRequest(
    `/api/conversation/${conversationId}/message/${messageId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export async function deleteMessages(
  conversationId: string,
  messageIds: number[],
  baseURL?: string
): Promise<{ deletedCount: number }> {
  return apiRequest(
    `/api/conversation/${conversationId}/messages`,
    {
      method: 'DELETE',
      body: JSON.stringify({ messageIds }),
    },
    baseURL || getBaseURL()
  );
}

export async function deleteMessagesFrom(
  conversationId: string,
  messageId: number,
  baseURL?: string
): Promise<{ deletedCount: number }> {
  return apiRequest(
    `/api/conversation/${conversationId}/messages-from/${messageId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

export interface InjectedMessage {
  id: number;
  role: 'developer';
  content: string;
  metadata: {
    injectedForTesting: boolean;
    crewMemberName?: string;
    injectedAt: string;
  };
  createdAt: string;
}

/**
 * Inject a developer-role message into conversation history (for testing transition prompts)
 */
export async function injectDeveloperMessage(
  conversationId: string,
  content: string,
  crewMemberName?: string,
  baseURL?: string
): Promise<InjectedMessage> {
  const response = await apiRequest<{ success: boolean; message: InjectedMessage }>(
    `/api/conversation/${conversationId}/inject-developer-message`,
    {
      method: 'POST',
      body: JSON.stringify({ content, crewMemberName }),
    },
    baseURL || getBaseURL()
  );
  return response.message;
}
