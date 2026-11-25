/**
 * Lybi Gate — the window frame every Gate modal uses: the management
 * center's own (ConversationModal.module.css), Escape / backdrop to close.
 */

import { useEffect, type ReactNode } from 'react';
import { IconClose } from '../../icons';
import s from '../../components/ConversationModal/ConversationModal.module.css';
import g from './GatePage.module.css';
import { G } from './gateCopy';

interface Props {
  title: string;
  sub?: ReactNode;
  wide?: boolean;
  /** Blocks closing while something runs. */
  busy?: boolean;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function GateModal({ title, sub, wide, busy, onClose, footer, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  return (
    <div className={s.backdrop} data-manage-root dir="rtl" lang="he" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className={`${s.dialog} ${wide ? g.modalWide : g.modal}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className={s.head}>
          <div className={s.headText}>
            <h2 className={s.title}>{title}</h2>
            {sub && <div className={s.headMeta}>{sub}</div>}
          </div>
          <button type="button" className={s.close} onClick={onClose} disabled={busy} aria-label={G.close}>
            <IconClose size={16} />
          </button>
        </header>
        <div className={s.body}>{children}</div>
        <footer className={s.foot}>
          {footer}
          <button type="button" className={s.closeBtn} onClick={onClose} disabled={busy}>{G.close}</button>
        </footer>
      </div>
    </div>
  );
}
