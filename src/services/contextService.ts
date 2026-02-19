import { apiRequest, getBaseURL } from './api';

export interface ContextResponse {
  conversationId: string;
  userLevel: Record<string, unknown>;
  conversationLevel: Record<string, unknown>;
}

export interface UpdateContextResponse {
  success: boolean;
  namespace: string;
  level: 'user' | 'conversation';
  data: unknown;
}

export interface DeleteContextResponse {
  success: boolean;
  namespace: string;
  level: 'user' | 'conversation';
}

export async function getContext(
  conversationId: string,
  baseURL?: string
): Promise<ContextResponse> {
  return apiRequest<ContextResponse>(
    `/api/conversation/${conversationId}/context`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

export async function updateContext(
  conversationId: string,
  namespace: string,
  data: unknown,
  level: 'user' | 'conversation' = 'user',
  baseURL?: string
): Promise<UpdateContextResponse> {
  return apiRequest<UpdateContextResponse>(
    `/api/conversation/${conversationId}/context/${namespace}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ data, level }),
    },
    baseURL || getBaseURL()
  );
}

export async function deleteContext(
  conversationId: string,
  namespace: string,
  level: 'user' | 'conversation' = 'user',
  baseURL?: string
): Promise<DeleteContextResponse> {
  return apiRequest<DeleteContextResponse>(
    `/api/conversation/${conversationId}/context/${namespace}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ level }),
    },
    baseURL || getBaseURL()
  );
}
