/**
 * BrainPanels — the customer-facing Live Brain. Same shared PanelSurface
 * (Noa design) the builder uses; it's the drawer container (SidePanel)
 * that differs. One look everywhere.
 */

import { PanelSurface, type DisplayPanel } from '../../builder/components/LiveBrainScreen/PanelSurface';
import type { LiveBrainPanelData } from '../../builder/state/builderApi';

export function BrainPanels({ panels, onClose }: {
  panels: LiveBrainPanelData[];
  /** Closes the drawer — rendered as the surface's own header close. */
  onClose?: () => void;
  /** Accepted for compat; layout is handled by PanelSurface. */
  arrangement?: 'stack' | 'grid';
}) {
  const display: DisplayPanel[] = panels.map(p => ({
    id: p.id,
    title: p.title,
    render: p.render,
    text: p.text,
    values: p.values,
  }));
  return (
    <PanelSurface
      panels={display}
      onClose={onClose}
      emptyLabel="Your live brain fills in as the conversation unfolds."
    />
  );
}
