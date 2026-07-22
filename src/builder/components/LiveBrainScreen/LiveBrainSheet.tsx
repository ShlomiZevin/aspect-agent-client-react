/**
 * PanelSheet — the full-screen OVERLAY container (dark scrim + a light
 * sheet sliding in from the side) around the shared PanelSurface. Same
 * single design as the inline preview and the customer chat; only the
 * container differs. Config-driven header so it also serves future
 * surfaces (Profile, …). `LiveBrainSheet` is a defaults-applied alias.
 */

import { PanelSurface, type DisplayPanel } from './PanelSurface';
import s from './LiveBrainSheet.module.css';

export interface PanelSheetProps {
  open: boolean;
  onClose: () => void;
  panels: DisplayPanel[];
  icon?: string;
  title?: string;
  subtitle?: string;
  sectionLabel?: string;
}

export function PanelSheet({ open, onClose, panels, icon, title, subtitle, sectionLabel }: PanelSheetProps) {
  if (!open) return null;
  return (
    <div className={s.overlay} onClick={onClose}>
      <aside className={s.sheet} onClick={e => e.stopPropagation()} role="dialog" aria-label={title ?? 'Live Brain'}>
        <PanelSurface
          panels={panels}
          icon={icon}
          title={title}
          subtitle={subtitle}
          sectionLabel={sectionLabel}
          onClose={onClose}
        />
      </aside>
    </div>
  );
}

/** The Live Brain instance of the generic PanelSheet (defaults applied). */
export function LiveBrainSheet(props: PanelSheetProps) {
  return <PanelSheet {...props} />;
}
