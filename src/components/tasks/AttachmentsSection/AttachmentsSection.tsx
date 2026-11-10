import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  listAttachments, uploadAttachment, deleteAttachment, attachmentUrl, attachmentProblem,
  type TaskAttachment, type FailedUpload,
} from '../../../services/taskAttachmentsService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import { ConfirmDialog } from '../../common/ConfirmDialog/ConfirmDialog';
import styles from './AttachmentsSection.module.css';

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

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/** Lets the task modal hand over files dropped anywhere on it. */
export interface AttachmentsHandle {
  addFiles: (files: File[]) => void;
}

interface AttachmentsSectionProps {
  /** Existing task: files upload right away. */
  taskId?: number;
  /** New task: files are held here until Create returns the task id. */
  pending?: File[];
  onPendingChange?: (files: File[]) => void;
  /** Files that failed right after Create — shown with Retry. */
  initialFailed?: FailedUpload[];
  ref?: Ref<AttachmentsHandle>;
}

/**
 * Files on a task (task #954) — under the description. On a new task the
 * files wait locally and upload after Create (TaskBoardContent.handleCreateTask).
 * The whole task modal is the drop zone (TaskForm). Codex attaches through the
 * Builder MCP into the same list.
 */
export function AttachmentsSection({ taskId, pending = [], onPendingChange, initialFailed, ref }: AttachmentsSectionProps) {
  const { identity } = useCommenterIdentity();
  const [files, setFiles] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState<File[]>([]);
  const [failed, setFailed] = useState<FailedUpload[]>(() => initialFailed ?? []);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<TaskAttachment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (taskId == null) return;
    listAttachments(taskId).then(setFiles).catch(() => setFiles([]));
  }, [taskId]);
  useEffect(load, [load]);

  const upload = async (picked: File[]) => {
    if (taskId == null) return;
    for (const f of picked) {
      setUploading(u => [...u, f]);
      try {
        await uploadAttachment(taskId, f, identity);
      } catch (err) {
        setFailed(fs => [...fs, { file: f, error: err instanceof Error ? err.message : 'Upload failed', retryable: true }]);
      } finally {
        setUploading(u => u.filter(x => x !== f));
      }
    }
    load();
  };

  const addFiles = (list: File[]) => {
    const rejected = list.filter(f => attachmentProblem(f));
    const ok = list.filter(f => !attachmentProblem(f));
    setFailed(fs => [
      ...fs.filter(x => !list.some(f => sameFile(f, x.file))),
      ...rejected.map(f => ({ file: f, error: attachmentProblem(f)!, retryable: false })),
    ]);
    if (!ok.length) return;
    if (taskId != null) void upload(ok);
    else onPendingChange?.([...pending, ...ok.filter(f => !pending.some(p => sameFile(p, f)))]);
  };

  useImperativeHandle(ref, () => ({ addFiles }));

  const retry = (item: FailedUpload) => {
    setFailed(fs => fs.filter(x => x !== item));
    void upload([item.file]);
  };

  const confirmDelete = async () => {
    if (!toDelete || taskId == null) return;
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

  const count = taskId != null ? files.length : pending.length;
  const isEmpty = count === 0 && uploading.length === 0 && failed.length === 0;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <label>Files{count ? ` (${count})` : ''}</label>
        <button type="button" className={styles.attachBtn} onClick={() => inputRef.current?.click()}>
          + Attach
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={e => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = ''; }}
        />
      </div>

      {isEmpty && <div className={styles.empty}>Drop files here</div>}

      {taskId != null && files.map(f => (
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

      {taskId == null && pending.map((f, i) => (
        <div key={`${f.name}-${f.size}-${f.lastModified}-${i}`} className={styles.row}>
          <span className={styles.icon} aria-hidden="true">{fileIcon(f.type, f.name)}</span>
          <span className={styles.name} title={f.name}>{f.name}</span>
          <span className={styles.meta}>{fileSize(f.size)}</span>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => onPendingChange?.(pending.filter(p => p !== f))}
            title="Remove"
            aria-label={`Remove ${f.name}`}
          >
            ×
          </button>
        </div>
      ))}

      {uploading.map((f, i) => (
        <div key={`up-${f.name}-${i}`} className={`${styles.row} ${styles.pending}`}>
          <span className={styles.icon} aria-hidden="true">⏳</span>
          <span className={styles.name}>{f.name}</span>
          <span className={styles.meta}>Uploading…</span>
        </div>
      ))}

      {failed.map((item, i) => (
        <div key={`fail-${item.file.name}-${i}`} className={`${styles.row} ${styles.failed}`}>
          <span className={styles.icon} aria-hidden="true">⚠️</span>
          <span className={styles.name} title={item.file.name}>{item.file.name}</span>
          <span className={styles.failedMeta} title={item.error}>{item.retryable ? 'Upload failed' : item.error}</span>
          {item.retryable && taskId != null && (
            <button type="button" className={styles.attachBtn} onClick={() => retry(item)}>Retry</button>
          )}
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => setFailed(fs => fs.filter(x => x !== item))}
            title="Dismiss"
            aria-label={`Dismiss ${item.file.name}`}
          >
            ×
          </button>
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
