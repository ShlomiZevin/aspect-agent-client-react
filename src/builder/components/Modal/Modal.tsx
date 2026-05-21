/**
 * Modal — reusable frame. Click on overlay / Esc closes. Body is
 * caller-supplied. Used by SpecModal, AddonModal, AddStepModal.
 */

import { useEffect, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Right-aligned chip next to the title (e.g. plugin name, level). */
  badge?: ReactNode;
  children: ReactNode;
  /** Optional footer (e.g. Save / Cancel). */
  footer?: ReactNode;
  /** Pixel width — default 640. */
  width?: number;
}

export function Modal({ open, onClose, title, badge, children, footer, width = 640 }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ width }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.title}>{title}</span>
            {badge && <span className={styles.badge}>{badge}</span>}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
