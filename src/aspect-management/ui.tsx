import { useEffect, useState, type ReactNode } from 'react';
import styles from './ledger.module.css';

/** The small pieces every screen shares. */

/** Holds a screen's body until its data is in, or says why it is not. */
export function Loading({ error }: { error: string | null }) {
  return <p className={error ? styles.errorLine : styles.quietLine}>{error ?? 'טוען…'}</p>;
}

export function PageHead({ title, sub, accent, action }: {
  title: string;
  sub?: ReactNode;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageHead}>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {sub && <p className={styles.sub}>{sub}</p>}
      </div>
      <div className={styles.pageHeadSide}>
        {accent && <span className={styles.accent}>{accent}</span>}
        {action}
      </div>
    </header>
  );
}

export type Tone = 'ok' | 'late' | 'wait' | 'plain';

export function Tag({ tone = 'plain', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`${styles.tag} ${styles[`tag_${tone}`]}`}>{children}</span>;
}

/** Numbers and ₪ read left to right inside the right-to-left page. */
export const Num = ({ children }: { children: ReactNode }) => <span className={styles.num}>{children}</span>;

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className={styles.dialogHead}>
          <h2 className={styles.dialogTitle}>{title}</h2>
          <button type="button" className={styles.linkBtn} onClick={onClose}>סגירה</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A dialog's form: save, wait, show the server's sentence if it refuses. */
export function DialogForm({ onSave, onDone, onCancel, saveLabel = 'שמירה', children }: {
  onSave: () => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
  saveLabel?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {children}
      {error && <p className={styles.errorLine}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? 'שומר…' : saveLabel}</button>
        <button type="button" className={styles.linkBtn} onClick={onCancel}>ביטול</button>
      </div>
    </form>
  );
}

const ICONS: Record<string, ReactNode> = {
  home: <path d="M4 11l8-7 8 7M6 10v10h4v-6h4v6h4V10" />,
  projects: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />,
  team: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 5.2a3.2 3.2 0 010 5.6M18 14.6c1.8.8 3 2.8 3 5.4" /></>,
  clients: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.8 3.1-6.5 7-6.5s7 2.7 7 6.5" /></>,
  quotes: <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" />,
  ask: <path d="M12 3l2 6.5 6.5 2-6.5 2L12 20l-2-6.5-6.5-2 6.5-2z" />,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></>,
  warning: <path d="M12 4l9 16H3zM12 10v4.5M12 17.5v.1" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
  send: <path d="M20 4L3 11l7 3 3 7zM10 14l5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof ICONS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
