/**
 * Smart Replenishment — client API.
 *
 * These are the CLIENT-facing reads (the buyer's screen), not the admin ones.
 * Every route 404s unless the module is enabled AND ready, which is exactly
 * how the page decides whether it exists at all — see `isLive` below.
 */

import { apiRequest } from './api';
import type { SupplierRow, RecommendationsResponse, Recommendation, PlanResponse } from '../types/replenishment';

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
  plan: (datasetId: string, lang?: string, baseURL?: string) =>
    apiRequest<PlanResponse>(
      `${base(datasetId)}/plan${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`, {}, baseURL,
    ),

  recommendations: (
    datasetId: string,
    // `lang` selects the language of the CAVEATS only. Every figure is computed
    // on structured values and comes back identical either way, so two people
    // reading in two languages reconcile to the same numbers.
    opts: {
      supplier?: string; onlyDue?: boolean; limit?: number; offset?: number;
      search?: string; lang?: string;
    } = {},
    baseURL?: string,
  ) => {
    const q = new URLSearchParams();
    if (opts.supplier) q.set('supplier', opts.supplier);
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
};
