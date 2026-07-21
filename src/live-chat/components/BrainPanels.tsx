/**
 * BrainPanels — the customer-facing Live Brain. Maps the resolved
 * `LiveBrainPanelData[]` onto the SHARED surface/templates (the same ones
 * the builder preview uses), themed to the brand via --lb-* vars. All the
 * look lives in the shared components — this file is just the data + theme
 * bridge.
 */

import type { CSSProperties } from 'react';
import { LiveBrainSurface, type DisplayPanel } from '../../builder/components/LiveBrainScreen/LiveBrainFrame';
import type { LiveBrainPanelData } from '../../builder/state/builderApi';

// Map the customer chat's brand tokens onto the shared template vars.
const LB_THEME = {
  '--lb-accent': 'var(--mag, #E0198A)',
  '--lb-ink': 'var(--text, #1f2937)',
  '--lb-muted': 'var(--text-dim, #6b7280)',
  '--lb-line': 'var(--border-2, rgba(0,0,0,.08))',
  '--lb-surface': 'var(--surface-2, #f3f4f6)',
  '--lb-panel': 'var(--surface, #fff)',
} as CSSProperties;

export function BrainPanels({ panels, arrangement }: {
  panels: LiveBrainPanelData[];
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
    <div style={LB_THEME}>
      <LiveBrainSurface panels={display} arrangement={arrangement} />
    </div>
  );
}
