/**
 * Owner identity for the Live (customer-facing) chat.
 *
 * Intentionally reads/writes the SAME localStorage key the builder
 * uses (`builder:ownerUserId`, see BuilderApp.getOrCreateOwnerUserId)
 * so conversations started here show up in the builder's User Chat
 * history and vice versa — one user entity across both surfaces.
 */

const OWNER_KEY = 'builder:ownerUserId';

export function getOwnerUserId(): string {
  try {
    const existing = localStorage.getItem(OWNER_KEY);
    if (existing && existing.length > 0) return existing;
    const next = `builder-owner-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(OWNER_KEY, next);
    return next;
  } catch {
    // Private mode / unavailable storage — per-session fallback.
    return `builder-owner-anon-${Date.now()}`;
  }
}
