import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getProfilerConfig, updateProfilerConfig, resetProfilerConfig, askProfiler } from '../../../services/profilerService';
import { createTask, getAssignees } from '../../../services/taskService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import { useChatContext } from '../../../context';
import { AgentBugModal } from '../AgentBugModal/AgentBugModal';
import type {
  ProfileSchema,
  ProfileData,
  ProfileCluster,
  ProfileField,
} from '../../../types/profile';
import type { ProfileUpdateData } from '../../../services/chatService';
import type { Assignee } from '../../../types/task';
import type { RecommendationItem } from '../../../types/profile';
import styles from './ProfilePanel.module.css';

function fieldValueToString(value: string | string[] | RecommendationItem[] | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.map(v => typeof v === 'object' && v !== null && 'name' in v ? (v as RecommendationItem).name : String(v)).join(', ');
}

interface ProfilePanelProps {
  conversationId: string;
  baseURL: string;
  profileSchema: ProfileSchema;
  refreshKey?: number;
  profilerData?: ProfileUpdateData | null;
  profilerLastRaw?: unknown | null;
  debugMode?: boolean;
  agentName?: string;
  freshStart?: boolean;
  onFreshStartChange?: (value: boolean) => void;
  profilerEnabled?: boolean;
  onProfilerEnabledChange?: (value: boolean) => void;
  onClose?: () => void;
}

// ─── Value resolver (legacy: source-based) ─────────────────────

// ─── Profile computation (from profiler data) ────────────────
// The profiler returns a flat JSON where each key is a cluster ID.
// Each cluster contains fields directly: { fieldKey: { value, confidence, source } }
// The "summary" cluster is special: { general_overview, key_profile_traits, potential_index, focused_action_recommendation }

function computeProfileFromProfiler(
  schema: ProfileSchema,
  profilerData: ProfileUpdateData | null,
  prevFields: Map<string, string | null>
): ProfileData {
  const rawClusters = (profilerData?.clusters || {}) as Record<string, Record<string, unknown>>;

  const clusters: ProfileCluster[] = schema.clusters.map((clusterDef) => {
    const clusterRaw = rawClusters[clusterDef.id] as Record<string, unknown> | undefined;
    const clusterScore = profilerData?.clusterScores?.[clusterDef.id];

    // Special handling for summary cluster
    if (clusterDef.displayMode === 'summary') {
      const summary = (profilerData?.summary || clusterRaw || {}) as Record<string, unknown>;
      const traits = Array.isArray(summary.key_profile_traits)
        ? (summary.key_profile_traits as unknown[])
            .map(t => typeof t === 'string' ? t : (t && typeof t === 'object' && 'value' in t ? String((t as {value: unknown}).value) : ''))
            .filter(Boolean)
            .join(', ')
        : null;

      // Defensive unwrap: profiler sometimes returns summary fields as { value, confidence, source } objects
      const unwrap = (v: unknown): string | null => {
        if (v == null) return null;
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return String(v);
        if (Array.isArray(v)) return v.join(', ');
        if (typeof v === 'object' && 'value' in v) return unwrap((v as { value: unknown }).value);
        return null;
      };

      const summaryFields: ProfileField[] = [
        { key: 'general_overview', label: 'תמונת מצב כללי', value: unwrap(summary.general_overview), confidence: 80, isNew: false },
        { key: 'key_profile_traits', label: 'מאפייני פרופיל מרכזיים', value: traits ?? unwrap(summary.key_profile_traits), confidence: 80, isNew: false },
        { key: 'potential_index', label: 'אינדקציית פוטנציאל', value: unwrap(summary.potential_index), confidence: 80, isNew: false },
        { key: 'focused_action_recommendation', label: 'המלצת פעולה ממוקדת', value: unwrap(summary.focused_action_recommendation), confidence: 80, isNew: false },
      ];

      return {
        id: clusterDef.id,
        name: clusterDef.name,
        icon: clusterDef.icon,
        displayMode: clusterDef.displayMode,
        fields: summaryFields,
        depth: 0,
      };
    }

    const fields: ProfileField[] = clusterDef.fields.map((fieldDef) => {
      // The LLM returns { value, confidence, source } directly under the cluster
      const fieldData = clusterRaw?.[fieldDef.key] as { value?: string | string[] | null; confidence?: number; source?: string; _filtered?: boolean } | undefined;
      const rawValue = fieldData?.value;
      // Arrays stay as arrays (rendered as multiple tags); other primitives → string
      const value = Array.isArray(rawValue) ? rawValue : (rawValue ?? null);
      const isFiltered = fieldData?._filtered === true;
      const prevValue = prevFields.get(fieldDef.key);
      const isNew = value !== null && prevValue !== value && prevValue !== undefined;
      const confidence = fieldData?.confidence ?? 0;
      const source = fieldData?.source;

      let badge: 'user' | 'system' | 'external' | undefined;
      if (source === 'user') badge = 'user';
      else if (source === 'inferred') badge = 'system';
      else if (source === 'external') badge = 'external';

      return {
        key: fieldDef.key,
        label: fieldDef.label,
        value,
        badge,
        confidence,
        isInsight: fieldDef.isInsight,
        isNew,
        isFiltered,
      };
    });

    const depth = clusterScore?.depth ?? 0;

    return {
      id: clusterDef.id,
      name: clusterDef.name,
      icon: clusterDef.icon,
      displayMode: clusterDef.displayMode,
      fields,
      depth,
    };
  });

  const overallDepth = profilerData?.overallDepth ?? 0;
  const sortedLabels = [...schema.depthLabels].sort((a, b) => a.maxPercent - b.maxPercent);
  const matchedLabel = sortedLabels.find((l) => overallDepth <= l.maxPercent) ||
    sortedLabels[sortedLabels.length - 1] || { label: '', color: undefined };

  return {
    clusters,
    overallDepth,
    overallConfidence: profilerData?.overallConfidence ?? 0,
    depthLabel: overallDepth < 15 ? '' : (profilerData?.profileTier || matchedLabel.label),
    depthLabelColor: overallDepth < 15 ? undefined : matchedLabel.color,
  };
}

