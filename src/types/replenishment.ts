/**
 * Smart Replenishment — client types.
 *
 * Mirrors the server's engine output (aspect-agent-server/modules/
 * replenishment/engine.js) and the recommendations service. Kept by hand.
 */

export type ReplenishmentStatus = 'overdue' | 'due_soon' | 'ok' | 'no_demand';

/** Where a parameter came from — drives the "you set this / default" badge. */
export type LeadTimeSource = 'supplier' | 'dataset_default' | 'code';

export interface SupplierRow {
  supplier: string;
  supplierCode: string | null;
  skuItemCount: number;
  skusWithStock: number;
  skusSold365d: number;
  warehouseUnits: number;
  warehouseValueExVat: number;
  unitsSold365d: number;
  dataThrough: string | null;
  leadTimeDays: number | null;
  leadTimeSource: LeadTimeSource;
  reviewDays: number | null;
  safetyDays: number | null;
  minOrderUnits: number | null;
}

/** One recommendation, carrying everything the trust panel needs to show. */
export interface Recommendation {
  sku: string;
  itemNumber: string | null;
  itemName: string | null;
  category: string | null;
  supplier: string | null;
  supplierCode: string | null;

  status: ReplenishmentStatus;
  unmatched: boolean;

  // inputs — the row's working
  velocityDaily: number;
  velocityBasis: string;
  thinHistory: boolean;
  staleDemand: boolean;
  qtyInWindow: number;
  warehouseQty: number;
  storeQty: number;
  onHand: number;
  onOrderQty: number;
  onOrderLineCount: number;
  onOrderLastDate: string | null;
  /** No goods-receipt events exist in the feed, so "on the way" may already have arrived. */
  onOrderIsUnverified: boolean;
  committedQty: number;
  netAvailable: number;

  // parameters, each with its source
  leadTimeDays: number;
  leadTimeSource: LeadTimeSource;
  reviewDays: number;
  safetyStock: number;
  safetyStockSource: 'configured' | 'computed';
  unitsPerCarton: number | null;

  // results
  reorderPoint: number;
  daysOfCover: number | null;
  orderByDate: string | null;
  daysLate: number | null;
  targetStock: number;
  rawQty: number;
  orderQty: number;
  orderQtyRounding: string;
  estimatedCostExVat: number | null;

  dataThrough: string | null;
  firstSold: string | null;
  lastSold: string | null;
  /** Every caveat, already worded — the screen quotes these rather than re-deriving them. */
  notes: string[];
}

export interface RecommendationSummary {
  orderNow: number;
  dueSoon: number;
  ok: number;
  noDemand: number;
  estimatedTotalExVat: number;
}

export interface RecommendationsResponse {
  datasetId: string;
  today: string;
  summary: RecommendationSummary;
  dataThrough: string | null;
  total: number;
  recommendations: Recommendation[];
}
