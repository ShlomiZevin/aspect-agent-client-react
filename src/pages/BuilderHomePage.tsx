/**
 * BuilderHomePage — lists the user's agents and offers a button to
 * create a new one. Lives at `/builder`. A typo'd `/<slug>/builder`
 * no longer silently bootstraps; that URL now lands on the
 * BuilderApp's "Create this agent?" gate instead.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  bootstrapProject,
  deleteProject,
  fetchProject,
  listProjects,
  type ProjectListItem,
} from '../builder/state/builderApi';
import { emptyProject } from '../builder/state/BuilderContext';

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

export function BuilderHomePage() {
  const navigate = useNavigate();
  const ownerUserId = getOrCreateOwnerUserId();
  const [items, setItems] = useState<ProjectListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [slugDirty, setSlugDirty] = useState(false);
  // Per-row state. `deleting` holds the projectId currently mid-delete;
  // `confirmId` holds the row pending the second-click confirmation.
  // Confirmation is inline (click Delete → button morphs to "Confirm?")
  // rather than a modal — list-page actions feel lighter that way.
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProjects({ ownerUserId })
      .then(list => { if (!cancelled) setItems(list); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, [ownerUserId]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = (slugDirty ? newSlug : slugify(newName)).trim();
    if (!slug) return;
    setError(null);

    try {
      // Skip the gate if the user came through this form — they
      // already declared intent. Bootstrap inline (if needed), then
      // jump straight to the builder. A direct URL hit on a missing
      // slug still goes through BuilderApp's "Create this agent?"
      // gate as the safety net.
      const existing = await fetchProject({ agentSlug: slug, ownerUserId });
      if (!existing) {
        const proj = emptyProject(slug);
        // Apply the user's display name to the project + agent body.
        const displayName = newName.trim() || slug;
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
      }
      navigate(`/${slug}/builder`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [navigate, newName, newSlug, slugDirty, ownerUserId]);

  const onDelete = useCallback(async (projectId: string) => {
    setDeleting(projectId);
    setError(null);
    try {
      await deleteProject({ projectId });
      // Optimistic update — drop the row from the list. The list is
      // sourced from a single fetch so we don't need to refetch unless
      // it fails (which surfaces an error and keeps the row).
      setItems(prev => prev ? prev.filter(p => p.projectId !== projectId) : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }, []);

  return (
    <div style={page}>
      <div style={container}>
        <header style={headerRow}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Your agents</h1>
          <button type="button" onClick={() => setCreating(c => !c)} style={primaryBtn}>
            {creating ? 'Cancel' : '+ New agent'}
          </button>
        </header>

        {creating && (
          <form onSubmit={onSubmit} style={createCard}>
            <label style={fieldLabel}>
              Display name
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={e => {
                  setNewName(e.target.value);
                  if (!slugDirty) setNewSlug(slugify(e.target.value));
                }}
                placeholder="e.g. Support Bot"
                style={fieldInput}
              />
            </label>
            <label style={fieldLabel}>
              Slug
              <input
                type="text"
                value={newSlug}
                onChange={e => { setSlugDirty(true); setNewSlug(slugify(e.target.value)); }}
                placeholder="support-bot"
                style={fieldInput}
              />
              <small style={hint}>
                URL: <code>/{newSlug || 'your-slug'}/builder</code>
              </small>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={!newSlug} style={primaryBtn}>
                Open builder
              </button>
              <button type="button" onClick={() => setCreating(false)} style={secondaryBtn}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <div style={errorBox}>Couldn’t load: {error}</div>
        )}

        {items === null && !error && (
          <div style={empty}>Loading…</div>
        )}

        {items && items.length === 0 && (
          <div style={empty}>
            No agents yet. Click <strong>+ New agent</strong> to create one.
          </div>
        )}

        {items && items.length > 0 && (
          <ul style={list}>
            {items.map(p => {
              const isConfirming = confirmId === p.projectId;
              const isDeleting   = deleting  === p.projectId;
              return (
                <li key={p.projectId} style={listItem}>
                  <div style={listRow}>
                    <Link to={`/${p.agentSlug}/builder`} style={listLink}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={listName}>{p.agentName}</span>
                        <span style={listSlug}>/{p.agentSlug}/builder</span>
                      </div>
                      <span style={listMeta}>{timeAgo(p.updatedAt)}</span>
                    </Link>
                    {isConfirming ? (
                      <div style={confirmGroup}>
                        <button
                          type="button"
                          onClick={() => onDelete(p.projectId)}
                          disabled={isDeleting}
                          style={dangerBtn}
                          title="Permanently delete this agent and every crew under it"
                        >
                          {isDeleting ? 'Deleting…' : 'Yes, delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          disabled={isDeleting}
                          style={ghostBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(p.projectId)}
                        style={deleteIconBtn}
                        title="Delete this agent"
                        aria-label={`Delete ${p.agentName}`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f9fafb',
  fontFamily: 'inherit',
  padding: '40px 16px',
};

const container: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
};

const headerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const createCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: '#4b5563',
};

const fieldInput: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  fontFamily: 'inherit',
};

const hint: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  fontWeight: 400,
};

const list: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  overflow: 'hidden',
};

const listItem: React.CSSProperties = {
  borderBottom: '1px solid #f3f4f6',
};

const listRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  paddingRight: 12,
};

const listLink: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 18px',
  textDecoration: 'none',
  color: '#111827',
  minWidth: 0,
};

const deleteIconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  color: '#9ca3af',
  background: 'transparent',
  border: '1px solid transparent',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const confirmGroup: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const dangerBtn: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  background: '#dc2626',
  color: '#fff',
  border: '1px solid #dc2626',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  background: '#fff',
  color: '#4b5563',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const listName: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const listSlug: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  fontFamily: 'monospace',
};

const listMeta: React.CSSProperties = {
  fontSize: 11,
  color: '#9ca3af',
  flexShrink: 0,
};

const empty: React.CSSProperties = {
  background: '#fff',
  border: '1px dashed #e5e7eb',
  borderRadius: 10,
  padding: '32px 24px',
  textAlign: 'center',
  color: '#6b7280',
  fontSize: 14,
};

const errorBox: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#dc2626',
  fontSize: 13,
};

const primaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  background: '#6366f1',
  color: '#fff',
  border: '1px solid #6366f1',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  background: '#fff',
  color: '#4b5563',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
