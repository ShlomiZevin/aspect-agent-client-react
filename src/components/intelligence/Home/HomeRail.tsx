/**
 * Left quick-nav rail — collapsed (60px, icons only, design turns 9a/9b/10a/10b)
 * by default, expands to a rich 300px panel (design turn 7c/9c: Saved Reports
 * cards with chart+delta+comment, Recent Reports list, footer link) when the
 * chevron is clicked. Expanded state persists per dataset in localStorage.
 */
import { useState } from 'react';
import type { TrackedMetric, InsightSummary } from '../../../types/insights';
import { MiniChart } from '../Insights/MiniChart';
import { useLanguage } from '../../../context/LanguageContext';
import { FeedbackTrigger } from '../../chat/GeneralFeedbackModal';
import styles from './HomeRail.module.css';

const EXPANDED_KEY_PREFIX = 'aspect_intel_rail_expanded_';

export function useRailExpanded(datasetId: string) {
  const key = `${EXPANDED_KEY_PREFIX}${datasetId}`;
  const [expanded, setExpanded] = useState(() => localStorage.getItem(key) === '1');
  const toggle = () => setExpanded(v => {
    const next = !v;
    localStorage.setItem(key, next ? '1' : '0');
    return next;
  });
  return { expanded, toggle };
}

interface Props {
  /** Threaded through for the feedback modal — the Intelligence tree has no AgentProvider. */
  agentName: string;
  baseURL: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  tracked: TrackedMetric[] | null;
  recent: InsightSummary[];
  totalCount: number;
  onOpenInsight: (id: string) => void;
  onOpenAll: () => void;
  onOpenHistory: () => void;
}

export function HomeRail({ agentName, baseURL, expanded, onToggleExpanded, tracked, recent, totalCount, onOpenInsight, onOpenAll, onOpenHistory }: Props) {
  const { t } = useLanguage();

  if (!expanded) {
    return (
      <div className={styles.rail}>
        <button className={styles.railExpand} onClick={onToggleExpanded} title={t('intel.rail.expand')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        {/* Mobile stand-in for the chevron above, which is hidden below 720px:
            the panel is a drawer there, and a right-chevron reads as "widen
            this column" rather than "open a panel". */}
        <button className={styles.railDrawerBtn} onClick={onToggleExpanded} title={t('intel.rail.expand')} aria-label={t('intel.rail.expand')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5.5h18M3 12h18M3 18.5h12" /></svg>
        </button>
        <div className={styles.railDivider} />
        <button className={styles.railBtn} onClick={onToggleExpanded} title={t('intel.rail.saved')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ai-accent)" strokeWidth="2.1" strokeLinejoin="round"><path d="M6 3.5h12V21l-6-4.6L6 21z" /></svg>
          {tracked && tracked.length > 0 && <span className={styles.railBadge}>{tracked.length}</span>}
        </button>
        <button className={styles.railBtn} onClick={onOpenHistory} title={t('intel.rail.lastRun')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></svg>
        </button>
        <button className={styles.railBtn} onClick={onOpenAll} title={t('intel.rail.all')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
        </button>
        {/* Pinned to the foot of the rail so it is reachable from Home in both
            rail states without competing with the navigation above it. */}
        <div className={styles.railFoot}>
          <FeedbackTrigger agentName={agentName} baseURL={baseURL} variant="icon" className={styles.railBtn} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Below 720px the panel is a drawer over the page, so it needs something
          to dismiss against. Rendered at every width but display:none on
          desktop, which keeps the desktop tree and layout unchanged. */}
      <div className={styles.scrim} onClick={onToggleExpanded} role="presentation" />
    <div className={styles.railExpanded}>
      <div className={styles.expHead}>
        <div className={styles.expTitle}>{t('intel.nav.reports').toUpperCase()}</div>
        <button className={styles.expCollapseBtn} onClick={onToggleExpanded} title={t('intel.rail.collapse')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5B21B6" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      </div>

      <div className={styles.expSectionHead}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ai-accent)" strokeWidth="2.1" strokeLinejoin="round"><path d="M6 3.5h12V21l-6-4.6L6 21z" /></svg>
        <span className={styles.expSectionLabel}>{t('intel.reports.saved').toUpperCase()} · {tracked?.length ?? 0}</span>
      </div>
      <div className={styles.expCards}>
        {(tracked || []).slice(0, 3).map(item => (
          <button key={item.id} className={styles.expCard} onClick={() => onOpenInsight(item.id)}>
            <div className={styles.expCardTop}>
              <span className={styles.expCardLabel}>{item.label}</span>
              <span className={`${styles.deltaChip} ${styles[item.trendDir]}`}>{item.trendLabel}</span>
            </div>
            <div className={styles.expCardValue}>{item.value}</div>
            <div className={styles.expCardChart}>
              <MiniChart series={[{ key: item.id, color: '#8B5CF6', points: item.points }]} variant={item.isRanking ? 'bar' : 'line'} height={34} />
            </div>
            <div className={styles.expCardComment}>{item.sub}</div>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <div className={styles.expSectionHead}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ai-text-mute)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></svg>
            <span className={styles.expSectionLabel}>{t('intel.rail.recent').toUpperCase()}</span>
          </div>
          <div className={styles.expRecent}>
            {recent.map(r => (
              <button key={r.id} className={styles.expRecentRow} onClick={() => onOpenInsight(r.id)}>
                <span className={`${styles.expRecentDot} ${r.viewed ? styles.dotMuted : styles.dotReady}`} />
                <span className={styles.expRecentLabel}>{r.headline}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Carries the same grid glyph as the collapsed rail's "all reports"
          button. Without it this row's label started at the padding edge while
          the feedback row below was indented by its icon, so the two never
          lined up. */}
      <button className={styles.expFooter} onClick={onOpenAll}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
        {t('intel.rail.allFooter')} ({totalCount}) →
      </button>
      <FeedbackTrigger agentName={agentName} baseURL={baseURL} className={styles.expFeedback} />
    </div>
    </>
  );
}
