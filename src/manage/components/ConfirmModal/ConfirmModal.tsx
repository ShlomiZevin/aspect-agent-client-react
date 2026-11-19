/**
 * The management center's confirmation window — every action that changes
 * something asks here first (never the browser's confirm()). Same frame as
 * the conversation window (ConversationModal.module.css). The action runs
 * from here: the window stays open, says "רגע…", and shows the server's
 * refusal in place if it fails.
 */

import { useEffect, useRef, useState } from 'react';
import { IconClose } from '../../icons';
import { COPY } from '../../copy';
import s from '../ConversationModal/ConversationModal.module.css';
import c from './ConfirmModal.module.css';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  /** Red confirm button (delete). */
  danger?: boolean;
  /** Runs the action; a thrown error's text is shown, the window stays open. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
  /** The words for a failure (by default the generic one). */
  failText?: (err: unknown) => string;
}

export function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onClose, failText }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(failText ? failText(err) : COPY.actionFailed);
      setBusy(false);
    }
  };

  return (
    <div className={s.backdrop} data-manage-root dir="rtl" lang="he" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={`${s.dialog} ${c.dialog}`} role="alertdialog" aria-modal="true" aria-labelledby="manage-confirm-title" aria-describedby="manage-confirm-body">
        <header className={s.head}>
          <div className={s.headText}>
            <h2 id="manage-confirm-title" className={s.title} dir="auto">{title}</h2>
          </div>
          <button type="button" className={s.close} onClick={onClose} disabled={busy} aria-label={COPY.close}>
            <IconClose size={16} />
          </button>
        </header>
        <div className={s.body}>
          <p id="manage-confirm-body" className={c.text}>{body}</p>
          {/* Reserved line: a failure never resizes the window. */}
          <p className={c.error} role="status">{error || ' '}</p>
        </div>
        <footer className={s.foot}>
          <button ref={cancelBtn} type="button" className={s.closeBtn} onClick={onClose} disabled={busy}>{COPY.cancel}</button>
          <button type="button" className={`${c.confirm} ${danger ? c.danger : ''}`} onClick={run} disabled={busy}>
            {busy ? COPY.working : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
