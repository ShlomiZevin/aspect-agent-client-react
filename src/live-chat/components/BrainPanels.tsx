/**
 * BrainPanels — the customer-facing Live Brain (Noa's Shell mockup).
 * Wraps the shared PanelSurface in the `brain` look and supplies the
 * shell's own header furniture: the spiral wordmark, a LIVE pill and the
 * light/dark toggle. The reasoning animation rides along as the first card
 * in the list (`leadCard`), the way Noa opens the panel.
 */

import { PanelSurface, type DisplayPanel } from '../../builder/components/LiveBrainScreen/PanelSurface';
import type { LiveBrainPanelData } from '../../builder/state/builderApi';
import { BrainViz } from './BrainViz';
import s from './BrainPanels.module.css';

export function BrainPanels({ panels, onClose, dockSide, lang = 'he', subtitle, moreLabel, lessLabel }: {
  panels: LiveBrainPanelData[];
  /** Closes the drawer — rendered as the surface's own header close. */
  onClose?: () => void;
  /** Accepted for compat; layout is handled by PanelSurface. */
  arrangement?: 'stack' | 'grid';
  /** Which wall the drawer is docked against (close chevron side). */
  dockSide?: 'left' | 'right';
  /** UI language — picks the animation's node labels. */
  lang?: 'he' | 'en';
  /** Header subtitle ("why I'm saying what I'm saying"), already localised. */
  subtitle?: string;
  /** Localised expand/collapse labels for clamped TEXT panels. */
  moreLabel?: string;
  lessLabel?: string;
}) {
  const display: DisplayPanel[] = panels.map(p => ({
    id: p.id,
    title: p.title,
    render: p.render,
    text: p.text,
    values: p.values,
    ranAt: p.ranAt,
  }));

  // Noa's header also carries a Light/Dark toggle; ours lives in the chat's
  // settings menu, so the pill is the only furniture here.
  const headerRight = (
    <span className={s.livePill} dir="ltr">
      <span className={s.liveDot} aria-hidden />
      LIVE
    </span>
  );

  return (
    <PanelSurface
      panels={display}
      look="brain"
      icon={<img src="/img/lybi-spiral.png" alt="" />}
      title="LIVE BRAIN"
      subtitle={subtitle}
      headerRight={headerRight}
      moreLabel={moreLabel}
      lessLabel={lessLabel}
      leadCard={<BrainViz lang={lang} />}
      onClose={onClose}
      dockSide={dockSide}
      emptyLabel="Your live brain fills in as the conversation unfolds."
    />
  );
}
