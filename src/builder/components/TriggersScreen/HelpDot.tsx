/**
 * HelpDot — a `?` that reveals an explanation, instead of a paragraph
 * that is always there.
 *
 * The trigger editor had three blocks of prose explaining how quiet is
 * measured, what the brief is, and why attempts are counted. All true,
 * all worth saying once — and all of it pushing the actual controls
 * below the fold on every visit after the first. This keeps the words
 * available and gives the space back to the form.
 */

import { useState, type ReactNode } from 'react';
import styles from './HelpDot.module.css';

interface Props {
  /** Screen-reader / hover label. */
  label?: string;
  children: ReactNode;
}

export function HelpDot({ label = 'How this works', children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={open ? styles.dotOpen : styles.dot}
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen(o => !o)}
      >
        ?
      </button>
      {open && <span className={styles.body}>{children}</span>}
    </span>
  );
}
