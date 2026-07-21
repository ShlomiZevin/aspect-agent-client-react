export type InsightCategory = 'cross-sell' | 'margin' | 'inventory' | 'trend' | 'risk';
export type ImpactDirection = 'positive' | 'negative' | 'neutral';
export type ConfidenceLabel = 'High' | 'Medium' | 'Low';

export interface ChartSeriesPoint {
  key: string;
  label?: string;
  color: string;
  dashed?: boolean;
  points: number[];
}

export interface InsightChartPreview {
  categories: string[];
  series: ChartSeriesPoint[];
}

export interface InsightSummary {
  id: string;
  category: InsightCategory;
  categoryLabel: string;
  tag: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  foundAgo: string;
  headline: string;
  impactValue: string;
  impactLabel: string;
  impactDirection: ImpactDirection;
  ctaLabel: string;
  chartPreview: InsightChartPreview;
  /** True for insights produced by a real "Start analysis" run — these can be deleted; seed content cannot. */
  isGenerated?: boolean;
  /** True when pinned to "Tracked by you" via the detail page's Track button — the only way anything lands in that strip. */
  tracked?: boolean;
}

export interface InsightScenario {
  key: 'current' | 'good' | 'neutral' | 'negative';
  label: string;
  value: string;
  description: string;
}

export interface InsightReasoningStep {
  title: string;
  description: string;
}

export interface InsightConfidenceCheck {
  positive: boolean;
  text: string;
}

export interface InsightChartData {
  title: string;
  unit: string;
  categories: string[];
  series: ChartSeriesPoint[];
  donutPct?: number;
}

export interface RankedListItem {
  label: string;
  value: string;
  /** 0-100, relative to the top item — drives the bar fill width. */
  pct: number;
}

export interface ComparisonItem {
  label: string;
  value: string;
  sub: string;
  direction: ImpactDirection;
}

/**
 * The detail page's content is 1-3 of these, chosen by the model per
 * question rather than one fixed template every time (see
 * investigation.service.js's synthesis prompt) — pick the block type to
 * render off `type`.
 */
export type InsightBlock =
  | { type: 'chart'; chart: InsightChartData }
  | { type: 'ranked_list'; title: string; unit: string; items: RankedListItem[] }
  | { type: 'stat_callout'; value: string; label: string; description: string }
  | { type: 'comparison'; items: ComparisonItem[] }
  | { type: 'scenarios'; items: InsightScenario[] };

export interface InsightDetail extends Omit<InsightSummary, 'chartPreview'> {
  title: string;
  breadcrumbLabel: string;
  /** Small fixed preview chart for the list-view card only — NOT what the detail page renders, see `blocks`. */
  chart: InsightChartData;
  sourceNote: string;
  blocks: InsightBlock[];
  reasoning: InsightReasoningStep[];
  confidenceScore: number;
  confidenceChecks: InsightConfidenceCheck[];
  confidenceBasis: string;
  /** The real investigation prompt, derived data question, and SQL that produced this insight — shown via "View SQL queries". */
  evidence?: { prompt: string; dataQuestion: string; sql: string };
}

export interface TrackedMetric {
  id: string;
  label: string;
  value: string;
  sub: string;
  trendDir: 'up' | 'down' | 'flat';
  trendLabel: string;
  points: number[];
  /**
   * True when `points` is a ranked snapshot across different entities
   * (products/stores/SKUs), not a value sampled over time — e.g. "top 8
   * product families by revenue" has 8 points, but there is no meaningful
   * "before vs after" between rank #1 and rank #8. The sparkline should
   * render as a bar (ranking) rather than a line (implies a time trend).
   */
  isRanking: boolean;
}

export interface IntelligenceDatasetMeta {
  id: string;
  name: string;
  description: string;
  logoText: string;
  gradientFrom: string;
  gradientTo: string;
}

export interface InvestigateResult {
  prompt: string;
  status: 'ready';
  resultLabel: string;
  findingsCount: number;
  combinedImpactLabel: string;
  insightIds: string[];
}

/** "Open <cta> plan" on an insight detail page — see generateActionPlan in investigation.service.js. */
export interface ActionPlan {
  planTitle: string;
  steps: { title: string; detail: string }[];
  expectedImpact: string;
}
