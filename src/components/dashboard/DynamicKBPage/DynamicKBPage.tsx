import { useEffect, useState } from 'react';
import { useAgentConfig } from '../../../context';
import { useDynamicKB } from '../../../hooks';
import type { DynamicFile, TableData } from '../../../types';
import { TextEditor } from './TextEditor';
import { TableEditor } from './TableEditor';
import { PreviewMDModal } from './PreviewMDModal';
import styles from './DynamicKBPage.module.css';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export function DynamicKBPage() {
  const config = useAgentConfig();
  const {
    files,
    selectedFile,
    content,
    attachments,
    isLoading,
    isSaving,
    isDirty,
    error,
    clearError,
    loadFiles,
    selectFile,
    createFile,
    updateFileName,
    deleteFile,
    saveContent,
    updateContent,
    importFromDoc,
    importFromSpreadsheet,
  } = useDynamicKB(config.agentName, config.baseURL);

  const [showNewModal, setShowNewModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'text' | 'table'>('text');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [saveResult, setSaveResult] = useState<{ synced: boolean; syncedKBs: string[] } | null>(null);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    setIsCreating(true);
    try {
      const file = await createFile(newFileName.trim(), newFileType);
      setShowNewModal(false);
      setNewFileName('');
      setNewFileType('text');
      await selectFile(file);
    } catch {
      // error shown via hook
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (file: DynamicFile) => {
    if (file.attachmentCount > 0 && deleteConfirmId !== file.id) {
      setDeleteConfirmId(file.id);
      return;
    }
    await deleteFile(file.id);
    setDeleteConfirmId(null);
  };

  const handleSave = async () => {
    if (!selectedFile || !isDirty) return;
    const result = await saveContent(content);
    if (result) setSaveResult(result);
    setTimeout(() => setSaveResult(null), 5000);
  };

  const handleImportDoc = async (file: File) => {
    setIsImporting(true);
    try { await importFromDoc(file); }
    finally { setIsImporting(false); }
  };

  const handleImportSpreadsheet = async (file: File) => {
    setIsImporting(true);
    try { await importFromSpreadsheet(file); }
    finally { setIsImporting(false); }
  };

  const handleStartRename = () => {
    if (!selectedFile) return;
    setEditedName(selectedFile.name);
    setIsEditingName(true);
  };

  const handleRename = async () => {
    if (!selectedFile || !editedName.trim()) return;
    await updateFileName(selectedFile.id, editedName.trim());
    setIsEditingName(false);
  };

  const attachmentCount = attachments.length;

  return (
    <div className={styles.page}>
      {/* ── Left sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Dynamic Files</h2>
          <button className={styles.newBtn} onClick={() => setShowNewModal(true)}>+ New</button>
        </div>

        {isLoading && <p className={styles.loadingText}>Loading...</p>}

        <ul className={styles.fileList}>
          {files.map(f => (
            <li
              key={f.id}
              className={`${styles.fileItem} ${selectedFile?.id === f.id ? styles.fileItemActive : ''}`}
              onClick={() => selectFile(f)}
            >
              <span className={styles.fileTypeIcon}>{f.fileType === 'table' ? '⊞' : '≡'}</span>
              <div className={styles.fileInfo}>
                <span className={styles.fileName}>{f.name}</span>
                <span className={styles.fileMeta}>
                  {formatDate(f.updatedAt)}
                  {f.attachmentCount > 0 && (
                    <span className={styles.attachBadge}>{f.attachmentCount} KB</span>
                  )}
                </span>
              </div>
              <button
                className={styles.deleteFileBtn}
                onClick={e => { e.stopPropagation(); handleDelete(f); }}
                title={deleteConfirmId === f.id ? 'Click again to confirm delete' : 'Delete file'}
              >
                {deleteConfirmId === f.id ? '!' : '×'}
              </button>
            </li>
          ))}
          {!isLoading && files.length === 0 && (
            <li className={styles.emptyState}>No files yet. Create one to get started.</li>
          )}
        </ul>
      </aside>

      {/* ── Right editor area ── */}
      <main className={styles.editor}>
        {!selectedFile ? (
          <div className={styles.emptyEditor}>
            <p>Select a file or create a new one</p>
          </div>
        ) : (
          <>
            {/* File header */}
            <div className={styles.editorHeader}>
              <div className={styles.editorTitle}>
                {isEditingName ? (
                  <div className={styles.renameRow}>
                    <input
                      className={styles.renameInput}
                      value={editedName}
                      onChange={e => setEditedName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsEditingName(false); }}
                      autoFocus
                    />
                    <button className={styles.renameSaveBtn} onClick={handleRename}>Save</button>
                    <button className={styles.renameCancelBtn} onClick={() => setIsEditingName(false)}>Cancel</button>
                  </div>
                ) : (
                  <div className={styles.titleRow}>
                    <h2 className={styles.fileTitle}>{selectedFile.name}</h2>
                    <button className={styles.renameBtn} onClick={handleStartRename} title="Rename">✎</button>
                    <span className={styles.fileTypeBadge}>{selectedFile.fileType}</span>
                    {isDirty && <span className={styles.dirtyDot} title="Unsaved changes">●</span>}
                  </div>
                )}
                <div className={styles.fileSizeInfo}>
                  {selectedFile.fileSize > 0 && <span>{formatBytes(selectedFile.fileSize)}</span>}
                  <span>Updated {formatDate(selectedFile.updatedAt)}</span>
                </div>
              </div>

              {/* Attachments */}
              {attachmentCount > 0 && (
                <div className={styles.attachmentsBar}>
                  <span className={styles.attachLabel}>Synced to:</span>
                  {attachments.map(a => (
                    <span key={a.id} className={styles.kbChip}>{a.kbName}</span>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div className={styles.actionBar}>
                <button
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                >
                  {isSaving
                    ? 'Saving...'
                    : attachmentCount > 0
                      ? `Save & Sync to ${attachmentCount} KB${attachmentCount > 1 ? 's' : ''}`
                      : 'Save'}
                </button>
                <button
                  className={styles.previewBtn}
                  onClick={() => setShowPreview(true)}
                >
                  Preview MD
                </button>
              </div>

              {/* Sync result */}
              {saveResult && (
                <div className={`${styles.syncResult} ${saveResult.synced ? styles.syncOk : ''}`}>
                  {saveResult.synced
                    ? `Synced to: ${saveResult.syncedKBs.join(', ')}`
                    : 'Saved (no KBs attached)'}
                </div>
              )}
            </div>

            {/* Editor body */}
            <div className={styles.editorBody}>
              {selectedFile.fileType === 'text' ? (
                <TextEditor
                  value={content as string}
                  onChange={updateContent}
                  onImport={handleImportDoc}
                  isImporting={isImporting}
                />
              ) : (
                <TableEditor
                  value={(content as TableData) || { headers: [], rows: [] }}
                  onChange={updateContent}
                  onImport={handleImportSpreadsheet}
                  isImporting={isImporting}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Error banner */}
      {error && (
        <div className={styles.errorBanner} onClick={clearError}>
          {error} (click to dismiss)
        </div>
      )}

      {/* New file modal */}
      {showNewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>New Dynamic File</h3>
            <label className={styles.modalLabel}>
              File name
              <input
                className={styles.modalInput}
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="e.g. Banking Fees"
                autoFocus
              />
            </label>
            <label className={styles.modalLabel}>
              Type
              <div className={styles.typeOptions}>
                <label className={`${styles.typeOption} ${newFileType === 'text' ? styles.typeOptionActive : ''}`}>
                  <input
                    type="radio"
                    name="fileType"
                    value="text"
                    checked={newFileType === 'text'}
                    onChange={() => setNewFileType('text')}
                  />
                  <span>Text / Markdown</span>
                  <small>Free-form content, supports markdown</small>
                </label>
                <label className={`${styles.typeOption} ${newFileType === 'table' ? styles.typeOptionActive : ''}`}>
                  <input
                    type="radio"
                    name="fileType"
                    value="table"
                    checked={newFileType === 'table'}
                    onChange={() => setNewFileType('table')}
                  />
                  <span>Table / Grid</span>
                  <small>Spreadsheet-style data, auto-converted to MD</small>
                </label>
              </div>
            </label>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowNewModal(false)}>Cancel</button>
              <button
                className={styles.modalCreateBtn}
                onClick={handleCreate}
                disabled={!newFileName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview MD modal */}
      {showPreview && selectedFile && (
        <PreviewMDModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          fileName={selectedFile.name}
          fileType={selectedFile.fileType}
          content={content}
        />
      )}
    </div>
  );
}
