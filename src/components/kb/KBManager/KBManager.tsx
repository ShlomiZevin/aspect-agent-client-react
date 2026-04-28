import { useState, useRef } from 'react';
import { useAgentConfig } from '../../../context';
import { useKnowledgeBase } from '../../../hooks';
import { formatBytes } from '../../../utils';
import { Button, Modal } from '../../common';
// SyncKBModal no longer used — sync is inline per provider
import { downloadFile, getProviderFiles, deleteProviderFile, previewFile } from '../../../services/kbService';
import type { ProviderFile, ProviderFilesResponse } from '../../../services/kbService';
import * as dynamicKBService from '../../../services/dynamicKBService';
import type { DynamicFile } from '../../../types/dynamicKB';
import type { KBProviderName } from '../../../types';
import styles from './KBManager.module.css';

const PROVIDER_LABELS: Record<KBProviderName, string> = {
  openai: 'OpenAI',
  google: 'Gemini',
  anthropic: 'Anthropic',
};

const PROVIDER_HINTS: Record<KBProviderName, string> = {
  openai: 'Uses OpenAI vector stores for semantic search',
  google: 'Uses Google File Search (free storage)',
  anthropic: 'Files injected as document blocks into Claude context (no semantic search)',
};

const ALL_PROVIDERS: KBProviderName[] = ['openai', 'google', 'anthropic'];

