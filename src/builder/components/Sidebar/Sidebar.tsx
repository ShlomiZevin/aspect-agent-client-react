/**
 * Sidebar — project / agent / crews navigation.
 *
 * Three sections, each selectable. The "current selection" drives
 * what the center canvas renders.
 */

import { useBuilder } from '../../state/BuilderContext';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { doc, selection, setSelection, addCrew, isCrewDirty, isAgentDirty } = useBuilder();
  const agent = doc.agents.find(a => a.id === selection.agentId) ?? doc.agents[0];

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
                const activeVersion = c.versions.find(v => v.id === c.activeVersionId);
                const dirty = isCrewDirty(agent.id, c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.crewRow} ${isActive ? styles.crewRowActive : ''}`}
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
