/** Where a problem row leads — the existing Admin pages (task #985). */

import type { CustomerProblem } from '../types/manage';

/** Admin → Conversations, opened on this conversation (`?c=`). */
export const conversationHref = (p: CustomerProblem) =>
  `/${encodeURIComponent(p.agentSlug)}/builder/admin/conversations?c=${p.conversationId}`;

/** Admin → Errors — the technical side. */
export const errorsHref = (p: CustomerProblem) =>
  `/${encodeURIComponent(p.agentSlug)}/builder/admin/errors`;
