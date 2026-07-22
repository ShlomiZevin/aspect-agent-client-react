/**
 * PanelSurface — the ONE Noa-designed surface, used everywhere: the
 * inline builder preview, the full-screen overlay, and the customer chat.
 * There is a single look; only the container differs (a contained frame,
 * a scrim, or a drawer). Config-driven header (icon/title/subtitle/section)
 * so the same component powers the Live Brain today and future surfaces
 * (Profile, …) tomorrow.
 *
 * The header is STICKY (not a flex fixed-header), so it pins to the top of
 * whatever scroll container it's dropped into — no layout assumptions.
 * Panel bodies reuse the shared PanelBody, themed to Noa's palette via the
 * --lb-* vars set on .surface.
 */

import { useState, type ReactNode } from 'react';
import type { PanelRender } from '../../types';
import { PanelBody, type PanelValues } from './PanelTemplates';
import s from './PanelSurface.module.css';

export interface DisplayPanel {
  id: string;
  title: string;
  render: PanelRender;
  text?: string;
  values?: PanelValues;
}

const TYPE_LABEL: Record<PanelRender, string> = {
  text: 'Note', html: 'Card', tags: 'Tags', fields: 'Fields', bars: 'Levels', cards: 'Cards',
};
const DEF_ICON: Record<PanelRender, string> = {
  text: '📝', html: '✨', tags: '🏷️', fields: '📋', bars: '📊', cards: '🗂️',
};

/** Pull a leading emoji out of the title for the card's icon tile (like
 *  Noa's cards); fall back to a per-type icon. */
function splitIcon(title: string, render: PanelRender): { icon: string; label: string } {
  try {
    const m = title.match(/^\s*(\p{Extended_Pictographic}️?)\s*(.*)$/u);
    if (m) return { icon: m[1], label: (m[2] || TYPE_LABEL[render]).trim() };
  } catch { /* older engine without \p{} — fall through */ }
  return { icon: DEF_ICON[render] ?? '•', label: title || 'Untitled' };
}

function Card({ panel, selected, footer }: { panel: DisplayPanel; selected?: boolean; footer?: ReactNode }) {
  const [open, setOpen] = useState(true);
  const { icon, label } = splitIcon(panel.title, panel.render);
  return (
    <section className={`${s.card} ${selected ? s.cardSel : ''}`}>
      <button type="button" className={s.cardHead} onClick={() => setOpen(o => !o)}>
        <span className={s.cardIcon} aria-hidden>{icon}</span>
        <span className={s.cardTitle}>{label}</span>
        <span className={s.spacer} />
        <span className={s.typePill}>{TYPE_LABEL[panel.render] ?? panel.render}</span>
        <span className={s.chev}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <div className={`${s.cardBody} ${panel.render === 'text' ? s.narrative : ''}`}>
            <PanelBody render={panel.render} text={panel.text} values={panel.values} />
          </div>
          {footer}
        </>
      )}
    </section>
  );
}

export interface PanelSurfaceProps {
  panels: DisplayPanel[];
  icon?: string;
  title?: string;
  subtitle?: string;
  /** Right-aligned header slot (builder: Open/Logs buttons). */
  headerRight?: ReactNode;
  /** When set, a close (›) button renders at the header's far right — for
   *  the overlay and the customer drawer, so the surface owns its header
   *  entirely (no separate close bar). */
  onClose?: () => void;
  /** Optional section label above the cards — only for surfaces that
   *  group multiple sections (like Noa's "PROFILE HEALTH"). Omitted for a
   *  single flat list (Live Brain), where it's just noise. */
  sectionLabel?: string;
  /** Per-panel footer (builder run logs). */
  footerFor?: (panel: DisplayPanel) => ReactNode;
  selectedId?: string;
  emptyLabel?: string;
}

export function PanelSurface({
  panels, headerRight, onClose, footerFor, selectedId, emptyLabel, sectionLabel,
  icon = '🧠', title = 'LYBI · LIVE BRAIN',
  subtitle = 'why I’m saying what I’m saying',
}: PanelSurfaceProps) {
  return (
    <div className={s.surface}>
      <header className={s.head}>
        <span className={s.logo} aria-hidden>{icon}</span>
        <div className={s.mark}>
          <div className={s.title}>{title}</div>
          <div className={s.sub}>{subtitle}</div>
        </div>
        {(headerRight || onClose) && (
          <div className={s.headRight}>
            {headerRight}
            {onClose && (
              <button type="button" className={s.close} onClick={onClose} aria-label="Close">✕</button>
            )}
          </div>
        )}
      </header>
      <div className={s.body}>
        {sectionLabel ? <div className={s.sectionLabel}>{sectionLabel}</div> : null}
        <div className={s.cards}>
          {panels.length === 0
            ? (
              <div className={s.empty}>
                <span className={s.emptyEmoji} aria-hidden>🧠</span>
                <span>{emptyLabel ?? 'Nothing here yet.'}</span>
              </div>
            )
            : panels.map(p => <Card key={p.id} panel={p} selected={p.id === selectedId} footer={footerFor?.(p)} />)}
        </div>
      </div>
    </div>
  );
}
