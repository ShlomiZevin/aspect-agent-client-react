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
  /** True when pinned to "Tracked by you" / "Saved reports" via the detail page's Track button — the only way anything lands there. */
  tracked?: boolean;
  /** Epoch ms — used for History-page date column and sorting. */
  createdAt?: number;
  /** 'user' = a question someone actually typed; 'proposed' = Aspect picked this angle on its own (History page's "my report" vs "proposed" tag, design turn 12a). */
  origin?: 'user' | 'proposed';
  /** Flips to true the first time the detail page is opened — drives History's "Ready — not viewed yet" highlight. */
  viewed?: boolean;
  /** True when this is a dataset-wide suggestion owned by the system, not this session — it can be Saved (which clones it) but not deleted. */
  shared?: boolean;
  /** The free-text question actually asked (typed by the user, or Aspect's own proposed angle) — History page's "What I asked" column. */
  askedPrompt?: string;
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
  evidence?: {
    prompt: string;
    dataQuestion: string;
    sql: string;
    /** The SQL generator's own confidence that this dataset can answer the question. */
    sqlConfidence?: 'high' | 'medium' | 'low';
    verification?: { verified: boolean; issues: string[] };
    /** How the reported numbers were actually computed — see result-digest.service.js. */
    aggregation?: {
      rowCount: number;
      groupedBy: string[];
      distinctGroups: number;
      collapsedColumns: string[];
      sampleShown: number;
    };
  };
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

/**
 * Real server-side pipeline stage for a running investigation — see
 * insights/services/investigation-progress.service.js. `percent` is anchored
 * to actual stage boundaries and eased within a stage, so it is monotonic and
 * never claims a step finished before it did.
 */
export interface InvestigationProgress {
  stage: 'plan' | 'query' | 'aggregate' | 'synthesize' | 'verify' | 'done' | 'failed';
  percent: number;
  done: boolean;
  failed: boolean;
  detail: string | null;
  elapsedMs: number;
  /** Time remaining, from the same stage model as `percent` so the two never disagree. */
  etaMs?: number;
}

/** "Open <cta> plan" on an insight detail page — see generateActionPlan in investigation.service.js. */
export interface ActionPlan {
  planTitle: string;
  steps: { title: string; detail: string }[];
  expectedImpact: string;
}
