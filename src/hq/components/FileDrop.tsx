/**
 * HQ — what a worker has been given.
 *
 * Used twice with different scope: her briefcase (in front of her forever) and
 * a conversation's attachments (that chat only). The mechanics are identical,
 * so the component is one; only the scope differs.
 *
 * The file uploads the moment you pick it, and the label is added afterwards,
 * inline on the row. Naming a file before it exists put a dialog in front of the
 * thing you actually came to do, and made an already-chosen file feel unsaved.
 *
 * Two things it insists on:
 *
 * The supported formats are stated BEFORE you pick, because the common case — a
 * brand deck — is a .pptx that cannot be read, and finding that out after a 20MB
 * upload is a bad way to learn it.
 *
 * The token weight is shown per file. These are re-sent on every turn, so a
 * briefcase is a running cost, and a number is the only thing that keeps it a
 * briefcase rather than a filing cabinet.
 */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { deleteWorkerFile, updateWorkerFile, uploadWorkerFile } from '../services/hqApi';
import type { WorkerCapabilities, WorkerFile } from '../types';
import styles from './FileDrop.module.css';

interface Props {
  slug: string;
  caps: WorkerCapabilities | null;
  files: WorkerFile[];
  onChange: (files: WorkerFile[]) => void;
  /** Omitted for the briefcase; set for a conversation's own attachments. */
  conversationId?: number | null;
  /**
   * Compact drops the add button and the format line — the composer's paperclip
   * is the affordance there, and a second one would be noise above the input.
   */
  compact?: boolean;
}

export interface FileDropHandle {
  /** Open the file picker from outside — the composer's paperclip uses this. */
  pick: () => void;
}

const weight = (n: number | null) =>
  !n ? '' : n >= 1000 ? `${(n / 1000).toFixed(1)}k tokens` : `${n} tokens`;

function icon(file: WorkerFile) {
  if (file.mime_type.startsWith('image/')) return '🖼️';
  if (file.mime_type === 'application/pdf') return '📕';
  return '📄';
}

export const FileDrop = forwardRef<FileDropHandle, Props>(function FileDrop({
  slug, caps, files, onChange, conversationId = null, compact = false,
}, ref) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which row is being named. New uploads open straight into this. */
  const [naming, setNaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ pick: () => input.current?.click() }), []);

  const accept = (caps?.fileExtensions || []).join(',');
  const total = files.filter(f => f.active).reduce((sum, f) => sum + (f.token_estimate || 0), 0);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const added = await uploadWorkerFile(slug, file, { conversationId });
      onChange([...files, added]);
      // Straight into naming: the file is safe, and this is the one thing that
      // turns "here is a PDF" into an instruction.
      setNaming(added.id);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function saveLabel(file: WorkerFile) {
    const label = draft.trim();
    setNaming(null);
    if (label === (file.label || '')) return;
    onChange(files.map(f => f.id === file.id ? { ...f, label: label || null } : f));
    await updateWorkerFile(file.id, { label }).catch(() => onChange(files));
  }

  async function toggle(file: WorkerFile) {
    onChange(files.map(f => f.id === file.id ? { ...f, active: !f.active } : f));
    await updateWorkerFile(file.id, { active: !file.active }).catch(() => onChange(files));
  }

  async function remove(file: WorkerFile) {
    onChange(files.filter(f => f.id !== file.id));
    await deleteWorkerFile(file.id).catch(() => onChange(files));
  }

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      {files.length > 0 && (
        <ul className={styles.list}>
          {files.map(f => (
            <li key={f.id} className={`${styles.file} ${f.active ? '' : styles.fileOff}`}>
              <span className={styles.icon}>{icon(f)}</span>

              <span className={styles.body}>
                {naming === f.id ? (
                  <input
                    className={styles.labelInput}
                    autoFocus
                    value={draft}
                    placeholder="What is this? e.g. brand voice — follow for all copy"
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => void saveLabel(f)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void saveLabel(f);
                      if (e.key === 'Escape') setNaming(null);
                    }}
                    dir="auto"
                  />
                ) : (
                  <button
                    className={styles.labelBtn}
                    onClick={() => { setNaming(f.id); setDraft(f.label || ''); }}
                    title="Click to say what this is"
                  >
                    <span className={f.label ? styles.label : styles.labelEmpty} dir="auto">
                      {f.label || 'Add a label'}
                    </span>
                  </button>
                )}
                <span className={styles.meta}>
                  {f.filename}{f.token_estimate ? ` · ${weight(f.token_estimate)}` : ''}
                  {f.kind === 'reference' && ' · visual reference'}
                </span>
              </span>

              <button
                className={styles.act}
                onClick={() => toggle(f)}
                title={f.active ? 'Stop using this without deleting it' : 'Use this again'}
              >
                {f.active ? 'On' : 'Off'}
              </button>
              <button className={styles.act} onClick={() => remove(f)} title="Remove">✕</button>
            </li>
          ))}
        </ul>
      )}

      {busy && <div className={styles.busy}>Reading it…</div>}
      {error && <div className={styles.error}>{error}</div>}

      <input
        ref={input}
        type="file"
        accept={accept}
        className={styles.hidden}
        onChange={e => void send(e.target.files?.[0])}
      />

      {!compact && (
        <div className={styles.footer}>
          <button className="hqMini" onClick={() => input.current?.click()} disabled={busy}>
            ＋ Add a file
          </button>
          <span className={styles.formats}>
            {(caps?.fileTypes || []).join(', ')}
            {caps?.maxFileBytes ? ` · up to ${Math.round(caps.maxFileBytes / 1048576)}MB` : ''}
          </span>
          {/* The running cost of the briefcase, stated where you add to it. */}
          {total > 0 && (
            <span className={styles.total} title="Re-read on every message, so this is a per-message cost">
              {weight(total)} every message
            </span>
          )}
        </div>
      )}
    </div>
  );
});
