import { apiRequest, getBaseURL } from './api';
import type { Conversation } from '../types';

interface LinkPhoneResponse {
  userId: string;
  conversations: Conversation[];
}

export async function linkPhone(
  phone: string,
  agentName: string,
  baseURL?: string
): Promise<LinkPhoneResponse> {
  return apiRequest<LinkPhoneResponse>(
    '/api/user/link-phone',
    {
      method: 'POST',
      body: JSON.stringify({ phone, agentName }),
    },
    baseURL || getBaseURL()
  );
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
