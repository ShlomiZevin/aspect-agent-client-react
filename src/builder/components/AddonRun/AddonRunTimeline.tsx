/**
 * AddonRunTimeline — ordered list of `AddonRunCard`s for one turn. Each run
 * is colour-coded by family via a coloured left stripe (no title clutter):
 *   • Chat chain (the reply pipeline)  — slate
 *   • Live Brain (pluginId 'live-brain-panel')  — magenta
 *   • Profiler   (pluginId 'profiler-panel')    — violet
 * Which families show is controlled from the chat Settings popover and
 * passed in as `hidden`.
 */

import { AddonRunCard, type AddonRunSnapshot } from './AddonRunCard';
import styles from './AddonRunTimeline.module.css';

export type RunCat = 'chain' | 'brain' | 'profiler';

export function catOf(pluginId?: string): RunCat {
  if (pluginId === 'live-brain-panel') return 'brain';
  if (pluginId === 'profiler-panel') return 'profiler';
  return 'chain';
}

interface Props {
  runs: AddonRunSnapshot[];
  /** Families to hide (from chat Settings). Absent → show everything. */
  hidden?: Partial<Record<RunCat, boolean>>;
}

export function AddonRunTimeline({ runs, hidden }: Props) {
  const visible = hidden ? runs.filter(r => !hidden[catOf(r.pluginId)]) : runs;
  if (visible.length === 0) return null;
  return (
    <div className={styles.timeline}>
      {visible.map(r => (
        <div key={r.instanceId} className={styles.row} data-cat={catOf(r.pluginId)}>
          <AddonRunCard run={r} />
        </div>
      ))}
    </div>
  );
}
