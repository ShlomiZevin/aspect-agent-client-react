/**
 * BuilderHomePage — lists agents grouped into workspaces (folders),
 * with a Live / Archived split and per-agent actions (rename, move,
 * archive, delete). Lives at `/builder`.
 *
 * Workspaces are shared folders (no per-user scoping yet). Archiving
 * hides an agent from the live grid AND blocks it from running until
 * restored. Renaming changes the display name and the slug/URL.
 */

import {
  useCallback, useEffect, useRef, useState, type ReactNode,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  bootstrapProject,
  createWorkspace,
  deleteProject,
  deleteWorkspace,
  fetchProject,
  listProjects,
  listWorkspaces,
  moveAgent,
  renameAgent,
  renameWorkspace,
  setAgentArchived,
  type ProjectListItem,
  type WorkspaceItem,
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

/** Pull a clean message out of our `${status}: {json}` fetch errors. */
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
  // Drill-in: when set, we're inside that workspace folder (live tab).
  const [openWorkspaceId, setOpenWorkspaceId] = useState<string | null>(null);

  // Create-agent modal.
  const [createOpen, setCreateOpen] = useState(false);

  // Modal targets.
  const [wsCreateOpen, setWsCreateOpen]         = useState(false);
  const [wsRenameTarget, setWsRenameTarget]     = useState<WorkspaceItem | null>(null);
  const [wsDeleteTarget, setWsDeleteTarget]     = useState<WorkspaceItem | null>(null);
  const [agentRenameTarget, setAgentRenameTarget] = useState<ProjectListItem | null>(null);
  const [agentMoveTarget, setAgentMoveTarget]     = useState<ProjectListItem | null>(null);

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

  // Create an agent. When inside a folder, it's filed under that
  // workspace. `goToBuilder` decides whether we jump into the builder
  // or stay on the home page (and just refresh the grid). Throws on a
  // slug already in use so the modal can surface it.
  const handleCreateAgent = async (name: string, slug: string, goToBuilder: boolean) => {
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

    // Inside a folder → file the new agent there.
    if (openWorkspaceId) {
      await moveAgent({ agentId: agent.id, workspaceId: openWorkspaceId });
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
    try {
      await setAgentArchived({ agentId: item.agentId, archived });
      await reload();
    } catch (err) { setError(cleanErr(err)); }
  };

  const doDelete = async (item: ProjectListItem) => {
    const ok = await confirm({
      title: `Delete “${item.agentName}”?`,
      message: 'Permanently deletes this agent and every crew and version under it. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProject({ projectId: item.projectId });
      await reload();
    } catch (err) { setError(cleanErr(err)); }
  };

  // ── Derived lists ──────────────────────────────────────────────
  const all          = items ?? [];
  const liveItems    = all.filter(i => !i.archivedAt);
  const archivedItems = all.filter(i => i.archivedAt);
  const topLevel     = liveItems.filter(i => !i.workspaceId);
  const inWorkspace  = (wsId: string) => liveItems.filter(i => i.workspaceId === wsId);
  const countInWs    = (wsId: string) => inWorkspace(wsId).length;

  // ── Agent tile (files/folders view) ────────────────────────────
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

  // ── Folder tile (click to open) ────────────────────────────────
  const renderFolderTile = (ws: WorkspaceItem) => {
    const n = countInWs(ws.id);
    return (
      <div key={ws.id} className={`${styles.tile} ${styles.tileFolder}`}
        role="button" tabIndex={0}
        onClick={() => setOpenWorkspaceId(ws.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenWorkspaceId(ws.id); } }}>
        <div className={styles.tileFolderInner}>
          <span className={styles.tileIcon} aria-hidden>📁</span>
          <span className={styles.tileName}>{ws.name}</span>
          <span className={styles.tileFolderCount}>{n} agent{n === 1 ? '' : 's'}</span>
        </div>
        <div className={styles.tileKebab} onClick={e => e.stopPropagation()}>
          <KebabMenu>
            {close => (
              <>
                <button type="button" className={styles.menuItem}
                  onClick={() => { close(); setWsRenameTarget(ws); }}>
                  <span className={styles.menuIcon}>✏️</span> Rename
                </button>
                <div className={styles.menuDivider} />
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`}
                  onClick={() => { close(); setWsDeleteTarget(ws); }}>
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

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}><span aria-hidden>🛠</span> Your agents</h1>
          <div className={styles.headerActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setWsCreateOpen(true)}>
              📁 New workspace
            </button>
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
        {items !== null && tab === 'live' && openWs && (
          <>
            <div className={styles.breadcrumb}>
              <button type="button" className={styles.crumbBack} onClick={() => setOpenWorkspaceId(null)}>
                ← Your agents
              </button>
              <span className={styles.crumbSep}>/</span>
              <span className={styles.crumbCurrent}><span aria-hidden>📁</span> {openWs.name}</span>
              <div className={styles.crumbActions}>
                <button type="button" className={styles.iconBtn} title="Rename workspace"
                  onClick={() => setWsRenameTarget(openWs)}>✏️</button>
                <button type="button" className={styles.iconBtn} title="Delete workspace"
                  onClick={() => setWsDeleteTarget(openWs)}>🗑</button>
              </div>
            </div>
            {inWorkspace(openWs.id).length > 0
              ? <div className={styles.grid}>{inWorkspace(openWs.id).map(renderAgentTile)}</div>
              : <div className={styles.emptyNested}>Empty — move an agent here from its ⋯ menu.</div>}
          </>
        )}

        {items !== null && tab === 'live' && !openWs && (
          !hasAnything
            ? <div className={styles.empty}>No agents yet. Click <strong>+ New agent</strong> to create one.</div>
            : (
              <div className={styles.grid}>
                {workspaces.map(renderFolderTile)}
                {topLevel.map(renderAgentTile)}
              </div>
            )
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
          intoWorkspaceName={openWs?.name ?? null}
          onClose={() => setCreateOpen(false)}
          onCreate={async (name, slug, goToBuilder) => {
            await handleCreateAgent(name, slug, goToBuilder);
            setCreateOpen(false);
          }}
        />
      )}

      {wsCreateOpen && (
        <WorkspaceNameModal
          mode="create"
          initial=""
          onClose={() => setWsCreateOpen(false)}
          onSubmit={async name => {
            await createWorkspace({ ownerUserId, name });
            await reload();
            setWsCreateOpen(false);
          }}
        />
      )}

      {wsRenameTarget && (
        <WorkspaceNameModal
          mode="rename"
          initial={wsRenameTarget.name}
          onClose={() => setWsRenameTarget(null)}
          onSubmit={async name => {
            await renameWorkspace({ id: wsRenameTarget.id, name });
            await reload();
            setWsRenameTarget(null);
          }}
        />
      )}

      {wsDeleteTarget && (
        <DeleteWorkspaceModal
          workspace={wsDeleteTarget}
          agentCount={countInWs(wsDeleteTarget.id)}
          onClose={() => setWsDeleteTarget(null)}
          onChoose={async cascade => {
            await deleteWorkspace({ id: wsDeleteTarget.id, cascade });
            await reload();
            if (openWorkspaceId === wsDeleteTarget.id) setOpenWorkspaceId(null);
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
    </div>
  );
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

// ─── Create-agent modal ─────────────────────────────────────────────

function CreateAgentModal({
  intoWorkspaceName, onCreate, onClose,
}: {
  intoWorkspaceName: string | null;
  onCreate: (name: string, slug: string, goToBuilder: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName]   = useState('');
  const [slug, setSlug]   = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  const [busy, setBusy]   = useState<null | 'stay' | 'go'>(null);
  const [err, setErr]     = useState<string | null>(null);

  const trimmedSlug = slug.trim();
  const valid = trimmedSlug.length > 0;

  const submit = async (goToBuilder: boolean) => {
    if (!valid || busy) return;
    setBusy(goToBuilder ? 'go' : 'stay'); setErr(null);
    try { await onCreate(name.trim() || trimmedSlug, trimmedSlug, goToBuilder); }
    catch (e) { setErr(cleanErr(e)); setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} width={480}
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
        {intoWorkspaceName && (
          <div className={styles.modalNote}>Creating in <strong>📁 {intoWorkspaceName}</strong>.</div>
        )}
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
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Workspace create / rename modal ────────────────────────────────

function WorkspaceNameModal({
  mode, initial, onSubmit, onClose,
}: {
  mode: 'create' | 'rename';
  initial: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed || busy) return;
    setBusy(true); setErr(null);
    try { await onSubmit(trimmed); }
    catch (e) { setErr(cleanErr(e)); setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} width={440}
      title={mode === 'create' ? '📁 New workspace' : '✏️ Rename workspace'}
      footer={
        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.primaryBtn} disabled={!trimmed || busy} onClick={submit}>
            {busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      }>
      <div className={styles.modalBody}>
        <label className={styles.fieldLabel}>
          Workspace name
          <input type="text" autoFocus value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="e.g. ShlomisAgents" className={styles.fieldInput} />
        </label>
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}

// ─── Delete-workspace choice modal ──────────────────────────────────

function DeleteWorkspaceModal({
  workspace, agentCount, onChoose, onClose,
}: {
  workspace: WorkspaceItem;
  agentCount: number;
  onChoose: (cascade: 'orphan' | 'agents') => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<null | 'orphan' | 'agents'>(null);
  const run = async (cascade: 'orphan' | 'agents') => {
    setBusy(cascade);
    try { await onChoose(cascade); }
    catch { setBusy(null); }
  };

  return (
    <Modal open onClose={onClose} width={480}
      title="🗑 Delete workspace"
      footer={
        <div className={styles.modalFooterSplit}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={busy !== null}>Cancel</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className={styles.secondaryBtn} disabled={busy !== null} onClick={() => run('orphan')}>
              {busy === 'orphan' ? 'Working…' : 'Keep agents (move to top)'}
            </button>
            <button type="button" className={styles.dangerBtn} disabled={busy !== null} onClick={() => run('agents')}>
              {busy === 'agents' ? 'Deleting…' : 'Delete agents too'}
            </button>
          </div>
        </div>
      }>
      <div className={styles.modalBody}>
        <div className={styles.modalNote}>
          Delete <strong>“{workspace.name}”</strong>?
          {agentCount > 0
            ? <> It holds <strong>{agentCount}</strong> agent{agentCount === 1 ? '' : 's'}. Choose what happens to {agentCount === 1 ? 'it' : 'them'}:</>
            : <> It’s empty, so this just removes the folder.</>}
        </div>
        {agentCount > 0 && (
          <div className={styles.modalNote}>
            <strong>Keep agents</strong> moves them back to the top level.<br />
            <strong>Delete agents too</strong> permanently removes them and all their crews/versions.
          </div>
        )}
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

  const options: Array<{ id: string | null; name: string }> = [
    { id: null, name: 'Top level' },
    ...workspaces.map(w => ({ id: w.id, name: w.name })),
  ];

  return (
    <Modal open onClose={onClose} width={440}
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
        <div className={styles.radioList}>
          {options.map(opt => {
            const active = target === opt.id;
            const isCurrent = item.workspaceId === opt.id;
            return (
              <button key={opt.id ?? '__top'} type="button"
                className={`${styles.radioRow} ${active ? styles.radioRowActive : ''}`}
                onClick={() => setTarget(opt.id)}>
                <span aria-hidden>{opt.id === null ? '🏠' : '📁'}</span>
                <span>{opt.name}</span>
                {isCurrent && <span className={styles.radioCurrent}>current</span>}
              </button>
            );
          })}
        </div>
        {workspaces.length === 0 && (
          <div className={styles.modalNote}>No workspaces yet — create one from “📁 New workspace”.</div>
        )}
        {err && <div className={styles.modalError}>{err}</div>}
      </div>
    </Modal>
  );
}
