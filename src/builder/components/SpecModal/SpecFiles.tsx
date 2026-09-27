/**
 * Files attached to an agent's Spec (task #870).
 *
 * Source material for whoever builds the agent — a requirements doc, a
 * brief, a policy. Alfred reads their text, and so does an outside
 * assistant through the Builder's AI door; the running agent never sees
 * them. They belong to the AGENT, not a version: attaching one saves
 * immediately and does not make anything "unsaved".
 */

import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '../Confirm/Confirm';
import {
  deleteSpecFile, listSpecFiles, specFileDownloadUrl, uploadSpecFile, type SpecFile,
} from '../../state/builderApi';
import styles from './SpecFiles.module.css';

interface Props {
  agentId: string;
}

const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SpecFiles({ agentId }: Props) {
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SpecFile[] | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSpecFiles(agentId)
      .then(f => { if (!cancelled) setFiles(f); })
      .catch(e => { if (!cancelled) { setFiles([]); setError(e instanceof Error ? e.message : String(e)); } });
    return () => { cancelled = true; };
  }, [agentId]);

  const onPick = async (picked: FileList | null) => {
    const file = picked?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    setError(null);
    setUploading(file.name);
    try {
      const saved = await uploadSpecFile(agentId, file);
      setFiles(prev => [saved, ...(prev ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  const onRemove = async (f: SpecFile) => {
    const ok = await confirm({
      title: `Remove "${f.fileName}"?`,
      message: 'It is removed from the Spec for good — Alfred and outside assistants will no longer see it.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteSpecFile(f.id);
      setFiles(prev => (prev ?? []).filter(x => x.id !== f.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>📎 Files</span>
        <span className={styles.sub}>Read by Alfred and your AI — never by the agent itself</span>
        <button
          type="button"
          className={styles.attach}
          onClick={() => inputRef.current?.click()}
          disabled={!!uploading}
        >
          Attach file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className={styles.hiddenInput}
          onChange={e => onPick(e.target.files)}
        />
      </div>

      <ul className={styles.list}>
        {uploading && (
          <li className={`${styles.row} ${styles.rowBusy}`}>
            <span className={styles.name}>{uploading}</span>
            <span className={styles.meta}>Uploading…</span>
          </li>
        )}
        {files?.map(f => (
          <li key={f.id} className={styles.row}>
            <a
              className={styles.name}
              href={specFileDownloadUrl(f.id)}
              target="_blank"
              rel="noreferrer"
              title="Download the original"
            >
              {f.fileName}
            </a>
            <span className={styles.meta}>
              {formatSize(f.fileSize)}
              {!f.hasText && <span className={styles.noText} title="No text could be read from this file, so Alfred and your AI can't use it"> · no readable text</span>}
            </span>
            <button
              type="button"
              className={styles.remove}
              onClick={() => onRemove(f)}
              aria-label={`Remove ${f.fileName}`}
              title="Remove"
            >
              ✕
            </button>
          </li>
        ))}
        {files && files.length === 0 && !uploading && (
          <li className={styles.empty}>No files yet — a brief, requirements or a policy document.</li>
        )}
        {!files && <li className={styles.empty}>Loading…</li>}
      </ul>

      {/* Reserved so an error never pushes the dialog around. */}
      <div className={styles.errorSlot} role="status" aria-live="polite">
        {error}
      </div>
    </section>
  );
}
