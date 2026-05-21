/**
 * AddonRunTimeline — ordered list of `AddonRunCard`s for one turn.
 */

import { AddonRunCard, type AddonRunSnapshot } from './AddonRunCard';
import styles from './AddonRunTimeline.module.css';

interface Props {
  runs: AddonRunSnapshot[];
}

export function AddonRunTimeline({ runs }: Props) {
  if (runs.length === 0) return null;
  return (
    <div className={styles.timeline}>
      {runs.map(r => (
        <AddonRunCard key={r.instanceId} run={r} />
      ))}
    </div>
  );
}
