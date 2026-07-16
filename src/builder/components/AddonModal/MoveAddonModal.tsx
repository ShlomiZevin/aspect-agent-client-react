/**
 * MoveAddonModal — Move OR Duplicate an addon to a lane/container.
 *
 * One picker, two actions (Shlomi's framing: "duplicate and move are
 * the same functionality — the only difference is whether the original
 * stays"). Destinations: any crew or the agent cortex (Talker /
 * Transition Router excluded there — the runtime forbids them). Lanes:
 * Blocking + Offline only — Background is reserved and never executed.
 *
 * The addon lands at the END of the destination chain (drag to reorder
 * afterwards). Landing in Offline seeds an "every 1 message" trigger
 * when none is set. A cross-container move that leaves behind
 * crew-scoped extracted fields shows a warning (refs stay, runtime
 * ignores them; the Fields panel will flag the field as unwired).
 * Notices render inside a fixed-height slot so the modal NEVER resizes
 * as they appear/disappear.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useBuilderSettings } from '../TopBar/BuilderSettings';
import { AGENT_FORBIDDEN_PLUGINS } from '../AddStepModal/AddStepModal';
import type { AddonInstance, ID } from '../../types';
import styles from './MoveAddonModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** Where the addon lives now. null = agent cortex. */
  fromCrewId: ID | null;
  instance: AddonInstance;
  /** Fired after a successful move (the host closes the addon modal —
   *  the instance no longer lives where that modal was opened from). */
  onMoved: () => void;
  /** Fired after a duplicate — the original is untouched, so the host
   *  just closes this picker and stays on the addon modal. */
  onDuplicated: () => void;
}

const CORTEX_KEY = '__cortex__';

export function MoveAddonModal({ open, onClose, agentId, fromCrewId, instance, onMoved, onDuplicated }: Props) {
  const { doc, moveAddon, duplicateAddon, saveAgentVersion, saveCrewVersion } = useBuilder();
  const [settings] = useBuilderSettings();
  const agent = doc.agents.find(a => a.id === agentId);

  const currentKey = fromCrewId ?? CORTEX_KEY;
  const currentLane: 'main' | 'offline' = instance.lane === 'offline' ? 'offline' : 'main';

  const [targetKey, setTargetKey] = useState<string>(currentKey);
  const [lane, setLane] = useState<'main' | 'offline'>(currentLane);

  // Re-seat on open so a reopened modal starts from the addon's
  // current home (Move disabled until something changes).
  useEffect(() => {
    if (!open) return;
    setTargetKey(fromCrewId ?? CORTEX_KEY);
    setLane(instance.lane === 'offline' ? 'offline' : 'main');
  }, [open, fromCrewId, instance.lane]);

  const cortexAllowed = !AGENT_FORBIDDEN_PLUGINS.has(instance.pluginId);
  const toCrewId: ID | null = targetKey === CORTEX_KEY ? null : targetKey;
  const isNoop = targetKey === currentKey && lane === currentLane;

  // Crew-scoped fields of the SOURCE crew that this addon extracts —
  // they don't travel (scope = the array they live in), so a
  // cross-container move leaves those references dangling.
  const strandedFields = useMemo(() => {
    if (!agent || fromCrewId === null || toCrewId === fromCrewId) return [];
    const src = agent.crews.find(c => c.id === fromCrewId);
    const extracts = (instance.config as { extractsFields?: ID[] } | undefined)?.extractsFields ?? [];
    if (!src || extracts.length === 0) return [];
    return (src.fields ?? []).filter(f => extracts.includes(f.id)).map(f => f.name);
  }, [agent, fromCrewId, toCrewId, instance.config]);

  if (!agent) return null;

  const persistTouched = (movedAway: boolean) => {
    if (!settings.autoSave) return;
    // Persist the touched entities — same commit model as the addon
    // modal's Done button. Duplicate touches only the destination.
    if ((movedAway && fromCrewId === null) || toCrewId === null) saveAgentVersion(agentId);
    if (movedAway && fromCrewId !== null) saveCrewVersion(agentId, fromCrewId);
    if (toCrewId !== null && (!movedAway || toCrewId !== fromCrewId)) saveCrewVersion(agentId, toCrewId);
  };

  const move = () => {
    if (isNoop) return;
    moveAddon(agentId, instance.instanceId, { crewId: fromCrewId }, { crewId: toCrewId, lane });
    persistTouched(true);
    onMoved();
  };

  const duplicate = () => {
    duplicateAddon(agentId, instance.instanceId, { crewId: fromCrewId }, { crewId: toCrewId, lane });
    persistTouched(false);
    onDuplicated();
  };

  return (
    <Modal open={open} onClose={onClose} width={440} title="Move / duplicate addon">
      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>Destination</span>
          <select
            className={styles.input}
            value={targetKey}
            onChange={e => setTargetKey(e.target.value)}
          >
            {cortexAllowed && (
              <option value={CORTEX_KEY}>
                Agent cortex{currentKey === CORTEX_KEY ? ' (current)' : ''}
              </option>
            )}
            {agent.crews.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.id === currentKey ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Lane</span>
          <div className={styles.laneRow}>
            {(['main', 'offline'] as const).map(l => (
              <button
                key={l}
                type="button"
                className={`${styles.laneBtn} ${lane === l ? styles.laneBtnActive : ''}`}
                onClick={() => setLane(l)}
              >
                {l === 'main' ? 'Blocking' : 'Offline'}
              </button>
            ))}
          </div>
        </div>

        {/* Fixed-height notice slot — hints/warnings swap INSIDE it, so
            the modal never resizes as they appear. One notice at a
            time; the stranded-fields warning outranks the trigger hint. */}
        <div className={styles.noticeSlot}>
          {strandedFields.length > 0 ? (
            <div className={styles.warn}>
              ⚠ {strandedFields.length === 1 ? 'Field' : 'Fields'}{' '}
              <strong>{strandedFields.join(', ')}</strong>{' '}
              {strandedFields.length === 1 ? 'is' : 'are'} crew-scoped to the current crew and won't travel — the reference stays but stops resolving.
            </div>
          ) : lane === 'offline' && !instance.context?.trigger ? (
            <span className={styles.hint}>
              Offline addons fire on a trigger — an "every 1 message" default is set; tune it in the addon's Trigger section.
            </span>
          ) : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <span className={styles.footerSpacer} />
          <button
            type="button"
            className={styles.duplicateBtn}
            onClick={duplicate}
            title="Copy this addon to the destination — the original stays"
          >
            Duplicate
          </button>
          <button
            type="button"
            className={styles.moveBtn}
            disabled={isNoop}
            onClick={move}
            title={isNoop ? 'Pick a different destination or lane (or Duplicate in place)' : 'Move (appended at the end — drag to reorder)'}
          >
            Move
          </button>
        </div>
      </div>
    </Modal>
  );
}
