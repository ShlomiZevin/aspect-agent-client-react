import { useState } from 'react';
import { useAgentConfig } from '../../../context';
import { useKnowledgeBase } from '../../../hooks';
import { formatBytes } from '../../../utils';
import { Button, Modal } from '../../common';
import styles from './KBManager.module.css';

export function KBManager() {
  const config = useAgentConfig();
  const {
    knowledgeBases,
    selectedKB,
    files,
    isLoading,
    isUploading,
    error,
    selectKnowledgeBase,
    createKnowledgeBase,
    uploadFiles,
    deleteFile,
    clearError,
  } = useKnowledgeBase(config.agentName, config.baseURL);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newKBName, setNewKBName] = useState('');
  const [newKBDescription, setNewKBDescription] = useState('');
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  const handleCreateKB = async () => {
    if (!newKBName.trim()) return;
    try {
      await createKnowledgeBase(newKBName.trim(), newKBDescription.trim());
      setShowCreateModal(false);
      setNewKBName('');
      setNewKBDescription('');
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
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFilesToUpload(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFilesToUpload(prev => [...prev, ...selected]);
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
              <div className={styles.loading}>Loading...</div>
            ) : knowledgeBases.length === 0 ? (
              <div className={styles.empty}>No knowledge bases yet</div>
            ) : (
              knowledgeBases.map(kb => (
                <div
                  key={kb.id}
                  className={`${styles.kbCard} ${selectedKB?.id === kb.id ? styles.active : ''}`}
                  onClick={() => selectKnowledgeBase(kb)}
                >
                  <div className={styles.kbName}>{kb.name}</div>
                  <div className={styles.kbMeta}>
                    {kb.fileCount} files • {formatBytes(kb.totalSize)}
                  </div>
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
                </div>
                <Button onClick={() => setShowUploadModal(true)}>
                  Upload Files
                </Button>
              </div>

              <div className={styles.fileList}>
                {files.length === 0 ? (
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
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => deleteFile(file.id)}
                            >
                              Delete
                            </Button>
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
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKB} disabled={!newKBName.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setFilesToUpload([]);
        }}
        title="Upload Files"
        size="md"
      >
        <div className={styles.form}>
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

          <div className={styles.actions}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowUploadModal(false);
                setFilesToUpload([]);
              }}
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
    </div>
  );
}
