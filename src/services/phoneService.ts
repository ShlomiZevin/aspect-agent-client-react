import { apiRequest, getBaseURL } from './api';
import type { Conversation } from '../types';

interface RawConversation {
  id: number;
  externalId: string;
  title?: string;
  messageCount?: number;
  channel?: 'web' | 'whatsapp';
  createdAt: string;
  updatedAt: string;
  metadata?: { title?: string };
  firstMessage?: string;
}

interface RawLinkPhoneResponse {
  userId: string;
  conversations: RawConversation[];
}

interface LinkPhoneResponse {
  userId: string;
  conversations: Conversation[];
}

export async function linkPhone(
  phone: string,
  agentName: string,
  baseURL?: string
): Promise<LinkPhoneResponse> {
  const raw = await apiRequest<RawLinkPhoneResponse>(
    '/api/user/link-phone',
    {
      method: 'POST',
      body: JSON.stringify({ phone, agentName }),
    },
    baseURL || getBaseURL()
  );

  // Map raw response to use externalId as id (consistent with getUserConversations)
  return {
    userId: raw.userId,
    conversations: raw.conversations.map(conv => ({
      id: conv.externalId,
      title: conv.metadata?.title || conv.firstMessage?.substring(0, 50) || 'New Chat',
      messageCount: conv.messageCount || 0,
      channel: conv.channel,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
    })),
  };
}

interface GoMobileResponse {
  userId: string;
  conversationId: string;
}

export async function goMobile(
  phone: string,
  conversationId: string,
  baseURL?: string
): Promise<GoMobileResponse> {
  return apiRequest<GoMobileResponse>(
    `/api/conversation/${encodeURIComponent(conversationId)}/link-phone`,
    {
      method: 'POST',
      body: JSON.stringify({ phone }),
    },
    baseURL || getBaseURL()
  );
}
