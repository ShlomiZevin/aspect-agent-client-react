/**
 * Sidebar — project / agent / crews navigation.
 *
 * Three sections, each selectable. The "current selection" drives
 * what the center canvas renders.
 *
 * The CREWS list is a manual, display-only tree (task #855): a crew can
 * be shown under another (drag onto it, or ⋯ → Move under…), moved back
 * to the top level, reordered, and parents fold. It never changes routing
 * — see `crewTree.ts`. Design: lybi-website/art-source/ui/crew-tree-855/.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { Modal } from '../Modal/Modal';
import type { ID } from '../../types';
import {
  childrenMap,
  computeMove,
  effectiveParents,
  subtreeOf,
  visibleRows,
  type DropZone,
} from './crewTree';
import styles from './Sidebar.module.css';

/** Per-browser fold state of the crew tree, per agent (not saved with the agent). */
const collapsedKey = (agentId: ID) => `lybi.builder.crewTree.collapsed.${agentId}`;
function readCollapsed(agentId: ID | undefined): Set<ID> {
  if (!agentId) return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(collapsedKey(agentId)) || '[]')); } catch { return new Set(); }
}

export function Sidebar() {
  const {
    doc, selection, setSelection, addCrew, removeCrew, reorderCrews, setCrewParents,
    isCrewDirty, isAgentDirty,
  } = useBuilder();
  const confirm = useConfirm();
  // Sidebar crew drag (reorder + nest).
  const [dragCrewId, setDragCrewId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: ID | null; zone: DropZone } | null>(null);
  const [menuCrewId, setMenuCrewId] = useState<ID | null>(null);
  const [moveUnderId, setMoveUnderId] = useState<ID | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
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

  // Fold state, keyed by the agent it was read for (switching agents reads
  // that agent's set from localStorage — no effect needed).
  const [fold, setFoldState] = useState<{ agentId?: ID; set: Set<ID> }>(() => ({ agentId: agent?.id, set: readCollapsed(agent?.id) }));
  const collapsed = useMemo(
    () => (fold.agentId === agent?.id ? fold.set : readCollapsed(agent?.id)),
    [fold, agent?.id],
  );
  const setFold = (id: ID, folded: boolean) => {
    if (!agent) return;
    const next = new Set(collapsed);
    if (folded) next.add(id); else next.delete(id);
    try { localStorage.setItem(collapsedKey(agent.id), JSON.stringify([...next])); } catch { /* private mode */ }
    setFoldState({ agentId: agent.id, set: next });
  };

  const crews = useMemo(() => agent?.crews ?? [], [agent?.crews]);
  const parents = useMemo(() => effectiveParents(crews, agent?.crewTree?.parents), [crews, agent?.crewTree]);
  const kids = useMemo(() => childrenMap(crews, parents), [crews, parents]);
  const rows = useMemo(() => visibleRows(crews, kids, collapsed), [crews, kids, collapsed]);

  // Close the ⋯ menu on an outside click or Esc.
  useEffect(() => {
    if (!menuCrewId) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuCrewId(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuCrewId(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuCrewId]);

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

  /** Apply a tree move: persist only what changed (order and/or parents). */
  const applyMove = (moved: ID, target: ID | null, zone: DropZone, targetOpen = false) => {
    if (!agent) return;
    const res = computeMove({ crews, parents, moved, target, zone, targetOpen });
    if (!res) return;
    const before = crews.map(c => c.id);
    if (res.order.join('\u0000') !== before.join('\u0000')) reorderCrews(agent.id, res.order);
    const stored = agent.crewTree?.parents ?? {};
    const same = Object.keys(stored).length === Object.keys(res.parents).length
      && Object.entries(res.parents).every(([k, v]) => stored[k] === v);
    if (!same) setCrewParents(agent.id, res.parents);
    // Nesting under a folded crew opens it, so you see where it went.
    if (zone === 'inside' && target && collapsed.has(target)) setFold(target, false);
  };

  /**
   * Delete a crew with confirmation. Blocks deletion of the agent's
   * `defaultCrewId` since that would leave the agent rudderless at
   * runtime (resolveRunnable would have nothing to fall back to).
   * If the deleted crew was currently selected, jump to whichever
   * crew remains. Crews shown under it move up to its parent.
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
    const raw = agent.crewTree?.parents ?? {};
    if (Object.keys(raw).length) {
      const up = parents.get(crewId);
      const next: Record<ID, ID> = {};
      for (const [child, parent] of Object.entries(raw)) {
        if (child === crewId) continue;
        if (parent === crewId) { if (up) next[child] = up; } else next[child] = parent;
      }
      setCrewParents(agent.id, next);
    }
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

  /** Which zone of a row the pointer is over: top quarter / middle / bottom quarter. */
  const zoneAt = (e: React.DragEvent<HTMLElement>): DropZone => {
    const r = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - r.top) / Math.max(1, r.height);
    return y < 0.28 ? 'before' : y > 0.72 ? 'after' : 'inside';
  };

  const isProjectSel = selection.level === 'project';
  const isAgentSel = selection.level === 'agent';
  const INDENT = 16;   // = .treeCol width
  const HANDLE_W = 18; // = .crewDragHandle width
  const moveUnderCrew = moveUnderId ? crews.find(c => c.id === moveUnderId) : undefined;
  const blocked = moveUnderId ? subtreeOf(moveUnderId, kids) : new Set<ID>();

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
              <span className={styles.headerBtns}>
                <button
                  type="button"
                  className={styles.mapBtn}
                  onClick={() => { if (urlAgentSlug) navigate(`/${urlAgentSlug}/builder/crew-map`); }}
                  title="See how a conversation moves between crews"
                >
                  Map
                </button>
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
              </span>
            </div>

            <div className={styles.crewList}>
              {rows.map(({ crew: c, depth, hasKids, descendants, isLast, guides }) => {
                const isActive = selection.level === 'crew' && selection.crewId === c.id;
                const isDefault = agent.defaultCrewId === c.id;
                // No version number on a crew — the agent has one (#923).
                // Unsaved changes still show as a dot.
                const dirty = isCrewDirty(agent.id, c.id);
                const isDragging = dragCrewId === c.id;
                const isFolded = hasKids && collapsed.has(c.id);
                const dz = drop && drop.id === c.id ? drop.zone : null;
                // Where a before/after drop would land — its line starts at that level.
                const landDepth = dz === 'after' && hasKids && !isFolded ? depth + 1 : depth;
                return (
                  <div
                    key={c.id}
                    className={[
                      styles.crewRow,
                      isActive ? styles.crewRowActive : '',
                      isDragging ? styles.crewRowDragging : '',
                      dz === 'inside' ? styles.crewRowDropInside : '',
                      menuCrewId === c.id ? styles.crewRowMenuOpen : '',
                    ].join(' ')}
                    draggable
                    onDragStart={(e) => {
                      setDragCrewId(c.id);
                      setMenuCrewId(null);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', c.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragCrewId || dragCrewId === c.id) { if (drop) setDrop(null); return; }
                      const zone = zoneAt(e);
                      const ok = computeMove({ crews, parents, moved: dragCrewId, target: c.id, zone, targetOpen: hasKids && !isFolded });
                      if (!ok) { if (drop) setDrop(null); return; }
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (!drop || drop.id !== c.id || drop.zone !== zone) setDrop({ id: c.id, zone });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragCrewId && drop && drop.id === c.id) applyMove(dragCrewId, c.id, drop.zone, hasKids && !isFolded);
                      setDragCrewId(null);
                      setDrop(null);
                    }}
                    onDragEnd={() => { setDragCrewId(null); setDrop(null); }}
                  >
                    <span className={styles.crewDragHandle} aria-hidden="true" title="Drag to reorder, or onto a crew to put it under it">⋮⋮</span>
                    {/* Tree connectors: one column per ancestor level, then this crew's elbow. */}
                    {guides.map((cont, i) => (
                      <span key={i} className={`${styles.treeCol} ${cont ? styles.treeColLine : ''}`} aria-hidden="true" />
                    ))}
                    {depth > 0 && (
                      <span className={`${styles.treeCol} ${styles.treeElbow} ${isLast ? styles.treeElbowLast : ''}`} aria-hidden="true" />
                    )}
                    {hasKids ? (
                      <button
                        type="button"
                        className={styles.chevron}
                        onClick={() => setFold(c.id, !isFolded)}
                        aria-label={isFolded ? `Expand ${c.name}` : `Collapse ${c.name}`}
                        aria-expanded={!isFolded}
                      >
                        <svg className={`${styles.chevronIcon} ${isFolded ? '' : styles.chevronOpen}`} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M3.5 2l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    ) : (
                      <span className={styles.chevronSpacer} aria-hidden="true" />
                    )}
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
                      {dirty && <span className={styles.versionDot} title="Unsaved changes" />}
                      {isFolded && (
                        <span className={styles.foldCount} title={`${descendants} crew${descendants === 1 ? '' : 's'} under it`}>{descendants}</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className={styles.crewMenuBtn}
                      onClick={() => setMenuCrewId(menuCrewId === c.id ? null : c.id)}
                      title="Crew actions"
                      aria-label={`Actions for crew ${c.name}`}
                      aria-haspopup="menu"
                      aria-expanded={menuCrewId === c.id}
                    >
                      ⋯
                    </button>
                    {(dz === 'before' || dz === 'after') && (
                      <span
                        className={`${styles.dropLine} ${dz === 'before' ? styles.dropLineTop : styles.dropLineBottom}`}
                        style={{ left: HANDLE_W + landDepth * INDENT }}
                        aria-hidden="true"
                      />
                    )}
                    {menuCrewId === c.id && (
                      <div className={styles.crewMenu} role="menu" ref={menuRef}>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.crewMenuItem}
                          disabled={crews.length < 2}
                          onClick={() => { setMenuCrewId(null); setMoveUnderId(c.id); }}
                        >
                          <span className={styles.crewMenuIcon} aria-hidden="true">↳</span> Move under…
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className={styles.crewMenuItem}
                          disabled={depth === 0}
                          title={depth === 0 ? 'Already at the top level' : undefined}
                          onClick={() => { setMenuCrewId(null); applyMove(c.id, null, 'inside'); }}
                        >
                          <span className={styles.crewMenuIcon} aria-hidden="true">↰</span> Move to top level
                        </button>
                        <div className={styles.crewMenuSep} />
                        <button
                          type="button"
                          role="menuitem"
                          className={`${styles.crewMenuItem} ${styles.crewMenuDanger}`}
                          disabled={isDefault}
                          title={isDefault ? "Can't delete the default crew" : undefined}
                          onClick={() => { setMenuCrewId(null); void handleDeleteCrew(c.id, c.name); }}
                        >
                          <span className={styles.crewMenuIcon} aria-hidden="true">🗑</span> Delete crew
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {crews.length === 0 && (
                <div className={styles.empty}>No crews yet.</div>
              )}
              {/* Drop here = top level, at the end. Always present (fixed
                  height) so nothing shifts when a drag starts. */}
              {crews.length > 0 && (
                <div
                  className={`${styles.dropEnd} ${drop && drop.id === null ? styles.dropEndActive : ''}`}
                  onDragOver={(e) => {
                    if (!dragCrewId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (!drop || drop.id !== null) setDrop({ id: null, zone: 'inside' });
                  }}
                  onDragLeave={() => { if (drop && drop.id === null) setDrop(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragCrewId) applyMove(dragCrewId, null, 'inside');
                    setDragCrewId(null);
                    setDrop(null);
                  }}
                  aria-hidden="true"
                />
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

      {/* "Move under…" — the non-drag way to nest (#855). */}
      <Modal
        open={!!moveUnderCrew}
        onClose={() => setMoveUnderId(null)}
        title={moveUnderCrew ? `Move "${moveUnderCrew.name}" under` : ''}
        width={380}
      >
        {moveUnderCrew && (
          <div className={styles.pickList} role="listbox">
            <button
              type="button"
              className={styles.pickItem}
              disabled={!parents.has(moveUnderCrew.id)}
              onClick={() => { applyMove(moveUnderCrew.id, null, 'inside'); setMoveUnderId(null); }}
            >
              <span className={styles.pickName}>Top level</span>
              {!parents.has(moveUnderCrew.id) && <span className={styles.pickTag}>current</span>}
            </button>
            {visibleRows(crews, kids, new Set()).map(({ crew, depth }) => {
              const isBlocked = blocked.has(crew.id);
              const isCurrent = parents.get(moveUnderCrew.id) === crew.id;
              return (
                <button
                  type="button"
                  key={crew.id}
                  className={styles.pickItem}
                  style={{ paddingLeft: 12 + (depth + 1) * INDENT }}
                  disabled={isBlocked || isCurrent}
                  title={isBlocked ? (crew.id === moveUnderCrew.id ? 'This crew' : 'It is under this crew — that would be a loop') : undefined}
                  onClick={() => { applyMove(moveUnderCrew.id, crew.id, 'inside'); setMoveUnderId(null); }}
                >
                  <span className={styles.crewDot} />
                  <span className={styles.pickName}>{crew.name}</span>
                  {isCurrent && <span className={styles.pickTag}>current</span>}
                </button>
              );
            })}
            <div className={styles.pickNote}>Only changes how the list is shown — never which crew runs.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
