/**
 * SilenceConfig — the two-number form for the Silence trigger.
 *
 * Two numbers is the whole card, and that is the point. Everything else
 * the rule needs — spacing between attempts, refusing to reach back into
 * conversations that went quiet before the trigger existed — is derived
 * from these two, so the author never sees a knob whose purpose they'd
 * have to be told.
 *
 * Uses the shared `TriggerRow` and its control classes, NOT its own row
 * layout: mixing two row systems inside one group card is what made the
 * labels sit at different heights and pushed "of quiet" past the card's
 * edge.
 *
 * No explanatory prose here — the "how this works" copy lives behind the
 * `?` on the editor's When header.
 *
 * Lives apart from its shape (`silenceShape.ts`) and its registration
 * (`trigger.silence.ts`) so this file exports only components — React
 * Fast Refresh needs that.
 */

import { TriggerRow } from '../TriggerRow';
import { rowStyles as s } from '../triggerRowStyles';
import type { TriggerTypeConfigProps } from '../registry';
import { SILENCE_UNITS, type SilenceConfig } from './silenceShape';

export function SilenceConfigComponent({ config, onChange }: TriggerTypeConfigProps<SilenceConfig>) {
  const after = config?.after ?? { value: 30, unit: 'minutes' as const };
  const maxAttempts = config?.maxAttempts ?? 3;

  return (
    <>
      <TriggerRow
        label="Nudge after"
        htmlFor="silence-after"
        hint="How long the customer has to be quiet before the first attempt."
      >
        <div className={s.inline}>
          <input
            id="silence-after"
            className={s.number}
            type="number"
            min={1}
            value={after.value}
            onChange={e => onChange({
              ...config,
              after: { ...after, value: Math.max(1, Number(e.target.value) || 1) },
            })}
          />
          <select
            className={`${s.select} ${s.unit}`}
            value={after.unit}
            onChange={e => onChange({
              ...config,
              after: { ...after, unit: e.target.value as SilenceConfig['after']['unit'] },
            })}
          >
            {SILENCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <span className={s.trail}>of quiet</span>
        </div>
      </TriggerRow>

      <TriggerRow
        label="Up to"
        htmlFor="silence-max"
        hint="Attempts per silence. Counted whether or not the crew ends up speaking. Resets when the customer replies."
      >
        <div className={s.inline}>
          <input
            id="silence-max"
            className={s.number}
            type="number"
            min={1}
            max={20}
            value={maxAttempts}
            onChange={e => onChange({
              ...config,
              maxAttempts: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
            })}
          />
          <span className={s.trail}>times, until they reply</span>
        </div>
      </TriggerRow>
    </>
  );
}
