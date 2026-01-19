import { apiRequest, getBaseURL } from './api';

interface CreateUserResponse {
  userId: string;
  createdAt: string;
}

export async function createUser(baseURL?: string): Promise<CreateUserResponse> {
  return apiRequest<CreateUserResponse>(
    '/api/user/create',
    { method: 'POST' },
    baseURL || getBaseURL()
  );
}
