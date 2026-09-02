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
  /** Kept out of the recommendations entirely — see the settings dialog. */
  excluded?: boolean;
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
  /** What was done to the raw quantity, worded in the requested language. */
  orderQtyRounding: string;
  /**
   * The same thing as a code, so a sentence built around it can tell the cases
   * apart without pattern-matching the prose - which would put the wording back
   * on the client, in one language.
   */
  orderQtyRoundingCode: string | null;
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
  /** Suppliers kept out of the list on purpose, and how many items that removed. */
  excluded?: { items: number; suppliers: string[] };
}

/** One line of the supplier accordion, computed server-side. */
export interface PlanSupplier {
  supplier: string;
  /** Items overdue or due soon - what the row lists when opened. */
  items: number;
  estimatedTotalExVat: number;
  overdue: number;
  dueSoon: number;
  leadTimeDays: number | null;
  leadTimeSource: LeadTimeSource;
  excluded: boolean;
}

/**
 * The whole Procurement screen in one small response.
 *
 * The page used to build this itself from every recommendation - 14 MB on
 * ZolStock, to draw ten lines. The grouping belongs to the server, which has
 * already computed every row to produce the summary.
 */
export interface PlanResponse {
  datasetId: string;
  today: string;
  dataThrough: string | null;
  summary: RecommendationSummary;
  supplierCount: number;
  excluded: { items: number; suppliers: string[] };
  suppliers: PlanSupplier[];
}
