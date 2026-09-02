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
   */
  list: (datasetId: string, withHeadlines = false, baseURL?: string) =>
    apiRequest<AppsResponse>(`${base(datasetId)}${withHeadlines ? '?headlines=1' : ''}`, {}, baseURL),

  /**
   * Does this dataset show an Apps nav item?
   *
   * Resolves false on any failure rather than throwing: a nav item is not
   * worth an error screen, and the page behind it 404s on its own if someone
   * reaches it by URL.
   */
  hasApps: (datasetId: string, baseURL?: string) =>
    appsService.list(datasetId, false, baseURL)
      .then(r => r.apps.length > 0)
      .catch(() => false),
};
