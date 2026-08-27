/**
 * Aspect Modules — API client.
 *
 * Every call wraps apiRequest (which attaches the super-admin key when the
 * dashboard is unlocked); components never call fetch directly.
 *
 * Note the two audiences the server splits by path: `/api/modules/:datasetId`
 * is the PUBLIC status a customer's browser may call, and everything under
 * `/api/modules/admin/...` requires the super-admin key. Only the admin calls
 * belong in this dashboard service; the public one is used by the client
 * situation page (D2) and lives in its own service.
 */

import { apiRequest } from './api';
import type { ClientModule, ModuleRunResponse } from '../types/modules';

const base = (datasetId: string) => `/api/modules/admin/${encodeURIComponent(datasetId)}`;

export const modulesService = {
  /** Every registered module for a dataset, with state and resolved settings. */
  list: (datasetId: string, baseURL?: string) =>
    apiRequest<{ datasetId: string; modules: ClientModule[] }>(base(datasetId), {}, baseURL)
      .then(r => r.modules),

  get: (datasetId: string, moduleId: string, baseURL?: string) =>
    apiRequest<ClientModule>(`${base(datasetId)}/${encodeURIComponent(moduleId)}`, {}, baseURL),

  /**
   * The on/off switch. Does NOT touch status — a module can be enabled before
   * it has ever been initialized (it simply is not live yet), and disabling
   * one must not throw away a converged binding.
   */
  setEnabled: (datasetId: string, moduleId: string, enabled: boolean, baseURL?: string) =>
    apiRequest<ClientModule>(
      `${base(datasetId)}/${encodeURIComponent(moduleId)}/enabled`,
      { method: 'PUT', body: JSON.stringify({ enabled }) },
      baseURL,
    ),

  saveSettings: (
    datasetId: string,
    moduleId: string,
    settings: Record<string, unknown>,
    baseURL?: string,
  ) =>
    apiRequest<ClientModule>(
      `${base(datasetId)}/${encodeURIComponent(moduleId)}/settings`,
      { method: 'PUT', body: JSON.stringify({ settings }) },
      baseURL,
    ),

  /**
   * Starts the init pipeline and returns immediately with a run id — the
   * pipeline continues server-side and is polled via latestRun(). 409 if a
   * run is already in progress.
   */
  startInit: (datasetId: string, moduleId: string, baseURL?: string) =>
    apiRequest<{ runId: number; status: string }>(
      `${base(datasetId)}/${encodeURIComponent(moduleId)}/init`,
      { method: 'POST', body: JSON.stringify({}) },
      baseURL,
    ),

  /** What the progress bar polls. `progress` is computed server-side. */
  latestRun: (datasetId: string, moduleId: string, baseURL?: string) =>
    apiRequest<ModuleRunResponse>(
      `${base(datasetId)}/${encodeURIComponent(moduleId)}/runs/latest`, {}, baseURL,
    ),
};
