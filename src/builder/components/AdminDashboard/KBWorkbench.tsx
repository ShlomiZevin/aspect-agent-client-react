/**
 * KBWorkbench — V2-native Knowledge Base screen.
 *
 * Replaces the embedded V1 PineconeAdmin (3 disconnected tabs:
 * Settings / Upload / Search) with one KB-centric master/detail screen:
 *
 *   ┌ Knowledge Bases ─┬─ selected KB ───────────────────────────┐
 *   │ [+ New KB]        │  header (name · chunks · ⚙)             │
 *   │ ● medical-kb  12  │  ⬆ Add knowledge (drop · chunk knobs ·  │
 *   │   pricing-kb   3  │     preview)                            │
 *   │   support-kb   7  │  Files in this KB                       │
 *   │                   │  🔍 Test this KB (scores · inject view) │
 *   └───────────────────┴─────────────────────────────────────────┘
 *
 * People think in knowledge bases, not in functions — so the unit is a
 * KB (a Pinecone namespace), and the whole pipeline (add → chunk →
 * index → retrieve → inject) reads top-to-bottom for the selected KB.
 * Every atom stays visible/playable (chunk preview, similarity scores,
 * the exact injected block) — see memory: project_kb_playable_atoms.
 *
 * Low-level Pinecone infra (connection, index create/activate/delete)
 * is demoted behind a ⚙ gear; a setup card shows only when unconfigured.
 *
 * Reuses the existing `pineconeService` client (talks to /api/pinecone/*),
 * so no server changes. KBs are still the GLOBAL namespace list for the
 * active index — per-agent scoping is the parked Stage-B decision.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getConnectionStatus,
  getAgentKbs,
  getLibraryFiles,
  linkKb,
  previewChunks,
  indexBulk,
  deleteLibraryFile,
  deleteKB,
  listVectors,
  queryPinecone,
  type ConnectionStatus,
  type ChunkPreviewResult,
  type LibraryFile,
  type VectorData,
  type QueryResponse,
} from '../../../services/pineconeService';
import { IndexSettingsModal } from './IndexSettingsModal';
// import { LinkedAgents } from './KBLinkedAgents'; // temporarily hidden
import { useConfirm } from '../Confirm/Confirm';
import styles from './KBWorkbench.module.css';

interface Props {
  /** Builder agent slug — used to suggest a default KB name. */
  agentSlug: string;
  /** Builder agent id — scopes the KB list to this agent's links. */
  agentId: string;
}

interface KBEntry {
  name: string;
  vectorCount: number;
  /** DB-tracked aggregates (may be absent for legacy namespaces). */
  fileCount?: number;
  cost?: number;
  /** Whether this KB is linked to the current agent. */
  linked?: boolean;
  /** True for a KB the user just created that has no vectors yet. */
  pending?: boolean;
}

