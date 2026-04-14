import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './PineconeAdmin.module.css';
import {
  previewChunks,
  indexBulk,
  getIndexStats,
  listVectors,
  queryPinecone,
  getConnectionStatus,
  listPineconeIndexes,
  createPineconeIndex,
  deletePineconeIndex,
  activatePineconeIndex,
  getLibraryFiles,
  deleteLibraryFile,
  type ChunkPreviewResult,
  type BulkIndexResult,
  type QueryResponse,
  type ConnectionStatus,
  type PineconeIndex,
  type LibraryFile,
} from '../../services/pineconeService';

type Tab = 'settings' | 'upload' | 'search';

interface PineconeAdminProps {
  agentName: string;
  baseURL: string;
}

export function PineconeAdmin({ agentName }: PineconeAdminProps) {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    getConnectionStatus().then(setStatus).catch(() => {});
  }, []);

  const isReady = status?.configured;

  return (
    <div className={styles.content}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'settings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'upload' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('upload')}
          disabled={!isReady}
          style={!isReady ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'search' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('search')}
          disabled={!isReady}
          style={!isReady ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>
      </div>

      {activeTab === 'settings' && <SetupTab status={status} onStatusChange={setStatus} />}
      {activeTab === 'upload' && isReady && <UploadTab agentName={agentName} />}
      {activeTab === 'search' && isReady && <QueryTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP TAB
// ═══════════════════════════════════════════════════════════════════════════════

function SetupTab({ status, onStatusChange }: { status: ConnectionStatus | null; onStatusChange: (s: ConnectionStatus) => void }) {
  const [indexes, setIndexes] = useState<PineconeIndex[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create index modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCloud, setNewCloud] = useState('aws');
  const [newRegion, setNewRegion] = useState('us-east-1');

  const regionOptions: Record<string, string[]> = {
    aws: ['us-east-1', 'us-west-2', 'eu-west-1'],
    gcp: ['us-central1', 'europe-west4'],
    azure: ['eastus2'],
  };

  const loadIndexes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listPineconeIndexes();
      setIndexes(result.indexes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status?.hasApiKey) loadIndexes();
  }, [status?.hasApiKey, loadIndexes]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      await createPineconeIndex(newName, 1536, 'cosine', newCloud, newRegion);
      setSuccess(`Index "${newName}" created!`);
      setShowCreateModal(false);
      setNewName('');
      loadIndexes();
      const s = await getConnectionStatus();
      onStatusChange(s);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }, [newName, newCloud, newRegion, loadIndexes, onStatusChange]);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`Permanently delete index "${name}"? All data will be lost.`)) return;
    setError('');
    try {
      await deletePineconeIndex(name);
      setSuccess(`Index "${name}" deleted`);
      loadIndexes();
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadIndexes]);

  return (
    <>
      {!status?.hasApiKey && (
        <div className={styles.card}>
          <div style={{
            padding: '16px',
            background: 'rgba(245, 158, 11, 0.08)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
          }}>
            <strong>API key missing.</strong> Add your Pinecone API key to the server's <code>.env</code> file:
            <pre style={{
              margin: '8px 0 0',
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '4px',
              fontSize: '13px',
            }}>
{`PINECONE_API_KEY=your-key-here`}
            </pre>
            Then restart the server and refresh this page.
          </div>
        </div>
      )}

      {status?.hasApiKey && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Indexes</h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadIndexes} disabled={loading}>
                {loading ? <span className={`${styles.spinner} ${styles.spinnerDark}`} /> : null}
                Refresh
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => { setNewName(''); setShowCreateModal(true); }}
              >
                + Create Index
              </button>
            </div>
          </div>

          {error && <div style={{ color: 'var(--error-color)', marginBottom: '12px', fontSize: '14px' }}>Error: {error}</div>}
          {success && <div style={{ color: 'var(--success-color)', marginBottom: '12px', fontSize: '14px' }}>{success}</div>}

          {indexes.length > 0 ? (
            <div className={styles.namespaceList}>
              {indexes.map(idx => (
                <div key={idx.name} className={styles.namespaceItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px', cursor: 'default' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={styles.namespaceName}>{idx.name}</div>
                    <button
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                      onClick={() => handleDelete(idx.name)}
                    >
                      Delete
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span><strong>Dimensions:</strong> {idx.dimension}</span>
                    <span><strong>Metric:</strong> {idx.metric}</span>
                    <span><strong>Cloud:</strong> {idx.cloud?.toUpperCase()}</span>
                    <span><strong>Region:</strong> {idx.region}</span>
                    <span><strong>Status:</strong> <span style={{ color: idx.status === 'ready' ? 'var(--success-color)' : 'var(--warning-color)' }}>{idx.status}</span></span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7, wordBreak: 'break-all' }}>
                    {idx.host}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>~</div>
                <div className={styles.emptyText}>No indexes yet</div>
                <div className={styles.emptyHint}>Click "+ Create Index" to get started</div>
              </div>
            )
          )}
        </div>
      )}

      {/* Create Index Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
            onClick={() => !creating && setShowCreateModal(false)}
          />
          <div style={{
            position: 'relative', background: 'var(--surface, #fff)',
            borderRadius: 'var(--radius-md)', padding: '24px',
            width: '100%', maxWidth: '480px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Create Index
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              A Pinecone index stores your vector data. You typically only need one.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className={styles.settingLabel}>Index Name</label>
                <input
                  type="text"
                  className={styles.settingInput}
                  value={newName}
                  onChange={e => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. my-kb"
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className={styles.settingLabel}>Cloud</label>
                  <select
                    className={styles.settingInput}
                    value={newCloud}
                    onChange={e => { setNewCloud(e.target.value); setNewRegion(regionOptions[e.target.value][0]); }}
                    style={{ width: '100%' }}
                  >
                    <option value="aws">AWS</option>
                    <option value="gcp">GCP</option>
                    <option value="azure">Azure</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className={styles.settingLabel}>Region</label>
                  <select
                    className={styles.settingInput}
                    value={newRegion}
                    onChange={e => setNewRegion(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {regionOptions[newCloud].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label className={styles.settingLabel}>Dimensions</label>
                  <input type="text" className={styles.settingInput} value="1536" disabled style={{ width: '100%', opacity: 0.6 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className={styles.settingLabel}>Metric</label>
                  <input type="text" className={styles.settingInput} value="cosine" disabled style={{ width: '100%', opacity: 0.6 }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
              >
                {creating ? <><span className={styles.spinner} /> Creating...</> : 'Create Index'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD & INDEX TAB
// ═══════════════════════════════════════════════════════════════════════════════

function UploadTab({ agentName }: { agentName: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [kbName, setKbName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [chunkSize, setChunkSize] = useState(1000);
  const [chunkOverlap, setChunkOverlap] = useState(200);

  const [indexes, setIndexes] = useState<PineconeIndex[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [existingNs, setExistingNs] = useState<string[]>([]);

  // File browser state (DB-backed)
  const [libraryFilesList, setLibraryFilesList] = useState<LibraryFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  // Legacy fallback (vector-based scan for namespaces not in DB)
  const [legacyFiles, setLegacyFiles] = useState<{ name: string; chunks: number }[]>([]);
  const [isLegacy, setIsLegacy] = useState(false);

  const [preview, setPreview] = useState<ChunkPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<number | null>(null);

  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState({ current: 0, total: 0, fileName: '' });
  const [indexResult, setIndexResult] = useState<BulkIndexResult | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listPineconeIndexes().then(r => {
      setIndexes(r.indexes);
      setSelectedIndex(r.activeIndex || (r.indexes[0]?.name ?? ''));
    }).catch(() => {});
    getIndexStats().then(s => {
      const names = s.namespaces.map(n => n.name);
      setExistingNs(names);
      if (names.length > 0) setKbName(names[0]);
    }).catch(() => {});
  }, [agentName]);

  // Load files — try DB first, fall back to vector scan for legacy
  const loadFiles = useCallback(async (ns: string) => {
    if (!ns) return;
    setFilesLoading(true);
    setIsLegacy(false);
    setLegacyFiles([]);
    setLibraryFilesList([]);

    // Try DB first
    let dbFiles: LibraryFile[] = [];
    try {
      const result = await getLibraryFiles(ns);
      dbFiles = result.files;
    } catch { /* DB not available or endpoint not found */ }

    if (dbFiles.length > 0) {
      setLibraryFilesList(dbFiles);
      setFilesLoading(false);
      return;
    }

    // No DB records — try vector scan (legacy/fallback)
    try {
      const vectors = await listVectors(ns, undefined, 200);
      if (vectors.vectors.length > 0) {
        const groups: Record<string, { name: string; chunks: number }> = {};
        for (const v of vectors.vectors) {
          const meta = v.metadata as Record<string, any>;
          const name = meta?.fileName || meta?.source || meta?.sourceArticle || 'unknown';
          if (!groups[name]) groups[name] = { name, chunks: 0 };
          groups[name].chunks++;
        }
        setLegacyFiles(Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)));
        setIsLegacy(true);
      }
    } catch { /* Pinecone not available */ }

    setFilesLoading(false);
  }, []);

  useEffect(() => { loadFiles(kbName); }, [kbName, loadFiles]);

  const handleIndexChange = useCallback(async (name: string) => {
    setSelectedIndex(name);
    // Clear current state immediately
    setLibraryFilesList([]);
    setLegacyFiles([]);
    setIsLegacy(false);
    try { await activatePineconeIndex(name); } catch {}
    try {
      const s = await getIndexStats();
      const names = s.namespaces.map(n => n.name);
      setExistingNs(names);
      if (names.length > 0) {
        setKbName(names[0]);
      } else {
        setKbName('');
      }
    } catch {
      setExistingNs([]);
      setKbName('');
    }
  }, []);

  const handleDeleteFile = useCallback(async (fileId: number) => {
    if (!confirm('Remove this file from the library?')) return;
    try {
      await deleteLibraryFile(fileId);
      loadFiles(kbName);
    } catch (err: any) {
      setError(err.message);
    }
  }, [kbName, loadFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    setIndexResult(null);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
      setIndexResult(null);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (files.length === 0) return;
    setPreviewLoading(true);
    setError('');
    try {
      const result = await previewChunks(files[0], chunkSize, chunkOverlap);
      setPreview(result);
      setSelectedChunk(null);
    } catch (err: any) { setError(err.message); }
    finally { setPreviewLoading(false); }
  }, [files, chunkSize, chunkOverlap]);

  const handleIndex = useCallback(async () => {
    if (files.length === 0 || !kbName) return;
    setIndexing(true);
    setError('');
    setIndexResult(null);
    try {
      const result = await indexBulk(files, kbName, 0, chunkSize, chunkOverlap,
        (current, total, fileName) => setIndexProgress({ current, total, fileName })
      );
      setIndexResult(result);
      setFiles([]);
      getIndexStats().then(s => setExistingNs(s.namespaces.map(n => n.name))).catch(() => {});
      loadFiles(kbName);
    } catch (err: any) { setError(err.message); }
    finally { setIndexing(false); }
  }, [files, kbName, chunkSize, chunkOverlap, loadFiles]);

  const fileIcon = (type: string | null) => {
    const t = (type || '').toLowerCase();
    if (t === 'pdf') return { icon: 'PDF', color: '#ef4444' };
    if (t === 'docx' || t === 'doc') return { icon: 'DOC', color: '#2563eb' };
    if (t === 'xlsx' || t === 'xls' || t === 'csv') return { icon: 'XLS', color: '#10b981' };
    if (t === 'md') return { icon: 'MD', color: '#8b5cf6' };
    if (t === 'txt') return { icon: 'TXT', color: '#64748b' };
    return { icon: 'FILE', color: '#94a3b8' };
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const totalFiles = libraryFilesList.length || legacyFiles.length;

  return (
    <>
      {/* Top bar: index + KB selector */}
      <div className={styles.card} style={{ paddingBottom: '12px' }}>
        <div className={styles.settingsRow} style={{ marginBottom: 0 }}>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Index</label>
            <select className={styles.settingInput} value={selectedIndex} onChange={e => handleIndexChange(e.target.value)} style={{ width: '180px' }}>
              {indexes.map(idx => <option key={idx.name} value={idx.name}>{idx.name} ({idx.dimension}d)</option>)}
              {indexes.length === 0 && <option value="">No indexes</option>}
            </select>
          </div>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Knowledge Base</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select className={styles.settingInput} value={kbName} onChange={e => setKbName(e.target.value)} style={{ width: '200px' }}>
                {existingNs.map(ns => <option key={ns} value={ns}>{ns}</option>)}
              </select>
              <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`} onClick={() => { setNewKbName(''); setShowCreateModal(true); }} style={{ whiteSpace: 'nowrap' }}>+ New</button>
            </div>
          </div>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Chunk Size <span className={styles.helpWrap}>?<span className={styles.helpTip}>Each file is split into smaller pieces for search. This sets the max size of each piece in characters. Smaller = more precise, larger = more context.</span></span></label>
            <input type="number" className={styles.settingInput} value={chunkSize} onChange={e => setChunkSize(e.target.value === '' ? 0 : parseInt(e.target.value))} min="100" max="4000" step="100" />
          </div>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Overlap <span className={styles.helpWrap}>?<span className={styles.helpTip}>How many characters are shared between adjacent chunks. Prevents information from being cut off at boundaries. Value is in characters, same unit as Chunk Size.</span></span></label>
            <input type="number" className={styles.settingInput} value={chunkOverlap} onChange={e => setChunkOverlap(e.target.value === '' ? 0 : parseInt(e.target.value))} min="0" max="1000" step="50" />
          </div>
        </div>
      </div>

      {/* Side by side: Upload (left) + File Browser (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--spacing-md)' }}>
        {/* LEFT: Upload area */}
        <div className={styles.card}>
          <h3 className={styles.cardTitle} style={{ marginBottom: '12px' }}>Upload</h3>

          <div
            className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{ padding: '24px 16px' }}
          >
            <div className={styles.dropIcon}>+</div>
            <div className={styles.dropText}>Drop files or click to browse</div>
            <div className={styles.dropHint}>PDF, DOCX, XLSX, CSV, TXT, MD</div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.html" onChange={handleFileSelect} style={{ display: 'none' }} />
          </div>

          {files.length > 0 && (
            <>
              <div className={styles.fileTagList}>
                {files.map((file, i) => (
                  <span key={i} className={styles.fileTag}>
                    {file.name} ({(file.size / 1024).toFixed(0)}KB)
                    <span className={styles.fileTagRemove} onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>x</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleIndex} disabled={indexing || !kbName}>
                  {indexing ? <span className={styles.spinner} /> : null}
                  Upload {files.length} file{files.length > 1 ? 's' : ''}
                </button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePreview} disabled={previewLoading}>
                  {previewLoading ? <span className={`${styles.spinner} ${styles.spinnerDark}`} /> : null}
                  Preview
                </button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => { setFiles([]); setPreview(null); setIndexResult(null); }}>
                  Clear
                </button>
              </div>
            </>
          )}

          {/* Progress */}
          {indexing && (
            <div style={{ marginTop: '16px' }}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${indexProgress.total > 0 ? (indexProgress.current / indexProgress.total) * 100 : 0}%` }} />
              </div>
              <div className={styles.progressText}>{indexProgress.current} / {indexProgress.total} — {indexProgress.fileName}</div>
            </div>
          )}

          {/* Result summary */}
          {indexResult && (
            <div style={{ marginTop: '16px' }}>
              <div className={styles.statsBar} style={{ padding: '10px 14px' }}>
                <div className={styles.stat}><div className={styles.statValue}>{indexResult.successCount}</div><div className={styles.statLabel}>Uploaded</div></div>
                {indexResult.failedCount > 0 && <div className={styles.stat}><div className={styles.statValue} style={{ color: 'var(--error-color)' }}>{indexResult.failedCount}</div><div className={styles.statLabel}>Failed</div></div>}
                <div className={styles.stat}><div className={styles.statValue}>{indexResult.totalVectors.toLocaleString()}</div><div className={styles.statLabel}>Chunks</div></div>
                <div className={styles.stat}><div className={styles.statValue}>${indexResult.totalEmbeddingCost.toFixed(4)}</div><div className={styles.statLabel}>Cost</div></div>
              </div>
            </div>
          )}

          {error && <div style={{ color: 'var(--error-color)', marginTop: '12px', fontSize: '13px' }}>Error: {error}</div>}
        </div>

        {/* RIGHT: File Browser */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
          <div className={styles.cardHeader} style={{ marginBottom: '8px' }}>
            <div>
              <h3 className={styles.cardTitle}>Files</h3>
              <p className={styles.cardSubtitle}>
                {filesLoading ? 'Loading...' : `${totalFiles} file${totalFiles !== 1 ? 's' : ''}`}
                {isLegacy && ' (legacy — not tracked in database)'}
              </p>
            </div>
            <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => loadFiles(kbName)} disabled={filesLoading}>
              {filesLoading ? <span className={`${styles.spinner} ${styles.spinnerDark}`} /> : null}
              Refresh
            </button>
          </div>

          {isLegacy && (
            <div style={{
              padding: '8px 12px', marginBottom: '8px',
              background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--text-secondary)',
            }}>
              These files were imported before the Library was set up. File list is approximate (based on vector scan). Re-upload files to get full tracking.
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '500px' }}>
            {/* DB-tracked files */}
            {libraryFilesList.length > 0 && (
              <div className={styles.fileList}>
                {libraryFilesList.map(f => {
                  const fi = fileIcon(f.fileType);
                  return (
                    <div key={f.id} className={styles.fileItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: 5,
                          background: `${fi.color}15`, color: fi.color,
                          fontSize: '8px', fontWeight: 800, letterSpacing: '0.3px', flexShrink: 0,
                        }}>{fi.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.fileName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                            {f.fileSize ? <span>{formatSize(f.fileSize)}</span> : null}
                            <span>{f.chunkCount} chunks</span>
                            <span>{formatDate(f.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        className={`${styles.btn} ${styles.btnDanger} ${styles.btnSmall}`}
                        onClick={() => handleDeleteFile(f.id)}
                        style={{ flexShrink: 0 }}
                      >Delete</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legacy files (vector scan) */}
            {legacyFiles.length > 0 && (
              <div className={styles.fileList}>
                {legacyFiles.map((f, i) => {
                  const name = f.name.split('/').pop() || f.name;
                  const ext = name.split('.').pop() || '';
                  const fi = fileIcon(ext);
                  return (
                    <div key={i} className={styles.fileItem}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 26, height: 26, borderRadius: 5,
                          background: `${fi.color}15`, color: fi.color,
                          fontSize: '8px', fontWeight: 800, letterSpacing: '0.3px', flexShrink: 0,
                        }}>{fi.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className={styles.fileName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>~{f.chunks} chunks (approx.)</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty */}
            {!filesLoading && totalFiles === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyText}>No files yet</div>
                <div className={styles.emptyHint}>Upload files to start building this knowledge base</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chunk preview (full width below) */}
      {preview && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>Preview: {preview.fileName}</h3>
              <p className={styles.cardSubtitle}>{preview.stats.totalChunks} chunks | {preview.stats.totalCharacters.toLocaleString()} chars{preview.pages ? ` | ${preview.pages} pages` : ''}</p>
            </div>
          </div>
          <div className={styles.chunksContainer}>
            <div className={styles.extractedText}>
              {preview.extractedText.substring(0, 10000)}
              {preview.extractedText.length > 10000 && '\n\n... (truncated)'}
            </div>
            <div className={styles.chunksList}>
              {preview.chunks.map(chunk => (
                <div key={chunk.chunkIndex} className={`${styles.chunkItem} ${selectedChunk === chunk.chunkIndex ? styles.chunkItemActive : ''}`} onClick={() => setSelectedChunk(selectedChunk === chunk.chunkIndex ? null : chunk.chunkIndex)}>
                  <div className={styles.chunkHeader}>
                    <span className={styles.chunkIndex}>#{chunk.chunkIndex}</span>
                    <span className={styles.chunkTokens}>~{Math.ceil(chunk.text.length / 4)} tokens</span>
                  </div>
                  <div className={`${styles.chunkText} ${selectedChunk === chunk.chunkIndex ? styles.chunkTextFull : ''}`}>{chunk.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create KB Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowCreateModal(false)} />
          <div style={{ position: 'relative', background: 'var(--surface, #fff)', borderRadius: 'var(--radius-md)', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Knowledge Base</h3>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>Upload files to it after creation.</p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Name</label>
              <input type="text" className={styles.settingInput} value={newKbName} onChange={e => setNewKbName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))} placeholder="e.g. freeda-medical" style={{ width: '100%' }} autoFocus onKeyDown={e => { if (e.key === 'Enter' && newKbName.trim()) { setExistingNs(prev => prev.includes(newKbName) ? prev : [...prev, newKbName]); setKbName(newKbName); setShowCreateModal(false); } }} />
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Lowercase letters, numbers, hyphens, and underscores only.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={!newKbName.trim()} onClick={() => { setExistingNs(prev => prev.includes(newKbName) ? prev : [...prev, newKbName]); setKbName(newKbName); setShowCreateModal(false); }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH TAB
// ═══════════════════════════════════════════════════════════════════════════════

function QueryTab() {
  const [namespaces, setNamespaces] = useState('__default__');
  const [queryText, setQueryText] = useState('');
  const [topK, setTopK] = useState(5);
  const [scoreThreshold, setScoreThreshold] = useState(0.0);
  const [maxTokens, setMaxTokens] = useState(3000);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  // Load available namespaces for suggestions
  const [availableNs, setAvailableNs] = useState<string[]>([]);
  useEffect(() => {
    getIndexStats().then(s => setAvailableNs(s.namespaces.map(n => n.name))).catch(() => {});
  }, []);

  const handleQuery = useCallback(async () => {
    if (!queryText.trim() || !namespaces.trim()) return;
    setLoading(true);
    setError('');
    try {
      const nsList = namespaces.split(',').map(s => s.trim()).filter(Boolean);
      const r = await queryPinecone(nsList, queryText, topK, scoreThreshold, maxTokens);
      setResult(r);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [namespaces, queryText, topK, scoreThreshold, maxTokens]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleQuery();
    }
  }, [handleQuery]);

  const getScoreClass = (score: number) => {
    if (score >= 0.7) return styles.scoreHigh;
    if (score >= 0.4) return styles.scoreMedium;
    return styles.scoreLow;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.7) return '#10b981';
    if (score >= 0.4) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Search</h3>
            <p className={styles.cardSubtitle}>Test how your knowledge base responds to questions.</p>
          </div>
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>Knowledge Base</label>
            <select
              className={styles.settingInput}
              value={namespaces}
              onChange={e => setNamespaces(e.target.value)}
              style={{ width: '200px' }}
            >
              {availableNs.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
              {availableNs.length === 0 && <option value="">No namespaces</option>}
            </select>
          </div>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Results
              <span className={styles.helpWrap}>?<span className={styles.helpTip}>How many matching text chunks to return. More = broader coverage but slower.</span></span>
            </label>
            <input
              type="number"
              className={styles.settingInput}
              value={topK}
              onChange={e => setTopK(e.target.value === '' ? 0 : parseInt(e.target.value))}
              min="1"
              max="20"
              style={{ width: '80px' }}
            />
          </div>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Min Score
              <span className={styles.helpWrap}>?<span className={styles.helpTip}>Only show results above this relevance score. Scale: 0 to 1, where 1 = perfect match. Set to 0 to see everything.</span></span>
            </label>
            <input
              type="number"
              className={styles.settingInput}
              value={scoreThreshold}
              onChange={e => setScoreThreshold(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              min="0"
              max="1"
              step="0.05"
              style={{ width: '80px' }}
            />
          </div>
          <div className={styles.settingGroup}>
            <label className={styles.settingLabel}>
              Max Length
              <span className={styles.helpWrap}>?<span className={styles.helpTip}>Max total text to include, measured in tokens. 1 token is roughly 4 characters or 3/4 of a word. 3000 tokens is about 4 pages.</span></span>
            </label>
            <input
              type="number"
              className={styles.settingInput}
              value={maxTokens}
              onChange={e => setMaxTokens(e.target.value === '' ? 0 : parseInt(e.target.value))}
              min="500"
              max="10000"
              step="500"
              style={{ width: '100px' }}
            />
          </div>
        </div>

        <textarea
          className={styles.queryInput}
          value={queryText}
          onChange={e => setQueryText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your query here... (Ctrl+Enter to search)"
        />

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleQuery}
            disabled={loading || !queryText.trim() || !namespaces.trim()}
          >
            {loading ? <span className={styles.spinner} /> : null}
            Search
          </button>
          {result && (
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => setShowPrompt(!showPrompt)}
            >
              {showPrompt ? 'Hide' : 'Show'} Prompt Preview
            </button>
          )}
        </div>

        {error && <div style={{ color: 'var(--error-color)', marginTop: '12px', fontSize: '14px' }}>Error: {error}</div>}
      </div>

      {/* Results */}
      {result && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>Results</h3>
          </div>

          <div className={styles.statsBar}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{result.results.length}</div>
              <div className={styles.statLabel}>Matches</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{result.queryTimeMs}ms</div>
              <div className={styles.statLabel}>Query Time</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{result.tokensUsed.toLocaleString()}</div>
              <div className={styles.statLabel}>Tokens Used</div>
            </div>
          </div>

          {result.results.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyText}>No results found</div>
              <div className={styles.emptyHint}>Try lowering the score threshold or using different query terms</div>
            </div>
          )}

          {result.results.map((r, i) => (
            <div key={i} className={styles.resultItem}>
              <div className={styles.resultHeader}>
                <div>
                  <span className={styles.resultFileName}>{r.fileName}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginLeft: '8px' }}>
                    Chunk #{r.chunkIndex}
                  </span>
                </div>
                <span className={`${styles.resultScore} ${getScoreClass(r.score)}`}>
                  {(r.score * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.resultText}>{r.text}</div>
              <div className={styles.scoreBar}>
                <div
                  className={styles.scoreBarFill}
                  style={{ width: `${r.score * 100}%`, background: getScoreColor(r.score) }}
                />
              </div>
            </div>
          ))}

          {/* Prompt preview */}
          {showPrompt && result.formattedPrompt && (
            <>
              <h4 style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Prompt that would be injected into the LLM
              </h4>
              <div className={styles.promptPreview}>
                {result.formattedPrompt}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
