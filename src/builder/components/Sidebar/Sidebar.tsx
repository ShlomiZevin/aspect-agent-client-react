/**
 * Sidebar — project / agent / crews navigation.
 *
 * Three sections, each selectable. The "current selection" drives
 * what the center canvas renders.
 */

import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { doc, selection, setSelection, addCrew, removeCrew, isCrewDirty, isAgentDirty } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents.find(a => a.id === selection.agentId) ?? doc.agents[0];

  /**
   * Delete a crew with confirmation. Blocks deletion of the agent's
   * `defaultCrewId` since that would leave the agent rudderless at
   * runtime (resolveRunnable would have nothing to fall back to).
   * If the deleted crew was currently selected, jump to whichever
   * crew remains.
   */
  const handleDeleteCrew = async (crewId: string, crewName: string) => {
    if (!agent) return;
    if (agent.defaultCrewId === crewId) {
      await confirm({
        title: "Can't delete the default crew",
        message:
          `"${crewName}" is the agent's default crew — it runs the first turn of every new conversation. ` +
          'Set a different crew as default before deleting this one.',
        confirmLabel: 'OK',
      });
      return;
    }
    const ok = await confirm({
      title: `Delete crew "${crewName}"?`,
      message:
        'The crew, its versions, and its addon config will be removed. ' +
        'Memory captured into shared domains is kept; this only deletes the crew itself.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    removeCrew(agent.id, crewId);
    // If we just deleted the active selection, fall through to another crew.
    if (selection.level === 'crew' && selection.crewId === crewId) {
      const remaining = agent.crews.find(c => c.id !== crewId);
      if (remaining) {
        setSelection({ level: 'crew', agentId: agent.id, crewId: remaining.id });
      } else {
        setSelection({ level: 'agent', agentId: agent.id });
      }
    }
  };

  const isProjectSel = selection.level === 'project';
  const isAgentSel = selection.level === 'agent';

  return (
    <div className={styles.wrap}>
      <div className={styles.section}>
        <button
          type="button"
          className={`${styles.row} ${isProjectSel ? styles.rowActive : ''}`}
          onClick={() => setSelection({ level: 'project' })}
        >
          <span className={styles.rowIcon}>📁</span>
          <div className={styles.rowText}>
            <span className={styles.rowLabel}>Project</span>
            <span className={styles.rowSub}>{doc.name}</span>
          </div>
        </button>
      </div>

      {agent && (
        <>
          <div className={styles.section}>
            <button
              type="button"
              className={`${styles.row} ${isAgentSel ? styles.rowActive : ''}`}
              onClick={() => setSelection({ level: 'agent', agentId: agent.id })}
            >
              <span className={styles.rowIcon}>🤖</span>
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>Agent</span>
                <span className={styles.rowSub}>{agent.name}</span>
              </div>
              {(() => {
                const activeVersion = agent.versions.find(v => v.id === agent.activeVersionId);
                const dirty = isAgentDirty(agent.id);
                return (
                  <span
                    className={`${styles.versionPill} ${dirty ? styles.versionPillDirty : ''}`}
                    title={dirty ? 'Unsaved changes' : activeVersion?.description}
                  >
                    v{activeVersion?.number ?? '?'}
                    {dirty && <span className={styles.versionDot} />}
                  </span>
                );
              })()}
            </button>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Crews</span>
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => {
                  const crew = addCrew(agent.id);
                  setSelection({ level: 'crew', agentId: agent.id, crewId: crew.id });
                }}
              >
                +
              </button>
            </div>

            <div className={styles.crewList}>
              {agent.crews.map(c => {
                const isActive = selection.level === 'crew' && selection.crewId === c.id;
                const isDefault = agent.defaultCrewId === c.id;
                const activeVersion = c.versions.find(v => v.id === c.activeVersionId);
                const dirty = isCrewDirty(agent.id, c.id);
                return (
                  <div
                    key={c.id}
                    className={`${styles.crewRow} ${isActive ? styles.crewRowActive : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.crewRowMain}
                      onClick={() =>
                        setSelection({ level: 'crew', agentId: agent.id, crewId: c.id })
                      }
                    >
                      <span className={styles.crewDot} />
                      <span className={styles.crewName}>{c.name}</span>
                      <span
                        className={`${styles.versionPill} ${dirty ? styles.versionPillDirty : ''}`}
                        title={dirty ? 'Unsaved changes' : activeVersion?.description}
                      >
                        v{activeVersion?.number ?? '?'}
                        {dirty && <span className={styles.versionDot} />}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.crewDeleteBtn} ${isDefault ? styles.crewDeleteBtnDisabled : ''}`}
                      onClick={() => handleDeleteCrew(c.id, c.name)}
                      title={
                        isDefault
                          ? "Can't delete the default crew"
                          : 'Delete crew'
                      }
                      aria-label={`Delete crew ${c.name}`}
                    >
                      🗑
                    </button>
                  </div>
                );
              })}
              {agent.crews.length === 0 && (
                <div className={styles.empty}>No crews yet.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
