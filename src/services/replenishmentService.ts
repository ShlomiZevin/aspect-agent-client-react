/**
 * Smart Replenishment — client API.
 *
 * These are the CLIENT-facing reads (the buyer's screen), not the admin ones.
 * Every route 404s unless the module is enabled AND ready, which is exactly
 * how the page decides whether it exists at all — see `isLive` below.
 */

import { apiRequest } from './api';
import type {
  SupplierRow, RecommendationsResponse, Recommendation, PlanResponse,
  ProcurementGroup, TuneExecuteResult,
} from '../types/replenishment';

const base = (datasetId: string) => `/api/modules/replenishment/${encodeURIComponent(datasetId)}`;

export const replenishmentService = {
  /**
   * Is the module live for this dataset?
   *
   * Resolved from the PUBLIC module status endpoint rather than by probing a
   * data route — that call is cheap, leaks nothing, and answers the same
   * question the nav item needs.
   */
  isLive: (datasetId: string, baseURL?: string) =>
    apiRequest<{ datasetId: string; modules: { id: string }[] }>(
      `/api/modules/${encodeURIComponent(datasetId)}`, {}, baseURL,
    )
      .then(r => r.modules.some(m => m.id === 'replenishment'))
      .catch(() => false),

  suppliers: (datasetId: string, baseURL?: string) =>
    apiRequest<{ suppliers: SupplierRow[] }>(`${base(datasetId)}/suppliers`, {}, baseURL)
      .then(r => r.suppliers),

  /**
   * Set or clear one supplier's overrides. A field sent as null CLEARS it and
   * falls back to the dataset default — that is how a buyer un-sets a lead
   * time.
   */
  saveSupplier: (
    datasetId: string,
    supplierKey: string,
    patch: Record<string, unknown>,
    baseURL?: string,
  ) =>
    apiRequest<{ supplierKey: string }>(
      `${base(datasetId)}/suppliers/${encodeURIComponent(supplierKey)}`,
      { method: 'PUT', body: JSON.stringify(patch) },
      baseURL,
    ),

  /**
   * The screen: tiles plus one line per supplier.
   *
   * What the page opens with. Item rows come later, one expanded supplier at a
   * time — asking for all of them to draw the accordion was a 14 MB response.
   */
  plan: (datasetId: string, lang?: string, baseURL?: string, group?: ProcurementGroup) => {
    const q = new URLSearchParams();
    if (lang) q.set('lang', lang);
    // The active chip. A pre-groups server ignores the parameter and returns
    // the whole plan — which is exactly the page the chips-less screen shows.
    if (group) q.set('group', group);
    const qs = q.toString();
    return apiRequest<PlanResponse>(
      `${base(datasetId)}/plan${qs ? `?${qs}` : ''}`, {}, baseURL,
    );
  },

  recommendations: (
    datasetId: string,
    // `lang` selects the language of the CAVEATS only. Every figure is computed
    // on structured values and comes back identical either way, so two people
    // reading in two languages reconcile to the same numbers.
    opts: {
      supplier?: string; onlyDue?: boolean; limit?: number; offset?: number;
      search?: string; lang?: string; group?: ProcurementGroup;
    } = {},
    baseURL?: string,
  ) => {
    const q = new URLSearchParams();
    if (opts.supplier) q.set('supplier', opts.supplier);
    if (opts.group) q.set('group', opts.group);
    if (opts.onlyDue) q.set('onlyDue', 'true');
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.offset) q.set('offset', String(opts.offset));
    if (opts.search) q.set('search', opts.search);
    if (opts.lang) q.set('lang', opts.lang);
    const qs = q.toString();
    return apiRequest<RecommendationsResponse>(
      `${base(datasetId)}/recommendations${qs ? `?${qs}` : ''}`, {}, baseURL,
    );
  },

  bySku: (datasetId: string, sku: string, baseURL?: string) =>
    apiRequest<{ recommendation: Recommendation }>(
      `${base(datasetId)}/recommendations/${encodeURIComponent(sku)}`, {}, baseURL,
    ).then(r => r.recommendation),

  // ── Procurement Groups: the buyer's verdict layer ─────────────────────

  /**
   * Set or clear one item's group. `group: null` clears the verdict — the
   * item follows the computed suggestion again (that is Undo).
   * `suggestedGroup` is what the screen showed when the buyer decided,
   * recorded so a later recompute that disagrees flags for review.
   * 403 when group edits are disabled for this client; 404 when the module
   * is off — both surface as thrown errors with the server's own message.
   */
  saveVerdict: (
    datasetId: string,
    sku: string,
    body: { group: ProcurementGroup | null; suggestedGroup?: ProcurementGroup | null; note?: string; updatedBy?: string },
    baseURL?: string,
  ) =>
    apiRequest<{ sku: string }>(
      `${base(datasetId)}/verdicts/${encodeURIComponent(sku)}`,
      { method: 'PUT', body: JSON.stringify(body) },
      baseURL,
    ),

  // ── Smart Tune: the preview's two buttons, and Undo ───────────────────

  executeProposal: (datasetId: string, proposalId: number, baseURL?: string) =>
    apiRequest<TuneExecuteResult>(
      `${base(datasetId)}/proposals/${encodeURIComponent(String(proposalId))}/execute`,
      { method: 'POST', body: JSON.stringify({}) },
      baseURL,
    ),

  cancelProposal: (datasetId: string, proposalId: number, baseURL?: string) =>
    apiRequest<{ ok: boolean }>(
      `${base(datasetId)}/proposals/${encodeURIComponent(String(proposalId))}/cancel`,
      { method: 'POST', body: JSON.stringify({}) },
      baseURL,
    ),

  revertOperation: (datasetId: string, operationId: number, baseURL?: string) =>
    apiRequest<{ ok: boolean; restored: number }>(
      `${base(datasetId)}/operations/${encodeURIComponent(String(operationId))}/revert`,
      { method: 'POST', body: JSON.stringify({}) },
      baseURL,
    ),
};
