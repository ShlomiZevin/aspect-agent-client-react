/**
 * AddonTriggerSection — "When does this offline addon fire?"
 *
 * Rendered by AddonModal only when `instance.lane === 'offline'`.
 * Blocking and background lanes don't have a trigger concept — they
 * run once per turn by definition — so the section is hidden for
 * them.
 *
 * Two trigger kinds in v1 (`every_n_messages`, `on_transition`).
 * Kinds are a flat <select>; the `every_n_messages` row also shows
 * an N input. New kinds plug in by extending the OfflineTrigger
 * discriminated union, the render switch below, and (server-side)
 * the `shouldFire` evaluator in `offlineDispatcher.js`.
 *
 * The Trigger section sits ABOVE History in the AddonModal because
 * "when does this run" reads before "what does it see when it runs."
 */

import { useAddonMutations } from '../../state/useAddonMutations';
import { InlineField } from '../AddonModal/InlineField';
import { describeTrigger } from './triggerFormat';
import type { AddonContext, AddonInstance, ID, OfflineTrigger } from '../../types';
import styles from './AddonTriggerSection.module.css';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  instance: AddonInstance;
}

type TriggerKind = OfflineTrigger['kind'];

/** Default config for a freshly-picked trigger kind. Used when the
 *  user switches kinds in the <select> — we synthesise a complete
 *  OfflineTrigger so the persisted state is always valid. */
function defaultsForKind(kind: TriggerKind): OfflineTrigger {
  switch (kind) {
    case 'every_n_messages': return { kind: 'every_n_messages', n: 8 };
    case 'on_transition':    return { kind: 'on_transition' };
  }
}

export function AddonTriggerSection({ agentId, crewId, instance }: Props) {
  const muts = useAddonMutations(agentId, crewId);
  const ctx = instance.context;
  const trigger = ctx.trigger;
  const patch = (next: Partial<AddonContext>) =>
    muts.updateContext(instance.instanceId, { ...ctx, ...next });

  // Treat a missing trigger as `every_n_messages` for the kind picker
  // — the most common case for a fresh offline addon. The actual
  // persisted state stays `undefined` until the user changes anything,
  // at which point we synthesise a full trigger.
  const kind: TriggerKind = trigger?.kind ?? 'every_n_messages';

  const onKindChange = (nextKind: TriggerKind) => {
    if (nextKind === kind && trigger) return;
    patch({ trigger: defaultsForKind(nextKind) });
  };

  return (
    <div className={styles.section}>
      <InlineField label="Trigger" hint={describeTrigger(trigger)}>
        <select
          className={styles.select}
          value={kind}
          onChange={e => onKindChange(e.target.value as TriggerKind)}
        >
          <option value="every_n_messages">Every N messages</option>
          <option value="on_transition">On crew transition</option>
        </select>
      </InlineField>

      {kind === 'every_n_messages' && (
        <InlineField
          label="N"
          hint="The addon fires after every N user messages (counted per conversation). Counter resets to 0 after each firing."
        >
          <input
            className={styles.numberInput}
            type="number"
            min={1}
            max={1000}
            value={trigger?.kind === 'every_n_messages' ? trigger.n : 8}
            onChange={e => {
              const n = Math.max(1, Math.floor(Number(e.target.value) || 8));
              patch({ trigger: { kind: 'every_n_messages', n } });
            }}
          />
        </InlineField>
      )}
    </div>
  );
}
