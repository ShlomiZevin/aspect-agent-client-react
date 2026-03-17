import { useState } from 'react';
import { useAgentConfig } from '../../../context';
import { useKnowledgeBase } from '../../../hooks';
import { formatBytes } from '../../../utils';
import { Button, Modal } from '../../common';
import { SyncKBModal } from '../SyncKBModal';
import { downloadFile } from '../../../services/kbService';
import type { KBProvider } from '../../../types';
import styles from './KBManager.module.css';

const PROVIDER_LABELS: Record<KBProvider, string> = {
  openai: 'OpenAI',
  google: 'Gemini',
  both: 'Both',
};

const PROVIDER_HINTS: Record<KBProvider, string> = {
  openai: 'Uses OpenAI vector stores for semantic search',
  google: 'Uses Google File Search (free storage)',
  both: 'Creates on both OpenAI and Google simultaneously',
};

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
    uploadFiles,
    deleteFile,
    deleteKnowledgeBase,
    syncKnowledgeBase,
    detachProvider,
    clearError,
  } = useKnowledgeBase(config.agentName, config.baseURL);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDeleteKBId, setConfirmDeleteKBId] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [newKBProvider, setNewKBProvider] = useState<KBProvider>('openai');
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return;
    try {
      await createKnowledgeBase(newKBName.trim(), newKBDescription.trim(), newKBProvider);
      setShowCreateModal(false);
      setNewKBName('');
      setNewKBDescription('');
      setNewKBProvider('openai');
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

  const handleSync = async (targetProvider: KBProvider) => {
    if (!selectedKB) return;
    await syncKnowledgeBase(selectedKB.id, targetProvider);
    setShowSyncModal(false);
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

  // Determine which provider(s) the selected KB can still sync to
  const syncTargetProvider: KBProvider | null = selectedKB
    ? selectedKB.provider === 'openai' ? 'google'
    : selectedKB.provider === 'google' ? 'openai'
    : null // 'both' — already on all providers
    : null;

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
                  <div className={styles.kbCardHeader}>
                    <div className={styles.kbName}>{kb.name}</div>
                    <span
                      className={styles.providerBadge}
                      data-provider={kb.provider}
                    >
                      {PROVIDER_LABELS[kb.provider]}
                    </span>
                  </div>
                  <div className={styles.kbMeta}>
                    {kb.fileCount} files • {formatBytes(kb.totalSize)}
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
                  <h2>{selectedKB.name}</h2>
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
                        {selectedKB.provider === 'both' && (
                          <button
                            className={styles.detachBtn}
                            onClick={() => detachProvider(selectedKB.id, 'openai')}
                            disabled={isSyncing}
                            title="Detach OpenAI provider"
                          >
                            Detach
                          </button>
                        )}
                      </div>
                    )}
                    {selectedKB.googleCorpusId && (
                      <div className={styles.idRow}>
                        <span className={styles.idLabel}>Google:</span>
                        <span className={styles.idValue} title={selectedKB.googleCorpusId}>
                          {selectedKB.googleCorpusId}
                        </span>
                        {selectedKB.provider === 'both' && (
                          <button
                            className={styles.detachBtn}
                            onClick={() => detachProvider(selectedKB.id, 'google')}
                            disabled={isSyncing}
                            title="Detach Google provider"
                          >
                            Detach
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.headerActions}>
                  {syncTargetProvider && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowSyncModal(true)}
                      disabled={isSyncing}
                      isLoading={isSyncing}
                    >
                      Sync to {PROVIDER_LABELS[syncTargetProvider]}
                    </Button>
                  )}
                  <Button onClick={() => setShowUploadModal(true)}>
                    Upload Files
                  </Button>
                </div>
              </div>

              {!isLoading && files.length > 0 && (
                <div className={styles.fileListHeader}>
                  <span className={styles.fileCount}>{files.length} files</span>
                </div>
              )}
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
                              {file.id !== null && file.originalFileUrl && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => downloadFile(selectedKB!.id, file.id!, file.name, config.baseURL)}
                                >
                                  Download
                                </Button>
                              )}
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => deleteFile(file)}
                                disabled={file.id === null && !file.openaiFileId}
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
            <label>Provider</label>
            <select
              className={styles.providerSelect}
              value={newKBProvider}
              onChange={(e) => setNewKBProvider(e.target.value as KBProvider)}
            >
              <option value="openai">OpenAI</option>
              <option value="google">Google Gemini</option>
              <option value="both">Both (OpenAI + Google)</option>
            </select>
            <span className={styles.providerHint}>{PROVIDER_HINTS[newKBProvider]}</span>
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKB} disabled={!newKBName.trim() || isLoading} isLoading={isLoading}>
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

      {/* Sync Modal */}
      {selectedKB && syncTargetProvider && (
        <SyncKBModal
          isOpen={showSyncModal}
          sourceKB={selectedKB}
          targetProvider={syncTargetProvider}
          isSyncing={isSyncing}
          onSync={handleSync}
          onClose={() => setShowSyncModal(false)}
        />
      )}

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
    </div>
  );
}
