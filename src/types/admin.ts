/**
 * Admin Types
 *
 * Types for the user management admin system.
 * Mirrors the users table structure with extended fields.
 */

export type UserRole = 'user' | 'admin';
export type UserSource = 'web' | 'whatsapp';
export type UserSubscription = 'demo' | 'pro';

export interface AdminUser {
  id: number;
  externalId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole;
  source: UserSource;
  subscription: UserSubscription;
  tenant: string | null;
  whatsappConversationId: number | null;
  lastActiveAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  /** Computed: number of active conversations */
  conversationCount: number;
}

export interface AdminUserDetails extends AdminUser {
  conversations: AdminConversation[];
}

export interface AdminConversation {
  id: number;
  externalId: string;
  channel: 'web' | 'whatsapp';
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
}

export interface AdminUserFilters {
  source?: UserSource;
  tenant?: string;
  subscription?: UserSubscription;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminStats {
  totalUsers: number;
  webUsers: number;
  whatsappUsers: number;
  proUsers: number;
  totalConversations: number;
}

export interface CreateUserPayload {
  phone: string;
  name?: string;
  email?: string;
  tenant?: string;
  subscription?: UserSubscription;
  role?: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  subscription?: UserSubscription;
  tenant?: string;
}

export interface LinkWhatsAppPayload {
  phone: string;
}

export interface DeleteUserResponse {
  userId: number;
  deletedConversations: number;
  deletedMessages: number;
}