export function KBWorkbench({ agentSlug, agentId }: Props) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const confirm = useConfirm();

  const [kbs, setKbs] = useState<KBEntry[]>([]);
  const [pending, setPending] = useState<string[]>([]); // locally-created, not-yet-indexed
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingKbs, setLoadingKbs] = useState(false);
  // Scope: linked (this agent's KBs) by default; "show all" reveals every
  // KB so a shared one can be linked / inspected.
  // show-all toggle temporarily hidden — re-add `setShowAll` + the button
  // below to restore.
  const [showAll] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getConnectionStatus();
      setStatus(s);
    } catch {
      setStatus({ configured: false, hasApiKey: false, indexName: null });
    } finally {
      setStatusLoaded(true);
    }
  }, []);

  const refreshKbs = useCallback(async () => {
    setLoadingKbs(true);
    try {
      const list = await getAgentKbs(agentId, showAll ? 'all' : 'linked');
      const rows: KBEntry[] = list
        .map(k => ({ name: k.namespace, vectorCount: k.vectorCount, fileCount: k.fileCount, cost: k.cost, linked: k.linked }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setKbs(rows);
      setSelected(prev => prev ?? rows[0]?.name ?? null);
    } catch {
      setKbs([]);
    } finally {
      setLoadingKbs(false);
    }
  }, [agentId, showAll]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);
  useEffect(() => { if (status?.configured) refreshKbs(); }, [status?.configured, refreshKbs]);

  // Merge index namespaces with locally-created pending KBs.
  const allKbs = useMemo<KBEntry[]>(() => {
    const names = new Set(kbs.map(k => k.name));
    const extras = pending
      .filter(p => !names.has(p))
      .map(p => ({ name: p, vectorCount: 0, pending: true }));
    return [...extras, ...kbs];
  }, [kbs, pending]);

  const handleCreateKB = useCallback((rawName: string) => {
    const name = rawName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!name) return;
    setPending(prev => (prev.includes(name) ? prev : [...prev, name]));
    setSelected(name);
  }, []);

  // After a successful index, the namespace now has vectors — drop it
  // from the pending set, LINK it to this agent (so it's "owned" here and
  // stays visible without "show all"), then refresh.
  const handleIndexed = useCallback((ns: string) => {
    setPending(prev => prev.filter(p => p !== ns));
    linkKb(agentId, ns).catch(() => {}).finally(refreshKbs);
  }, [agentId, refreshKbs]);

  const handleDeleteKB = useCallback(async (kb: KBEntry) => {
    // A pending (never-indexed) KB exists only locally — just drop it.
    if (kb.pending) {
      setPending(prev => prev.filter(p => p !== kb.name));
      setSelected(prev => (prev === kb.name ? null : prev));
      return;
    }
    const ok = await confirm({
      title: `Delete knowledge base “${kb.name}”?`,
      message: `All ${kb.vectorCount.toLocaleString()} chunks and every file in it are permanently removed. This can’t be undone.`,
      confirmLabel: 'Delete KB',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteKB(kb.name);
      setSelected(prev => (prev === kb.name ? null : prev));
      refreshKbs();
    } catch { /* best-effort; refresh will reflect reality */ refreshKbs(); }
  }, [confirm, refreshKbs]);

  // ── Render states ────────────────────────────────────────────────
  if (!statusLoaded) {
    return <div className={styles.boot}>Loading knowledge bases…</div>;
  }

  if (!status?.hasApiKey) {
    return (
      <div className={styles.setupWrap}>
        <div className={styles.setupCard}>
          <div className={styles.setupTitle}>Pinecone isn’t configured</div>
          <p className={styles.setupBody}>
            Add your Pinecone API key to the server’s <code>.env</code>, then restart:
          </p>
          <pre className={styles.setupPre}>PINECONE_API_KEY=your-key-here{'\n'}PINECONE_INDEX_NAME=your-index</pre>
          <button type="button" className={styles.btn} onClick={refreshStatus}>Re-check</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {/* ── Left rail: the agent's knowledge bases ──────────────── */}
      <aside className={styles.rail}>
        <div className={styles.railHead}>
          <span className={styles.railTitle}>Knowledge Bases</span>
          <button
            type="button"
            className={styles.gearBtn}
            title="Index & connection settings"
            onClick={() => setSettingsOpen(true)}
          >⚙</button>
        </div>

        <NewKBButton agentSlug={agentSlug} onCreate={handleCreateKB} />

        {/* Temporarily hidden — restore with `setShowAll` (see useState above).
        <button type="button" className={styles.scopeToggle} onClick={() => setShowAll(v => !v)}>
          {showAll ? '◂ Show this agent’s KBs' : 'Show all KBs ▸'}
        </button> */}

        <div className={styles.kbList}>
          {loadingKbs && allKbs.length === 0 && <div className={styles.muted}>Loading…</div>}
          {!loadingKbs && allKbs.length === 0 && (
            <div className={styles.muted}>
              {showAll ? 'No knowledge bases yet. Create one to start.' : 'No KBs linked to this agent. Create one, or “Show all KBs”.'}
            </div>
          )}
          {allKbs.map(kb => (
            <div
              key={kb.name}
              className={`${styles.kbRow} ${kb.name === selected ? styles.kbRowActive : ''}`}
            >
              <button
                type="button"
                className={styles.kbItem}
                onClick={() => setSelected(kb.name)}
              >
                <span className={styles.kbIcon} aria-hidden>📚</span>
                <span className={styles.kbText}>
                  <span className={styles.kbName}>{kb.name}</span>
                  <span className={styles.kbSub}>
                    {kb.pending
                      ? 'new — no files yet'
                      : `${kb.fileCount ?? 0} file${kb.fileCount === 1 ? '' : 's'} · ${kb.vectorCount.toLocaleString()} chunks${kb.cost ? ` · $${kb.cost.toFixed(4)}` : ''}`}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={styles.kbDelete}
                title="Delete knowledge base"
                aria-label={`Delete knowledge base ${kb.name}`}
                onClick={() => handleDeleteKB(kb)}
              >🗑</button>
            </div>
          ))}
        </div>

        {status.indexName && (
          <div className={styles.railFoot}>
            index: <strong>{status.indexName}</strong>
          </div>
        )}
      </aside>

      {/* ── Right: the selected KB ───────────────────────────────── */}
      <main className={styles.detail}>
        {selected
          ? <KBDetail key={selected} namespace={selected} onIndexed={handleIndexed} />
          : <div className={styles.detailEmpty}>Pick a knowledge base, or create one.</div>}
      </main>

      {settingsOpen && (
        <IndexSettingsModal
          status={status}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => { refreshStatus(); refreshKbs(); }}
        />
      )}
    </div>
  );
}

/** "+ New KB" with an inline name field that expands on click. */
function NewKBButton({ agentSlug, onCreate }: { agentSlug: string; onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const submit = () => {
    if (name.trim()) onCreate(name);
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        className={styles.newBtn}
        onClick={() => { setName(`${agentSlug || 'my'}-kb`); setOpen(true); }}
      >
        + New knowledge base
      </button>
    );
  }
  return (
    <div className={styles.newRow}>
      <input
        ref={inputRef}
        className={styles.newInput}
        value={name}
        placeholder={`${agentSlug || 'my'}-kb`}
        onFocus={e => e.currentTarget.select()}
        onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
        onKeyDown={e => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') { setName(''); setOpen(false); }
        }}
      />
      <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={submit} disabled={!name.trim()}>Add</button>
      <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => { setName(''); setOpen(false); }}>✕</button>
    </div>
  );
}

