/**
 * Simple browser-based user identification for draft tasks.
 * Generates and stores a unique ID in localStorage.
 */

const USER_ID_KEY = 'aspect_user_id';
const DRAFT_DEFAULT_KEY = 'aspect_draft_default';

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    userId = generateUserId();
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
}

export function getDraftDefault(): boolean {
  const value = localStorage.getItem(DRAFT_DEFAULT_KEY);
  return value === 'true';
}

export function setDraftDefault(enabled: boolean): void {
  localStorage.setItem(DRAFT_DEFAULT_KEY, enabled ? 'true' : 'false');
}
