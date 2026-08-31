import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import styles from './Modal.module.css';

/**
 * The one dialog shell for this feature.
 *
 * Exists so nothing here reaches for `window.prompt`. A native prompt cannot be
 * styled, cannot hold more than one field, renders as a browser security warning
 * in Chrome, and looks like a bug in an app that has a design system.
 *
 * Handles the parts every dialog gets wrong: Escape closes, a click on the
 * backdrop closes but a drag that ends there does not, focus moves into the
 * panel on open and returns to whatever opened it on close, and the page behind
 * does not scroll.
 */
interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Overrides the panel width; the CSS reads it as a custom property. */
  width?: number;
}

export function Modal({ title, onClose, children, footer, width }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    // Stop the page behind scrolling under the overlay, and put it back exactly
    // as it was — not to '', which would drop a value the host had set.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first control so the dialog is usable from the keyboard the
    // moment it opens; falls back to the panel itself when it has none.
    const first = panel.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
    (first ?? panel.current)?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      // mousedown, not click: a text selection that starts inside the panel and
      // ends on the backdrop would otherwise close the dialog mid-drag.
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panel}
        className={styles.panel}
        style={width ? ({ '--modal-width': `${width}px` } as React.CSSProperties) : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className={styles.body}>{children}</div>

        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </div>
  );
}
