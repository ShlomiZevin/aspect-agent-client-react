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
}

/**
 * Collapsible side panel. Brain opens from the inline-end (left in RTL),
 * Profiler from the inline-start (right in RTL) — per Noa's spec. Content
 * is a placeholder for now ("to be specified later").
 */
export function SidePanel({ which, open, onClose, title, icon, placeholderTitle, placeholderSub, emoji }: Props) {
  return (
    <aside className={`side ${which} ${open ? 'open' : ''}`}>
      <div className="panel-inner">
        <div className="panel-head">
          <h3><span className="ph-icn">{icon}</span><span>{title}</span></h3>
          <button className="icon-btn" onClick={onClose} aria-label="close"><IconClose size={20} /></button>
        </div>
        <div className="panel-body">
          <div className="placeholder-card">
            <span className="pc-emoji">{emoji}</span>
            <b>{placeholderTitle}</b>
            <span>{placeholderSub}</span>
          </div>
          <div className="ghost-row lg" /><div className="ghost-row md" />
          <div className="ghost-row lg" /><div className="ghost-row sm" />
          <div className="ghost-row md" /><div className="ghost-row lg" />
        </div>
      </div>
    </aside>
  );
}
