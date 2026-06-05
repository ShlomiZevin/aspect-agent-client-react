/**
 * InlineField — shared "label on the left, control on the right" row
 * used by every addon's config modal. Replaces the older stacked
 * pattern (uppercase label on its own line + paragraph of hint copy +
 * input below) which ate vertical space and pushed the meaningful
 * content (prompt textarea) below the fold.
 *
 * Hint text becomes a tooltip on the label — the input gets to keep
 * its full width.
 */

import type { ReactNode } from 'react';
import styles from './InlineField.module.css';

interface Props {
  label: string;
  /** Tooltip surfaced when the user hovers the label. Optional. */
  hint?: string;
  /** Accessibility link to the inner control. */
  htmlFor?: string;
  children: ReactNode;
}

export function InlineField({ label, hint, htmlFor, children }: Props) {
  return (
    <div className={styles.row}>
      <label
        className={styles.label}
        htmlFor={htmlFor}
        title={hint}
      >
        {label}
      </label>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
