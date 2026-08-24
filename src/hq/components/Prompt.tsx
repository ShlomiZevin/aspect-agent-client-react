/**
 * HQ — a dialog that asks for one thing.
 *
 * Replaces `window.prompt`. The browser's dialog is unstyled, unlabelled,
 * cannot say what the field is for, blocks the whole tab, and looks like a
 * phishing attempt inside an otherwise finished app. It also gives no room for
 * the one line of guidance that stops people naming a folder "new folder".
 *
 * Deliberately narrow: one field, confirm, cancel. Anything that needs more
 * than that is a screen, not a prompt.
 */

import { useEffect, useRef, useState } from 'react';

import styles from './Prompt.module.css';

interface Props {
  title: string;
  /** One line under the title. Say what the value is for, not how to type it. */
  hint?: string;
  placeholder?: string;
  initial?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}

export function Prompt({
  title, hint, placeholder, initial = '', confirmLabel = 'Create', onConfirm, onCancel,
}: Props) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  // Focus and select, so replacing an existing value takes no extra clicks.
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [busy, onCancel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    if (!clean || busy) return;
    setBusy(true);
    try { await onConfirm(clean); } finally { setBusy(false); }
  }

  return (
    <div className={styles.wrap} onClick={() => !busy && onCancel()}>
      <form className={styles.box} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className={styles.title}>{title}</div>
        {hint && <p className={styles.hint}>{hint}</p>}
        <input
          ref={field}
          className={styles.input}
          value={value}
          placeholder={placeholder}
          onChange={e => setValue(e.target.value)}
          disabled={busy}
          dir="auto"
        />
        <div className={styles.actions}>
          <button type="button" className="hqGhostPill" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="hqPill" disabled={busy || !value.trim()}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