// ─── Badge component ──────────────────────────────────────────

function BadgeIcon({ badge }: { badge: 'user' | 'system' | 'external' }) {
  const badgeConfig = {
    user: { label: 'לקוח', className: styles.badgeUser },
    system: { label: 'מערכת', className: styles.badgeSystem },
    external: { label: 'חיצוני', className: styles.badgeExternal },
  };
  const { label, className } = badgeConfig[badge];
  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

// ─── Confidence dot ───────────────────────────────────────────

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color =
    confidence >= 80 ? 'var(--success-color)' : confidence >= 50 ? 'var(--warning-color)' : 'var(--text-muted)';
  return (
    <span
      className={styles.confidenceDot}
      style={{ background: color }}
      title={`ביטחון: ${confidence}%`}
    />
  );
}

// ─── Depth bar ────────────────────────────────────────────────

function DepthBar({ depth }: { depth: number }) {
  const color =
    depth >= 75
      ? 'var(--success-color)'
      : depth >= 40
        ? 'var(--primary-color)'
        : depth > 0
          ? 'var(--warning-color)'
          : 'var(--border)';
  return (
    <div className={styles.depthBar}>
      <div className={styles.depthFill} style={{ width: `${depth}%`, background: color }} />
    </div>
  );
}

// ─── Summary section (Cluster 7) ─────────────────────────────

