/**
 * Smart Replenishment — client types.
 *
 * Mirrors the server's engine output (aspect-agent-server/modules/
 * replenishment/engine.js) and the recommendations service. Kept by hand.
 */

export type ReplenishmentStatus = 'overdue' | 'due_soon' | 'ok' | 'no_demand';

/**
 * Procurement Groups — the five buckets every due item lands in.
 *
 * Stable ids from the server's classifier (modules/replenishment/groups.js);
 * the screen renders its own labels ("Needs checking" for `suspicious`).
 */
export type ProcurementGroup = 'order_now' | 'suspicious' | 'out_of_season' | 'fading' | 'new';

/** Chip order on the group bar — the design's, not alphabetical. */
export const PROCUREMENT_GROUPS: ProcurementGroup[] = [
  'order_now', 'suspicious', 'out_of_season', 'fading', 'new',
];

/**
 * Counts over the WHOLE due set, one entry per group — what the chips show
 * regardless of which group is active. Absent entirely on a server that has
 * not run the groups migration yet, which is how the page knows to render
 * itself exactly as before.
 */
export type GroupSummary = Partial<Record<ProcurementGroup, {
  count: number;
  estimatedCostExVat: number;
}>>;

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
  /** WHEN TO ORDER — today at the earliest, never a past date. The
   *  instruction; orderByDate above is the diagnosis it derives from. */
  placeOrderBy: string | null;
  /** When current stock is projected to hit zero. */
  runoutDate: string | null;
  /** When goods would land if the order went out today. */
  arrivesIfOrderedToday: string | null;
  /** Projected zero-stock days even if ordered today (0 = still in time). */
  stockoutGapDays: number | null;
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

  // ── Procurement Groups (absent until the server migration lands) ──
  /** The group in force: the buyer's verdict when one exists, else the suggestion. */
  group?: ProcurementGroup;
  groupSource?: 'computed' | 'buyer';
  groupNote?: string | null;
  /** A recompute moved the suggestion under a standing buyer verdict — review dot. */
  suggestionChanged?: boolean;
  /**
   * true/false = the warehouse file does/doesn't carry this item;
   * null = the signals view is not built yet (render as before).
   */
  stockTracked?: boolean | null;
  /** What the classifier said, before any verdict — sent back on a verdict PUT. */
  suggestedGroup?: ProcurementGroup;
  groupReasonCode?: string;
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
  /** Chip counts over the whole due set — absent pre-migration. */
  groupSummary?: GroupSummary;
  /** The group filter this response was computed under, or null. */
  group?: ProcurementGroup | null;
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
  /**
   * Chip counts over the WHOLE due set, present regardless of the active
   * filter. Absent = the server has not run the groups migration; the page
   * renders exactly as before, no chips and no Smart Tune.
   */
  groupSummary?: GroupSummary;
  /** The active group filter the suppliers list reflects, or null. */
  group?: ProcurementGroup | null;
}

// ── Smart Tune: previewed proposals ─────────────────────────────────────────

/** One row of a proposal's preview table (server: proposals.service `sample`). */
export interface TuneProposalSampleRow {
  sku: string;
  item: string;
  inStock: number;
  stockTracked: boolean | null;
  salesPerDay: number;
  orderByDate: string | null;
  group: ProcurementGroup;
}

/**
 * A previewed change the tune chat proposed. Nothing has moved when this
 * arrives — Process is a button, never a chat turn.
 */
export interface TuneProposal {
  proposalId: number;
  targetGroup: ProcurementGroup;
  count: number;
  /** The filter in words — quoted, so the buyer can check what was matched. */
  interpreted: string;
  expiresAt: string;
  sample: TuneProposalSampleRow[];
}

export interface TuneExecuteResult {
  operationId: number;
  applied: number;
  skipped: number;
  targetGroup: ProcurementGroup;
}
