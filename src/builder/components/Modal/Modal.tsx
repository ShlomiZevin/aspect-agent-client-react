/**
 * Modal — reusable frame. Click on overlay / Esc closes. Body is
 * caller-supplied. Used by SpecModal, AddonModal, AddStepModal.
 *
 * Rendered via a portal to `document.body` so the overlay sits at the
 * root stacking context. Without the portal, modal's `z-index` only
 * competes inside its parent — siblings like the chat panel or the
 * chip canvas's on/off switch could leak through visually.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Right-aligned chip next to the title (e.g. plugin name, level). */
  badge?: ReactNode;
  /** Extra controls rendered between the title and the close button
   *  (e.g. an "Enlarge" toggle for the table editor). */
  headerExtra?: ReactNode;
  children: ReactNode;
  /** Optional footer (e.g. Save / Cancel). */
  footer?: ReactNode;
  /** Pixel width — default 640. Ignored when `fullscreen` is set. */
  width?: number;
  /** When true, the modal expands to fill nearly the entire viewport.
   *  Used by the table editor so the author can see wide tables without
   *  horizontal scrolling. */
  fullscreen?: boolean;
  /** Skip the default 20px padding around `children`. Useful when the
   *  child component owns its own layout end-to-end (e.g. a grid that
   *  should fill the modal width). */
  noBodyPadding?: boolean;
  /** Trim the header to a thin bar (no bottom separator). Used by
   *  modals where the host wants the body content to dominate. */
  compactHeader?: boolean;
}

export function Modal({
  open, onClose, title, badge, headerExtra, children, footer,
  width = 640, fullscreen = false, noBodyPadding = false, compactHeader = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const mousedownOnOverlayRef = useRef(false);

  if (!open) return null;

  // Fullscreen flips the modal box dimensions to fill nearly the
  // viewport. The width prop is ignored in that mode — the host
  // wants the maximum drawing surface. `resize: both` allows
  // drag-from-the-bottom-right corner; the parent overlay's flex-
  // center keeps the modal centered so growing the box visually
  // expands in all directions equally.
  const modalStyle: React.CSSProperties = fullscreen
    ? { width: '96vw', height: '94vh', maxWidth: '96vw', maxHeight: '94vh' }
    : { width, resize: 'both', overflow: 'auto', minWidth: 320, minHeight: 200, maxWidth: '96vw', maxHeight: '94vh' };
  const bodyClass = noBodyPadding ? `${styles.body} ${styles.bodyTight}` : styles.body;

  // Click-vs-drag disambiguation: the modal frame uses `resize: both`
  // so the user can drag the corner. During a drag, the cursor often
  // leaves the modal box and the mouseup lands on the overlay — a
  // naive onClick={onClose} would close the modal mid-resize. Track
  // mousedown target instead: only close when the mousedown ALSO
  // started on the overlay (i.e. a deliberate click outside, not a
  // drag that drifted out).
  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={e => { mousedownOnOverlayRef.current = e.target === e.currentTarget; }}
      onClick={e => {
        if (e.target === e.currentTarget && mousedownOnOverlayRef.current) onClose();
      }}
    >
      <div
        className={styles.modal}
        style={modalStyle}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <div className={`${styles.header} ${compactHeader ? styles.headerCompact : ''}`}>
          <div className={styles.titleWrap}>
            <span className={styles.title}>{title}</span>
            {badge && <span className={styles.badge}>{badge}</span>}
          </div>
          {/* All right-side actions hug the close button so the
              header doesn't have a giant centered gap between the
              title and the close. headerExtra rides inside this
              cluster (Save / Cancel buttons sit immediately left
              of the X). */}
          <div className={styles.headerActions}>
            {headerExtra}
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className={bodyClass}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
