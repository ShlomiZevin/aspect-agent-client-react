import type { InsightBlock } from '../../../types/insights';
import { InsightChart } from './InsightChart';
import { useLanguage } from '../../../context/LanguageContext';
import detailStyles from './InsightDetail.module.css';
import styles from './Blocks.module.css';

/** Renders whichever block type the model chose for this specific finding — see InsightBlock in types/insights.ts. */
export function BlockRenderer({ block }: { block: InsightBlock }) {
  switch (block.type) {
    case 'chart':
      return <InsightChart chart={block.chart} />;
    case 'ranked_list':
      return <RankedListBlock {...block} />;
    case 'stat_callout':
      return <StatCalloutBlock {...block} />;
    case 'comparison':
      return <ComparisonBlock {...block} />;
    case 'scenarios':
      return <ScenariosBlock {...block} />;
    default:
      return null;
  }
}

function RankedListBlock({ title, unit, items }: Extract<InsightBlock, { type: 'ranked_list' }>) {
  return (
    <div className={styles.card}>
      <div className={styles.blockTitle}>{title}</div>
      <div>
        {items.map((it, i) => (
          <div className={styles.rankRow} key={`${it.label}-${i}`}>
            <div className={styles.rankNum}>{i + 1}</div>
            <div className={styles.rankBody}>
              <div className={styles.rankLabel}>{it.label}</div>
              <div className={styles.rankBarTrack}><div className={styles.rankBarFill} style={{ width: `${it.pct}%` }} /></div>
            </div>
            <div className={styles.rankValue}>{it.value}{unit ? ` ${unit}` : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCalloutBlock({ value, label, description }: Extract<InsightBlock, { type: 'stat_callout' }>) {
  return (
    <div className={styles.card}>
      <div className={styles.statCallout}>
        <div className={styles.statLabel}>{label}</div>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statDesc}>{description}</div>
      </div>
    </div>
  );
}

function ComparisonBlock({ items }: Extract<InsightBlock, { type: 'comparison' }>) {
  return (
    <div className={styles.comparisonGrid} style={{ '--ai-cmp-cols': items.length } as React.CSSProperties}>
      {items.map((it, i) => (
        <div key={`${it.label}-${i}`} className={`${styles.comparisonCard} ${styles[it.direction]}`}>
          <div className={styles.comparisonLabel}>{it.label}</div>
          <div className={`${styles.comparisonValue} ${styles[it.direction]}`}>{it.value}</div>
          <div className={styles.comparisonSub}>{it.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ScenariosBlock({ items }: Extract<InsightBlock, { type: 'scenarios' }>) {
  const { t } = useLanguage();
  return (
    <div>
      <div className={detailStyles.scenariosTitle}>{t('intel.detail.keyNumbers')}</div>
      <div className={detailStyles.scenarioGrid}>
        {items.map(s => (
          <div key={s.key} className={`${detailStyles.scenarioCard} ${s.key === 'good' ? detailStyles.good : ''} ${s.key === 'negative' ? detailStyles.negative : ''}`}>
            <div className={`${detailStyles.scenarioLabel} ${s.key === 'good' ? detailStyles.good : ''} ${s.key === 'negative' ? detailStyles.negative : ''}`}>{s.label.toUpperCase()}</div>
            <div className={`${detailStyles.scenarioValue} ${s.key === 'good' ? detailStyles.good : ''} ${s.key === 'negative' ? detailStyles.negative : ''}`}>{s.value}</div>
            <div className={detailStyles.scenarioDesc}>{s.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