export function KBManager() {
  const config = useAgentConfig();
  const {
    knowledgeBases,
    selectedKB,
    files,
    isLoading,
    isUploading,
    isSyncing,
    uploadProgress,
    error,
    selectKnowledgeBase,
    createKnowledgeBase,
    renameKnowledgeBase,
    uploadFiles,
    deleteFile,
    deleteKnowledgeBase,
    syncKnowledgeBase,
    detachProvider,
    clearError,
  } = useKnowledgeBase(config.agentName, config.baseURL);

  const [editingKBId, setEditingKBId] = useState<number | null>(null);
  const [editingKBLocation, setEditingKBLocation] = useState<'sidebar' | 'header' | null>(null);
  const [editingKBName, setEditingKBName] = useState('');
  const justOpenedRef = useRef(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDeleteKBId, setConfirmDeleteKBId] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [newKBProviders, setNewKBProviders] = useState<KBProviderName[]>(['openai']);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncSelectedProviders, setSyncSelectedProviders] = useState<KBProviderName[]>([]);
  const [showAttachDynamic, setShowAttachDynamic] = useState(false);
  const [dynamicFiles, setDynamicFiles] = useState<DynamicFile[]>([]);
  const [attachingFileId, setAttachingFileId] = useState<number | null>(null);
  const [showProviderView, setShowProviderView] = useState(false);
  const [providerFiles, setProviderFiles] = useState<ProviderFilesResponse | null>(null);
  const [loadingProviderFiles, setLoadingProviderFiles] = useState(false);
  const [deletingProviderFileId, setDeletingProviderFileId] = useState<string | null>(null);
  const [deletingDBFileId, setDeletingDBFileId] = useState<number | string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState<string | number | null>(null);

  const handleDeleteProviderFile = async (provider: 'openai' | 'google' | 'anthropic', fileId: string, fileName: string) => {
    if (!selectedKB) return;
    if (!confirm(`Delete "${fileName}" directly from ${provider}? This only removes it from the provider, not from the DB.`)) return;
    try {
      setDeletingProviderFileId(fileId);
      await deleteProviderFile(selectedKB.id, provider, fileId, config.baseURL);
      // Refresh provider view
      const data = await getProviderFiles(selectedKB.id, config.baseURL);
      setProviderFiles(data);
    } catch (err) {
      console.error('Delete from provider failed:', err);
    } finally {
      setDeletingProviderFileId(null);
    }
  };

  const handleStartRename = (kb: { id: number; name: string }, location: 'sidebar' | 'header', e: React.MouseEvent) => {
    e.stopPropagation();
    justOpenedRef.current = true;
    setEditingKBId(kb.id);
    setEditingKBLocation(location);
    setEditingKBName(kb.name);
    setTimeout(() => { justOpenedRef.current = false; }, 300);
  };

  const handleSaveRename = async (kbId: number) => {
    const trimmed = editingKBName.trim();
    if (trimmed) await renameKnowledgeBase(kbId, trimmed);
    setEditingKBId(null);
    setEditingKBLocation(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, kbId: number) => {
    if (e.key === 'Enter') handleSaveRename(kbId);
    if (e.key === 'Escape') { setEditingKBId(null); setEditingKBLocation(null); }
  };

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return;
    try {
      await createKnowledgeBase(newKBName.trim(), newKBDescription.trim(), newKBProviders);
      setShowCreateModal(false);
      setNewKBName('');
      setNewKBDescription('');
      setNewKBProviders(['openai']);
    } catch {
      // Error handled by hook
    }
  };

  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    await uploadFiles(filesToUpload);
    setFilesToUpload([]);
    setShowUploadModal(false);
  };


  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setFilesToUpload(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilesToUpload(prev => [...prev, ...Array.from(e.target.files || [])]);
  };

  const removeFileFromUpload = (index: number) => {
    setFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('csv') || type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('json')) return '🔧';
    if (type.includes('text')) return '📃';
    return '📎';
  };

  // Determine which providers the selected KB doesn't have yet
  const missingProviders: KBProviderName[] = selectedKB
    ? ALL_PROVIDERS.filter(p => !selectedKB.providers.includes(p))
    : [];

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          <span>{error}</span>
          <button onClick={clearError}>×</button>
        </div>
      )}

      <div className={styles.layout}>
        {/* KB List Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>Knowledge Bases</h2>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              + New
            </Button>
          </div>

          <div className={styles.kbList}>
            {isLoading && knowledgeBases.length === 0 ? (
              <div className={styles.loading}>
                <span className={styles.spinner} />
                Loading...
              </div>
            ) : knowledgeBases.length === 0 ? (
              <div className={styles.empty}>No knowledge bases yet</div>
            ) : (
              knowledgeBases.map(kb => (
                <div
                  key={kb.id}
                  className={`${styles.kbCard} ${selectedKB?.id === kb.id ? styles.active : ''}`}
                  onClick={() => selectKnowledgeBase(kb)}
                >
                  <div className={styles.kbName}>
                    {editingKBId === kb.id && editingKBLocation === 'sidebar' ? (
                      <input
                        autoFocus
                        value={editingKBName}
                        onChange={e => setEditingKBName(e.target.value)}
                        onKeyDown={e => handleRenameKeyDown(e, kb.id)}
                        onBlur={() => { if (!justOpenedRef.current) handleSaveRename(kb.id); }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '100%', fontSize: 'inherit', fontWeight: 'inherit', padding: '0 2px', border: '1px solid var(--primary-color, #6d28d9)', borderRadius: '3px', outline: 'none' }}
                      />
                    ) : (
                      <span onDoubleClick={e => handleStartRename(kb, 'sidebar', e)} title="Double-click to rename">{kb.name}</span>
                    )}
                  </div>
                  <div className={styles.kbMeta}>
                    {kb.fileCount} files • {formatBytes(kb.totalSize)}
                  </div>
                  <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {kb.providers.map(p => (
                      <span key={p} className={styles.providerBadge} data-provider={p}>
                        {p === 'openai' ? 'OAI' : p === 'google' ? 'GEM' : 'CLA'}
                      </span>
                    ))}
                  </div>
                  <button
                    className={styles.deleteKBBtn}
                    onClick={e => { e.stopPropagation(); setConfirmDeleteKBId(kb.id); }}
                    title="Delete knowledge base"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className={styles.main}>
          {selectedKB ? (
            <>
              <div className={styles.mainHeader}>
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {editingKBId === selectedKB.id && editingKBLocation === 'header' ? (
                      <input
                        autoFocus
                        value={editingKBName}
                        onChange={e => setEditingKBName(e.target.value)}
                        onKeyDown={e => handleRenameKeyDown(e, selectedKB.id)}
                        onBlur={() => { if (!justOpenedRef.current) handleSaveRename(selectedKB.id); }}
                        style={{ fontSize: 'inherit', fontWeight: 'inherit', padding: '2px 6px', border: '1px solid var(--primary-color, #6d28d9)', borderRadius: '4px', outline: 'none', minWidth: '200px' }}
                      />
                    ) : (
                      <>
                        <span>{selectedKB.name}</span>
                        <button
                          onClick={e => handleStartRename(selectedKB, 'header', e)}
                          title="Rename"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px 4px', fontSize: '13px', lineHeight: 1 }}
                        >✎</button>
                      </>
                    )}
                  </h2>
                  {selectedKB.description && (
                    <p className={styles.description}>{selectedKB.description}</p>
                  )}
                  <div className={styles.kbIds}>
                    {selectedKB.vectorStoreId && (
                      <div className={styles.idRow}>
                        <span className={styles.idLabel}>OpenAI:</span>
                        <span className={styles.idValue} title={selectedKB.vectorStoreId}>
                          {selectedKB.vectorStoreId}
                        </span>
                        {selectedKB.providers.length > 1 && (
                          <button className={styles.detachBtn} onClick={() => detachProvider(selectedKB.id, 'openai')} disabled={isSyncing}>Detach</button>
                        )}
                      </div>
                    )}
                    {selectedKB.googleCorpusId && (
                      <div className={styles.idRow}>
                        <span className={styles.idLabel}>Google:</span>
                        <span className={styles.idValue} title={selectedKB.googleCorpusId}>
                          {selectedKB.googleCorpusId}
                        </span>
                        {selectedKB.providers.length > 1 && (
                          <button className={styles.detachBtn} onClick={() => detachProvider(selectedKB.id, 'google')} disabled={isSyncing}>Detach</button>
                        )}
                      </div>
                    )}
                    {selectedKB.providers.includes('anthropic') && (
                      <div className={styles.idRow}>
                        <span className={styles.idLabel}>Anthropic:</span>
                        <span className={styles.idValue}>Files API</span>
                        {selectedKB.providers.length > 1 && (
                          <button className={styles.detachBtn} onClick={() => detachProvider(selectedKB.id, 'anthropic')} disabled={isSyncing}>Detach</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.headerActions}>
                  {missingProviders.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowSyncModal(true)}
                      disabled={isSyncing}
                    >
                      + Sync to Provider
                    </Button>
                  )}
                  <Button onClick={() => setShowUploadModal(true)}>
                    Upload Files
                  </Button>
                  <Button variant="secondary" onClick={async () => {
                    try {
                      const files = await dynamicKBService.getFiles(config.agentName);
                      setDynamicFiles(files);
                      setShowAttachDynamic(true);
                    } catch (err) {
                      console.error('Failed to load dynamic files:', err);
                    }
                  }}>
                    Attach Dynamic File
                  </Button>
                </div>
              </div>

              <div className={styles.fileListHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {showProviderView && (
                    <button
                      disabled={loadingProviderFiles}
                      onClick={async () => {
                        if (!selectedKB) return;
                        setLoadingProviderFiles(true);
                        try {
                          const data = await getProviderFiles(selectedKB.id, config.baseURL);
                          setProviderFiles(data);
                        } catch (err) {
                          console.error('Failed to refresh provider files:', err);
                        } finally {
                          setLoadingProviderFiles(false);
                        }
                      }}
                      style={{
                        padding: '6px 10px', fontSize: '12px', fontWeight: 500, border: '1px solid var(--border, #e2e8f0)', borderRadius: '6px',
                        cursor: loadingProviderFiles ? 'wait' : 'pointer',
                        background: 'var(--surface, #fff)', color: 'var(--primary-color, #6d28d9)', display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                      title="Refresh provider data"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ animation: loadingProviderFiles ? 'spin 1s linear infinite' : 'none' }}>
                        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                      </svg>
                      Refresh
                    </button>
                  )}
                  <span className={styles.fileCount}>
                    {!isLoading && files.length > 0 && !showProviderView ? `${files.length} files` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', background: 'var(--surface-light, #f1f5f9)', borderRadius: '8px', padding: '3px' }}>
                  <button
                    onClick={() => setShowProviderView(false)}
                    style={{
                      padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: 'none', borderRadius: '6px', cursor: 'pointer',
                      background: !showProviderView ? 'var(--primary-color, #6d28d9)' : 'transparent',
                      color: !showProviderView ? '#fff' : 'var(--text-muted, #64748b)',
                    }}
                  >
                    DB View
                  </button>
                  <button
                    onClick={async () => {
                      if (!showProviderView && selectedKB) {
                        setShowProviderView(true);
                        setLoadingProviderFiles(true);
                        try {
                          const data = await getProviderFiles(selectedKB.id, config.baseURL);
                          setProviderFiles(data);
                        } catch (err) {
                          console.error('Failed to load provider files:', err);
                        } finally {
                          setLoadingProviderFiles(false);
                        }
                      } else {
                        setShowProviderView(true);
                      }
                    }}
                    style={{
                      padding: '6px 14px', fontSize: '12px', fontWeight: 500, border: 'none', borderRadius: '6px', cursor: 'pointer',
                      background: showProviderView ? 'var(--primary-color, #6d28d9)' : 'transparent',
                      color: showProviderView ? '#fff' : 'var(--text-muted, #64748b)',
                    }}
                  >
                    Provider View
                  </button>
                </div>
              </div>

              {showProviderView && (
                <div style={{ padding: '4px 0 0', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Deletions may take a few seconds to reflect on the provider side.
                </div>
              )}

              {showProviderView ? (
                <div className={styles.fileList}>
                  {loadingProviderFiles ? (
                    <div className={styles.filesLoading}>
                      <span className={styles.filesSpinner} />
                      <span>Loading from providers...</span>
                    </div>
                  ) : !providerFiles ? (
                    <div className={styles.emptyFiles}><p>No provider data</p></div>
                  ) : (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {providerFiles.openai && (
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>
                            OpenAI Vector Store
                            {Array.isArray(providerFiles.openai) && <span style={{ fontWeight: 400, color: '#64748b' }}> — {providerFiles.openai.length} files</span>}
                          </h4>
                          {'error' in providerFiles.openai ? (
                            <p style={{ color: '#dc2626', fontSize: '12px' }}>{(providerFiles.openai as { error: string }).error}</p>
                          ) : (
                            <table className={styles.table}>
                              <thead><tr><th>File Name</th><th>Size</th><th>Status</th><th>Actions</th></tr></thead>
                              <tbody>
                                {(providerFiles.openai as ProviderFile[]).map(f => (
                                  <tr key={f.id}>
                                    <td style={{ fontSize: '12px' }}>{f.fileName}</td>
                                    <td style={{ fontSize: '12px' }}>{f.fileSize ? formatBytes(f.fileSize) : '—'}</td>
                                    <td style={{ fontSize: '12px' }}>{f.status || '—'}</td>
                                    <td>
                                      <Button variant="danger" size="sm"
                                        disabled={deletingProviderFileId === f.id}
                                        isLoading={deletingProviderFileId === f.id}
                                        onClick={() => handleDeleteProviderFile('openai', f.id, f.fileName || f.id)}
                                      >Delete</Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                      {providerFiles.google && (
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>
                            Google File Search
                            {Array.isArray(providerFiles.google) && <span style={{ fontWeight: 400, color: '#64748b' }}> — {providerFiles.google.length} files</span>}
                          </h4>
                          {'error' in providerFiles.google ? (
                            <p style={{ color: '#dc2626', fontSize: '12px' }}>{(providerFiles.google as { error: string }).error}</p>
                          ) : (
                            <table className={styles.table}>
                              <thead><tr><th>Display Name</th><th>Size</th><th>State</th><th>Created</th><th>Actions</th></tr></thead>
                              <tbody>
                                {(providerFiles.google as ProviderFile[]).map(f => (
                                  <tr key={f.id}>
                                    <td style={{ fontSize: '12px' }}>{f.displayName || f.id}</td>
                                    <td style={{ fontSize: '12px' }}>{(f as any).sizeBytes ? formatBytes(Number((f as any).sizeBytes)) : '—'}</td>
                                    <td style={{ fontSize: '12px' }}>{(f as any).state?.replace('STATE_', '') || '—'}</td>
                                    <td style={{ fontSize: '12px' }}>{f.createTime ? new Date(f.createTime).toLocaleDateString() : '—'}</td>
                                    <td>
                                      <Button variant="danger" size="sm"
                                        disabled={deletingProviderFileId === f.id}
                                        isLoading={deletingProviderFileId === f.id}
                                        onClick={() => handleDeleteProviderFile('google', f.id, f.displayName || f.id)}
                                      >Delete</Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                      {providerFiles.anthropic && (
                        <div>
                          <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: '#1e293b' }}>
                            Anthropic Files
                            {Array.isArray(providerFiles.anthropic) && <span style={{ fontWeight: 400, color: '#64748b' }}> — {providerFiles.anthropic.length} files</span>}
                          </h4>
                          {'error' in providerFiles.anthropic ? (
                            <p style={{ color: '#dc2626', fontSize: '12px' }}>{(providerFiles.anthropic as { error: string }).error}</p>
                          ) : (
                            <table className={styles.table}>
                              <thead><tr><th>File Name</th><th>File ID</th><th>Actions</th></tr></thead>
                              <tbody>
                                {(providerFiles.anthropic as ProviderFile[]).map(f => (
                                  <tr key={f.id}>
                                    <td style={{ fontSize: '12px' }}>{f.fileName}</td>
                                    <td style={{ fontSize: '12px', fontFamily: 'monospace' }}>{f.id}</td>
                                    <td>
                                      <Button variant="danger" size="sm"
                                        disabled={deletingProviderFileId === f.id}
                                        isLoading={deletingProviderFileId === f.id}
                                        onClick={() => handleDeleteProviderFile('anthropic', f.id, f.fileName || f.id)}
                                      >Delete</Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                      {!providerFiles.openai && !providerFiles.google && !providerFiles.anthropic && (
                        <p style={{ color: '#64748b', fontSize: '13px' }}>No provider data available</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
              <div className={styles.fileList}>
                {isLoading ? (
                  <div className={styles.filesLoading}>
                    <span className={styles.filesSpinner} />
                    <span>Loading files...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className={styles.emptyFiles}>
                    <p>No files in this knowledge base</p>
                    <Button variant="secondary" onClick={() => setShowUploadModal(true)}>
                      Upload your first file
                    </Button>
                  </div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {files.map(file => (
                        <tr key={file.id}>
                          <td>
                            <span className={styles.fileIcon}>{getFileIcon(file.type)}</span>
                            {file.name}
                          </td>
                          <td>{file.type}</td>
                          <td>{formatBytes(file.size)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {file.id !== null && file.originalFileUrl && !file.tags?.includes('dynamic-kb') && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => downloadFile(selectedKB!.id, file.id!, file.name, config.baseURL)}
                                >
                                  Download
                                </Button>
                              )}
                              {file.id !== null && file.tags?.includes('dynamic-kb') && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  isLoading={previewLoading === file.id}
                                  onClick={async () => {
                                    try {
                                      setPreviewLoading(file.id);
                                      const data = await previewFile(selectedKB!.id, file.id!, config.baseURL);
                                      setPreviewTitle(file.name);
                                      setPreviewContent(data.content);
                                    } catch {
                                      setPreviewTitle(file.name);
                                      setPreviewContent('Preview not available for this file.');
                                    } finally {
                                      setPreviewLoading(null);
                                    }
                                  }}
                                >
                                  Preview
                                </Button>
                              )}
                              <Button
                                variant="danger"
                                size="sm"
                                isLoading={deletingDBFileId === (file.id ?? file.openaiFileId)}
                                disabled={deletingDBFileId !== null || (file.id === null && !file.openaiFileId)}
                                onClick={async () => {
                                  const fileKey = file.id ?? file.openaiFileId ?? null;
                                  setDeletingDBFileId(fileKey);
                                  try {
                                    await deleteFile(file);
                                  } finally {
                                    setDeletingDBFileId(null);
                                  }
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              )}
            </>
          ) : (
            <div className={styles.noSelection}>
              <p>Select a knowledge base to view files</p>
            </div>
          )}
        </div>
      </div>

      {/* Create KB Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Knowledge Base"
        size="sm"
      >
        <div className={styles.form}>
          <div className={styles.field}>
            <label>Name</label>
            <input
              type="text"
              value={newKBName}
              onChange={(e) => setNewKBName(e.target.value)}
              placeholder="Enter knowledge base name"
            />
          </div>
          <div className={styles.field}>
            <label>Description (optional)</label>
            <textarea
              value={newKBDescription}
              onChange={(e) => setNewKBDescription(e.target.value)}
              placeholder="Enter description"
              rows={3}
            />
          </div>
          <div className={styles.field}>
            <label>Providers</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ALL_PROVIDERS.map(p => {
                const isChecked = newKBProviders.includes(p);
                return (
                  <label
                    key={p}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                      padding: '10px 12px', borderRadius: '8px',
                      border: `2px solid ${isChecked ? 'var(--primary-color, #6d28d9)' : 'var(--border, #e2e8f0)'}`,
                      background: isChecked ? 'rgba(109, 40, 217, 0.04)' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        if (e.target.checked) {
                          setNewKBProviders(prev => [...prev, p]);
                        } else {
                          setNewKBProviders(prev => prev.filter(x => x !== p));
                        }
                      }}
                      style={{ accentColor: 'var(--primary-color, #6d28d9)', width: '16px', height: '16px', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{PROVIDER_LABELS[p]}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{PROVIDER_HINTS[p]}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKB} disabled={!newKBName.trim() || newKBProviders.length === 0 || isLoading} isLoading={isLoading}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { if (!isUploading) { setShowUploadModal(false); setFilesToUpload([]); } }}
        title="Upload Files"
        size="md"
      >
        <div className={styles.form}>
          {isUploading && uploadProgress ? (
            <div className={styles.uploadProgress}>
              <div className={styles.progressSummary}>
                <span>
                  {uploadProgress.filter(f => f.status === 'done').length} of {uploadProgress.length} uploaded
                </span>
                <span className={styles.progressPercent}>
                  {Math.round((uploadProgress.filter(f => f.status === 'done').length / uploadProgress.length) * 100)}%
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${(uploadProgress.filter(f => f.status === 'done').length / uploadProgress.length) * 100}%` }}
                />
              </div>
              <div className={styles.progressList}>
                {uploadProgress.map((file, index) => (
                  <div key={index} className={`${styles.progressItem} ${styles[`status_${file.status}`]}`}>
                    <span className={styles.progressIcon}>
                      {file.status === 'done' && '✓'}
                      {file.status === 'error' && '✗'}
                      {file.status === 'uploading' && <span className={styles.spinner} />}
                      {file.status === 'pending' && '·'}
                    </span>
                    <span className={styles.progressName}>{file.name}</span>
                    {file.status === 'error' && (
                      <span className={styles.progressError}>{file.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div
                className={styles.dropzone}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className={styles.fileInput}
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p>Drop files here or click to browse</p>
                </label>
              </div>

              {filesToUpload.length > 0 && (
                <div className={styles.filePreview}>
                  {filesToUpload.map((file, index) => (
                    <div key={index} className={styles.previewItem}>
                      <span>{getFileIcon(file.type)} {file.name}</span>
                      <button onClick={() => removeFileFromUpload(index)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => { setShowUploadModal(false); setFilesToUpload([]); }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={filesToUpload.length === 0 || isUploading}
              isLoading={isUploading}
            >
              Upload {filesToUpload.length > 0 && `(${filesToUpload.length})`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sync to Provider Modal */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => { if (!isSyncing) { setShowSyncModal(false); setSyncSelectedProviders([]); } }}
        title="Sync to Providers"
        size="sm"
      >
        <div className={styles.form}>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>
            Select which providers to sync <strong>{selectedKB?.name}</strong> to.
            All existing files will be copied to the selected providers.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
            {missingProviders.map(p => {
              const isChecked = syncSelectedProviders.includes(p);
              return (
                <label
                  key={p}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                    padding: '10px 12px', borderRadius: '8px',
                    border: `2px solid ${isChecked ? 'var(--primary-color, #6d28d9)' : 'var(--border, #e2e8f0)'}`,
                    background: isChecked ? 'rgba(109, 40, 217, 0.04)' : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={e => {
                      if (e.target.checked) setSyncSelectedProviders(prev => [...prev, p]);
                      else setSyncSelectedProviders(prev => prev.filter(x => x !== p));
                    }}
                    style={{ accentColor: 'var(--primary-color, #6d28d9)', width: '16px', height: '16px', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{PROVIDER_LABELS[p]}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{PROVIDER_HINTS[p]}</div>
                  </div>
                </label>
              );
            })}
          </div>
          {selectedKB && (
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>
              {selectedKB.fileCount} file{selectedKB.fileCount !== 1 ? 's' : ''} will be synced to each selected provider.
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => { setShowSyncModal(false); setSyncSelectedProviders([]); }} disabled={isSyncing}>
              Cancel
            </Button>
            <Button
              disabled={syncSelectedProviders.length === 0 || isSyncing}
              isLoading={isSyncing}
              onClick={async () => {
                if (!selectedKB) return;
                for (const p of syncSelectedProviders) {
                  await syncKnowledgeBase(selectedKB.id, p);
                }
                setShowSyncModal(false);
                setSyncSelectedProviders([]);
              }}
            >
              Sync to {syncSelectedProviders.length > 0 ? syncSelectedProviders.map(p => PROVIDER_LABELS[p]).join(' + ') : '...'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete KB Modal */}
      <Modal
        isOpen={confirmDeleteKBId !== null}
        onClose={() => setConfirmDeleteKBId(null)}
        title="Delete Knowledge Base"
        size="sm"
      >
        <div className={styles.form}>
          <p>Are you sure you want to delete this knowledge base and all its files? This cannot be undone.</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setConfirmDeleteKBId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirmDeleteKBId !== null) {
                  await deleteKnowledgeBase(confirmDeleteKBId);
                  setConfirmDeleteKBId(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      {/* Attach Dynamic File Modal */}
      <Modal
        isOpen={showAttachDynamic}
        onClose={() => setShowAttachDynamic(false)}
        title="Attach Dynamic File"
        size="md"
      >
        <div className={styles.form}>
          {dynamicFiles.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
              No dynamic files found. Create one in the Dynamic KB page first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {dynamicFiles.map(df => {
                const alreadyAttached = files.some(f => f.name === `${df.name}.md` && f.tags?.includes('dynamic-kb'));
                return (
                  <div key={df.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    opacity: alreadyAttached ? 0.5 : 1,
                  }}>
                    <span style={{ fontSize: '18px' }}>{df.fileType === 'text' ? '📝' : '📊'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{df.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{df.fileType} · {df.fileSize} bytes</div>
                    </div>
                    {alreadyAttached ? (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Already attached</span>
                    ) : (
                      <Button
                        size="sm"
                        isLoading={attachingFileId === df.id}
                        disabled={attachingFileId !== null}
                        onClick={async () => {
                          if (!selectedKB) return;
                          try {
                            setAttachingFileId(df.id);
                            await dynamicKBService.attachToKB(df.id, selectedKB.id);
                            // Refresh file list
                            selectKnowledgeBase(selectedKB);
                            setShowAttachDynamic(false);
                          } catch (err) {
                            console.error('Attach failed:', err);
                          } finally {
                            setAttachingFileId(null);
                          }
                        }}
                      >
                        Attach
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className={styles.actions} style={{ marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setShowAttachDynamic(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
      {/* Preview Modal */}
      {previewContent !== null && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setPreviewContent(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: '12px', width: '700px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{previewTitle}</h3>
              <button onClick={() => setPreviewContent(null)} style={{ width: '28px', height: '28px', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', borderRadius: '4px' }}>×</button>
            </div>
            <pre style={{ flex: 1, overflow: 'auto', padding: '20px', margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", fontSize: '12px', lineHeight: 1.6, color: '#1e293b', background: '#f8fafc', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {previewContent}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <Button variant="secondary" size="sm" onClick={() => setPreviewContent(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
