import { useState, useEffect, useCallback, useRef } from 'react';
import { useDynamicKB } from '../../../hooks/useDynamicKB';
import { TextEditor } from './TextEditor';
import { TableEditor } from './TableEditor';
import { PreviewMDModal } from './PreviewMDModal';
import type { TableData } from '../../../types/dynamicKB';
import styles from './DynamicKBPage.module.css';

interface DynamicKBPageProps {
  agentName: string;
}

export function DynamicKBPage({ agentName }: DynamicKBPageProps) {
  const {
    files,
    selectedFile,
    content,
    setContent,
    attachments,
    isLoading,
    isSaving,
    isDirty,
    error,
    selectFile,
    createFile,
    updateFileName,
    deleteFile,
    saveContent,
    importFromDoc,
    importFromSpreadsheet,
    reimportDocAndSave,
    reimportSpreadsheetAndSave,
    clearError,
  } = useDynamicKB(agentName);

  const reimportInputRef = useRef<HTMLInputElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'text' | 'table'>('text');
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Warn on unsaved changes before leaving
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Ctrl+S shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (selectedFile && !isSaving) handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // Sync editingName with selectedFile
  useEffect(() => {
    if (selectedFile) setEditingName(selectedFile.name);
  }, [selectedFile]);

  const handleSave = useCallback(async () => {
    try {
      const result = await saveContent();
      if (result) {
        const msg = result.synced
          ? `Saved and synced to ${result.syncedKBs.length} KB${result.syncedKBs.length > 1 ? 's' : ''}`
          : 'Saved';
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      // error is set in hook
    }
  }, [saveContent]);

  const handleCreate = useCallback(async () => {
    if (!newFileName.trim()) return;
    const file = await createFile(newFileName.trim(), newFileType);
    setShowCreateModal(false);
    setNewFileName('');
    setNewFileType('text');
    if (file) selectFile(file);
  }, [newFileName, newFileType, createFile, selectFile]);

  const handleDelete = useCallback(async (fileId: number, fileName: string, attachmentCount: number) => {
    const msg = attachmentCount > 0
      ? `"${fileName}" is attached to ${attachmentCount} KB(s). Deleting will remove it from all KBs. Continue?`
      : `Delete "${fileName}"?`;
    if (confirm(msg)) {
      await deleteFile(fileId);
    }
  }, [deleteFile]);

  const handleNameBlur = useCallback(() => {
    if (selectedFile && editingName.trim() && editingName.trim() !== selectedFile.name) {
      updateFileName(selectedFile.id, editingName.trim());
    }
  }, [selectedFile, editingName, updateFileName]);

  const handleImport = useCallback((file: File) => {
    if (isDirty && !confirm('You have unsaved changes. Import will replace the current content. Continue?')) return;
    if (selectedFile?.fileType === 'text') {
      importFromDoc(file);
    } else {
      importFromSpreadsheet(file);
    }
  }, [isDirty, selectedFile, importFromDoc, importFromSpreadsheet]);

  const handleReimport = useCallback(async (file: File) => {
    if (!selectedFile) return;
    const label = selectedFile.fileType === 'text' ? '.doc / .docx' : '.csv / .xls / .xlsx';
    if (!confirm(`Re-import will replace all current content with the new file and save immediately${attachments.length > 0 ? `, syncing to ${attachments.length} KB${attachments.length > 1 ? 's' : ''}` : ''}. Continue?`)) return;
    const result = selectedFile.fileType === 'text'
      ? await reimportDocAndSave(file)
      : await reimportSpreadsheetAndSave(file);
    if (result) {
      const msg = result.synced
        ? `Re-imported and synced to ${result.syncedKBs.length} KB${result.syncedKBs.length > 1 ? 's' : ''}`
        : 'Re-imported and saved';
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
    }
    void label;
  }, [selectedFile, attachments, reimportDocAndSave, reimportSpreadsheetAndSave]);

  const formatDate = (d: Date) => {
    return new Date(d).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>Dynamic KB Files</span>
          <button className={styles.newFileBtn} onClick={() => setShowCreateModal(true)}>
            + New
          </button>
        </div>

        <div className={styles.fileList}>
          {files.length === 0 && !isLoading && (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>📄</div>
              <div className={styles.emptyStateText}>Create your first dynamic file</div>
            </div>
          )}
          {files.map(f => (
            <div
              key={f.id}
              className={`${styles.fileItem} ${selectedFile?.id === f.id ? styles.fileItemActive : ''}`}
              onClick={() => {
                if (isDirty && !confirm('You have unsaved changes. Switch file?')) return;
                selectFile(f);
              }}
            >
              <span className={styles.fileTypeIcon}>{f.fileType === 'text' ? '📝' : '📊'}</span>
              <div className={styles.fileInfo}>
                <div className={styles.fileName}>{f.name}</div>
                <div className={styles.fileDate}>{formatDate(f.updatedAt)}</div>
              </div>
              {f.attachmentCount > 0 && (
                <span className={styles.attachBadge}>{f.attachmentCount} KB</span>
              )}
              <button
                className={styles.deleteBtn}
                onClick={e => { e.stopPropagation(); handleDelete(f.id, f.name, f.attachmentCount); }}
                title="Delete file"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      {!selectedFile ? (
        <div className={styles.noSelection}>Select a file or create a new one</div>
      ) : (
        <div className={styles.editor}>
          {error && (
            <div className={styles.error}>
              {error}
              <button onClick={clearError} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>×</button>
            </div>
          )}

          <div className={styles.editorHeader}>
            <div className={styles.editorHeaderLeft}>
              <input
                className={styles.fileNameInput}
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              {isDirty && <div className={styles.dirtyDot} title="Unsaved changes" />}
              <span className={`${styles.typeBadge} ${selectedFile.fileType === 'text' ? styles.typeBadgeText : styles.typeBadgeTable}`}>
                {selectedFile.fileType}
              </span>
            </div>
            <span className={styles.savedAt}>
              Last saved: {formatDate(selectedFile.updatedAt)}
            </span>
          </div>

          {attachments.length > 0 && (
            <div className={styles.attachmentsBar}>
              Attached to:
              {attachments.map(a => (
                <span key={a.kbId} className={styles.attachChip}>
                  {a.kbName} ({a.kbProvider})
                </span>
              ))}
            </div>
          )}

          <div className={styles.editorBody}>
            {isLoading ? (
              <div className={styles.noSelection}><div className={styles.spinner} /></div>
            ) : selectedFile.fileType === 'text' ? (
              <TextEditor
                value={content as string}
                onChange={setContent}
                onImport={handleImport}
              />
            ) : (
              <TableEditor
                value={(content as TableData) || { headers: [], rows: [] }}
                onChange={setContent}
                onImport={handleImport}
              />
            )}
          </div>

          <div className={styles.actionBar}>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving && <div className={styles.spinner} />}
              {attachments.length > 0
                ? `Save & Sync to ${attachments.length} KB${attachments.length > 1 ? 's' : ''}`
                : 'Save'}
            </button>
            <button
              className={styles.reimportBtn}
              onClick={() => reimportInputRef.current?.click()}
              disabled={isSaving}
              title="Replace all content by importing a new file, then save automatically"
            >
              Re-import & Save
            </button>
            <input
              ref={reimportInputRef}
              type="file"
              accept={selectedFile?.fileType === 'text' ? '.doc,.docx' : '.csv,.xls,.xlsx'}
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleReimport(file);
                e.target.value = '';
              }}
            />
            <button className={styles.previewBtn} onClick={() => setShowPreview(true)}>
              Preview MD
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>New Dynamic File</div>
            <input
              className={styles.modalInput}
              placeholder="File name (e.g. Banking Fees)"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
            <div className={styles.typeSelector}>
              <div
                className={`${styles.typeOption} ${newFileType === 'text' ? styles.typeOptionActive : ''}`}
                onClick={() => setNewFileType('text')}
              >
                <span className={styles.typeOptionIcon}>📝</span>
                <span className={styles.typeOptionLabel}>Text</span>
              </div>
              <div
                className={`${styles.typeOption} ${newFileType === 'table' ? styles.typeOptionActive : ''}`}
                onClick={() => setNewFileType('table')}
              >
                <span className={styles.typeOptionIcon}>📊</span>
                <span className={styles.typeOptionLabel}>Table</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className={styles.modalCreateBtn} onClick={handleCreate} disabled={!newFileName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <PreviewMDModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        fileType={selectedFile?.fileType || 'text'}
        fileName={selectedFile?.name || ''}
        content={content}
      />

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
