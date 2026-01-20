import { apiRequest, getBaseURL } from './api';
import type { Message, Conversation, ThinkingStep } from '../types';

interface ConversationHistoryResponse {
  conversationId: string;
  messageCount: number;
  messages: Array<{
    id: number | string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
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
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.createdAt),
      thinkingSteps: msg.thinkingSteps?.map(step => ({
        stepType: step.stepType,
        description: step.description,
        stepOrder: step.stepOrder,
        metadata: step.metadata,
      })) || [],
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
