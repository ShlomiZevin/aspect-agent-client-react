/**
 * Super-admin gate for the hidden /users page.
 *
 * Holds the unlock key in localStorage. When unlocked, adminService attaches
 * an `X-Super-Admin-Key` header so the server lets the request see across
 * all tenants (including null-tenant/anonymous users).
 *
 * Note: this is intentionally lightweight gating, not real auth. The key is
 * shared with internal users only.
 */

const STORAGE_KEY = 'super_admin_key';
const EXPECTED_KEY = '6724';

export function getSuperAdminKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isSuperAdminUnlocked(): boolean {
  return getSuperAdminKey() === EXPECTED_KEY;
}

export function unlockSuperAdmin(code: string): boolean {
  if (code === EXPECTED_KEY) {
    localStorage.setItem(STORAGE_KEY, code);
    return true;
  }
  return false;
}

export function lockSuperAdmin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
