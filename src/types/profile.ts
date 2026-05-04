// Profile Schema - defined in agent config to describe what profile data to display

export interface ProfileSchema {
  title: string;
  clusters: ProfileClusterDef[];
  depthLabels: ProfileDepthLabel[];
}

export interface ProfileDepthLabel {
  /** Upper bound percentage for this label (inclusive) */
  maxPercent: number;
  label: string;
  color?: string;
}

export interface ProfileClusterDef {
  id: string;
  name: string;
  icon: string;
  /** 'fields' shows all fields (empty or filled), 'tags' only shows fields with values, 'summary' renders narrative blocks */
  displayMode: 'fields' | 'tags' | 'summary';
  fields: ProfileFieldDef[];
}

export interface ProfileFieldDef {
  key: string;
  label: string;
  /**
   * Data source path:
   * - "context:user:namespace.field.path" — user-level context
   * - "context:conv:namespace.field.path" — conversation-level context
   * - "field:fieldName" — collected fields
   */
  source: string;
  /** Badge indicating data origin */
  badge?: 'user' | 'system' | 'external';
  /** Whether this is a system-derived insight (not directly from user) */
  isInsight?: boolean;
}

// Runtime types — computed from schema + fetched data

export interface ProfileData {
  clusters: ProfileCluster[];
  overallDepth: number;
  overallConfidence: number;
  depthLabel: string;
  depthLabelColor?: string;
}

export interface ProfileCluster {
  id: string;
  name: string;
  icon: string;
  displayMode: 'fields' | 'tags' | 'summary';
  fields: ProfileField[];
  depth: number; // 0–100
}

export interface RecommendationItem {
  name: string;
  reason?: string;
  timing?: string;
  channel?: string;
}

export interface ProfileField {
  key: string;
  label: string;
  value: string | string[] | RecommendationItem[] | null;
  badge?: 'user' | 'system' | 'external';
  confidence: number; // 0–100
  isInsight?: boolean;
  /** Marked true when value just changed (for animation) */
  isNew?: boolean;
  /** Marked true when field was present but below confidence threshold — visible only in debug mode */
  isFiltered?: boolean;
}
