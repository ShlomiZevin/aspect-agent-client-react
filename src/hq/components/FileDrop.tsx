/**
 * HQ — what a worker has been given.
 *
 * Used twice with different scope: her briefcase (in front of her forever) and
 * a conversation's attachments (that chat only). The mechanics are identical,
 * so the component is one; only the scope and the labelling rule differ.
 *
 * Two things it insists on:
 *
 * The supported formats are stated BEFORE you pick a file, because the common
 * case — a brand deck — is a .pptx that cannot be read, and finding that out
 * after a 20MB upload is a bad way to learn it.
 *
 * The token weight is shown per file. These are re-sent on every turn, so a
 * briefcase is a running cost, and a number is the only thing that keeps it a
 * briefcase rather than a filing cabinet.
 */

import { useRef, useState } from 'react';

import { deleteWorkerFile, setWorkerFileActive, uploadWorkerFile } from '../services/hqApi';
import type { WorkerCapabilities, WorkerFile } from '../types';
import styles from './FileDrop.module.css';

interface Props {
  slug: string;
  caps: WorkerCapabilities | null;
  files: WorkerFile[];
  onChange: (files: WorkerFile[]) => void;
  /** Omitted for the briefcase; set for a conversation's own attachments. */
  conversationId?: number | null;
  /** The briefcase requires a label — it IS the instruction. */
  requireLabel?: boolean;
  compact?: boolean;
}

const weight = (n: number | null) =>
  !n ? '' : n >= 1000 ? `${(n / 1000).toFixed(1)}k tokens` : `${n} tokens`;

function icon(file: WorkerFile) {
  if (file.mime_type.startsWith('image/')) return '🖼️';
  if (file.mime_type === 'application/pdf') return '📕';
  return '📄';
}

export function FileDrop({
  slug, caps, files, onChange, conversationId = null, requireLabel = false, compact = false,
}: Props) {
  const [pending, setPending] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const accept = (caps?.fileExtensions || []).join(',');
  const total = files.filter(f => f.active).reduce((sum, f) => sum + (f.token_estimate || 0), 0);

  function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    // With a label required we cannot upload yet — the name is part of the
    // upload, not an edit afterwards.
    if (requireLabel) { setPending(file); setLabel(''); }
    else void send(file);
  }

  async function send(file: File, withLabel?: string) {
    setBusy(true);
    try {
      const added = await uploadWorkerFile(slug, file, { conversationId, label: withLabel });
      onChange([...files, added]);
      setPending(null); setLabel(''); setError(null);
      if (input.current) input.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(file: WorkerFile) {
    onChange(files.map(f => f.id === file.id ? { ...f, active: !f.active } : f));
    await setWorkerFileActive(file.id, !file.active)
      .catch(() => onChange(files));
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
                <span className={styles.label} dir="auto">{f.label || f.filename}</span>
                <span className={styles.meta}>
                  {f.label ? `${f.filename} · ` : ''}{weight(f.token_estimate)}
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

      {/* Naming happens before the upload, not after — the label is the
          instruction, so a file cannot exist without one. */}
      {pending && (
        <div className={styles.naming}>
          <div className={styles.namingFile}>{pending.name}</div>
          <input
            className={styles.namingInput}
            autoFocus
            value={label}
            placeholder="What is this, and what should she do with it?"
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && label.trim()) void send(pending, label.trim()); }}
            dir="auto"
          />
          <div className={styles.namingActions}>
            <button className="hqGhostPill" onClick={() => { setPending(null); setLabel(''); }} disabled={busy}>
              Cancel
            </button>
            <button className="hqPill" onClick={() => void send(pending, label.trim())} disabled={busy || !label.trim()}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {!pending && (
        <div className={styles.footer}>
          <button className="hqMini" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? 'Adding…' : '＋ Add a file'}
          </button>
          <input
            ref={input}
            type="file"
            accept={accept}
            className={styles.hidden}
            onChange={e => choose(e.target.files?.[0])}
          />
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
}