// ─── Detail: one knowledge base ──────────────────────────────────────
// NOTE: `agentId` + `onLinksChanged` props were removed along with the
// hidden LinkedAgents row — re-add them (and the call-site props) to
// restore the link-management UI.
function KBDetail({ namespace, onIndexed }: {
  namespace: string; onIndexed: (ns: string) => void;
}) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try { setFiles((await getLibraryFiles(namespace)).files); }
    catch { setFiles([]); }
    finally { setFilesLoading(false); }
  }, [namespace]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleIndexed = useCallback((ns: string) => {
    onIndexed(ns);   // updates the rail counts
    loadFiles();     // refreshes the Files section without a manual ↻
  }, [onIndexed, loadFiles]);

  const [view, setView] = useState<'both' | 'files' | 'test'>('both');

  const totalChunks = files.reduce((s, f) => s + (f.chunkCount || 0), 0);
  const totalCost = files.reduce((s, f) => s + (f.embeddingCost || 0), 0);

  return (
    <div className={styles.detailInner}>
      <header className={styles.detailHead}>
        <span className={styles.detailIcon} aria-hidden>📚</span>
        <span className={styles.detailName}>{namespace}</span>
        {files.length > 0 && (
          <span className={styles.detailMeta} title="One-time embedding cost to index this KB (not monthly)">
            {files.length} file{files.length === 1 ? '' : 's'} · {totalChunks.toLocaleString()} chunks · ${totalCost.toFixed(4)}
          </span>
        )}
        <span className={styles.detailSpacer} />
        <div className={styles.viewToggle} role="tablist">
          {(['files', 'both', 'test'] as const).map(v => (
            <button
              key={v}
              type="button"
              className={`${styles.viewBtn} ${view === v ? styles.viewBtnActive : ''}`}
              onClick={() => setView(v)}
            >{v === 'files' ? 'Files' : v === 'test' ? 'Test' : 'Both'}</button>
          ))}
        </div>
      </header>

      {/* Temporarily hidden — restore the import + this row to manage which
          agents a KB is linked to (incl. the "pick an agent" picker).
      <LinkedAgents namespace={namespace} currentAgentId={agentId} onChanged={onLinksChanged} /> */}

      <div className={styles.kbColumns}>
        {view !== 'test' && (
          <div className={styles.colFiles}>
            <AddKnowledge namespace={namespace} onIndexed={handleIndexed} existingNames={files.map(f => f.fileName)} />
            <FilesSection files={files} loading={filesLoading} onReload={loadFiles} />
          </div>
        )}
        {view !== 'files' && (
          <div className={styles.colTest}>
            <TestSection namespace={namespace} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Friendly error modal for dummy users — a plain-language summary up top
 * with a collapsible "technical details" section carrying the real error
 * (and a Copy button) for when you need to debug or report it.
 */
export interface KBError { title?: string; message: string; details?: string }

export function KBErrorModal({ error, onClose }: { error: KBError; onClose: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!error.details) return;
    navigator.clipboard?.writeText(error.details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.errModal} onClick={e => e.stopPropagation()}>
        <div className={styles.errIcon} aria-hidden>⚠️</div>
        <div className={styles.errTitle}>{error.title || 'Something went wrong'}</div>
        <div className={styles.errMessage} dir="auto">{error.message}</div>

        {error.details && (
          <div className={styles.errDetailsWrap}>
            <button type="button" className={styles.errDetailsToggle} onClick={() => setShowDetails(s => !s)}>
              {showDetails ? '▾ Hide technical details' : '▸ Show technical details'}
            </button>
            {showDetails && (
              <div>
                <pre className={styles.errDetails}>{error.details}</pre>
                <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={copy}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className={styles.errActions}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

/** Turn a raw error into a plain-language summary for the modal. */
function friendlyIndexError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('scanned') || r.includes('no text')) {
    return 'We couldn’t read any text from this file. If it’s a scanned or image-only PDF, it has no text to index — try a text-based version of the document.';
  }
  if (r.includes('429') || r.includes('rate limit')) {
    return 'The embedding service is rate-limiting requests right now. Wait a moment and try again.';
  }
  if (r.includes('insufficient_quota') || r.includes('quota')) {
    return 'The OpenAI account used for embeddings is out of quota. Check the API plan/billing, then retry.';
  }
  if (r.includes('api key') || r.includes('401') || r.includes('unauthorized')) {
    return 'A required API key looks missing or invalid on the server. Check the server configuration and try again.';
  }
  return 'This file couldn’t be added to the knowledge base. The technical details below explain why.';
}

// ─── Section: add knowledge (upload → chunk preview → index) ─────────
function AddKnowledge({ namespace, onIndexed, existingNames }: {
  namespace: string; onIndexed: (ns: string) => void; existingNames: string[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [dragActive, setDragActive] = useState(false);

  const [preview, setPreview] = useState<ChunkPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [errModal, setErrModal] = useState<KBError | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles(prev => [...prev, ...Array.from(list)]);
    setDoneMsg(null);
  };

  const handlePreview = async () => {
    if (!files[0]) return;
    setPreviewLoading(true); setError(null);
    try { setPreview(await previewChunks(files[0], chunkSize, chunkOverlap)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPreviewLoading(false); }
  };

  const handleIndex = async () => {
    if (files.length === 0) return;
    setIndexing(true); setError(null); setErrModal(null); setDoneMsg(null);
    try {
      const res = await indexBulk(files, namespace, 0, chunkSize, chunkOverlap,
        (current, total) => setProgress({ current, total }));

      if (res.successCount > 0 && res.totalVectors > 0) {
        setDoneMsg(`Indexed ${res.successCount} file${res.successCount === 1 ? '' : 's'} · ${res.totalVectors.toLocaleString()} chunks · $${res.totalEmbeddingCost.toFixed(4)}`);
        setFiles(res.failedFiles.length ? files.filter(f => res.failedFiles.some(ff => ff.fileName === f.name)) : []);
        setPreview(null);
        onIndexed(namespace); // only now does the namespace truly exist
      }

      // Per-file failures come back in `failedFiles` even on a 200 — show
      // them in the friendly modal (with the raw error under "details").
      if (res.failedCount > 0) {
        const details = res.failedFiles.map(f => `• ${f.fileName}\n  ${f.error}`).join('\n\n');
        setErrModal({
          title: res.failedCount === res.totalFiles ? 'Couldn’t add this file' : 'Some files couldn’t be added',
          message: friendlyIndexError(res.failedFiles[0]?.error || ''),
          details,
        });
      }
    } catch (e) {
      const raw = e instanceof Error ? (e.stack || e.message) : String(e);
      setErrModal({ title: 'Couldn’t reach the server', message: friendlyIndexError(raw), details: raw });
    } finally { setIndexing(false); }
  };

  // Auto-dismiss the success toast.
  useEffect(() => {
    if (!doneMsg) return;
    const t = setTimeout(() => setDoneMsg(null), 3800);
    return () => clearTimeout(t);
  }, [doneMsg]);

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>⬆ Add knowledge</div>

      <div
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.dropPlus}>+</div>
        <div className={styles.dropText}>Drop files or click to browse</div>
        <div className={styles.dropHint}>PDF · DOCX · XLSX · CSV · TXT · MD</div>
        <input ref={fileInputRef} type="file" multiple hidden
          accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.html"
          onChange={e => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <>
          <div className={styles.fileTags}>
            {files.map((f, i) => {
              const dup = existingNames.includes(f.name);
              return (
                <span key={i} className={`${styles.fileTag} ${dup ? styles.fileTagDup : ''}`} title={dup ? 'Already in this KB' : undefined}>
                  {dup && <span aria-hidden>⚠ </span>}{f.name}
                  <button type="button" className={styles.fileTagX}
                    onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>✕</button>
                </span>
              );
            })}
          </div>

          {files.some(f => existingNames.includes(f.name)) && (
            <div className={styles.warnLine}>
              ⚠ {files.filter(f => existingNames.includes(f.name)).map(f => f.name).join(', ')} already in
              {' '}this knowledge base — indexing again adds a <strong>duplicate copy</strong>. Remove the old file first to replace it.
            </div>
          )}

          <div className={styles.knobs}>
            <label className={styles.knob}>
              <span className={styles.knobLabel}>Chunk size</span>
              <input type="number" className={styles.knobInput} value={chunkSize} min={100} max={4000} step={100}
                onChange={e => setChunkSize(parseInt(e.target.value) || 0)} />
            </label>
            <label className={styles.knob}>
              <span className={styles.knobLabel}>Overlap</span>
              <input type="number" className={styles.knobInput} value={chunkOverlap} min={0} max={1000} step={50}
                onChange={e => setChunkOverlap(parseInt(e.target.value) || 0)} />
            </label>
            <div className={styles.knobSpacer} />
            <button type="button" className={styles.btn} onClick={handlePreview} disabled={previewLoading}>
              {previewLoading ? 'Previewing…' : 'Preview chunks'}
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleIndex} disabled={indexing}>
              {indexing ? `Indexing ${progress.current}/${progress.total}…` : `Index ${files.length} file${files.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {doneMsg && (
        <div className={styles.toast} role="status" key={doneMsg}>
          <span className={styles.toastCheck} aria-hidden>✓</span> {doneMsg}
        </div>
      )}

      {errModal && <KBErrorModal error={errModal} onClose={() => setErrModal(null)} />}

      {/* Preview lives in a modal so it never reflows the form/page. */}
      {preview && (
        <div className={styles.modalOverlay} onClick={() => setPreview(null)}>
          <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div className={styles.previewTitleWrap}>
                <span className={styles.previewKicker}>Chunk preview</span>
                <span className={styles.previewFile} dir="ltr" title={preview.fileName}>{preview.fileName}</span>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setPreview(null)}>✕</button>
            </div>
            <div className={styles.previewSub}>
              <strong>{preview.stats.totalChunks}</strong> chunks ·
              {' '}{preview.stats.totalCharacters.toLocaleString()} chars ·
              {' '}size {preview.settings.chunkSize} / overlap {preview.settings.chunkOverlap}
            </div>
            <div className={styles.chunkList}>
              {preview.chunks.map(c => {
                const text = c.text.replace(/\n{3,}/g, '\n\n').trim();
                return (
                  <div key={c.chunkIndex} className={styles.chunk}>
                    <div className={styles.chunkMeta}>
                      <span className={styles.chunkNum}>#{c.chunkIndex + 1}</span>
                      <span>~{Math.ceil(c.text.length / 4)} tokens · {c.text.length} chars</span>
                    </div>
                    <div className={styles.chunkText} dir="auto">{text}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Section: files in this KB (compact chips → detail modal) ────────
function fmtSize(b: number | null): string {
  return !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
}

/** Small colored type badge per file extension (clean + unambiguous,
 *  vs. toy-like emoji). Mirrors the V1 admin's file badges. */
function fileBadge(type: string | null): { label: string; color: string } {
  const t = (type || '').toLowerCase();
  if (t === 'pdf') return { label: 'PDF', color: '#ef4444' };
  if (t === 'docx' || t === 'doc') return { label: 'DOC', color: '#2563eb' };
  if (t === 'csv') return { label: 'CSV', color: '#10b981' };
  if (t === 'xlsx' || t === 'xls') return { label: 'XLS', color: '#10b981' };
  if (t === 'md') return { label: 'MD', color: '#8b5cf6' };
  if (t === 'txt') return { label: 'TXT', color: '#64748b' };
  if (t === 'json') return { label: 'JSON', color: '#d97706' };
  if (t === 'html') return { label: 'HTML', color: '#0ea5e9' };
  return { label: (t || 'file').toUpperCase().slice(0, 4), color: '#94a3b8' };
}

function FilesSection({ files, loading, onReload }: {
  files: LibraryFile[]; loading: boolean; onReload: () => void;
}) {
  const confirm = useConfirm();
  const [selected, setSelected] = useState<LibraryFile | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [q, setQ] = useState('');

  const shown = q.trim()
    ? files.filter(f => f.fileName.toLowerCase().includes(q.trim().toLowerCase()))
    : files;

  const handleRemove = async (f: LibraryFile) => {
    const ok = await confirm({
      title: `Remove “${f.fileName}”?`,
      message: 'Its chunks are deleted from this knowledge base. The original upload isn’t affected.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setRemovingId(f.id);
    try { await deleteLibraryFile(f.id); onReload(); }
    catch { setRemovingId(null); }
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        Files
        <span className={styles.countPill}>{q.trim() ? `${shown.length}/${files.length}` : files.length}</span>
        <span className={styles.titleSpacer} />
        {files.length > 0 && (
          <input
            className={styles.fileSearch}
            placeholder="Search files…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        )}
        <button type="button" className={styles.refreshLink} onClick={onReload} disabled={loading}>↻</button>
      </div>
      {loading && files.length === 0 && <div className={styles.muted}>Loading…</div>}
      {!loading && files.length === 0 && (
        <div className={styles.muted}>No files yet. Add knowledge above.</div>
      )}
      {files.length > 0 && shown.length === 0 && (
        <div className={styles.muted}>No files match “{q}”.</div>
      )}

      <div className={styles.fileGrid}>
        {shown.map(f => {
          const badge = fileBadge(f.fileType);
          return (
          <div key={f.id} className={`${styles.fileTile} ${removingId === f.id ? styles.fileTileBusy : ''}`}>
            <button type="button" className={styles.fileTileMain} onClick={() => setSelected(f)} title={f.fileName}>
              <span className={styles.fileTileTop}>
                <span className={styles.fileBadge} style={{ background: `${badge.color}1a`, color: badge.color }}>{badge.label}</span>
                <span className={styles.fileTileName} dir="ltr">{f.fileName}</span>
              </span>
              <span className={styles.fileTileMeta}>
                {f.chunkCount} chunks{f.fileSize ? ` · ${fmtSize(f.fileSize)}` : ''}
              </span>
              {f.embeddingCost > 0 && (
                <span className={styles.fileTileCost}>${f.embeddingCost.toFixed(4)} · {f.embeddingTokens.toLocaleString()} tok</span>
              )}
            </button>
            <button
              type="button"
              className={styles.fileTileRemove}
              title="Remove from KB"
              aria-label={`Remove ${f.fileName}`}
              onClick={() => handleRemove(f)}
            >✕</button>
          </div>
          );
        })}
      </div>

      {selected && (
        <FileDetailModal
          file={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); onReload(); }}
        />
      )}
    </section>
  );
}

function FileDetailModal({ file, onClose, onDeleted }: {
  file: LibraryFile; onClose: () => void; onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const [chunks, setChunks] = useState<VectorData[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listVectors(file.namespace, Number(file.fileId), 300)
      .then(r => { if (!cancelled) setChunks([...r.vectors].sort((a, b) => (a.metadata.chunkIndex ?? 0) - (b.metadata.chunkIndex ?? 0))); })
      .catch(() => { if (!cancelled) setChunks([]); });
    return () => { cancelled = true; };
  }, [file.namespace, file.fileId]);

  const fmtDate = (d: string) => { try { return new Date(d).toLocaleString(); } catch { return d; } };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Remove "${file.fileName}"?`,
      message: 'Its chunks are deleted from this knowledge base. The original upload isn’t affected.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try { await deleteLibraryFile(file.id); onDeleted(); }
    catch { setDeleting(false); }
  };

  const badge = fileBadge(file.fileType);
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.previewModal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <div className={styles.previewTitleWrap}>
            <span className={styles.previewKicker}>File</span>
            <span className={styles.previewFileRow}>
              <span className={styles.fileBadge} style={{ background: `${badge.color}1a`, color: badge.color }}>{badge.label}</span>
              <span className={styles.previewFile} dir="ltr" title={file.fileName}>{file.fileName}</span>
            </span>
          </div>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className={styles.previewSub}>
          <strong>{file.chunkCount}</strong> chunks
          {file.fileSize ? ` · ${fmtSize(file.fileSize)}` : ''}
          {file.fileType ? ` · ${file.fileType}` : ''}
          {' '}· added {fmtDate(file.createdAt)}
          <br />
          <span className={styles.costLine} title="One-time cost to embed this file at index time (text-embedding-3-small). Not recurring.">
            embedding cost (one-time) ${file.embeddingCost.toFixed(4)} · {file.embeddingTokens.toLocaleString()} tokens
          </span>
        </div>

        {chunks === null && <div className={styles.muted}>Loading chunks…</div>}
        {chunks && chunks.length === 0 && <div className={styles.muted}>No chunks found for this file.</div>}
        {chunks && chunks.length > 0 && (
          <div className={styles.chunkList}>
            {chunks.map(c => (
              <div key={c.id} className={styles.chunk}>
                <div className={styles.chunkMeta}>
                  <span className={styles.chunkNum}>#{(c.metadata.chunkIndex ?? 0) + 1}</span>
                </div>
                <div className={styles.chunkText} dir="auto">{c.metadata.text}</div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.errActions} style={{ justifyContent: 'space-between' }}>
          <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Removing…' : 'Remove from KB'}
          </button>
          <button type="button" className={styles.btn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section: test this KB (retrieve + inject preview) ───────────────
function TestSection({ namespace }: { namespace: string }) {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [minScore, setMinScore] = useState(0);
  const [maxTokens, setMaxTokens] = useState(3000);
  const [optsOpen, setOptsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true); setError(null);
    try { setResult(await queryPinecone([namespace], query, topK, minScore, maxTokens)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };

  const scoreColor = (s: number) => (s >= 0.7 ? '#059669' : s >= 0.4 ? '#d97706' : '#dc2626');

  return (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>
        🔍 Test this knowledge base
        <button type="button" className={styles.advLink} onClick={() => setOptsOpen(true)}>
          ⚙ options
        </button>
      </div>

      <div className={styles.testRow}>
        <input
          className={styles.queryInput}
          value={query}
          placeholder="Ask a question to see what this KB returns…"
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run(); }}
        />
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={run} disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {result && (
        <div className={styles.results}>
          <div className={styles.resultsMeta}>
            {result.results.length} matches · {result.queryTimeMs}ms · {result.tokensUsed.toLocaleString()} tokens
          </div>

          {result.results.length === 0 && (
            <div className={styles.muted}>No matches. Lower the min score or rephrase.</div>
          )}

          {result.results.map((r, i) => (
            <div key={i} className={styles.resultItem}>
              <div className={styles.resultHead}>
                <span className={styles.resultFile} dir="auto">{r.fileName} · #{r.chunkIndex}</span>
                <span className={styles.resultScore} style={{ color: scoreColor(r.score) }}>
                  {(r.score * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.scoreBar}>
                <div className={styles.scoreBarFill} style={{ width: `${r.score * 100}%`, background: scoreColor(r.score) }} />
              </div>
              <div className={styles.resultText} dir="auto">{r.text}</div>
            </div>
          ))}
        </div>
      )}

      {optsOpen && (
        <div className={styles.modalOverlay} onClick={() => setOptsOpen(false)}>
          <div className={styles.optsModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Search options</span>
              <button type="button" className={styles.modalClose} onClick={() => setOptsOpen(false)}>✕</button>
            </div>
            <div className={styles.optRow}>
              <div className={styles.optMain}>
                <div className={styles.optLabel}>Results (top K)</div>
                <div className={styles.optHint}>How many chunks to return.</div>
              </div>
              <input type="number" className={styles.knobInput} value={topK} min={1} max={20}
                onChange={e => setTopK(parseInt(e.target.value) || 1)} />
            </div>
            <div className={styles.optRow}>
              <div className={styles.optMain}>
                <div className={styles.optLabel}>Min score</div>
                <div className={styles.optHint}>Hide matches below this similarity (0–1).</div>
              </div>
              <input type="number" className={styles.knobInput} value={minScore} min={0} max={1} step={0.05}
                onChange={e => setMinScore(parseFloat(e.target.value) || 0)} />
            </div>
            <div className={styles.optRow}>
              <div className={styles.optMain}>
                <div className={styles.optLabel}>Max tokens</div>
                <div className={styles.optHint}>Cap on total text returned.</div>
              </div>
              <input type="number" className={styles.knobInput} value={maxTokens} min={500} max={10000} step={500}
                onChange={e => setMaxTokens(parseInt(e.target.value) || 500)} />
            </div>
            <div className={styles.errActions}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setOptsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
