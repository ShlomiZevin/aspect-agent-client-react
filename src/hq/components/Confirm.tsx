/**
 * HQ — asking before something irreversible.
 *
 * Replaces `window.confirm`, which is unstyled, cannot say what will actually
 * be lost, and blocks the whole tab. The difference that matters is the body:
 * "Delete this conversation?" is a worse question than one that lists what goes
 * with it.
 */

import { useEffect } from 'react';

import styles from './Confirm.module.css';

interface Props {
  title: string;
  /** What will actually happen. Be specific — this is the whole point. */
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({
  title, body, confirmLabel = 'Delete', danger = true, busy = false, onConfirm, onCancel,
}: Props) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [busy, onCancel]);

  return (
    <div className={styles.wrap} onClick={() => !busy && onCancel()}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <div className={styles.title}>{title}</div>
        {body && <p className={styles.body}>{body}</p>}
        <div className={styles.actions}>
          <button className="hqGhostPill" onClick={onCancel} disabled={busy}>Cancel</button>
          <button
            className={danger ? styles.danger : 'hqPill'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
