/**
 * Sidebar — project / agent / crews navigation.
 *
 * Three sections, each selectable. The "current selection" drives
 * what the center canvas renders.
 */

import { useState } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { doc, selection, setSelection, addCrew, removeCrew, reorderCrews, isCrewDirty, isAgentDirty } = useBuilder();
  const confirm = useConfirm();
  // Sidebar crew drag-reorder.
  const [dragCrewId, setDragCrewId] = useState<string | null>(null);
  const [overCrewId, setOverCrewId] = useState<string | null>(null);
  const navigate = useNavigate();
  // Read the agent slug from the URL — that's the source of truth for
  // the builder route. Going through the URL avoids races with the
  // doc-derived `agent` (which can be undefined during the very first
  // render, before fetchProject resolves).
  const { agent: urlAgentSlug } = useParams<{ agent: string }>();
  const agent = doc.agents.find(a => a.id === selection.agentId) ?? doc.agents[0];
  // Admin is a URL-routed view (not selection-driven), so its active
  // state comes from the route, not `selection`.
  const onAdminRoute = useMatch('/:agent/builder/admin/*');

  /**
   * Pop back to the builder's index route any time the user picks
   * something in the sidebar. Sibling routes (e.g. /dynamic-context/…)
   * are URL-mounted, so without this they would keep rendering even
   * though selection moved to project/agent/crew. React Router treats
   * same-URL navigations as no-ops, so we don't need to check whether
   * we're currently on a sibling route.
   *
   * Source of truth for the slug is `useParams` (URL), not
   * `agent?.slug` (doc) — the URL is set the moment BuilderPage
   * mounts, while doc lags behind by a fetch.
   */
  const goHome = () => {
    if (urlAgentSlug) navigate(`/${urlAgentSlug}/builder`);
  };

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
          onClick={() => { goHome(); setSelection({ level: 'project' }); }}
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
              onClick={() => { goHome(); setSelection({ level: 'agent', agentId: agent.id }); }}
            >
              <span className={styles.rowIcon}>🤖</span>
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>Agent</span>
                <span className={styles.rowSub}>{agent.name}</span>
              </div>
              {(() => {
                // Show the ACTIVE version — your editable working line (the
                // anchor). While previewing a different version, the body's
                // switcher shows the previewed one; this stays on active so
                // you always see "the version I'm working on" here.
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
                  goHome();
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
                // Show the ACTIVE version (the editable anchor) — see the
                // agent pill above.
                const activeVersion = c.versions.find(v => v.id === c.activeVersionId);
                const dirty = isCrewDirty(agent.id, c.id);
                const isDragging = dragCrewId === c.id;
                const isDropTarget = overCrewId === c.id && dragCrewId !== null && dragCrewId !== c.id;
                return (
                  <div
                    key={c.id}
                    className={`${styles.crewRow} ${isActive ? styles.crewRowActive : ''} ${isDragging ? styles.crewRowDragging : ''} ${isDropTarget ? styles.crewRowDropTarget : ''}`}
                    draggable
                    onDragStart={(e) => {
                      setDragCrewId(c.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', c.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragCrewId || dragCrewId === c.id) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (overCrewId !== c.id) setOverCrewId(c.id);
                    }}
                    onDragLeave={() => { if (overCrewId === c.id) setOverCrewId(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCrewId && dragCrewId !== c.id) {
                        const ids = agent.crews.map(x => x.id);
                        const from = ids.indexOf(dragCrewId);
                        const to = ids.indexOf(c.id);
                        if (from >= 0 && to >= 0) {
                          const next = [...ids];
                          const [moved] = next.splice(from, 1);
                          next.splice(to, 0, moved);
                          reorderCrews(agent.id, next);
                        }
                      }
                      setDragCrewId(null);
                      setOverCrewId(null);
                    }}
                    onDragEnd={() => { setDragCrewId(null); setOverCrewId(null); }}
                  >
                    <span className={styles.crewDragHandle} aria-hidden="true" title="Drag to reorder">⋮⋮</span>
                    <button
                      type="button"
                      className={styles.crewRowMain}
                      onClick={() => {
                        goHome();
                        setSelection({ level: 'crew', agentId: agent.id, crewId: c.id });
                      }}
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

      {agent && (
        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.footerBtn} ${onAdminRoute ? styles.footerBtnActive : ''}`}
            onClick={() => { if (urlAgentSlug) navigate(`/${urlAgentSlug}/builder/admin`); }}
            title="Open the admin dashboard"
          >
            <span className={styles.footerIcon} aria-hidden>📊</span>
            <span>Admin dashboard</span>
          </button>
        </div>
      )}
    </div>
  );
}
