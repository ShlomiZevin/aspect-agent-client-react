/**
 * TransitionRouterConfig — config UI for the Transition Router.
 *
 *   - Target crew: chip selector.
 *   - Conditions:  delegated to the shared `ConditionsEditor`.
 *   - Reason:      small text input.
 *   - After match: horizontal pill toggle (Continue / Break).
 *
 * The conditions list itself is shared with Triggered Context — both
 * addons speak the same condition vocabulary and use the same editor.
 * See `aspect-react-client/src/builder/components/Conditions/`.
 */

import { useMemo } from 'react';
import type { PluginConfigProps } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { ConditionsEditor } from '../../components/Conditions/ConditionsEditor';
import type { TransitionRouterConfig } from '../../types';
import styles from './TransitionRouterConfig.module.css';

export function TransitionRouterConfigComponent({
  config, onChange, agentId, crewId,
}: PluginConfigProps<TransitionRouterConfig>) {
  const { doc } = useBuilder();

  const targets = useMemo(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    if (!agent) return [];
    return agent.crews.filter(c => c.id !== crewId).map(c => ({ id: c.id, name: c.name }));
  }, [doc, agentId, crewId]);

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Target</span>
        {targets.length === 0 ? (
          <span className={styles.empty}>Add a second crew first.</span>
        ) : (
          <div className={styles.chipGroup}>
            {targets.map(t => (
              <button
                key={t.id}
                type="button"
                className={`${styles.chip} ${config.target === t.id ? styles.chipActive : ''}`}
                onClick={() => onChange({ ...config, target: t.id })}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <ConditionsEditor
        conditions={config.conditions}
        onChange={conditions => onChange({ ...config, conditions })}
        agentId={agentId}
        crewId={crewId}
        emptyMessage="No conditions — router will never fire. Add one above."
      />

      <div className={styles.row}>
        <span className={styles.rowLabel}>Reason</span>
        <input
          className={styles.reasonInput}
          value={config.reason ?? ''}
          onChange={e => onChange({ ...config, reason: e.target.value })}
          placeholder="optional — shown in the addon timeline"
          spellCheck={false}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>After match</span>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggle} ${config.onMatch !== 'break' ? styles.toggleActive : ''}`}
            onClick={() => onChange({ ...config, onMatch: 'continue' })}
            title="Run the rest of the CURRENT crew's chain. The target crew (if 'Fire immediately' is on) takes over after this crew finishes."
          >
            Continue
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${config.onMatch === 'break' ? styles.toggleActive : ''}`}
            onClick={() => onChange({ ...config, onMatch: 'break' })}
            title="Skip the rest of the CURRENT crew's chain. The target crew (if 'Fire immediately' is on) starts right away."
          >
            Break
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Fire target</span>
        <div className={styles.toggleStack}>
          <div className={styles.toggleGroup}>
            <button
              type="button"
              className={`${styles.toggle} ${config.fireImmediately !== false ? styles.toggleActive : ''}`}
              onClick={() => onChange({ ...config, fireImmediately: true })}
              title="The target crew's chain runs right after this crew settles — same turn."
            >
              This turn
            </button>
            <button
              type="button"
              className={`${styles.toggle} ${config.fireImmediately === false ? styles.toggleActive : ''}`}
              onClick={() => onChange({ ...config, fireImmediately: false })}
              title="The target crew is queued up but doesn't run until the next user message."
            >
              Next message
            </button>
          </div>
          <div className={styles.toggleHint}>
            {config.fireImmediately !== false
              ? 'Target crew runs right after this one — same turn.'
              : 'Target crew waits until the next user message.'}
          </div>
        </div>
      </div>
    </div>
  );
}
