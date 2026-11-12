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
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" /></>,
  flag: <path d="M6 21V4M6 4h11l-2.5 4L17 12H6" />,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></>,
  money: <><path d="M9 4h6l-1.6 3.2h-2.8z" /><path d="M10.6 7.2C6.6 9 4.5 12.5 4.5 15.6 4.5 19 7.6 21 12 21s7.5-2 7.5-5.4c0-3.1-2.1-6.6-6.1-8.4" /><path d="M13.8 11.3c-.4-.6-1-.9-1.8-.9-1.1 0-1.9.6-1.9 1.5 0 2 3.9 1 3.9 3.1 0 .9-.8 1.6-2 1.6-.8 0-1.6-.3-2-1M12 9.4v1M12 16.6v1" /></>,
  trophy: <path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  chevronStart: <path d="M9 6l6 6-6 6" />,
  chevronEnd: <path d="M15 6l-6 6 6 6" />,
  arrowEnd: <path d="M19 12H5M11 6l-6 6 6 6" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.1" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></>,
  sparkle: <path d="M12 3l2 6.5 6.5 2-6.5 2L12 20l-2-6.5-6.5-2 6.5-2z" />,
  chart: <path d="M5 20V14M10 20V9M15 20V12M20 20V5M3 20h18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
};

export function Icon({ name, size = 22, stroke = 1.8 }: { name: keyof typeof ICONS | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** The ochre bar mark beside the "Aspect" wordmark in the concepts. */
export function BarsMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="13" width="4" height="8" rx="1" fill="#B38A3E" />
      <rect x="10" y="8" width="4" height="13" rx="1" fill="#B38A3E" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill="#B38A3E" />
    </svg>
  );
}

/** The sprig drawn at the end of the "on track" strip. */
export function Sprig() {
  return (
    <svg width="120" height="84" viewBox="0 0 120 84" fill="none" stroke="#6B675F" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M14 78c22-2 52-2 92 0" stroke="#D3CEC4" strokeWidth="3" />
      <path d="M62 76c-2-20 4-40 20-58" />
      <path d="M70 46c-12-6-18-16-16-28 12 4 18 14 16 28z" />
      <path d="M76 34c4-12 14-20 28-20-2 14-12 22-28 20z" />
      <path d="M66 60c-10 0-18-6-22-16 10-2 20 4 22 16z" />
      <path d="M73 52c8-6 18-6 26 0-8 6-18 6-26 0z" />
    </svg>
  );
}
