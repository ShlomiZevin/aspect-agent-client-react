import { useEffect, useState } from 'react';
import type { InsightDetail as InsightDetailType } from '../../../types/insights';
import { insightsService } from '../../../services/insightsService';
import { BlockRenderer } from './Blocks';
import { ReasoningTrail } from './ReasoningTrail';
import { ConfidencePanel } from './ConfidencePanel';
import { SqlViewerModal } from './SqlViewerModal';
import { ActionPlanModal } from './ActionPlanModal';
import { CATEGORY_COLOR } from './categoryColors';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './InsightDetail.module.css';

interface Props {
  datasetId: string;
  /** Anon session id (see IntelligenceShell's UserProvider) — null until the async create finishes. */
  userId: string | null;
  insightId: string;
  onBack: () => void;
  /** Reports the fetched insight up once loaded, so the shell's header breadcrumb can show its name. */
  onLoaded?: (insight: InsightDetailType) => void;
  /** Opens the chat widget and sends a question grounded in this insight — see IntelligenceShell.askFollowUp. */
  onAskFollowUp?: (question: string) => void;
}

export function InsightDetail({ datasetId, userId, insightId, onBack, onLoaded, onAskFollowUp }: Props) {
  const { t } = useLanguage();
  const [insight, setInsight] = useState<InsightDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sqlModalOpen, setSqlModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  useEffect(() => {
    if (!userId) return; // anon session still being created
    let cancelled = false;
    setLoading(true);
    setError(null);
    insightsService.getInsight(datasetId, userId, insightId)
      .then(d => { if (!cancelled) { setInsight(d); setLoading(false); onLoaded?.(d); } })
      .catch(err => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetId, userId, insightId]);

  if (loading) return <div className={styles.state}>{t('intel.detail.loading')}</div>;
  if (error) return <div className={styles.state}>⚠ {error}</div>;
  if (!insight) return null;

  const color = CATEGORY_COLOR[insight.category] || '#7C3AED';

  const deleteInsight = () => {
    if (!userId) return;
    insightsService.deleteInsight(datasetId, userId, insightId).then(onBack).catch(() => {});
  };

  const toggleTracked = () => {
    if (!userId) return;
    const next = !insight.tracked;
    setInsight(cur => cur && { ...cur, tracked: next }); // optimistic — "Tracked by you" only re-reads on next mount, not worth a round trip first
    insightsService.setTracked(datasetId, userId, insightId, next).catch(() => {
      setInsight(cur => cur && { ...cur, tracked: !next }); // revert on failure
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div className={styles.titleBody}>
          <div className={styles.badgeRow}>
            <span className={styles.tagBadge} style={{ background: color }}>{insight.tag}</span>
            <span className={styles.foundInfo}>{t('intel.detail.foundBy')} · {insight.foundAgo}</span>
          </div>
          <div className={styles.title}>{insight.title}</div>
        </div>
        <div className={styles.actions}>
          <button className={styles.trackBtn} onClick={toggleTracked}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill={insight.tracked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M6 3.5h12V21l-6-4.6L6 21z" /></svg>
            {insight.tracked ? t('intel.detail.saved') : t('intel.detail.save')}
          </button>
          <button className={styles.openBtn} onClick={() => setPlanModalOpen(true)}>{t('intel.reports.open')} {insight.ctaLabel}</button>
          {insight.isGenerated && (
            <button className={styles.deleteBtn} onClick={deleteInsight} aria-label={t('intel.detail.delete')} title={t('intel.detail.delete')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* The model chose 1-3 of these per question — not a fixed
          chart+scenarios template every time, see Blocks.tsx. */}
      {insight.blocks.map((block, i) => <BlockRenderer key={i} block={block} />)}

      <div className={styles.bottomGrid}>
        <ReasoningTrail
          steps={insight.reasoning}
          onViewSql={insight.evidence ? () => setSqlModalOpen(true) : undefined}
          onAskFollowUp={onAskFollowUp ? () => onAskFollowUp(`I'm looking at this report: "${insight.headline}". Can you dig deeper into this and suggest what to do next?`) : undefined}
        />
        <ConfidencePanel score={insight.confidenceScore} basis={insight.confidenceBasis} checks={insight.confidenceChecks} />
      </div>

      {sqlModalOpen && insight.evidence && (
        <SqlViewerModal
          prompt={insight.evidence.prompt}
          dataQuestion={insight.evidence.dataQuestion}
          sql={insight.evidence.sql}
          onClose={() => setSqlModalOpen(false)}
        />
      )}

      {planModalOpen && userId && (
        <ActionPlanModal
          datasetId={datasetId}
          userId={userId}
          insightId={insightId}
          ctaLabel={insight.ctaLabel}
          onClose={() => setPlanModalOpen(false)}
        />
      )}
    </div>
  );
}
