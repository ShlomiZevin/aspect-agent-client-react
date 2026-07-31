import { useEffect, useState } from 'react';
import { insightsService } from '../../../services/insightsService';
import type { ActionPlan } from '../../../types/insights';
import { Skeleton } from './Skeleton';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ActionPlanModal.module.css';

interface Props {
  datasetId: string;
  insightId: string;
  ctaLabel: string;
  onClose: () => void;
}

/**
 * "Open <cta> plan" — was a dead button. Generates (or fetches the server's
 * cached) concrete action plan for this insight — see generateActionPlan in
 * investigation.service.js. Same bespoke-modal pattern as SqlViewerModal, not
 * the app-wide Modal component, to stay self-contained in this design system.
 */
export function ActionPlanModal({ datasetId, insightId, ctaLabel, onClose }: Props) {
  const { t } = useLanguage();
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    insightsService.getActionPlan(datasetId, insightId)
      .then(p => { if (!cancelled) setPlan(p); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [datasetId, insightId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.title}>{plan?.planTitle || `Open ${ctaLabel}`}</div>
            <div className={styles.subtitle}>{t('intel.plan.subtitle')}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className={styles.body}>
          {!plan && !error && (
            <div className={styles.loading}>
              <div className={styles.loadingHint}>
                <span className={styles.spinner} />
                {t('intel.plan.drafting')}
              </div>
              {[0, 1, 2].map(i => (
                <div key={i} className={styles.step}>
                  <Skeleton width={24} height={24} radius={999} />
                  <div className={styles.stepBody}>
                    <Skeleton width={i === 0 ? '55%' : i === 1 ? '68%' : '46%'} height={14} />
                    <div style={{ marginTop: 6 }}><Skeleton width="90%" height={12} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className={styles.error}>⚠ {error}</div>}
          {plan && (
            <>
              <ol className={styles.steps}>
                {plan.steps.map((s, i) => (
                  <li key={i} className={styles.step}>
                    <div className={styles.stepNum}>{i + 1}</div>
                    <div className={styles.stepBody}>
                      <div className={styles.stepTitle}>{s.title}</div>
                      <div className={styles.stepDetail}>{s.detail}</div>
                    </div>
                  </li>
                ))}
              </ol>
              {plan.expectedImpact && <div className={styles.impact}>{plan.expectedImpact}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
