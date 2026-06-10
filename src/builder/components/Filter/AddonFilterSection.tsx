/**
 * AddonFilterSection — per-addon "should this run?" gate.
 *
 * Universal — rendered by AddonModal for every plugin. Sits next to
 * History (and Trigger when on the offline lane). Same condition
 * vocabulary as the Transition Router; the shared `ConditionsEditor`
 * handles the rows. The polarity toggle (Include / Exclude) is what
 * this section adds on top:
 *
 *   - Include (default) — addon runs only when ALL conditions match.
 *   - Exclude — addon runs only when AT LEAST ONE condition fails.
 *
 * Empty conditions → no gate at all (the engine treats this as
 * "always run", matching legacy behaviour). A gentle hint says so.
 */

import { useAddonMutations } from '../../state/useAddonMutations';
import { ConditionsEditor } from '../Conditions/ConditionsEditor';
import type { AddonContext, AddonFilter, AddonInstance, ID, TransitionCondition } from '../../types';
import styles from './AddonFilterSection.module.css';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  instance: AddonInstance;
}

export function AddonFilterSection({ agentId, crewId, instance }: Props) {
  const muts = useAddonMutations(agentId, crewId);
  const ctx = instance.context;
  const filter: AddonFilter = ctx.filter ?? { conditions: [], mode: 'include' };

  const patch = (next: Partial<AddonContext>) =>
    muts.updateContext(instance.instanceId, { ...ctx, ...next });

  const setConditions = (conditions: TransitionCondition[]) =>
    patch({ filter: { mode: filter.mode, conditions } });

  const setMode = (mode: AddonFilter['mode']) =>
    patch({ filter: { mode, conditions: filter.conditions } });

  const hasConditions = filter.conditions.length > 0;

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <span className={styles.title}>Run filter</span>
        <span className={styles.modePill} role="group" aria-label="Filter polarity">
          <button
            type="button"
            className={`${styles.modeBtn} ${filter.mode !== 'exclude' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('include')}
            title="Run this addon only when ALL conditions match."
          >
            Run when matches
          </button>
          <button
            type="button"
            className={`${styles.modeBtn} ${filter.mode === 'exclude' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('exclude')}
            title="Skip this addon when conditions match; run when at least one fails."
          >
            Skip when matches
          </button>
        </span>
      </header>

      <ConditionsEditor
        conditions={filter.conditions}
        onChange={setConditions}
        agentId={agentId}
        crewId={crewId ?? ''}
        title=""
        emptyMessage="No conditions — addon runs every turn. Add one to gate it."
      />

      {hasConditions && (
        <p className={styles.hint}>
          {filter.mode === 'exclude'
            ? 'Runs UNLESS every condition above matches. Skipped runs surface as "skipped" cards in the chat timeline.'
            : 'Runs ONLY when every condition above matches. Skipped runs surface as "skipped" cards in the chat timeline.'}
        </p>
      )}
    </section>
  );
}