function SummarySection({ cluster }: { cluster: ProfileCluster }) {
  const overview = cluster.fields.find(f => f.key === 'general_overview');
  const traits = cluster.fields.find(f => f.key === 'key_profile_traits');
  const potential = cluster.fields.find(f => f.key === 'potential_index');
  const action = cluster.fields.find(f => f.key === 'focused_action_recommendation');

  const hasContent = cluster.fields.some(f => f.value != null);
  const [isExpanded, setIsExpanded] = useState(hasContent);

  return (
    <div className={styles.cluster}>
      <button
        className={styles.clusterHeader}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className={styles.clusterLeft}>
          <span className={styles.clusterIcon}>{cluster.icon}</span>
          <span className={styles.clusterName}>{cluster.name}</span>
        </div>
        <div className={styles.clusterRight}>
          <span className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className={styles.clusterBody}>
          {!hasContent ? (
            <div className={styles.noTags}>הסיכום יתעדכן במהלך השיחה</div>
          ) : (
            <div className={styles.summaryContent}>
              {overview?.value && (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryBlockLabel}>{overview.label}</div>
                  <div className={styles.summaryBlockText}>{fieldValueToString(overview.value)}</div>
                </div>
              )}
              {traits?.value && (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryBlockLabel}>{traits.label}</div>
                  <div className={styles.tagsContainer}>
                    {fieldValueToString(traits.value).split(', ').map((trait, i) => (
                      <span key={i} className={styles.tag}>{trait}</span>
                    ))}
                  </div>
                </div>
              )}
              {potential?.value && (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryBlockLabel}>{potential.label}</div>
                  <div className={styles.potentialBar}>
                    <div
                      className={styles.potentialFill}
                      style={{ width: `${fieldValueToString(potential.value)}%` }}
                    />
                    <span className={styles.potentialValue}>{fieldValueToString(potential.value)}%</span>
                  </div>
                </div>
              )}
              {action?.value && (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryBlockLabel}>{action.label}</div>
                  <div className={styles.summaryBlockText}>{fieldValueToString(action.value)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cluster section ──────────────────────────────────────────

function ClusterSection({ cluster, debugMode, onBugClick }: { cluster: ProfileCluster; debugMode?: boolean; onBugClick?: (field: { key: string; label: string; value: string | null }) => void }) {
  // Summary clusters get special rendering
  if (cluster.displayMode === 'summary') {
    return <SummarySection cluster={cluster} />;
  }

  const filledCount = cluster.fields.filter((f) => f.value != null).length;
  const isEmpty = filledCount === 0;

  // Start collapsed when empty, expanded when has data
  const [isExpanded, setIsExpanded] = useState(filledCount > 0);

  // Auto-expand when first field arrives
  const prevFilledRef = useRef(filledCount);
  useEffect(() => {
    if (filledCount > 0 && prevFilledRef.current === 0) {
      setIsExpanded(true);
    }
    prevFilledRef.current = filledCount;
  }, [filledCount]);

  // For tags mode, only show fields with values (filtered fields shown in debug mode)
  const visibleFields =
    cluster.displayMode === 'tags'
      ? cluster.fields.filter((f) => f.value != null || (debugMode && f.isFiltered))
      : cluster.fields;

  return (
    <div className={`${styles.cluster} ${isEmpty ? styles.clusterEmpty : ''}`}>
      <button
        className={styles.clusterHeader}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className={styles.clusterLeft}>
          <span className={styles.clusterIcon}>{cluster.icon}</span>
          <span className={styles.clusterName}>{cluster.name}</span>
          {cluster.displayMode !== 'tags' && (
            <span className={styles.clusterCount}>
              {filledCount}/{cluster.fields.length}
            </span>
          )}
        </div>
        <div className={styles.clusterRight}>
          {cluster.displayMode !== 'tags' && (
            <span className={styles.clusterDepth}>{cluster.depth}%</span>
          )}
          <span className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ''}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      {!isEmpty && <DepthBar depth={cluster.depth} />}

      {isExpanded && (
        <div className={styles.clusterBody}>
          {visibleFields.length === 0 && cluster.displayMode === 'tags' ? (
            <div className={styles.noTags}>טרם זוהו תגיות</div>
          ) : cluster.displayMode === 'tags' ? (
            <div className={styles.tagsContainer}>
              {visibleFields.flatMap((field) => {
                const values = Array.isArray(field.value) ? field.value : [field.value];
                return values.filter(v => v != null && v !== '').map((v, i) => {
                  // Object value with `name` → use name as tag label, render rest as value
                  const isRecObj = typeof v === 'object' && v !== null && 'name' in v;
                  const label = isRecObj ? String((v as { name: string }).name) : field.label;
                  let displayValue: string;
                  if (isRecObj) {
                    const obj = v as { reason?: string; timing?: string; channel?: string };
                    const parts = [obj.reason, obj.timing && `⏱ ${obj.timing}`, obj.channel && `📞 ${obj.channel}`].filter(Boolean);
                    displayValue = parts.join(' · ');
                  } else {
                    displayValue = String(v);
                  }
                  return (
                    <span
                      key={`${field.key}-${i}`}
                      className={`${styles.tag} ${field.isNew ? styles.tagNew : ''}`}
                      title={isRecObj ? `${field.label}: ${label}` : field.label}
                    >
                      <span className={styles.tagLabel}>{label}</span>
                      <span className={styles.tagValue}>{displayValue}</span>
                    </span>
                  );
                });
              })}
            </div>
          ) : (
            visibleFields.map((field) => (
              <div
                key={field.key}
                className={`${styles.field} ${field.value != null ? styles.fieldFilled : ''} ${field.isNew ? styles.fieldNew : ''} ${debugMode && field.isFiltered ? styles.fieldFiltered : ''}`}
              >
                <div className={styles.fieldRow}>
                  <div className={styles.fieldLabel}>
                    {field.value != null && <ConfidenceDot confidence={field.confidence} />}
                    {debugMode && field.isFiltered && (
                      <span className={styles.confidenceFiltered} title={`Filtered: confidence ${field.confidence}% is below threshold`}>
                        {field.confidence}%
                      </span>
                    )}
                    <span>{field.label}</span>
                  </div>
                  <div className={styles.fieldValue}>
                    {field.value != null ? (
                      <>
                        <span className={styles.fieldValueText}>{Array.isArray(field.value) ? field.value.map(v => typeof v === 'object' && v !== null && 'name' in v ? (v as { name: string }).name : String(v)).join(', ') : field.value}</span>
                        {field.badge && <BadgeIcon badge={field.badge} />}
                      </>
                    ) : field.isFiltered && debugMode ? (
                      <span className={styles.fieldFilteredValue} title="Filtered by confidence threshold">filtered</span>
                    ) : (
                      <span className={styles.fieldEmpty}>—</span>
                    )}
                    {debugMode && (
                      <button
                        className={styles.fieldBugBtn}
                        title="Report a bug on this field"
                        onClick={() => onBugClick?.({ key: field.key, label: field.label, value: Array.isArray(field.value) ? field.value.map(v => typeof v === 'object' && v !== null && 'name' in v ? (v as { name: string }).name : String(v)).join(', ') : field.value })}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 9a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V9z" />
                          <path d="M6 9l-3-2" /><path d="M18 9l3-2" />
                          <path d="M6 12H3" /><path d="M21 12h-3" />
                          <path d="M7 17l-2 2" /><path d="M17 17l2 2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Model & Provider constants ──────────────────────────────

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4.1-nano', 'o4-mini'],
  anthropic: ['claude-sonnet-4-6', 'claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'],
  google: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
};

const AVAILABLE_PROVIDERS = ['openai', 'anthropic', 'google'];

function inferProvider(model: string): string {
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google';
  return 'openai';
}

// ─── Expandable debug section ────────────────────────────────

function DebugSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: string;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  return (
    <div className={styles.configEditor}>
      <button
        className={styles.configToggle}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span className={styles.configToggleIcon}>{icon}</span>
        <span>{title}</span>
        {badge && <span className={styles.overrideBadge}>{badge}</span>}
        <span className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {isExpanded && (
        <div className={styles.configBody}>{children}</div>
      )}
    </div>
  );
}

// ─── Raw Response Modal ──────────────────────────────────────

function RawResponseModal({
  data,
  onClose,
}: {
  data: unknown;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Profiler Last Response</span>
          <button className={styles.modalClose} onClick={onClose} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <pre className={styles.modalBody}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// ─── Profiler Config Editor (debug mode) ────────────────────

function ProfilerConfigEditor({
  agentName,
  baseURL,
  lastRaw,
}: {
  agentName: string;
  baseURL: string;
  lastRaw?: unknown | null;
}) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [provider, setProvider] = useState('anthropic');
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasOverrides, setHasOverrides] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Load config on first expand of the config section
  const loadConfig = useCallback(() => {
    if (configLoaded) return;
    setIsLoading(true);
    getProfilerConfig(agentName, baseURL)
      .then((res) => {
        if (res.config) {
          setPrompt(res.config.prompt || '');
          setModel(res.config.model || 'claude-sonnet-4-6');
          setProvider(res.config.provider || inferProvider(res.config.model || 'claude-sonnet-4-6'));
          setConfidenceThreshold(res.config.confidenceThreshold ?? 70);
          setHasOverrides(res.hasOverrides);
        }
        setConfigLoaded(true);
      })
      .catch(() => setStatus('Error loading config'))
      .finally(() => setIsLoading(false));
  }, [configLoaded, agentName, baseURL]);

  const handleProviderChange = useCallback((newProvider: string) => {
    setProvider(newProvider);
    const models = MODELS_BY_PROVIDER[newProvider] || MODELS_BY_PROVIDER.openai;
    setModel(models[0]);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      await updateProfilerConfig(agentName, { prompt, model, provider, confidenceThreshold }, baseURL);
      setHasOverrides(true);
      setStatus('Saved');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('Error saving');
    } finally {
      setIsSaving(false);
    }
  }, [agentName, baseURL, prompt, model, provider]);

  const handleReset = useCallback(async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      await resetProfilerConfig(agentName, baseURL);
      const res = await getProfilerConfig(agentName, baseURL);
      if (res.config) {
        setPrompt(res.config.prompt || '');
        setModel(res.config.model || 'claude-sonnet-4-6');
        setProvider(res.config.provider || inferProvider(res.config.model || 'claude-sonnet-4-6'));
        setConfidenceThreshold(res.config.confidenceThreshold ?? 70);
      }
      setHasOverrides(false);
      setStatus('Reset to default');
      setTimeout(() => setStatus(null), 2000);
    } catch {
      setStatus('Error resetting');
    } finally {
      setIsSaving(false);
    }
  }, [agentName, baseURL]);

  const availableModels = MODELS_BY_PROVIDER[provider] || MODELS_BY_PROVIDER.openai;

  // Parse last raw envelope: { response, durationSec, model }
  const lastEnvelope = lastRaw && typeof lastRaw === 'object' ? lastRaw as Record<string, unknown> : null;
  const lastResponse = lastEnvelope?.response;
  const lastDuration = lastEnvelope?.durationSec ? `${lastEnvelope.durationSec}s` : null;
  const lastModel = lastEnvelope?.model ? String(lastEnvelope.model) : null;

  return (
    <>
      {/* Panel 1: Config */}
      <DebugSection
        icon="⚙"
        title="Profiler Config"
        badge={hasOverrides ? 'override' : undefined}
      >
        <div onFocus={loadConfig} onMouseEnter={loadConfig}>
          {isLoading ? (
            <div className={styles.configLoading}>Loading...</div>
          ) : (
            <>
              {/* Provider + Model row */}
              <div className={styles.configRow}>
                <div className={styles.configField}>
                  <label className={styles.configLabel}>Provider</label>
                  <select
                    className={styles.configSelect}
                    value={provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                  >
                    {AVAILABLE_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.configField}>
                  <label className={styles.configLabel}>Model</label>
                  <select
                    className={styles.configSelect}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Confidence Threshold */}
              <div className={styles.configRow}>
                <div className={styles.configField}>
                  <label className={styles.configLabel}>Confidence Threshold (%)</label>
                  <input
                    type="number"
                    className={styles.configInput}
                    min={0}
                    max={100}
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  />
                </div>
                <div className={styles.configField}>
                  <label className={styles.configLabel} style={{ visibility: 'hidden' }}>-</label>
                  <span className={styles.configHint}>Fields below this % are filtered out</span>
                </div>
              </div>

              {/* Prompt */}
              <div className={styles.configField}>
                <label className={styles.configLabel}>Profiler Prompt</label>
                <textarea
                  className={styles.configTextarea}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={10}
                  dir="auto"
                />
              </div>

              {/* Actions */}
              <div className={styles.configActions}>
                <button
                  className={styles.configSaveBtn}
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '...' : 'Save'}
                </button>
                {hasOverrides && (
                  <button
                    className={styles.configResetBtn}
                    onClick={handleReset}
                    disabled={isSaving}
                  >
                    Reset to Default
                  </button>
                )}
                {status && <span className={styles.configStatus}>{status}</span>}
              </div>
            </>
          )}
        </div>
      </DebugSection>

      {/* Panel 2: Last Response */}
      <DebugSection
        icon="📨"
        title="Last Response"
        badge={lastDuration ? `${lastDuration} · ${lastModel || ''}` : undefined}
      >
        <div>
          <pre className={styles.configRawResponse}>
            {lastResponse ? JSON.stringify(lastResponse, null, 2) : 'No response yet'}
          </pre>
          {lastResponse != null && (
            <button
              className={styles.configResetBtn}
              onClick={() => setShowModal(true)}
              style={{ marginTop: '6px' }}
              type="button"
            >
              View Full
            </button>
          )}
        </div>
      </DebugSection>

      {/* Modal */}
      {showModal && lastResponse != null && (
        <RawResponseModal data={lastResponse} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// ─── Ask the Profiler ────────────────────────────────────────

function ProfilerAsk({ agentName, conversationId, baseURL }: {
  agentName: string;
  conversationId: string;
  baseURL?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || isAsking) return;
    setIsAsking(true);
    setAnswer(null);
    try {
      const res = await askProfiler(agentName, conversationId, question.trim(), baseURL);
      setAnswer(res.answer);
    } catch {
      setAnswer('שגיאה — לא ניתן לקבל תשובה');
    } finally {
      setIsAsking(false);
    }
  }, [agentName, conversationId, question, baseURL, isAsking]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }, [handleAsk]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  return (
    <div className={styles.askSection}>
      <button
        className={styles.askToggle}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className={styles.askToggleIcon}>💬</span>
        <span>שאל על הפרופיל</span>
        <span className={`${styles.chevron} ${!isOpen ? styles.chevronUp : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className={styles.askBody}>
          <div className={styles.askInputRow}>
            <input
              ref={inputRef}
              className={styles.askInput}
              type="text"
              placeholder="מה תרצה לדעת על הלקוח?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isAsking}
              dir="auto"
            />
            <button
              className={styles.askSendBtn}
              onClick={handleAsk}
              disabled={isAsking || !question.trim()}
              title="שלח"
            >
              {isAsking ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                </svg>
              ) : '←'}
            </button>
          </div>
          {isAsking && (
            <div className={styles.askLoading}>
              <div className={styles.askLoadingDots}>
                <span /><span /><span />
              </div>
            </div>
          )}
          {answer && !isAsking && (
            <div className={styles.askAnswer} dir="auto">
              {answer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ProfilePanel ───────────────────────────────────────

export function ProfilePanel({
  conversationId,
  baseURL,
  profileSchema,
  refreshKey: _refreshKey,
  profilerData,
  profilerLastRaw,
  debugMode,
  agentName,
  freshStart = true,
  onFreshStartChange,
  profilerEnabled = false,
  onProfilerEnabledChange,
  onClose,
}: ProfilePanelProps) {
  const [isLoading] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [bugField, setBugField] = useState<{ key: string; label: string; value: string | null } | null>(null);
  const [bugAssignees, setBugAssignees] = useState<Assignee[]>([]);
  const { identity: commenterIdentity } = useCommenterIdentity();
  const { rerunProfiler } = useChatContext();
  const prevFieldsRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => {
    getAssignees().then(setBugAssignees).catch(() => {});
  }, []);

  // Compute profile data — only from profiler data (SSE push)
  const profileData = useMemo(() => {
    if (profilerData) {
      return computeProfileFromProfiler(profileSchema, profilerData, prevFieldsRef.current);
    }
    // No profiler data yet — return empty profile
    return computeProfileFromProfiler(profileSchema, null, prevFieldsRef.current);
  }, [profileSchema, profilerData]);

  // Update prev fields for animation detection
  useEffect(() => {
    const newPrev = new Map<string, string | null>();
    for (const cluster of profileData.clusters) {
      for (const field of cluster.fields) {
        newPrev.set(field.key, Array.isArray(field.value) ? field.value.join('|') : field.value);
      }
    }
    prevFieldsRef.current = newPrev;
  }, [profileData]);

  // Clear "isNew" animation flags after delay
  const [, setAnimTick] = useState(0);
  useEffect(() => {
    const hasNew = profileData.clusters.some((c) => c.fields.some((f) => f.isNew));
    if (hasNew) {
      const timer = setTimeout(() => setAnimTick((t) => t + 1), 2000);
      return () => clearTimeout(timer);
    }
  }, [profileData]);

  // Pulse animation when profiler pushes an update
  const [isPulsing, setIsPulsing] = useState(false);
  const profilerDataRef = useRef(profilerData);
  useEffect(() => {
    if (profilerData && profilerData !== profilerDataRef.current && profilerDataRef.current !== null) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 2000);
      return () => clearTimeout(timer);
    }
    profilerDataRef.current = profilerData;
  }, [profilerData]);

  return (
    <div className={`${styles.panel} ${isPulsing ? styles.panelPulse : ''}`} dir="rtl">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.headerTitle}>{profileSchema.title}</h3>
          <span className={`${styles.activityDot} ${isPulsing ? styles.activityDotActive : ''}`} />
          {debugMode && onProfilerEnabledChange && (
            <label className={styles.toggleLabel} title="הפעל/כבה את הפרופיילר">
              <div className={`${styles.toggleTrack} ${profilerEnabled ? styles.toggleTrackOn : ''}`} onClick={() => onProfilerEnabledChange(!profilerEnabled)}>
                <div className={`${styles.toggleThumb} ${profilerEnabled ? styles.toggleThumbOn : ''}`} />
              </div>
            </label>
          )}
          {debugMode && profilerEnabled && onFreshStartChange && (
            <label className={styles.freshStartLabel} title="התחל פרופיל מאפס בכל שיחה">
              <input
                type="checkbox"
                checked={freshStart}
                onChange={(e) => onFreshStartChange(e.target.checked)}
                className={styles.freshStartCheckbox}
              />
              <span className={styles.freshStartText}>מאפס</span>
            </label>
          )}
          {profilerEnabled && (
            <button
              className={styles.rerunBtn}
              title="Run profiler now"
              disabled={isRerunning}
              onClick={async () => {
                setIsRerunning(true);
                await rerunProfiler();
                setIsRerunning(false);
              }}
            >
              {isRerunning ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.rerunSpinner}>
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              )}
            </button>
          )}
        </div>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} title="Close panel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Profiler Config Editor (debug mode only) */}
      {debugMode && agentName && (
        <ProfilerConfigEditor agentName={agentName} baseURL={baseURL} lastRaw={profilerLastRaw} />
      )}

      {/* Overall Score */}
      <div className={styles.overallSection}>
        <div className={styles.overallRow}>
          <div className={styles.overallLabel}>עומק פרופיל</div>
          <div className={styles.overallStats}>
            {profileData.depthLabel && (
              <span
                className={styles.depthLabelBadge}
                style={profileData.depthLabelColor ? { background: profileData.depthLabelColor } : undefined}
              >
                {profileData.depthLabel}
              </span>
            )}
            <span className={styles.overallPercent}>{profileData.overallDepth}%</span>
          </div>
        </div>

        <div className={styles.overallBar}>
          <div
            className={styles.overallBarFill}
            style={{ width: `${profileData.overallDepth}%` }}
          />
        </div>

      </div>

      {/* Loading (only for legacy mode on first load) */}
      {isLoading ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>...</div>
          <p className={styles.emptyText}>טוען פרופיל...</p>
        </div>
      ) : (
        /* Clusters */
        <div className={styles.clustersContainer}>
          {profileData.clusters.map((cluster) => (
            <ClusterSection
              key={cluster.id}
              cluster={cluster}
              debugMode={debugMode}
              onBugClick={setBugField}
            />
          ))}
        </div>
      )}

      {/* Ask the Profiler — sticky footer */}
      {agentName && conversationId && (
        <ProfilerAsk agentName={agentName} conversationId={conversationId} baseURL={baseURL} />
      )}

      {/* Profile field bug modal */}
      {bugField && (
        <AgentBugModal
          isOpen={!!bugField}
          onClose={() => setBugField(null)}
          onSubmit={async (data) => { await createTask(data); }}
          profileField={bugField}
          currentDomain={window.location.hostname}
          conversationUrl={window.location.href}
          crewMembers={[]}
          assignees={bugAssignees}
          openerIdentity={commenterIdentity || undefined}
          conversationId={conversationId}
        />
      )}
    </div>
  );
}
