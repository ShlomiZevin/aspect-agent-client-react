import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getProfilerConfig, updateProfilerConfig, resetProfilerConfig } from '../../../services/profilerService';
import type {
  ProfileSchema,
  ProfileData,
  ProfileCluster,
  ProfileField,
} from '../../../types/profile';
import type { ProfileUpdateData } from '../../../services/chatService';
import styles from './ProfilePanel.module.css';

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
        ? (summary.key_profile_traits as string[]).join(', ')
        : null;

      const summaryFields: ProfileField[] = [
        { key: 'general_overview', label: 'תמונת מצב כללי', value: (summary.general_overview as string) || null, confidence: 80, isNew: false },
        { key: 'key_profile_traits', label: 'מאפייני פרופיל מרכזיים', value: traits, confidence: 80, isNew: false },
        { key: 'potential_index', label: 'אינדקציית פוטנציאל', value: summary.potential_index != null ? String(summary.potential_index) : null, confidence: 80, isNew: false },
        { key: 'focused_action_recommendation', label: 'המלצת פעולה ממוקדת', value: (summary.focused_action_recommendation as string) || null, confidence: 80, isNew: false },
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
      const fieldData = clusterRaw?.[fieldDef.key] as { value?: string | null; confidence?: number; source?: string } | undefined;
      const value = fieldData?.value ?? null;
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
    depthLabel: profilerData?.profileTier || matchedLabel.label,
    depthLabelColor: matchedLabel.color,
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
                  <div className={styles.summaryBlockText}>{overview.value}</div>
                </div>
              )}
              {traits?.value && (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryBlockLabel}>{traits.label}</div>
                  <div className={styles.tagsContainer}>
                    {traits.value.split(', ').map((trait, i) => (
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
                      style={{ width: `${potential.value}%` }}
                    />
                    <span className={styles.potentialValue}>{potential.value}%</span>
                  </div>
                </div>
              )}
              {action?.value && (
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryBlockLabel}>{action.label}</div>
                  <div className={styles.summaryBlockText}>{action.value}</div>
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

function ClusterSection({ cluster }: { cluster: ProfileCluster }) {
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

  // For tags mode, only show fields with values
  const visibleFields =
    cluster.displayMode === 'tags'
      ? cluster.fields.filter((f) => f.value != null)
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
              {visibleFields.map((field) => (
                <span
                  key={field.key}
                  className={`${styles.tag} ${field.isNew ? styles.tagNew : ''}`}
                  title={field.label}
                >
                  {field.value}
                </span>
              ))}
            </div>
          ) : (
            visibleFields.map((field) => (
              <div
                key={field.key}
                className={`${styles.field} ${field.value != null ? styles.fieldFilled : ''} ${field.isNew ? styles.fieldNew : ''}`}
              >
                <div className={styles.fieldRow}>
                  <div className={styles.fieldLabel}>
                    {field.value != null && <ConfidenceDot confidence={field.confidence} />}
                    <span>{field.label}</span>
                  </div>
                  <div className={styles.fieldValue}>
                    {field.value != null ? (
                      <>
                        <span className={styles.fieldValueText}>{field.value}</span>
                        {field.badge && <BadgeIcon badge={field.badge} />}
                      </>
                    ) : (
                      <span className={styles.fieldEmpty}>—</span>
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
      await updateProfilerConfig(agentName, { prompt, model, provider }, baseURL);
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

// ─── Main ProfilePanel ───────────────────────────────────────

export function ProfilePanel({
  conversationId,
  baseURL,
  profileSchema,
  refreshKey,
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
  const [isLoading, setIsLoading] = useState(false);
  const prevFieldsRef = useRef<Map<string, string | null>>(new Map());

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
        newPrev.set(field.key, field.value);
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
            <span
              className={styles.depthLabelBadge}
              style={profileData.depthLabelColor ? { background: profileData.depthLabelColor } : undefined}
            >
              {profileData.depthLabel}
            </span>
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
            <ClusterSection key={cluster.id} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  );
}
