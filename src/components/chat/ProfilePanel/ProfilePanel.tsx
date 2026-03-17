import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getContext, type ContextResponse } from '../../../services/contextService';
import { getFields } from '../../../services/fieldsService';
import type {
  ProfileSchema,
  ProfileData,
  ProfileCluster,
  ProfileField,
} from '../../../types/profile';
import styles from './ProfilePanel.module.css';

interface ProfilePanelProps {
  conversationId: string;
  baseURL: string;
  profileSchema: ProfileSchema;
  refreshKey?: number;
  onClose?: () => void;
}

// ─── Value resolver ────────────────────────────────────────────

function resolveValue(
  source: string,
  contextData: ContextResponse | null,
  fieldsData: Record<string, string>
): string | null {
  if (!source) return null;

  if (source.startsWith('field:')) {
    const fieldName = source.slice(6);
    const val = fieldsData[fieldName];
    return val && val.trim() ? val : null;
  }

  if (source.startsWith('context:')) {
    const rest = source.slice(8); // "user:onboarding_profile.name" or "conv:..."
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1 || !contextData) return null;

    const level = rest.slice(0, colonIdx); // "user" or "conv"
    const path = rest.slice(colonIdx + 1); // "onboarding_profile.name"

    const root =
      level === 'user'
        ? contextData.userLevel
        : level === 'conv'
          ? contextData.conversationLevel
          : null;
    if (!root) return null;

    // Navigate dot-path
    const parts = path.split('.');
    let current: unknown = root;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[part];
    }

    if (current == null) return null;
    if (typeof current === 'boolean') return current ? 'כן' : 'לא';
    if (typeof current === 'number') return String(current);
    if (typeof current === 'string') return current.trim() || null;
    if (Array.isArray(current)) return current.join(', ') || null;
    return JSON.stringify(current);
  }

  return null;
}

// ─── Profile computation ───────────────────────────────────────

function computeProfile(
  schema: ProfileSchema,
  contextData: ContextResponse | null,
  fieldsData: Record<string, string>,
  prevFields: Map<string, string | null>
): ProfileData {
  const clusters: ProfileCluster[] = schema.clusters.map((clusterDef) => {
    const fields: ProfileField[] = clusterDef.fields.map((fieldDef) => {
      const value = resolveValue(fieldDef.source, contextData, fieldsData);
      const prevValue = prevFields.get(fieldDef.key);
      const isNew = value !== null && prevValue !== value && prevValue !== undefined;
      const confidence = value != null ? (fieldDef.isInsight ? 80 : 100) : 0;

      return {
        key: fieldDef.key,
        label: fieldDef.label,
        value,
        badge: fieldDef.badge,
        confidence,
        isInsight: fieldDef.isInsight,
        isNew,
      };
    });

    const filledCount = fields.filter((f) => f.value != null).length;
    const depth = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

    return {
      id: clusterDef.id,
      name: clusterDef.name,
      icon: clusterDef.icon,
      displayMode: clusterDef.displayMode,
      fields,
      depth,
    };
  });

  // Overall depth: weighted average across clusters (equal weight)
  const totalFields = clusters.reduce((sum, c) => sum + c.fields.length, 0);
  const filledFields = clusters.reduce(
    (sum, c) => sum + c.fields.filter((f) => f.value != null).length,
    0
  );
  const overallDepth = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Overall confidence: average confidence of filled fields
  const filledFieldsList = clusters.flatMap((c) => c.fields.filter((f) => f.value != null));
  const overallConfidence =
    filledFieldsList.length > 0
      ? Math.round(
          filledFieldsList.reduce((sum, f) => sum + f.confidence, 0) / filledFieldsList.length
        )
      : 0;

  // Depth label
  const sortedLabels = [...schema.depthLabels].sort((a, b) => a.maxPercent - b.maxPercent);
  const matchedLabel = sortedLabels.find((l) => overallDepth <= l.maxPercent) ||
    sortedLabels[sortedLabels.length - 1] || { label: '', color: undefined };

  return {
    clusters,
    overallDepth,
    overallConfidence,
    depthLabel: matchedLabel.label,
    depthLabelColor: matchedLabel.color,
  };
}

// ─── Badge component ──────────────────────────────────────────

function BadgeIcon({ badge }: { badge: 'user' | 'system' | 'external' }) {
  const config = {
    user: { label: 'לקוח', className: styles.badgeUser },
    system: { label: 'מערכת', className: styles.badgeSystem },
    external: { label: 'חיצוני', className: styles.badgeExternal },
  };
  const { label, className } = config[badge];
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

// ─── Cluster section ──────────────────────────────────────────

function ClusterSection({ cluster }: { cluster: ProfileCluster }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const filledCount = cluster.fields.filter((f) => f.value != null).length;

  // For tags mode, only show fields with values
  const visibleFields =
    cluster.displayMode === 'tags'
      ? cluster.fields.filter((f) => f.value != null)
      : cluster.fields;

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
          <span className={styles.clusterCount}>
            {filledCount}/{cluster.fields.length}
          </span>
        </div>
        <div className={styles.clusterRight}>
          <span className={styles.clusterDepth}>{cluster.depth}%</span>
          <span className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      <DepthBar depth={cluster.depth} />

      {isExpanded && (
        <div className={styles.clusterBody}>
          {visibleFields.length === 0 && cluster.displayMode === 'tags' ? (
            <div className={styles.noTags}>לא זוהו תגיות עדיין</div>
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

// ─── Main ProfilePanel ───────────────────────────────────────

export function ProfilePanel({
  conversationId,
  baseURL,
  profileSchema,
  refreshKey,
  onClose,
}: ProfilePanelProps) {
  const [contextData, setContextData] = useState<ContextResponse | null>(null);
  const [fieldsData, setFieldsData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const prevFieldsRef = useRef<Map<string, string | null>>(new Map());

  const loadData = useCallback(async () => {
    if (!conversationId) return;

    try {
      const [ctx, fields] = await Promise.allSettled([
        getContext(conversationId, baseURL),
        getFields(conversationId, baseURL),
      ]);

      if (ctx.status === 'fulfilled') {
        setContextData(ctx.value);
      }
      if (fields.status === 'fulfilled') {
        setFieldsData(fields.value.collectedFields);
      }
    } catch {
      // Silently handle — panel is informational
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, baseURL]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Compute profile data
  const profileData = useMemo(() => {
    const data = computeProfile(profileSchema, contextData, fieldsData, prevFieldsRef.current);

    // Update prev fields for next render's animation detection
    const newPrev = new Map<string, string | null>();
    for (const cluster of data.clusters) {
      for (const field of cluster.fields) {
        newPrev.set(field.key, field.value);
      }
    }
    prevFieldsRef.current = newPrev;

    return data;
  }, [profileSchema, contextData, fieldsData]);

  // Clear "isNew" animation flags after delay
  const [, setAnimTick] = useState(0);
  useEffect(() => {
    const hasNew = profileData.clusters.some((c) => c.fields.some((f) => f.isNew));
    if (hasNew) {
      const timer = setTimeout(() => setAnimTick((t) => t + 1), 2000);
      return () => clearTimeout(timer);
    }
  }, [profileData]);

  return (
    <div className={styles.panel} dir="rtl">
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>{profileSchema.title}</h3>
        {onClose && (
          <button className={styles.closeButton} onClick={onClose} title="Close panel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

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

        <div className={styles.confidenceRow}>
          <span className={styles.confidenceLabel}>ביטחון המערכת</span>
          <span className={styles.confidenceValue}>{profileData.overallConfidence}%</span>
        </div>
      </div>

      {/* Loading */}
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
