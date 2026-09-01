/**
 * TriggerEditor — the setup for one trigger, in the addon-config modal.
 *
 * CONFIGURATION ONLY. No "who's due", no history, no run buttons — the
 * builder shows runtime data for the conversation you are currently
 * running, and a trigger's activity is not that. It lives in
 * Admin → Triggers.
 *
 * Every row — the editor's own and every trigger type's — comes from the
 * shared `TriggerRow`, so there is exactly one alignment and one set of
 * control widths. Two heading levels, deliberately unalike, because the
 * first pass made group titles and field labels both small-uppercase-grey
 * and they were impossible to tell apart:
 *
 *   group title  →  13px, bold, dark, sentence case
 *   field label  →  11px, bold, uppercase, grey
 *
 * Explanations sit behind a `?` on the group title. Delete lives in the
 * footer, where an addon keeps Remove.
 */

import { useMemo } from 'react';
import { Modal } from '../Modal/Modal';
import { HelpDot } from './HelpDot';
import { getTriggerType } from '../../triggers';
import { TriggerRow } from '../../triggers/TriggerRow';
import { rowStyles as s } from '../../triggers/triggerRowStyles';
import { groupedTimezones, shortZoneLabel } from '../../triggers/timezones';
import type { AgentDoc, AgentTrigger } from '../../types';
import styles from './TriggersScreen.module.css';

interface Props {
  agent: AgentDoc;
  trigger: AgentTrigger;
  onChange: (patch: Partial<AgentTrigger>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TriggerEditor({ agent, trigger, onChange, onDelete, onClose }: Props) {
  const type = getTriggerType(trigger.typeId);
  const quiet = trigger.quietHours;
  const crewMissing = !agent.crews.some(c => c.id === trigger.run?.crewId);
  // Built once per open, and re-derived if the saved zone changes so a
  // value this browser does not list still appears in the picker.
  const tzGroups = useMemo(() => groupedTimezones(quiet?.timezone), [quiet?.timezone]);

  return (
    <Modal
      open
      onClose={onClose}
      width={620}
      title={trigger.name || type?.displayName || 'Trigger'}
      badge={type?.displayName}
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.dangerBtn} onClick={onDelete}>Delete</button>
          <span className={styles.spacer} />
          <button type="button" className={styles.primaryBtn} onClick={onClose}>Done</button>
        </div>
      }
    >
      <div className={styles.editor}>
        <div className={styles.group}>
          <TriggerRow label="Name" htmlFor="trg-name">
            <input
              id="trg-name"
              className={s.input}
              value={trigger.name}
              placeholder="Name this trigger"
              onChange={e => onChange({ name: e.target.value })}
            />
          </TriggerRow>
        </div>

        {/* ── WHEN ── */}
        <div className={styles.groupTitle}>
          When it fires
          <HelpDot label="How the timing works">
            Quiet is measured from the <strong>customer's</strong> last message — a nudge
            doesn't reset it, so someone silent for three days stays silent for three days.
            Attempts are counted whether or not the crew ends up speaking, so a crew that
            decides to stay quiet can't loop forever. If they reply, the count starts again.
            A trigger only ever reaches conversations whose customer has spoken since you
            switched it on.
          </HelpDot>
        </div>
        <div className={styles.group}>
          {type
            ? <type.ConfigComponent
                config={trigger.config as never}
                onChange={next => onChange({ config: next })}
              />
            : <p className={styles.err}>Unknown trigger type "{trigger.typeId}".</p>}
        </div>

        {/* ── WHEN NOT ── */}
        <div className={styles.groupTitle}>
          When it must not
          <span className={styles.optional}>optional</span>
          <HelpDot label="About quiet hours">
            A nudge held back at night isn't lost — the customer is still quiet in the
            morning, so it goes then. Held-back attempts are recorded, so you can see the
            trigger wanted to fire.
          </HelpDot>
        </div>
        <div className={styles.group}>
          {/* A switch, not a checkbox. A checkbox beside the words "Any
              hour" reads as "tick this to get any hour" — the opposite
              of what ticking it does. A switch means "this row is on or
              off", and the row label already says what the row is. */}
          <TriggerRow label="Quiet hours">
            <div className={s.inline}>
              <label className={s.switchWrap} title={quiet ? 'Message at any hour instead' : 'Hold nudges during set hours'}>
                <input
                  type="checkbox"
                  checked={!!quiet}
                  onChange={e => onChange({
                    quietHours: e.target.checked
                      ? { from: '22:00', to: '08:00', timezone: 'Asia/Jerusalem' }
                      : undefined,
                  })}
                />
                <span className={s.switchTrack} />
              </label>
              {quiet ? (
                <>
                  <span className={s.trail}>Hold nudges between</span>
                  <input className={s.time} type="time" value={quiet.from}
                    onChange={e => onChange({ quietHours: { ...quiet, from: e.target.value } })} />
                  <span className={s.trail}>and</span>
                  <input className={s.time} type="time" value={quiet.to}
                    onChange={e => onChange({ quietHours: { ...quiet, to: e.target.value } })} />
                </>
              ) : (
                <span className={s.trail}>Off — the agent may message at any hour</span>
              )}
            </div>
          </TriggerRow>

          {/* Its own row rather than trailing the times — three controls
              on one line wrapped the timezone onto a second line, which
              is the ugliest thing a form row can do. */}
          {quiet && (
            <TriggerRow label="Timezone" htmlFor="trg-tz">
              <select
                id="trg-tz"
                className={s.selectFull}
                value={quiet.timezone}
                onChange={e => onChange({ quietHours: { ...quiet, timezone: e.target.value } })}
              >
                {tzGroups.map(g => (
                  <optgroup key={g.region} label={g.region}>
                    {g.zones.map(z => (
                      <option key={z} value={z}>{shortZoneLabel(z)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </TriggerRow>
          )}
        </div>

        {/* ── THEN ── */}
        <div className={styles.groupTitle}>
          What it runs
          <HelpDot label="About the brief">
            The brief stands in for the message the customer didn't send.
            {' '}<strong>They never see it</strong> — it isn't added to the conversation.
            Leave it blank and the crew works from the conversation history alone.
            Supports the same <code>{'{{tokens}}'}</code> as any prompt.
          </HelpDot>
        </div>
        <div className={styles.group}>
          <TriggerRow label="Crew" htmlFor="trg-crew">
            <select
              id="trg-crew"
              className={crewMissing ? `${s.selectFull} ${styles.selectWarn}` : s.selectFull}
              value={trigger.run?.crewId || ''}
              onChange={e => onChange({ run: { ...(trigger.run ?? {}), crewId: e.target.value } })}
            >
              <option value="">— pick a crew —</option>
              {agent.crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </TriggerRow>
          <TriggerRow label="Brief" htmlFor="trg-brief">
            <textarea
              id="trg-brief"
              className={s.textarea}
              rows={3}
              placeholder="The customer has gone quiet. Decide whether to re-engage, and if so, send one short follow-up."
              value={trigger.run?.brief || ''}
              onChange={e => onChange({ run: { ...(trigger.run ?? { crewId: '' }), brief: e.target.value } })}
            />
          </TriggerRow>
        </div>
      </div>
    </Modal>
  );
}
