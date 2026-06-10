/**
 * triggerFormat — render an `OfflineTrigger` into a short human label.
 *
 * Used by the ChainCanvas card (under the model line) and the
 * AddonModal Trigger section (preview chip). One shared formatter so
 * the wording stays in sync.
 */

import type { OfflineTrigger } from '../../types';

/** Short summary suitable for a chain card or chip. */
export function formatTrigger(trigger: OfflineTrigger | undefined | null): string {
  if (!trigger || typeof trigger !== 'object') return 'no trigger';
  if (trigger.kind === 'every_n_messages') {
    const n = Math.max(1, Math.floor(trigger.n || 0));
    return `every ${n} msg${n === 1 ? '' : 's'}`;
  }
  if (trigger.kind === 'on_transition') {
    return 'on transition';
  }
  return 'unknown trigger';
}

/** One-liner for the AddonModal hint copy. Longer than `formatTrigger`. */
export function describeTrigger(trigger: OfflineTrigger | undefined | null): string {
  if (!trigger || typeof trigger !== 'object') {
    return 'No trigger configured. The addon will never fire — pick a trigger to activate it.';
  }
  if (trigger.kind === 'every_n_messages') {
    const n = Math.max(1, Math.floor(trigger.n || 0));
    return `Fires after every ${n} user message${n === 1 ? '' : 's'} (counted per conversation). Counter resets to 0 after each firing.`;
  }
  if (trigger.kind === 'on_transition') {
    return "Fires whenever a crew transition is emitted during the turn's blocking chain.";
  }
  return 'Unknown trigger kind — your data may reference a future trigger this client version doesn\'t recognise.';
}
