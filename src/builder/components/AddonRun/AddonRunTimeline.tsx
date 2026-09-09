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
import { useBuilder } from '../../state/BuilderContext';
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
  // Crew display names for the transition strips — same lookup the card
  // body uses; falls back to the raw id when the crew was deleted.
  const { doc } = useBuilder();
  const crewNameById = (crewId: string): string => {
    for (const a of doc.agents) {
      const c = a.crews.find(cr => cr.id === crewId);
      if (c) return c.name;
    }
    return crewId;
  };
  const visible = hidden ? runs.filter(r => !hidden[catOf(r.pluginId)]) : runs;
  if (visible.length === 0) return null;
  return (
    <div className={styles.timeline}>
      {visible.map(r => (
        <div key={r.instanceId} className={styles.row} data-cat={catOf(r.pluginId)}>
          <AddonRunCard run={r} />
          {/* Task #828: a crew transition redefines the rest of the turn —
              give it its own strip in the timeline (driven by the run's
              REAL transition payload, live and rehydrated alike), so it
              reads as an event, not a detail hidden inside one card. */}
          {r.transition?.to && (
            <div className={styles.transitionRow} title={r.transition.reason || undefined}>
              <span className={styles.transitionArrow}>⤷</span>
              <span>Transition to <strong>{crewNameById(r.transition.to)}</strong></span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
