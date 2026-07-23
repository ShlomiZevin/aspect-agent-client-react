/**
 * BuilderHomePage — a file-manager for agents. Agents live in nested
 * folders (workspaces) of unlimited depth, or at the top level. A
 * Live / Archived split, per-agent actions (rename, move, duplicate,
 * archive, delete) and per-folder actions (rename, move, delete).
 * Lives at `/builder`.
 *
 * Folders nest via `workspace.parentId` (null = top). Agents point at a
 * folder via `agent.workspaceId` (null = top). Every level renders the
 * same way: that level's sub-folders + its agents.
 */

import {
  Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  bootstrapProject,
  createWorkspace,
  deleteProject,
  deleteWorkspace,
  duplicateProject,
  fetchProject,
  listProjects,
  listWorkspaces,
  moveAgent,
  moveWorkspace,
  renameAgent,
  renameWorkspace,
  setAgentArchived,
  type ProjectListItem,
  type WorkspaceItem,
  type WorkspaceKind,
} from '../builder/state/builderApi';
import { emptyProject } from '../builder/state/BuilderContext';
import { Modal } from '../builder/components/Modal/Modal';
import { ConfirmProvider, useConfirm } from '../builder/components/Confirm/Confirm';
import styles from './BuilderHomePage.module.css';

const OWNER_KEY = 'builder:ownerUserId';

