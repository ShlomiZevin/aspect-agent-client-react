/**
 * Admin Service
 *
 * API calls for user management admin functionality.
 */

import { apiRequest, getBaseURL } from './api';
import type {
  AdminUser,
  AdminUserDetails,
  AdminUsersResponse,
  AdminUserFilters,
  AdminStats,
  CreateUserPayload,
  UpdateUserPayload,
  LinkWhatsAppPayload,
  DeleteUserResponse,
} from '../types/admin';

/**
 * Get all users with optional filters
 */
export async function getUsers(
  filters: AdminUserFilters = {},
  baseURL?: string
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams();

  if (filters.source) params.append('source', filters.source);
  if (filters.tenant) params.append('tenant', filters.tenant);
  if (filters.subscription) params.append('subscription', filters.subscription);
  if (filters.search) params.append('search', filters.search);
  if (filters.agentName) params.append('agentName', filters.agentName);
  if (filters.includeSynthetic) params.append('includeSynthetic', 'true');
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());

  const queryString = params.toString();
  const endpoint = `/api/admin/users${queryString ? `?${queryString}` : ''}`;

  return apiRequest<AdminUsersResponse>(endpoint, { method: 'GET' }, baseURL || getBaseURL());
}

/**
 * Get admin dashboard stats
 */
export async function getStats(baseURL?: string, agentName?: string, tenant?: string): Promise<AdminStats> {
  const search = new URLSearchParams();
  if (agentName) search.append('agentName', agentName);
  if (tenant) search.append('tenant', tenant);
  const qs = search.toString();
  return apiRequest<AdminStats>(
    `/api/admin/stats${qs ? `?${qs}` : ''}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

/**
 * Get unique tenants for filter dropdown
 */
export async function getTenants(baseURL?: string): Promise<string[]> {
  const response = await apiRequest<{ tenants: string[] }>(
    '/api/admin/tenants',
    { method: 'GET' },
    baseURL || getBaseURL()
  );
  return response.tenants;
}

/**
 * Get single user by ID with full details
 */
export async function getUserById(
  userId: number,
  baseURL?: string
): Promise<AdminUserDetails> {
  return apiRequest<AdminUserDetails>(
    `/api/admin/users/${userId}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

/**
 * Update user fields (for inline editing)
 */
export async function updateUser(
  userId: number,
  updates: UpdateUserPayload,
  baseURL?: string
): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    `/api/admin/users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
    baseURL || getBaseURL()
  );
}

/**
 * Create new user manually
 */
export async function createUser(
  userData: CreateUserPayload,
  baseURL?: string
): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    '/api/admin/users',
    {
      method: 'POST',
      body: JSON.stringify(userData),
    },
    baseURL || getBaseURL()
  );
}

/**
 * Link WhatsApp number to user
 */
export async function linkWhatsApp(
  userId: number,
  payload: LinkWhatsAppPayload,
  baseURL?: string
): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    `/api/admin/users/${userId}/link`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    baseURL || getBaseURL()
  );
}

/**
 * Unlink WhatsApp from user
 */
export async function unlinkWhatsApp(
  userId: number,
  baseURL?: string
): Promise<AdminUser> {
  return apiRequest<AdminUser>(
    `/api/admin/users/${userId}/link`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}

/**
 * Delete user and all their conversations/messages
 */
export async function deleteUser(
  userId: number,
  baseURL?: string
): Promise<DeleteUserResponse> {
  return apiRequest<DeleteUserResponse>(
    `/api/admin/users/${userId}`,
    { method: 'DELETE' },
    baseURL || getBaseURL()
  );
}
