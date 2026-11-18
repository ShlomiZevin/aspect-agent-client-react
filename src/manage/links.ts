/** Where the management center lives and links out (task #985). */

/**
 * The center's home. Every center link is built from this — nowhere else
 * spells the path. It moved from `/manage` (round 6); App.tsx redirects the
 * old links here (`legacyManageRedirect`).
 */
export const MANAGE_BASE = '/lybi/manage';

/** A page of the center in a scope ('all' or an agent slug). */
export const scopePath = (scope: string, page: string) => `${MANAGE_BASE}/${encodeURIComponent(scope)}/${page}`;

/**
 * An old `/manage/...` address → the same place under MANAGE_BASE, with the
 * rest of the path, the query and the hash kept.
 */
export const legacyManageRedirect = (pathname: string, search: string, hash: string) =>
  `${MANAGE_BASE}${pathname.replace(/^\/manage(?=\/|$)/, '')}${search}${hash}`;

/** The Builder, opened on this conversation — "חקירה ב־Builder" (Lybi team only, new tab). */
export const builderConversationHref = (agentSlug: string, conversationId: number) =>
  `/${encodeURIComponent(agentSlug)}/builder?c=${conversationId}`;
