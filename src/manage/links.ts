/** Where the management center links out (task #985). */

/** The Builder, opened on this conversation — "חקירה ב-Builder" (Lybi team only, new tab). */
export const builderConversationHref = (agentSlug: string, conversationId: number) =>
  `/${encodeURIComponent(agentSlug)}/builder?c=${conversationId}`;

/** A page of the center in a scope ('all' or an agent slug). */
export const scopePath = (scope: string, page: string) => `/manage/${encodeURIComponent(scope)}/${page}`;
