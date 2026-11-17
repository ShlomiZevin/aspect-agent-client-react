/**
 * The management center (task #985) — server: builder/routes/manageRoute.js.
 * "All" needs the super-admin key, which `apiRequest` attaches once the
 * browser is unlocked (superAdminService).
 */

import { apiRequest } from './api';
import type { CustomerProblemsResponse, ProblemRange } from '../types/manage';

export const manageService = {
  /** One agent's customer-chat problems. */
  getAgentProblems: (agentSlug: string, range: ProblemRange) =>
    apiRequest<CustomerProblemsResponse>(
      `/api/manage/agents/${encodeURIComponent(agentSlug)}/customer-problems?range=${range}`,
    ),

  /** Every agent (internal) — optionally narrowed to one agent. */
  getAllProblems: (range: ProblemRange, agentSlug?: string | null) =>
    apiRequest<CustomerProblemsResponse>(
      `/api/manage/customer-problems?range=${range}${agentSlug ? `&agent=${encodeURIComponent(agentSlug)}` : ''}`,
    ),
};
