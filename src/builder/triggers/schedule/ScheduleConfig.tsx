/**
 * ScheduleConfig — the "When it fires" form for the Schedule trigger
 * (#950).
 *
 * Design: option 3A of the Leonardo round —
 * lybi-website/art-source/ui/schedule-trigger/ (3A.jpg; the card's
 * "next:" line and the one-off summary from 4A.jpg). Chosen because it
 * keeps the existing editor exactly: the same TriggerRow label column,
 * the same group box, so a Schedule reads as the same object as Silence.
 *
 *   REPEATS   [Weekly | Once]
 *   DAYS      Sun Mon Tue Wed Thu Fri Sat     (quick picks under them)
 *   TIMES     [09:00 ×] [17:00 ×] + Add time
 *   DATES     (switch) [start] – [end]
 *   ── or, for Once ──
 *   ON        [date] [time]
 *   TIMEZONE  Jerusalem
 *   RESULT    Sun–Thu at 09:00, 17:00 · next: tomorrow 09:00
 *
 * NO LAYOUT SHIFT (Shlomi's rule): the Weekly rows and the Once rows sit
 * in the SAME grid cell, the hidden set kept with `visibility: hidden`,
 * so the box is always as tall as the taller one and switching Weekly ↔
 * Once moves nothing below it. The date range stays on screen, disabled
 * in place, while its switch is off. A time inside quiet hours turns its
 * own chip amber — no notice row appears.
 *
 * Both modes' values are kept in the config while you switch, so going
 * back to Weekly restores your days and times. The server reads only
 * the fields of the current `repeat`.
 *
 * "next:" is the SERVER's answer (`context.nextFire`), computed by the
 * same slot code the clock runs — never re-derived here.
 */

import { useMemo, useState } from 'react';
import { TriggerRow } from '../TriggerRow';
import { rowStyles as s } from '../triggerRowStyles';
import { groupedTimezones, shortZoneLabel } from '../timezones';
import type { TriggerTypeConfigProps } from '../registry';
import {
  DAY_SHORT, DEFAULT_TZ, MAX_TIMES, QUICK_PICKS, describeSchedule, formatNextSchedule,
  insideQuietHours, onceLabel, sameDays, sortedTimes, todayIn, untilLabel,
  type ScheduleConfig,
} from './scheduleShape';
import styles from './ScheduleConfig.module.css';

/** A time not already in the list, an hour after the last one. */
function nextFreeTime(times: string[]): string {
  const last = times[times.length - 1];
  let h = last ? (Number(last.slice(0, 2)) + 1) % 24 : 9;
  for (let i = 0; i < 24; i++) {
    const t = `${String(h).padStart(2, '0')}:00`;
    if (!times.includes(t)) return t;
    h = (h + 1) % 24;
  }
  return '12:00';
}

