/**
 * The Apps shelf — the client half of modules/services/apps.service.js.
 *
 * The shelf, not the individual apps: which business apps are live for this
 * dataset, what goes on their badges, and what is announced but not built.
 * Each app's own data still comes from its own service.
 */

import { apiRequest } from './api';
import type { AppsResponse } from '../types/apps';

const base = (datasetId: string) => `/api/modules/apps/${encodeURIComponent(datasetId)}`;

export const appsService = {
  /**
   * @param withHeadlines the live numbers for each app. For Procurement that
   *   is a full pass over every tracked SKU, so the nav check — which only
   *   needs to know whether the shelf is empty — leaves it off.
   * @param viewerId the anonymous per-browser id from UserContext — scopes
   *   which of the dataset's Otto drafts come back (task #92).
   */
  list: (datasetId: string, withHeadlines = false, viewerId: string | null = null, baseURL?: string) => {
    const params = new URLSearchParams();
    if (withHeadlines) params.set('headlines', '1');
    if (viewerId) params.set('viewerId', viewerId);
    const qs = params.toString();
    return apiRequest<AppsResponse>(`${base(datasetId)}${qs ? `?${qs}` : ''}`, {}, baseURL);
  },

  /**
   * Does this dataset show an Apps nav item?
   *
   * Resolves false on any failure rather than throwing: a nav item is not
   * worth an error screen, and the page behind it 404s on its own if someone
   * reaches it by URL.
   */
  hasApps: (datasetId: string, viewerId: string | null = null, baseURL?: string) =>
    appsService.list(datasetId, false, viewerId, baseURL)
      // Live app modules, the ability to create screens (Otto), or existing
      // custom screens — any of them earns the shelf. Mirrors the server's
      // own hasApps; keep the two in step.
      .then(r => r.apps.length > 0 || r.canCreate === true || (r.custom?.length ?? 0) > 0)
      .catch(() => false),
};