function getOrCreateOwnerUserId(): string {
  try {
    const existing = localStorage.getItem(OWNER_KEY);
    if (existing && existing.length > 0) return existing;
    const next = `builder-owner-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(OWNER_KEY, next);
    return next;
  } catch {
    return `builder-owner-anon-${Date.now()}`;
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function cleanErr(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const brace = raw.indexOf('{');
  if (brace >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(brace));
      if (parsed && typeof parsed.error === 'string') return parsed.error;
    } catch { /* fall through */ }
  }
  return raw;
}

/** Distinct icon + label per folder kind. Domain (cabinet) holds
 *  projects; Project (folder) holds agents; Folder (generic) is free-form
 *  below a project. Kept visually distinct on purpose. */
const KIND_ICON: Record<WorkspaceKind, string> = { domain: '🗄️', project: '📦', folder: '📁' };
const KIND_LABEL: Record<WorkspaceKind, string> = { domain: 'Domain', project: 'Project', folder: 'Folder' };
const KIND_TILE: Record<WorkspaceKind, string> = { domain: styles.tileDomain, project: styles.tileProject, folder: styles.tileFolderGeneric };

// ─── Folder-tree helpers ────────────────────────────────────────────

/** Root→current chain of folders for the breadcrumb (empty at top). */
function ancestorChain(workspaces: WorkspaceItem[], id: string | null): WorkspaceItem[] {
  if (!id) return [];
  const byId = new Map(workspaces.map(w => [w.id, w]));
  const chain: WorkspaceItem[] = [];
  let cur: WorkspaceItem | undefined = byId.get(id);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

/** All descendant folder ids of `id` (for excluding them as move targets). */
function descendantIds(workspaces: WorkspaceItem[], id: string): Set<string> {
  const childrenOf = new Map<string | null, WorkspaceItem[]>();
  for (const w of workspaces) {
    const p = w.parentId ?? null;
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p)!.push(w);
  }
  const out = new Set<string>();
  const stack = [...(childrenOf.get(id) || [])];
  while (stack.length) {
    const w = stack.pop()!;
    out.add(w.id);
    for (const c of (childrenOf.get(w.id) || [])) stack.push(c);
  }
  return out;
}

export function BuilderHomePage() {
  return (
    <ConfirmProvider>
      <HomeContent />
    </ConfirmProvider>
  );
}

function HomeContent() {
  const navigate = useNavigate();
  const ownerUserId = getOrCreateOwnerUserId();
  const confirm = useConfirm();

  const [items, setItems]           = useState<ProjectListItem[] | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [tab, setTab]               = useState<'live' | 'archived'>('live');
  // Current folder we're inside (null = top level).
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [wsCreateOpen, setWsCreateOpen]         = useState(false);
  const [wsRenameTarget, setWsRenameTarget]     = useState<WorkspaceItem | null>(null);
  const [wsMoveTarget, setWsMoveTarget]         = useState<WorkspaceItem | null>(null);
  const [wsDeleteTarget, setWsDeleteTarget]     = useState<WorkspaceItem | null>(null);
  const [agentRenameTarget, setAgentRenameTarget] = useState<ProjectListItem | null>(null);
  const [agentMoveTarget, setAgentMoveTarget]     = useState<ProjectListItem | null>(null);
  const [agentDupTarget, setAgentDupTarget]       = useState<ProjectListItem | null>(null);

  const reload = useCallback(async () => {
    try {
      const [list, ws] = await Promise.all([listProjects({ ownerUserId }), listWorkspaces()]);
      setItems(list);
      setWorkspaces(ws);
      setError(null);
    } catch (err) {
      setError(cleanErr(err));
    }
  }, [ownerUserId]);

  useEffect(() => { reload(); }, [reload]);

  const handleCreateAgent = async (name: string, slug: string, goToBuilder: boolean, locationWorkspaceId: string | null) => {
    const existing = await fetchProject({ agentSlug: slug, ownerUserId });
    if (existing) throw new Error(`An agent with the URL “/${slug}” already exists.`);

    const proj = emptyProject(slug);
    const displayName = name || slug;
    proj.name = displayName;
    proj.agents[0].name = displayName;
    const agent = proj.agents[0];
    const crew = agent.crews[0];
    await bootstrapProject({
      ownerUserId,
      projectId:      proj.id,
      projectName:    proj.name,
      agentId:        agent.id,
      agentSlug:      agent.slug,
      agentVersionId: agent.versions[0].id,
      agentBody: {
        name:          agent.name,
        slug:          agent.slug,
        spec:          agent.spec,
        persona:       agent.persona,
        defaultCrewId: agent.defaultCrewId,
        fields:        agent.fields,
      },
      crewId:        crew.id,
      crewVersionId: crew.versions[0].id,
      crewBody: {
        name:        crew.name,
        description: crew.description,
        spec:        crew.spec,
        persona:     crew.persona,
        addons:      crew.addons,
        fields:      crew.fields,
      },
    });

    // File the new agent at the chosen location (agents may live
    // anywhere — top level, a domain, or a project).
    if (locationWorkspaceId) {
      await moveAgent({ agentId: agent.id, workspaceId: locationWorkspaceId });
    }

    if (goToBuilder) navigate(`/${slug}/builder`);
    else await reload();
  };

  // ── Agent actions ──────────────────────────────────────────────
  const doArchive = async (item: ProjectListItem, archived: boolean) => {
    if (archived) {
      const ok = await confirm({
        title: `Archive “${item.agentName}”?`,
        message: 'It will be hidden from your live agents and will stop running (its chat will be blocked) until you restore it.',
        confirmLabel: 'Archive',
        danger: true,
      });
      if (!ok) return;
    }
    try { await setAgentArchived({ agentId: item.agentId, archived }); await reload(); }
    catch (err) { setError(cleanErr(err)); }
  };

  const doDelete = async (item: ProjectListItem) => {
    const ok = await confirm({
      title: `Delete “${item.agentName}”?`,
      message: 'Permanently deletes this agent and every crew and version under it. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try { await deleteProject({ projectId: item.projectId }); await reload(); }
    catch (err) { setError(cleanErr(err)); }
  };

  // ── Derived (folder-aware) ─────────────────────────────────────
  const all           = items ?? [];
  const liveItems     = all.filter(i => !i.archivedAt);
  const archivedItems = all.filter(i => i.archivedAt);
  const agentsIn  = (folderId: string | null) => liveItems.filter(i => (i.workspaceId ?? null) === folderId);
  const foldersIn = (folderId: string | null) => workspaces.filter(w => (w.parentId ?? null) === folderId);
  const folderHasContents = (id: string) => agentsIn(id).length > 0 || foldersIn(id).length > 0;

  // ── Folder delete: empty → instant; non-empty → choice modal ───
  const doDeleteWorkspace = async (ws: WorkspaceItem) => {
    if (!folderHasContents(ws.id)) {
      const ok = await confirm({
        title: `Delete folder “${ws.name}”?`,
        message: 'This empty folder will be removed.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteWorkspace({ id: ws.id, cascade: 'orphan' });
        if (openWorkspaceId === ws.id) setOpenWorkspaceId(ws.parentId ?? null);
        await reload();
      } catch (err) { setError(cleanErr(err)); }
      return;
    }
    setWsDeleteTarget(ws);
  };

  // ── Agent tile ─────────────────────────────────────────────────
  const renderAgentTile = (item: ProjectListItem) => (
    <div key={item.projectId} className={styles.tile}>
      <Link to={`/${item.agentSlug}/builder`} className={styles.tileLink}>
        <span className={styles.tileIcon} aria-hidden>🤖</span>
        <span className={styles.tileName}>{item.agentName}</span>
        <span className={styles.tileSlug}>/{item.agentSlug}</span>
        <span className={styles.tileFooter}>
          {item.archivedAt && <span className={styles.archivedTag}>Archived</span>}
          <span className={styles.tileTime}>{timeAgo(item.updatedAt)}</span>
        </span>
      </Link>
      <div className={styles.tileKebab}>
        {item.archivedAt ? (
          <KebabMenu>
            {close => (
              <>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); doArchive(item, false); }}>
                  <span className={styles.menuIcon}>♻</span> Restore
                </button>
                <div className={styles.menuDivider} />
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { close(); doDelete(item); }}>
                  <span className={styles.menuIcon}>🗑</span> Delete permanently
                </button>
              </>
            )}
          </KebabMenu>
        ) : (
          <KebabMenu>
            {close => (
              <>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); setAgentRenameTarget(item); }}>
                  <span className={styles.menuIcon}>✏️</span> Rename
                </button>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); setAgentMoveTarget(item); }}>
                  <span className={styles.menuIcon}>📁</span> Move to…
                </button>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); setAgentDupTarget(item); }}>
                  <span className={styles.menuIcon}>📄</span> Duplicate
                </button>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); doArchive(item, true); }}>
                  <span className={styles.menuIcon}>📦</span> Archive
                </button>
                <div className={styles.menuDivider} />
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { close(); doDelete(item); }}>
                  <span className={styles.menuIcon}>🗑</span> Delete
                </button>
              </>
            )}
          </KebabMenu>
        )}
      </div>
    </div>
  );

  // ── Folder tile ────────────────────────────────────────────────
  const renderFolderTile = (ws: WorkspaceItem) => {
    const aCount = agentsIn(ws.id).length;
    const fCount = foldersIn(ws.id).length;
    const parts: string[] = [];
    // A domain's sub-folders are projects; a project has no sub-folders.
    if (fCount > 0) parts.push(`${fCount} project${fCount === 1 ? '' : 's'}`);
    parts.push(`${aCount} agent${aCount === 1 ? '' : 's'}`);
    return (
      <div key={ws.id} className={`${styles.tile} ${styles.tileFolder} ${KIND_TILE[ws.kind]}`}
        role="button" tabIndex={0}
        onClick={() => setOpenWorkspaceId(ws.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenWorkspaceId(ws.id); } }}>
        <div className={styles.tileFolderInner}>
          <span className={styles.tileTopRow}>
            <span className={styles.tileIcon} aria-hidden>{KIND_ICON[ws.kind]}</span>
            <span className={styles.kindChip}>{KIND_LABEL[ws.kind]}</span>
          </span>
          <span className={styles.tileName}>{ws.name}</span>
          <span className={styles.tileFolderCount}>{parts.join(' · ')}</span>
        </div>
        <div className={styles.tileKebab} onClick={e => e.stopPropagation()}>
          <KebabMenu>
            {close => (
              <>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); setWsRenameTarget(ws); }}>
                  <span className={styles.menuIcon}>✏️</span> Rename
                </button>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); setWsMoveTarget(ws); }}>
                  <span className={styles.menuIcon}>📁</span> Move to…
                </button>
                <div className={styles.menuDivider} />
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { close(); doDeleteWorkspace(ws); }}>
                  <span className={styles.menuIcon}>🗑</span> Delete
                </button>
              </>
            )}
          </KebabMenu>
        </div>
      </div>
    );
  };

  const hasAnything = all.length > 0 || workspaces.length > 0;
  const openWs = openWorkspaceId ? workspaces.find(w => w.id === openWorkspaceId) ?? null : null;
  // If the open folder vanished (deleted elsewhere), fall back to top.
  useEffect(() => {
    if (openWorkspaceId && workspaces.length > 0 && !workspaces.some(w => w.id === openWorkspaceId)) {
      setOpenWorkspaceId(null);
    }
  }, [openWorkspaceId, workspaces]);

  const path = ancestorChain(workspaces, openWorkspaceId);
  const curFolders = foldersIn(openWorkspaceId);
  const curAgents  = agentsIn(openWorkspaceId);
  // What "New folder" creates here: Domain at top → Project inside a
  // Domain → Folder inside a Project or Folder (free-form below a project).
  const createFolderKind: WorkspaceKind =
    !openWs ? 'domain' : openWs.kind === 'domain' ? 'project' : 'folder';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}><span aria-hidden>🛠</span> Your agents</h1>
          <div className={styles.headerActions}>
            {tab === 'live' && (
              <button type="button" className={styles.secondaryBtn} onClick={() => setWsCreateOpen(true)}>
                {KIND_ICON[createFolderKind]} New {KIND_LABEL[createFolderKind].toLowerCase()}
              </button>
            )}
            <button type="button" className={styles.primaryBtn} onClick={() => setCreateOpen(true)}>
              + New agent
            </button>
          </div>
        </header>

        <div className={styles.tabs}>
          <button type="button"
            className={`${styles.tab} ${tab === 'live' ? styles.tabActive : ''}`}
            onClick={() => setTab('live')}>
            Live <span className={styles.tabCount}>{liveItems.length}</span>
          </button>
          <button type="button"
            className={`${styles.tab} ${tab === 'archived' ? styles.tabActive : ''}`}
            onClick={() => setTab('archived')}>
            Archived <span className={styles.tabCount}>{archivedItems.length}</span>
          </button>
        </div>

        {error && <div className={styles.errorBox}>⚠ {error}</div>}
        {items === null && !error && <div className={styles.empty}>Loading…</div>}

        {/* ── LIVE TAB ──────────────────────────────────────────── */}
        {items !== null && tab === 'live' && (
          <>
            {/* Always render this row (root included) so navigating into a
                folder never shifts the grid down. At root the folder
                actions are present-but-inert to hold the same space. */}
            <div className={styles.breadcrumb}>
              {openWs ? (
                <>
                  <button type="button" className={styles.crumbBack} onClick={() => setOpenWorkspaceId(null)}>
                    🛠 Your agents
                  </button>
                  {path.map((ws, idx) => (
                    <Fragment key={ws.id}>
                      <span className={styles.crumbSep}>/</span>
                      {idx < path.length - 1
                        ? <button type="button" className={styles.crumb} onClick={() => setOpenWorkspaceId(ws.id)}>
                            <span aria-hidden>{KIND_ICON[ws.kind]}</span> {ws.name}
                          </button>
                        : <span className={styles.crumbCurrent}><span aria-hidden>{KIND_ICON[ws.kind]}</span> {ws.name}</span>}
                    </Fragment>
                  ))}
                </>
              ) : (
                <span className={styles.crumbCurrent}><span aria-hidden>🛠</span> Your agents</span>
              )}
              <div className={`${styles.crumbActions} ${openWs ? '' : styles.crumbActionsHidden}`} aria-hidden={!openWs}>
                <button type="button" className={styles.iconBtn} title="Rename folder" tabIndex={openWs ? 0 : -1}
                  onClick={() => openWs && setWsRenameTarget(openWs)}>✏️</button>
                <button type="button" className={styles.iconBtn} title="Move folder" tabIndex={openWs ? 0 : -1}
                  onClick={() => openWs && setWsMoveTarget(openWs)}>📁</button>
                <button type="button" className={styles.iconBtn} title="Delete folder" tabIndex={openWs ? 0 : -1}
                  onClick={() => openWs && doDeleteWorkspace(openWs)}>🗑</button>
              </div>
            </div>

            {!hasAnything ? (
              <div className={styles.empty}>No agents yet. Click <strong>+ New agent</strong> to create one.</div>
            ) : (curFolders.length === 0 && curAgents.length === 0) ? (
              <div className={styles.emptyNested}>
                {openWs?.kind === 'project'
                  ? 'This project has no agents yet — add one with “+ New agent”.'
                  : openWs?.kind === 'folder'
                    ? 'This folder is empty — add an agent, or a sub-folder.'
                    : openWs
                      ? 'This domain is empty — add a project, or an agent with “+ New agent”.'
                      : 'Nothing here yet — create a domain, or an agent with “+ New agent”.'}
              </div>
            ) : (
              <div className={styles.grid}>
                {curFolders.map(renderFolderTile)}
                {curAgents.map(renderAgentTile)}
              </div>
            )}
          </>
        )}

        {/* ── ARCHIVED TAB ──────────────────────────────────────── */}
        {items !== null && tab === 'archived' && (
          archivedItems.length > 0
            ? <div className={styles.grid}>{archivedItems.map(renderAgentTile)}</div>
            : <div className={styles.empty}>No archived agents. Archive one from its ⋯ menu to park it here.</div>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {createOpen && (
        <CreateAgentModal
          workspaces={workspaces}
          defaultLocation={openWorkspaceId}
          onClose={() => setCreateOpen(false)}
          onCreate={async (name, slug, goToBuilder, location) => {
            await handleCreateAgent(name, slug, goToBuilder, location);
            setCreateOpen(false);
          }}
        />
      )}

      {wsCreateOpen && (
        <WorkspaceNameModal
          mode="create"
          kind={createFolderKind}
          initial=""
          intoWorkspaceName={createFolderKind === 'domain' ? null : (openWs?.name ?? null)}
          onClose={() => setWsCreateOpen(false)}
          onSubmit={async name => {
            await createWorkspace({
              ownerUserId,
              name,
              parentId: createFolderKind === 'domain' ? null : openWorkspaceId,
              kind: createFolderKind,
            });
            await reload();
            setWsCreateOpen(false);
          }}
        />
      )}

      {wsRenameTarget && (
        <WorkspaceNameModal
          mode="rename"
          kind={wsRenameTarget.kind}
          initial={wsRenameTarget.name}
          intoWorkspaceName={null}
          onClose={() => setWsRenameTarget(null)}
          onSubmit={async name => {
            await renameWorkspace({ id: wsRenameTarget.id, name });
            await reload();
            setWsRenameTarget(null);
          }}
        />
      )}

      {wsMoveTarget && (
        <MoveFolderModal
          workspace={wsMoveTarget}
          workspaces={workspaces}
          onClose={() => setWsMoveTarget(null)}
          onSubmit={async parentId => {
            await moveWorkspace({ id: wsMoveTarget.id, parentId });
            await reload();
            setWsMoveTarget(null);
          }}
        />
      )}

      {wsDeleteTarget && (
        <DeleteWorkspaceModal
          workspace={wsDeleteTarget}
          agentCount={agentsIn(wsDeleteTarget.id).length}
          folderCount={foldersIn(wsDeleteTarget.id).length}
          parentName={wsDeleteTarget.parentId
            ? (workspaces.find(w => w.id === wsDeleteTarget.parentId)?.name ?? 'its parent')
            : 'the top level'}
          onClose={() => setWsDeleteTarget(null)}
          onChoose={async cascade => {
            await deleteWorkspace({ id: wsDeleteTarget.id, cascade });
            if (openWorkspaceId === wsDeleteTarget.id) setOpenWorkspaceId(wsDeleteTarget.parentId ?? null);
            await reload();
            setWsDeleteTarget(null);
          }}
        />
      )}

      {agentRenameTarget && (
        <RenameAgentModal
          item={agentRenameTarget}
          onClose={() => setAgentRenameTarget(null)}
          onSubmit={async (name, slug) => {
            await renameAgent({ agentId: agentRenameTarget.agentId, name, slug });
            await reload();
            setAgentRenameTarget(null);
          }}
        />
      )}

      {agentMoveTarget && (
        <MoveAgentModal
          item={agentMoveTarget}
          workspaces={workspaces}
          onClose={() => setAgentMoveTarget(null)}
          onSubmit={async workspaceId => {
            await moveAgent({ agentId: agentMoveTarget.agentId, workspaceId });
            await reload();
            setAgentMoveTarget(null);
          }}
        />
      )}

      {agentDupTarget && (
        <DuplicateAgentModal
          item={agentDupTarget}
          existingSlugs={all.map(i => i.agentSlug)}
          onClose={() => setAgentDupTarget(null)}
          onSubmit={async (name, slug) => {
            await duplicateProject({
              projectId: agentDupTarget.projectId,
              newName: name,
              newSlug: slug,
              workspaceId: agentDupTarget.workspaceId,
            });
            await reload();
            setAgentDupTarget(null);
          }}
        />
      )}
    </div>
  );
}

/** Suggest a free `<base>-copy` slug, bumping `-copy-2`, `-copy-3`, … */
function suggestCopySlug(base: string, existing: string[]): string {
  const taken = new Set(existing);
  const first = `${base}-copy`;
  if (!taken.has(first)) return first;
  let i = 2;
  while (taken.has(`${base}-copy-${i}`)) i += 1;
  return `${base}-copy-${i}`;
}

// ─── Kebab menu ─────────────────────────────────────────────────────

function KebabMenu({ children }: { children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className={styles.kebabWrap} ref={ref}>
      <button type="button" className={styles.kebabBtn} onClick={() => setOpen(o => !o)} aria-label="More actions">⋯</button>
      {open && <div className={styles.menu}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

// ─── Folder tree picker (shared by move-agent / move-folder) ─────────

function FolderTreePicker({
  workspaces, value, onChange, disabledIds, selectable, allowTop = true,
}: {
  workspaces: WorkspaceItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabledIds?: Set<string>;
  /** When provided, only folders passing this predicate are selectable
   *  (others render greyed for context). */
  selectable?: (ws: WorkspaceItem) => boolean;
  /** Show the "Top level" row as a target. Default true. */
  allowTop?: boolean;
}) {
  const canSelect = (ws: WorkspaceItem) =>
    !(disabledIds?.has(ws.id) ?? false) && (selectable ? selectable(ws) : true);
  const renderRow = (ws: WorkspaceItem, depth: number): ReactNode => {
    const disabled = !canSelect(ws);
    const kids = workspaces.filter(w => (w.parentId ?? null) === ws.id);
    return (
      <Fragment key={ws.id}>
        <button type="button" disabled={disabled}
          className={`${styles.treeRow} ${value === ws.id ? styles.treeRowActive : ''} ${disabled ? styles.treeRowDisabled : ''}`}
          style={{ paddingLeft: 10 + depth * 18 }}
          onClick={() => { if (!disabled) onChange(ws.id); }}>
          <span aria-hidden>{KIND_ICON[ws.kind]}</span>
          <span className={styles.treeLabel}>{ws.name}</span>
          <span className={styles.treeKind}>{KIND_LABEL[ws.kind]}</span>
        </button>
        {kids.map(k => renderRow(k, depth + 1))}
      </Fragment>
    );
  };
  const roots = workspaces.filter(w => !w.parentId);
  return (
    <div className={styles.tree}>
      {allowTop && (
        <button type="button"
          className={`${styles.treeRow} ${value === null ? styles.treeRowActive : ''}`}
          style={{ paddingLeft: 10 }}
          onClick={() => onChange(null)}>
          <span aria-hidden>🏠</span> <span className={styles.treeLabel}>Top level</span>
        </button>
      )}
      {roots.map(r => renderRow(r, allowTop ? 1 : 0))}
    </div>
  );
}

// ─── Create-agent modal ─────────────────────────────────────────────

function CreateAgentModal({
  workspaces, defaultLocation, onCreate, onClose,
}: {
  workspaces: WorkspaceItem[];
  defaultLocation: string | null;
  onCreate: (name: string, slug: string, goToBuilder: boolean, location: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]   = useState('');
  const [slug, setSlug]   = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [location, setLocation]   = useState<string | null>(defaultLocation);
  const [busy, setBusy]   = useState<null | 'stay' | 'go'>(null);
  const [err, setErr]     = useState<string | null>(null);

  const trimmedSlug = slug.trim();
  const valid = trimmedSlug.length > 0;

  const submit = async (goToBuilder: boolean) => {
    if (!valid || busy) return;
    setBusy(goToBuilder ? 'go' : 'stay'); setErr(null);
    try { await onCreate(name.trim() || trimmedSlug, trimmedSlug, goToBuilder, location); }
    catch (e) { setErr(cleanErr(e)); setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} width={520}
      title="🤖 New agent"
      footer={
        <div className={styles.modalFooterSplit}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={busy !== null}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={styles.secondaryBtn} disabled={!valid || busy !== null} onClick={() => submit(false)}>
              {busy === 'stay' ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className={styles.primaryBtn} disabled={!valid || busy !== null} onClick={() => submit(true)}>
              {busy === 'go' ? 'Opening…' : 'Create & open builder'}
            </button>
          </div>
        </div>
      }>
      <div className={styles.modalBody}>
        <label className={styles.fieldLabel}>
          Display name
          <input type="text" autoFocus value={name}
            onChange={e => { setName(e.target.value); if (!slugDirty) setSlug(slugify(e.target.value)); }}
            placeholder="e.g. Support Bot" className={styles.fieldInput} />
        </label>
        <label className={styles.fieldLabel}>
          Slug (URL)
          <input type="text" value={slug}
            onChange={e => { setSlugDirty(true); setSlug(slugify(e.target.value)); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(true); }}
            placeholder="support-bot" className={styles.fieldInput} />
          <small className={styles.hint}>URL: <code>/{trimmedSlug || 'your-slug'}/builder</code></small>
        </label>
        <div className={styles.fieldLabel}>
          Location <span className={styles.hint}>— an agent can live anywhere, but usually inside a project.</span>
          <FolderTreePicker workspaces={workspaces} value={location} onChange={setLocation} />
        </div>
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Folder create / rename modal ───────────────────────────────────

function WorkspaceNameModal({
  mode, kind, initial, intoWorkspaceName, onSubmit, onClose,
}: {
  mode: 'create' | 'rename';
  kind: WorkspaceKind;
  initial: string;
  intoWorkspaceName: string | null;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const trimmed = name.trim();
  const label = KIND_LABEL[kind];

  const submit = async () => {
    if (!trimmed || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(trimmed); }
    catch (e) { setErr(cleanErr(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={440}
      title={mode === 'create'
        ? `${KIND_ICON[kind]} New ${label.toLowerCase()}`
        : `✏️ Rename ${label.toLowerCase()}`}
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} disabled={!trimmed || busy} onClick={submit}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      }>
      <div className={styles.modalBody}>
        {mode === 'create' && intoWorkspaceName && (
          <div className={styles.modalNote}>Inside <strong>{intoWorkspaceName}</strong>.</div>
        )}
        {mode === 'create' && kind === 'project' && (
          <div className={styles.modalNote}>A project holds agents. It lives inside a domain.</div>
        )}
        {mode === 'create' && kind === 'domain' && (
          <div className={styles.modalNote}>A domain is a top-level group that holds projects.</div>
        )}
        <label className={styles.fieldLabel}>
          {label} name
          <input type="text" autoFocus value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder={kind === 'domain' ? 'e.g. Banking' : 'e.g. Credit Cards'} className={styles.fieldInput} />
        </label>
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Move-folder modal ──────────────────────────────────────────────

function MoveFolderModal({
  workspace, workspaces, onSubmit, onClose,
}: {
  workspace: WorkspaceItem;
  workspaces: WorkspaceItem[];
  onSubmit: (parentId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string | null>(workspace.parentId ?? null);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const changed = target !== (workspace.parentId ?? null);
  // Can't move a folder into itself or any of its own descendants.
  const disabled = useMemo(
    () => new Set([workspace.id, ...descendantIds(workspaces, workspace.id)]),
    [workspace, workspaces],
  );

  // Where each kind may move: a domain → top or another domain; a project
  // → a domain; a folder → a project or another folder.
  const validParentKinds: WorkspaceKind[] =
    workspace.kind === 'domain'  ? ['domain']
    : workspace.kind === 'project' ? ['domain']
    : ['project', 'folder'];
  const allowTop  = workspace.kind === 'domain';
  const intoLabel =
    workspace.kind === 'domain'  ? 'top level or another domain'
    : workspace.kind === 'project' ? 'a domain'
    : 'a project or another folder';

  const submit = async () => {
    if (!changed || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(target); }
    catch (e) { setErr(cleanErr(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={460}
      title={`${KIND_ICON[workspace.kind]} Move ${KIND_LABEL[workspace.kind].toLowerCase()}`}
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} disabled={!changed || busy} onClick={submit}>
            {busy ? 'Moving…' : 'Move here'}
          </button>
        </div>
      }>
      <div className={styles.modalBody}>
        <div className={styles.modalNote}>Move <strong>“{workspace.name}”</strong> into {intoLabel}:</div>
        <FolderTreePicker workspaces={workspaces} value={target} onChange={setTarget}
          disabledIds={disabled} allowTop={allowTop}
          selectable={ws => validParentKinds.includes(ws.kind)} />
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Delete-folder choice modal (non-empty) ─────────────────────────

function DeleteWorkspaceModal({
  workspace, agentCount, folderCount, parentName, onChoose, onClose,
}: {
  workspace: WorkspaceItem;
  agentCount: number;
  folderCount: number;
  parentName: string;
  onChoose: (cascade: 'orphan' | 'hard') => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<null | 'orphan' | 'hard'>(null);
  const run = async (cascade: 'orphan' | 'hard') => {
    setBusy(cascade);
    try { await onChoose(cascade); }
    catch { setBusy(null); }
  };

  const contents: string[] = [];
  if (folderCount > 0) contents.push(`${folderCount} sub-folder${folderCount === 1 ? '' : 's'}`);
  if (agentCount > 0)  contents.push(`${agentCount} agent${agentCount === 1 ? '' : 's'}`);

  return (
    <Modal open onClose={onClose} width={500}
      title="🗑 Delete folder"
      footer={
        <div className={styles.modalFooterSplit}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={busy !== null}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={styles.secondaryBtn} disabled={busy !== null} onClick={() => run('orphan')}>
              {busy === 'orphan' ? 'Working…' : 'Move contents up & delete'}
            </button>
            <button type="button" className={styles.dangerBtn} disabled={busy !== null} onClick={() => run('hard')}>
              {busy === 'hard' ? 'Deleting…' : 'Delete everything inside'}
            </button>
          </div>
        </div>
      }>
      <div className={styles.modalBody}>
        <div className={styles.modalNote}>
          <strong>“{workspace.name}”</strong> holds <strong>{contents.join(' and ')}</strong>. Choose what happens:
        </div>
        <div className={styles.modalNote}>
          <strong>Move contents up</strong> keeps everything — its agents and sub-folders move to <strong>{parentName}</strong>, then the folder is removed.<br />
          <strong>Delete everything inside</strong> permanently removes this folder, every sub-folder under it, and all their agents. This cannot be undone.
        </div>
      </div>
    </Modal>
  );
}

// ─── Rename-agent modal ─────────────────────────────────────────────

function RenameAgentModal({
  item, onSubmit, onClose,
}: {
  item: ProjectListItem;
  onSubmit: (name: string, slug: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]   = useState(item.agentName);
  const [slug, setSlug]   = useState(item.agentSlug);
  const [slugDirty, setSlugDirty] = useState(false);
  const [busy, setBusy]   = useState(false);
  const [err, setErr]     = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();
  const slugChanged = trimmedSlug !== item.agentSlug;

  const submit = async () => {
    if (!trimmedName || !trimmedSlug || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(trimmedName, trimmedSlug); }
    catch (e) { setErr(cleanErr(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={460}
      title="✏️ Rename agent"
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} disabled={!trimmedName || !trimmedSlug || busy} onClick={submit}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      }>
      <div className={styles.modalBody}>
        <label className={styles.fieldLabel}>
          Display name
          <input type="text" autoFocus value={name}
            onChange={e => { setName(e.target.value); if (!slugDirty) setSlug(slugify(e.target.value)); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            className={styles.fieldInput} />
        </label>
        <label className={styles.fieldLabel}>
          Slug (URL)
          <input type="text" value={slug}
            onChange={e => { setSlugDirty(true); setSlug(slugify(e.target.value)); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            className={styles.fieldInput} />
          <small className={styles.hint}>URL: <code>/{trimmedSlug || 'your-slug'}/builder</code></small>
        </label>
        {slugChanged && (
          <div className={styles.modalWarn}>
            ⚠ Changing the slug changes the agent’s URL. Existing links to
            <code> /{item.agentSlug}/builder</code> will stop working.
          </div>
        )}
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Duplicate-agent modal ──────────────────────────────────────────

function DuplicateAgentModal({
  item, existingSlugs, onSubmit, onClose,
}: {
  item: ProjectListItem;
  existingSlugs: string[];
  onSubmit: (name: string, slug: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(`${item.agentName} copy`);
  const [slug, setSlug] = useState(() => suggestCopySlug(item.agentSlug, existingSlugs));
  const [slugDirty, setSlugDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedSlug = slug.trim();

  const submit = async () => {
    if (!trimmedName || !trimmedSlug || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(trimmedName, trimmedSlug); }
    catch (e) { setErr(cleanErr(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={460}
      title="📄 Duplicate agent"
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} disabled={!trimmedName || !trimmedSlug || busy} onClick={submit}>
            {busy ? 'Duplicating…' : 'Duplicate'}
          </button>
        </div>
      }>
      <div className={styles.modalBody}>
        <div className={styles.modalNote}>
          Makes a full copy of <strong>“{item.agentName}”</strong> — its current (active) crews,
          addons, fields and personas — in the same place. The original is untouched.
        </div>
        <label className={styles.fieldLabel}>
          New name
          <input type="text" autoFocus value={name}
            onChange={e => { setName(e.target.value); if (!slugDirty) setSlug(slugify(e.target.value)); }}
            className={styles.fieldInput} />
        </label>
        <label className={styles.fieldLabel}>
          New slug (URL)
          <input type="text" value={slug}
            onChange={e => { setSlugDirty(true); setSlug(slugify(e.target.value)); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            className={styles.fieldInput} />
          <small className={styles.hint}>URL: <code>/{trimmedSlug || 'your-slug'}/builder</code></small>
        </label>
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Move-agent modal ───────────────────────────────────────────────

function MoveAgentModal({
  item, workspaces, onSubmit, onClose,
}: {
  item: ProjectListItem;
  workspaces: WorkspaceItem[];
  onSubmit: (workspaceId: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<string | null>(item.workspaceId);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const changed = target !== item.workspaceId;

  const submit = async () => {
    if (!changed || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(target); }
    catch (e) { setErr(cleanErr(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={460}
      title="📁 Move agent"
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} disabled={!changed || busy} onClick={submit}>
            {busy ? 'Moving…' : 'Move here'}
          </button>
        </div>
      }>
      <div className={styles.modalBody}>
        <div className={styles.modalNote}>Move <strong>“{item.agentName}”</strong> to:</div>
        <FolderTreePicker workspaces={workspaces} value={target} onChange={setTarget} />
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}