export function ScheduleConfigComponent({ config, onChange, context }: TriggerTypeConfigProps<ScheduleConfig>) {
  const tz = config?.timezone || DEFAULT_TZ;
  const repeat = config?.repeat === 'once' ? 'once' : 'weekly';
  const days = config?.days ?? [];
  const times = sortedTimes(config?.times);
  const rangeOn = !!(config?.startDate || config?.endDate);
  const onceDate = (config?.onceAt ?? '').split('T')[0] || '';
  const onceTime = (config?.onceAt ?? '').split('T')[1] || '';
  const tzGroups = useMemo(() => groupedTimezones(tz), [tz]);
  // Quiet hours are only comparable when they are read on the same clock.
  const qh = context?.quietHours && context.quietHours.timezone === tz ? context.quietHours : undefined;

  // The value a cleared time input holds until a valid one is typed —
  // kept locally so a half-typed time never reaches the saved config.
  const [draft, setDraft] = useState<Record<number, string>>({});

  const set = (patch: Partial<ScheduleConfig>) => onChange({ ...config, ...patch });

  const toggleDay = (d: number) =>
    set({ days: days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort((a, b) => a - b) });

  const setTime = (i: number, value: string) => {
    if (!/^\d{2}:\d{2}$/.test(value)) { setDraft(x => ({ ...x, [i]: value })); return; }
    setDraft(x => { const n = { ...x }; delete n[i]; return n; });
    const next = [...times];
    next[i] = value;
    set({ times: sortedTimes(next) });
  };

  const switchRepeat = (to: 'weekly' | 'once') => {
    if (to === repeat) return;
    if (to === 'once' && !config?.onceAt) set({ repeat: 'once', onceAt: `${todayIn(tz, 1)}T09:00` });
    else set({ repeat: to });
  };

  const next = context?.nextFire;
  const nextText = repeat === 'once'
    ? (next === undefined ? '…' : next?.at ? untilLabel(next.at) : 'already passed')
    : formatNextSchedule(next, config);
  const skipped = next?.skippedForQuietHours ?? 0;

  return (
    <>
      <TriggerRow label="Repeats">
        <div className={styles.segment} role="radiogroup" aria-label="Repeats">
          {(['weekly', 'once'] as const).map(r => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={repeat === r}
              className={repeat === r ? styles.segOn : styles.seg}
              onClick={() => switchRepeat(r)}
              title={r === 'weekly' ? 'On the days and times you pick, every week' : 'One send, on one date and time'}
            >
              {r === 'weekly' ? 'Weekly' : 'Once'}
            </button>
          ))}
        </div>
      </TriggerRow>

      {/* Both sets in one grid cell — see the header. */}
      <div className={styles.stack}>
        <div className={repeat === 'weekly' ? styles.layer : styles.layerHidden}
             aria-hidden={repeat !== 'weekly'} inert={repeat !== 'weekly' ? true : undefined}>
          <TriggerRow label="Days" hint="Days of the week, in the timezone below">
            <div className={styles.daysBlock}>
              <div className={styles.days}>
                {DAY_SHORT.map((name, d) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={days.includes(d)}
                    className={days.includes(d) ? styles.dayOn : styles.day}
                    onClick={() => toggleDay(d)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className={styles.picks}>
                {QUICK_PICKS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className={sameDays(days, p.days) ? styles.pickOn : styles.pick}
                    onClick={() => set({ days: p.days })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </TriggerRow>

          <TriggerRow label="Times" hint="Each time is its own send. At most 8.">
            <div className={styles.times}>
              {times.map((t, i) => {
                const quiet = insideQuietHours(t, qh);
                return (
                  <span key={`${t}-${i}`} className={quiet ? styles.timeChipWarn : styles.timeChip}
                        title={quiet ? 'Inside quiet hours — skipped' : undefined}>
                    <input
                      className={styles.timeInput}
                      type="time"
                      value={draft[i] ?? t}
                      onChange={e => setTime(i, e.target.value)}
                      aria-label={`Time ${i + 1}`}
                    />
                    <button
                      type="button"
                      className={styles.timeX}
                      onClick={() => set({ times: times.filter((_, j) => j !== i) })}
                      disabled={times.length <= 1}
                      title={times.length <= 1 ? 'A schedule needs at least one time' : 'Remove this time'}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                className={styles.addTime}
                onClick={() => set({ times: sortedTimes([...times, nextFreeTime(times)]) })}
                disabled={times.length >= MAX_TIMES}
                title={times.length >= MAX_TIMES ? `At most ${MAX_TIMES} times a day` : 'Add another time of day'}
              >
                + Add time
              </button>
            </div>
          </TriggerRow>

          <TriggerRow label="Dates" hint="Optional: the first and last day it runs. Off = until you switch the trigger off.">
            <div className={s.inline}>
              <label className={s.switchWrap} title={rangeOn ? 'Run with no end date' : 'Limit to a date range'}>
                <input
                  type="checkbox"
                  checked={rangeOn}
                  onChange={e => set(e.target.checked
                    ? { startDate: todayIn(tz), endDate: todayIn(tz, 30) }
                    : { startDate: undefined, endDate: undefined })}
                />
                <span className={s.switchTrack} />
              </label>
              {/* Always drawn; disabled in place while the switch is off. */}
              <input
                className={`${s.time} ${styles.date}`}
                type="date"
                disabled={!rangeOn}
                value={config?.startDate ?? ''}
                onChange={e => set({ startDate: e.target.value || undefined })}
                aria-label="First day"
              />
              <span className={s.trail}>–</span>
              <input
                className={`${s.time} ${styles.date}`}
                type="date"
                disabled={!rangeOn}
                min={config?.startDate || undefined}
                value={config?.endDate ?? ''}
                onChange={e => set({ endDate: e.target.value || undefined })}
                aria-label="Last day"
              />
            </div>
          </TriggerRow>
        </div>

        <div className={repeat === 'once' ? styles.layer : styles.layerHidden}
             aria-hidden={repeat !== 'once'} inert={repeat !== 'once' ? true : undefined}>
          <TriggerRow label="On" hint="The one date and time it sends">
            <div className={s.inline}>
              <input
                className={`${s.time} ${styles.date}`}
                type="date"
                value={onceDate}
                onChange={e => e.target.value && set({ onceAt: `${e.target.value}T${onceTime || '09:00'}` })}
                aria-label="Date"
              />
              <input
                className={s.time}
                type="time"
                value={onceTime}
                onChange={e => /^\d{2}:\d{2}$/.test(e.target.value)
                  && set({ onceAt: `${onceDate || todayIn(tz, 1)}T${e.target.value}` })}
                aria-label="Time"
              />
              {insideQuietHours(onceTime, qh) && (
                <span className={styles.warnPill} title="This time is inside quiet hours, so nothing would be sent">
                  inside quiet hours
                </span>
              )}
            </div>
          </TriggerRow>
        </div>
      </div>

      <TriggerRow label="Timezone" htmlFor="sched-tz" hint="The clock the days and times are read in">
        <select
          id="sched-tz"
          className={s.selectAuto}
          value={tz}
          onChange={e => set({ timezone: e.target.value })}
        >
          {tzGroups.map(g => (
            <optgroup key={g.region} label={g.region}>
              {g.zones.map(z => <option key={z} value={z}>{shortZoneLabel(z)}</option>)}
            </optgroup>
          ))}
        </select>
      </TriggerRow>

      <TriggerRow label="Result">
        <div className={styles.result}>
          <span className={styles.resultMain}>
            {repeat === 'once' ? `Once · ${onceLabel(config?.onceAt)}` : describeSchedule(config)}
          </span>
          <span className={styles.resultDot}>·</span>
          <span className={styles.resultNext}>{nextText}</span>
          {skipped > 0 && repeat === 'weekly' && (
            <span className={styles.warnPill}
                  title={`${skipped} upcoming time${skipped === 1 ? '' : 's'} fall inside quiet hours and will be skipped`}>
              {skipped} in quiet hours
            </span>
          )}
        </div>
      </TriggerRow>
    </>
  );
}
