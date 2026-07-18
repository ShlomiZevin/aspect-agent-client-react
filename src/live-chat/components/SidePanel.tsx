import type { ReactNode } from 'react';
import { IconClose } from '../icons';

interface Props {
  which: 'brain' | 'profiler';
  open: boolean;
  onClose: () => void;
  title: string;
  icon: ReactNode;
  placeholderTitle: string;
  placeholderSub: string;
  emoji: string;
  /** When provided, replaces the placeholder with real content. */
  children?: ReactNode;
  /** When provided, shows a Refresh button in the header. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Collapsible side panel. Brain opens from the inline-end (left in RTL),
 * Profiler from the inline-start (right in RTL). Renders `children` when
 * given (the live Brain panels); otherwise the "to be specified"
 * placeholder.
 */
export function SidePanel({
  which, open, onClose, title, icon, placeholderTitle, placeholderSub, emoji,
  children, onRefresh, refreshing,
}: Props) {
  return (
    <aside className={`side ${which} ${open ? 'open' : ''}`}>
      <div className="panel-inner">
        <div className="panel-head">
          <h3><span className="ph-icn">{icon}</span><span>{title}</span></h3>
          {onRefresh && (
            <button
              className={`icon-btn ${refreshing ? 'spinning' : ''}`}
              onClick={onRefresh}
              aria-label="refresh"
              title="Refresh"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
              </svg>
            </button>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="close"><IconClose size={20} /></button>
        </div>
        <div className="panel-body">
          {children ?? (
            <>
              <div className="placeholder-card">
                <span className="pc-emoji">{emoji}</span>
                <b>{placeholderTitle}</b>
                <span>{placeholderSub}</span>
              </div>
              <div className="ghost-row lg" /><div className="ghost-row md" />
              <div className="ghost-row lg" /><div className="ghost-row sm" />
              <div className="ghost-row md" /><div className="ghost-row lg" />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
