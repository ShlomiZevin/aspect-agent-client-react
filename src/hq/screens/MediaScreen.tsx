/**
 * HQ — everything the workers have made.
 *
 * Default view is BY CONVERSATION, because that's how people actually look for
 * something: "the images from the chat where we did the Freeda stories". A
 * folder view sits alongside for when you want to impose an order after the
 * fact — optional, never required, and nothing is ever only in a folder.
 */

import { useCallback, useEffect, useState } from 'react';

import { Prompt } from '../components/Prompt';
import { IconBack, IconSearch } from '../icons';
import {
  createMediaFolder, deleteMedia, listMedia, listMediaFolders, mediaByConversation, moveMedia,
} from '../services/hqApi';
import type { MediaConversationGroup, MediaFolder, MediaItem } from '../types';
import styles from './MediaScreen.module.css';

type View = 'conversations' | 'folders';

function whenText(value: string): string {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MediaScreen() {
  const [view, setView] = useState<View>('conversations');
  const [groups, setGroups] = useState<MediaConversationGroup[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [openGroup, setOpenGroup] = useState<MediaConversationGroup | null>(null);
  const [openFolder, setOpenFolder] = useState<MediaFolder | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [naming, setNaming] = useState(false);

  const loadIndex = useCallback(() =>
    Promise.all([
      mediaByConversation().catch(() => []),
      listMediaFolders().catch(() => []),
    ]).then(([g, f]) => { setGroups(g); setFolders(f); setLoading(false); }),
  []);

  useEffect(() => { void loadIndex(); }, [loadIndex]);

  async function openConversation(g: MediaConversationGroup) {
    setOpenFolder(null); setOpenGroup(g); setPicked(new Set());
    setItems(await listMedia({ conversationId: g.id }));
  }

  async function openFolderView(f: MediaFolder) {
    setOpenGroup(null); setOpenFolder(f); setPicked(new Set());
    setItems(await listMedia({ folderId: f.id }));
  }

  function back() { setOpenGroup(null); setOpenFolder(null); setItems([]); setPicked(new Set()); }

  function toggle(id: number) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function fileInto(folderId: number | null) {
    await moveMedia([...picked], folderId);
    setPicked(new Set());
    await loadIndex();
    if (openGroup) await openConversation(openGroup);
    if (openFolder) await openFolderView(openFolder);
  }

  async function newFolder(name: string) {
    const f = await createMediaFolder(name);
    // The insert returns the row, which has no computed count — without this the
    // count pill rendered `undefined` and showed as an empty grey blob until the
    // next reload.
    setFolders(prev => [...prev, { ...f, media_count: f.media_count ?? 0 }]);
    setNaming(false);
  }

  const visible = search
    ? items.filter(i => (i.title || '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const inside = openGroup || openFolder;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headInner}>
          {inside ? (
            <button className={styles.back} onClick={back}><IconBack /> All media</button>
          ) : (
            <span className={`hqEyebrow ${styles.eyebrow}`}>Everything the team has made</span>
          )}

          <div className={styles.titleRow}>
            <h1 className={styles.title} dir="auto">
              {openGroup ? openGroup.title : openFolder ? openFolder.name : 'Media'}
            </h1>

            {!inside && (
              <div className={styles.views}>
                <button
                  className={`hqGhostPill ${view === 'conversations' ? 'hqOn' : ''}`}
                  onClick={() => setView('conversations')}
                >
                  By conversation
                </button>
                <button
                  className={`hqGhostPill ${view === 'folders' ? 'hqOn' : ''}`}
                  onClick={() => setView('folders')}
                >
                  Folders
                </button>
              </div>
            )}

            {inside && (
              <div className={styles.searchWrap}>
                <IconSearch />
                <input
                  className={styles.search}
                  value={search}
                  dir="auto"
                  placeholder="Find…"
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.inner}>
          {loading && <div className={styles.loading}>Loading…</div>}

          {/* ── Index: conversations ──────────────────────────────────────── */}
          {!inside && view === 'conversations' && (
            <>
              {!loading && groups.length === 0 && (
                <div className={styles.empty}>
                  <div className={styles.emptyTitle}>Nothing made yet</div>
                  <div className={styles.emptyHint}>
                    Ask someone on the Team for a design and it lands here automatically.
                  </div>
                </div>
              )}
              <div className={styles.groups}>
                {groups.map(g => (
                  <button key={g.id} className={styles.group} onClick={() => openConversation(g)}>
                    <span className={styles.groupAvatar}>{g.avatar || '🎨'}</span>
                    <div className={styles.groupBody}>
                      <div className={styles.groupTitle} dir="auto">{g.title}</div>
                      <div className={styles.groupMeta}>
                        {g.worker_name} · {whenText(g.updated_at)}
                      </div>
                    </div>
                    <span className={styles.groupCount}>{g.media_count}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Index: folders ────────────────────────────────────────────── */}
          {!inside && view === 'folders' && (
            <>
              {folders.length === 0 && (
                <div className={styles.empty}>
                  <div className={styles.emptyTitle}>No folders yet</div>
                  <div className={styles.emptyHint}>
                    Folders are optional. Everything is already filed by the conversation it came
                    from — make one only when you want a different order.
                  </div>
                </div>
              )}

              {/* Tiles rather than a list: a folder is a place you go into, and
                  a row of full-width bars reads as records you scan. The create
                  tile sits in the grid so "make one" is where you already are
                  rather than a button above the content. */}
              <div className={styles.folderGrid}>
                {folders.map(f => (
                  <button key={f.id} className={styles.folderTile} onClick={() => openFolderView(f)}>
                    <span className={styles.folderIcon}>📁</span>
                    <span className={styles.folderName} dir="auto">{f.name}</span>
                    <span className={styles.folderFoot}>
                      {f.media_count === 1 ? '1 item' : `${f.media_count || 0} items`}
                    </span>
                  </button>
                ))}

                <button
                  className={`${styles.folderTile} ${styles.folderNew}`}
                  onClick={() => setNaming(true)}
                >
                  <span className={styles.folderIcon}>＋</span>
                  <span className={styles.folderName}>New folder</span>
                  <span className={styles.folderFoot}>Group things your own way</span>
                </button>
              </div>
            </>
          )}

          {/* ── Inside ────────────────────────────────────────────────────── */}
          {inside && (
            <div className={styles.grid}>
              {visible.map(m => (
                <div
                  key={m.id}
                  className={`${styles.tile} ${picked.has(m.id) ? styles.tileOn : ''}`}
                  onClick={e => (e.metaKey || e.ctrlKey ? toggle(m.id) : setPreview(m))}
                >
                  {m.url && <img src={m.url} alt={m.title || ''} loading="lazy" />}
                  <div className={styles.tileBar}>
                    <span className={styles.tileTitle} dir="auto">{m.title}</span>
                    <span className={styles.tileMeta}>{m.width}×{m.height}</span>
                  </div>
                  <span className={styles.tilePick} onClick={e => { e.stopPropagation(); toggle(m.id); }}>
                    {picked.has(m.id) ? '✓' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Filing ────────────────────────────────────────────────────────── */}
      {picked.size > 0 && (
        <div className={styles.floatBar}>
          <span className={styles.floatCount}>{picked.size}</span>
          <span>selected</span>
          <span className={styles.spacer} />
          <select
            className={styles.folderPick}
            defaultValue=""
            onChange={e => e.target.value && fileInto(Number(e.target.value))}
          >
            <option value="">File into…</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button className="hqMini" onClick={() => setPicked(new Set())}>Clear</button>
        </div>
      )}

      {/* ── Full size, because small Hebrew is unreadable in a thumbnail ──── */}
      {naming && (
        <Prompt
          title="New folder"
          hint="Anything already filed by conversation stays there — a folder is an extra way in, not a move."
          placeholder="Campaign visuals"
          confirmLabel="Create folder"
          onConfirm={newFolder}
          onCancel={() => setNaming(false)}
        />
      )}

      {preview && (
        <div className={styles.lightbox} onClick={() => setPreview(null)}>
          <div className={styles.lightboxInner} onClick={e => e.stopPropagation()}>
            {preview.url && <img src={preview.url} alt={preview.title || ''} />}
            <div className={styles.lightboxSide}>
              <div className={styles.lightboxTitle} dir="auto">{preview.title}</div>
              <div className={styles.lightboxMeta}>
                {preview.width}×{preview.height}
                {preview.model && ` · ${preview.model}`}
                {preview.cost_usd ? ` · $${Number(preview.cost_usd).toFixed(3)}` : ''}
              </div>
              {preview.prompt && (
                <>
                  <div className="hqEyebrow">Prompt</div>
                  <p className={styles.lightboxPrompt} dir="auto">{preview.prompt}</p>
                </>
              )}
              <div className={styles.lightboxActions}>
                <a className="hqMini" href={preview.url || '#'} target="_blank" rel="noopener noreferrer">
                  Open full size
                </a>
                <button
                  className="hqMini hqMiniDanger"
                  onClick={async () => {
                    await deleteMedia(preview.id);
                    setItems(prev => prev.filter(i => i.id !== preview.id));
                    setPreview(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
