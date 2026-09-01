/**
 * TriggerRow — the single row primitive for trigger configuration.
 *
 * Exists because there were briefly two: the editor used a CSS grid and
 * the Silence form used `InlineField`'s flex layout, so labels inside
 * one card sat at different vertical offsets and the controls overflowed
 * the card's right edge. Anything rendered inside a trigger group — the
 * editor's own rows and every trigger type's config — uses this, so
 * there is one alignment to get right.
 *
 * Lives beside the registry rather than in `components/` because it is
 * part of what a trigger type is handed: a type shouldn't have to reach
 * back into the editor's folder to lay out a field.
 */

import type { ReactNode } from 'react';
import styles from './TriggerRow.module.css';

interface Props {
  label: string;
  htmlFor?: string;
  /** Tooltip on the label, for the odd field that needs a nudge. */
  hint?: string;
  children: ReactNode;
}

export function TriggerRow({ label, htmlFor, hint, children }: Props) {
  return (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={htmlFor} title={hint}>{label}</label>
      <div className={styles.body}>{children}</div>
    </div>
  );
}

