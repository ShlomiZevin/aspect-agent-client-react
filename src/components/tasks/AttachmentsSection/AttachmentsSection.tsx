import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listAttachments, uploadAttachment, deleteAttachment, attachmentUrl, type TaskAttachment,
} from '../../../services/taskAttachmentsService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import { ConfirmDialog } from '../../common/ConfirmDialog/ConfirmDialog';
import styles from './AttachmentsSection.module.css';

const MAX_BYTES = 25 * 1024 * 1024;

function fileSize(n: number): string {
  return n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function fileIcon(mime: string, name: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📕';
  if (/\.(xlsx?|csv)$/i.test(name)) return '📊';
  if (/\.(docx?|md|txt)$/i.test(name)) return '📄';
  if (/\.json$/i.test(name)) return '🧾';
  return '📎';
}

/**
 * Files on a task (task #954) — under the description, existing tasks only.
 * Drop files on the section or use "+ Attach". Codex attaches through the
 * Builder MCP into the same list.
 */
export function AttachmentsSection({ taskId }: { taskId: number }) {
  const { identity } = useCommenterIdentity();
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [toDelete, setToDelete] = useState<TaskAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    listAttachments(taskId).then(setFiles).catch(() => setFiles([]));
  }, [taskId]);
  useEffect(load, [load]);

  const upload = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    const tooBig = picked.filter(f => f.size > MAX_BYTES);
    setError(tooBig.length ? `${tooBig.map(f => f.name).join(', ')}: over 25 MB` : null);
    for (const f of picked.filter(p => p.size <= MAX_BYTES)) {
      setUploading(u => [...u, f.name]);
      try {
        await uploadAttachment(taskId, f, identity);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(u => u.filter(n => n !== f.name));
      }
    }
    load();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAttachment(taskId, toDelete.id);
      setFiles(fs => fs.filter(f => f.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className={`${styles.section} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragOver(false);
        void upload(e.dataTransfer.files);
      }}
    >
      <div className={styles.header}>
        <label>Files{files.length ? ` (${files.length})` : ''}</label>
        <button type="button" className={styles.attachBtn} onClick={() => inputRef.current?.click()}>
          + Attach
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = ''; }}
        />
      </div>

      {files.length === 0 && uploading.length === 0 && (
        <div className={styles.empty}>Drop files here</div>
      )}

      {files.map(f => (
        <div key={f.id} className={styles.row}>
          <span className={styles.icon} aria-hidden="true">{fileIcon(f.mimeType, f.fileName)}</span>
          <a className={styles.name} href={attachmentUrl(taskId, f.id)} target="_blank" rel="noopener noreferrer" title={f.fileName}>
            {f.fileName}
          </a>
          <span className={styles.meta}>
            {fileSize(f.sizeBytes)}{f.uploadedBy ? ` · ${f.uploadedBy}` : ''} · {new Date(f.createdAt).toLocaleDateString()}
          </span>
          <button type="button" className={styles.removeBtn} onClick={() => setToDelete(f)} title="Remove" aria-label={`Remove ${f.fileName}`}>
            ×
          </button>
        </div>
      ))}

      {uploading.map(name => (
        <div key={name} className={`${styles.row} ${styles.pending}`}>
          <span className={styles.icon} aria-hidden="true">⏳</span>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>Uploading…</span>
        </div>
      ))}

      {error && <div className={styles.error}>{error}</div>}

      <ConfirmDialog
        isOpen={!!toDelete}
        title="Remove file"
        message={toDelete ? `Remove "${toDelete.fileName}" from this task?` : ''}
        confirmText="Remove"
        variant="danger"
        isLoading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
