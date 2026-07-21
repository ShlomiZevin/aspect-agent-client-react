import type { InsightSummary, InsightChartPreview } from '../../../types/insights';
import { MiniChart } from './MiniChart';
import { CATEGORY_COLOR } from './categoryColors';
import { Skeleton } from './Skeleton';
import styles from './InsightCard.module.css';

/**
 * Picks the mini-chart shape from the actual data, not the insight's
 * category — a hardcoded category->variant map (e.g. "inventory always
 * means donut") broke as soon as real generated data replaced the old seed
 * content: a real inventory finding can just as easily be a 10-item ranked
 * breakdown as a clean 2-way split, and forcing that through a donut chart
 * (which only reads correctly for ~2 segments) produced a meaningless blob.
 */
function pickVariant(preview: InsightChartPreview): 'line' | 'bar' | 'donut' {
  const s = preview.series[0];
  if (!s) return 'bar';
  if (preview.series.length === 1 && s.points.length <= 2) return 'donut';
  // More than 2 categories means each one is a distinct entity (cashier,
  // store, product family...) being compared side by side, not a sequence —
  // connecting them with a line implies an order/trend that isn't real. Only
  // 2 categories reads honestly as a line (a genuine before/after pair, same
  // "isPair" case the detail chart already special-cases in normalizeChart).
  const categoryCount = preview.categories?.length ?? s.points.length;
  if (categoryCount > 2 && preview.series.length >= 2) return 'bar';
  if (preview.series.length >= 2) return 'line';
  return 'bar';
}

interface Props {
  insight: InsightSummary;
  onOpen: (id: string) => void;
  /** Only generated insights are deletable (seed content has no delete path) — omitted entirely otherwise. */
  onDelete?: (id: string) => void;
}

export function InsightCard({ insight, onOpen, onDelete }: Props) {
  const color = CATEGORY_COLOR[insight.category] || '#7C3AED';
  return (
    <div className={styles.card} onClick={() => onOpen(insight.id)}>
      <div className={styles.top}>
        <span className={styles.tag} style={{ color }}>{insight.tag}</span>
        <span className={styles.meta}>{insight.confidenceLabel} confidence · {insight.foundAgo}</span>
        {insight.isGenerated && onDelete && (
          <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); onDelete(insight.id); }} aria-label="Delete this generated insight" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13" /></svg>
          </button>
        )}
      </div>
      <div className={styles.headline}>{insight.headline}</div>
      <div className={styles.chartWrap}>
        <MiniChart series={insight.chartPreview.series} variant={pickVariant(insight.chartPreview)} />
      </div>
      <div className={styles.footer}>
        <div>
          <div className={`${styles.impactValue} ${styles[insight.impactDirection]}`}>{insight.impactValue}</div>
          <div className={styles.impactLabel}>{insight.impactLabel}</div>
        </div>
        <button className={styles.cta} onClick={e => { e.stopPropagation(); onOpen(insight.id); }}>Open</button>
      </div>
    </div>
  );
}

export function InsightCardSkeleton() {
  return (
    <div className={styles.card} style={{ cursor: 'default' }}>
      <div className={styles.top}>
        <Skeleton width={90} height={11} />
        <span className={styles.meta}><Skeleton width={70} height={11} /></span>
      </div>
      <Skeleton width="100%" height={15} />
      <Skeleton width="70%" height={15} />
      <div className={styles.chartWrap} style={{ width: '100%' }}>
        <Skeleton width="100%" height={44} radius={6} />
      </div>
      <div className={styles.footer}>
        <div>
          <Skeleton width={60} height={17} />
          <div style={{ marginTop: 4 }}><Skeleton width={80} height={11} /></div>
        </div>
        <Skeleton width={70} height={32} radius={10} />
      </div>
    </div>
  );
}

export function RequestInsightCard({ onClick }: { onClick: () => void }) {
  return (
    <div className={styles.requestCard} onClick={onClick}>
      <div className={styles.requestIcon}>✦</div>
      <div className={styles.requestTitle}>Request a new insight</div>
      <div className={styles.requestSub}>Aspect will run a background investigation and report here.</div>
    </div>
  );
}
