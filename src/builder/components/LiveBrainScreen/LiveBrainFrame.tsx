/**
 * LiveBrainFrame — the shared WRAPPER: the fixed header, the per-panel
 * chrome (two-digit index + title + collapse), and the panels surface
 * (stack or grid). Used by BOTH the customer Live Brain and the builder
 * preview so they read as one family. Pure presentation — it takes a
 * normalized DisplayPanel[] and knows nothing about data sources.
 */

import { useState } from 'react';
import type { PanelRender } from '../../types';
import { PanelBody, type PanelValues } from './PanelTemplates';
import styles from './LiveBrainFrame.module.css';

export interface DisplayPanel {
  id: string;
  title: string;
  render: PanelRender;
  text?: string;
  values?: PanelValues;
  /** Optional leading icon + top-left meta pill (panel-frame spec). */
  icon?: string;
  meta?: string;
}

/** Fixed header strip — "LYBI · LIVE BRAIN". Same on every agent (per
 *  Noa); trivial to make configurable later without touching data. */
export function LiveBrainHeader() {
  return (
    <div className={styles.header}>
      <div className={styles.hMark}>
        <div className={styles.hTitle}>LYBI · LIVE BRAIN</div>
        <div className={styles.hSub}>why I’m saying what I’m saying</div>
      </div>
      <div className={styles.hIcon} aria-hidden>🧠</div>
    </div>
  );
}

/** One panel's shared chrome. Body is the render's template slot. */
function PanelFrame({ panel, index, selected, footer }: {
  panel: DisplayPanel;
  index: number;
  selected?: boolean;
  footer?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const idx = String(index + 1).padStart(2, '0');
  return (
    <section className={`${styles.panel} ${selected ? styles.panelSel : ''}`}>
      <header className={styles.phead}>
        {panel.meta ? <span className={styles.meta}>{panel.meta}</span> : null}
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.collapse}
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >{collapsed ? '▸' : '▾'}</button>
        {panel.icon ? <span className={styles.picon}>{panel.icon}</span> : null}
        <h3 className={styles.ptitle}>{panel.title || 'Untitled'}</h3>
        <span className={styles.pidx}>{idx}</span>
      </header>
      {!collapsed && (
        <>
          <div className={styles.pbody}>
            <PanelBody render={panel.render} text={panel.text} values={panel.values} />
          </div>
          {footer}
        </>
      )}
    </section>
  );
}

/** The whole surface: header + arranged panels. `footerFor`/`selectedId`
 *  let the builder attach per-panel run logs + a selection highlight
 *  without the customer surface knowing anything about them. */
export function LiveBrainSurface({ panels, arrangement = 'stack', selectedId, footerFor, emptyLabel }: {
  panels: DisplayPanel[];
  arrangement?: 'stack' | 'grid';
  selectedId?: string;
  footerFor?: (panel: DisplayPanel) => React.ReactNode;
  emptyLabel?: string;
}) {
  return (
    <div className={styles.surface}>
      <LiveBrainHeader />
      {panels.length === 0 ? (
        <div className={styles.empty}>{emptyLabel ?? 'No panels yet.'}</div>
      ) : (
        <div className={`${styles.panels} ${arrangement === 'grid' ? styles.grid : ''}`}>
          {panels.map((p, i) => (
            <PanelFrame
              key={p.id}
              panel={p}
              index={i}
              selected={p.id === selectedId}
              footer={footerFor?.(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
