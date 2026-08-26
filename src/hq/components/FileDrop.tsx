/**
 * HQ — what a worker has been given.
 *
 * Two scopes, and they are deliberately NOT the same control:
 *
 *   Briefcase (in "How she works") — material she carries into every message
 *   forever. Each file is labelled, because the label is the instruction: "brand
 *   voice, follow for all copy" is what turns an attachment into a rule. Files
 *   can be switched off without being deleted, for a guide you are between
 *   versions of. This is a small library you curate.
 *
 *   Conversation (the composer's paperclip) — the brief for this one job. No
 *   label, no on/off, nothing to configure: you attach it and send. Anything
 *   more is friction in the middle of typing a message.
 *
 * A file uploads the moment you pick it. Naming first put a dialog in front of
 * the thing you came to do and made an already-chosen file feel unsaved.
 */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { deleteWorkerFile, updateWorkerFile, uploadWorkerFile, workerFileUrl } from '../services/hqApi';
import type { WorkerCapabilities, WorkerFile } from '../types';
import styles from './FileDrop.module.css';

interface Props {
  slug: string;
  caps: WorkerCapabilities | null;
  files: WorkerFile[];
  onChange: (files: WorkerFile[]) => void;
  /** Omitted for the briefcase; set for a conversation's own attachments. */
  conversationId?: number | null;
  /** Chips in the composer: attach and send, nothing to configure. */
  compact?: boolean;
  /** Told to the parent so the paperclip can show progress on itself. */
  onBusyChange?: (busy: boolean) => void;
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
  slug, caps, files, onChange, conversationId = null, compact = false, onBusyChange,
}, ref) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which row is being named. Briefcase only. */
  const [naming, setNaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({ pick: () => input.current?.click() }), []);

  const accept = (caps?.fileExtensions || []).join(',');
  const total = files.filter(f => f.active).reduce((sum, f) => sum + (f.token_estimate || 0), 0);

  function working(v: boolean) { setBusy(v); onBusyChange?.(v); }

  async function send(file: File | undefined) {
    if (!file) return;
    working(true);
    setError(null);
    try {
      const added = await uploadWorkerFile(slug, file, { conversationId });
      onChange([...files, added]);
      // Straight into naming — but only where a label means something.
      if (!compact) { setNaming(added.id); setDraft(''); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      working(false);
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

  // With nothing to show the wrapper must contribute NO box: inside the composer
  // its parent has a `gap`, and an empty flex child still pushed the input row
  // down and left the field looking mis-centred.
  const nothing = !files.length && !error;

  const picker = (
    <input
      ref={input}
      type="file"
      accept={accept}
      className={styles.hidden}
      onChange={e => void send(e.target.files?.[0])}
    />
  );

  // ── In the composer: chips. Filename, weight, remove. Nothing else. ───────
  if (compact) {
    return (
      <div className={`${styles.wrap} ${styles.compact} ${nothing ? styles.silent : ''}`}>
        {files.length > 0 && (
          <ul className={styles.chips}>
            {files.map(f => (
              <li key={f.id} className={styles.chip}>
                <a
                  className={styles.chipOpen}
                  href={workerFileUrl(f.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${f.filename}`}
                >
                  <span className={styles.icon}>{icon(f)}</span>
                  <span className={styles.chipName} dir="auto">{f.filename}</span>
                </a>
                {f.token_estimate ? <span className={styles.chipMeta}>{weight(f.token_estimate)}</span> : null}
                <button className={styles.chipX} onClick={() => remove(f)} title="Remove">✕</button>
              </li>
            ))}
          </ul>
        )}
        {error && <div className={styles.error}>{error}</div>}
        {picker}
      </div>
    );
  }

  // ── Her briefcase: a small library you curate. ────────────────────────────
  return (
    <div className={styles.wrap}>
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
                      {f.label || 'Say what this is'}
                    </span>
                  </button>
                )}
                <span className={styles.meta}>
                  <a
                    className={styles.metaLink}
                    href={workerFileUrl(f.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`Open ${f.filename}`}
                  >
                    {f.filename}
                  </a>
                  {f.token_estimate ? ` · ${weight(f.token_estimate)}` : ''}
                  {f.kind === 'reference' && ' · visual reference'}
                  {!f.active && ' · not in use'}
                </span>
              </span>

              <span className={styles.actions}>
                <button
                  className={styles.act}
                  onClick={() => toggle(f)}
                  title={f.active ? 'Stop using this without deleting it' : 'Use this again'}
                >
                  {f.active ? 'Turn off' : 'Turn on'}
                </button>
                <button
                  className={`${styles.act} ${styles.actDanger}`}
                  onClick={() => remove(f)}
                  title="Remove"
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {picker}

      <div className={styles.footer}>
        <button className="hqMini" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? 'Reading it…' : '＋ Add a file'}
        </button>
        <span className={styles.formats}>
          {(caps?.fileTypes || []).join(', ')}
          {caps?.maxFileBytes ? ` · up to ${Math.round(caps.maxFileBytes / 1048576)}MB` : ''}
        </span>
        {/* The running cost, stated where you add to it rather than found later. */}
        {total > 0 && (
          <span className={styles.total} title="Re-read on every message, so this is a per-message cost">
            {weight(total)} every message
          </span>
        )}
      </div>
    </div>
  );
});
