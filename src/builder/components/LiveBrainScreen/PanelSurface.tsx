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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PanelRender } from '../../types';
import { PanelBody, compactSummary, type PanelValues } from './PanelTemplates';
import s from './PanelSurface.module.css';

export interface DisplayPanel {
  id: string;
  title: string;
  render: PanelRender;
  text?: string;
  values?: PanelValues;
  /** 'header' → the pinned group at the top (e.g. Profile Health);
   *  anything else → a normal body section. */
  placement?: 'header' | 'body';
}

// Noa's semantic pill labels (uppercased by CSS). Narrative=text,
// Insights=cards, Levels=bars.
const TYPE_LABEL: Record<PanelRender, string> = {
  text: 'Narrative', html: 'HTML', tags: 'Tags', fields: 'Fields', bars: 'Levels', cards: 'Insights', journey: 'Status',
};
// Noa uses SVG line-icons (NOT emoji) in a soft gradient tile — one per
// render type. 24×24 viewBox, stroke coloured by CSS (#9A2295).
export const ICON_PATH: Record<PanelRender, string> = {
  text:   'M4 6h16M4 11h16M4 16h9',                                   // list / narrative
  html:   'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10z',        // sparkle
  tags:   'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 3.8 11V6a2 2 0 0 1 2-2h5a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 2.6zM7.5 7.5h.01', // tag
  fields: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',  // person
  bars:   'M3 20h18M7 20v-6M12 20V8M17 20v-11',                       // bar chart
  cards:  'M12 3a7 7 0 0 0-4 12.7V18h8v-2.3A7 7 0 0 0 12 3zM9 21h6',  // bulb / insight
  journey:'M4 22V4M4 5h11l-2 3 2 3H4',                                // flag / status
};

/** Strip a leading emoji/symbol from the title → the clean label. The icon
 *  is a per-render SVG now, not the title's emoji (that read childish). */
export function cleanLabel(title: string, render: PanelRender): string {
  try {
    const m = title.match(/^\s*[\p{Extended_Pictographic}‍️\s]+(.*)$/u);
    if (m && m[1] !== undefined) return (m[1] || TYPE_LABEL[render]).trim();
  } catch { /* older engine without \p{} */ }
  return (title || TYPE_LABEL[render]).trim();
}

function Card({ panel, selected, footer }: { panel: DisplayPanel; selected?: boolean; footer?: ReactNode }) {
  const [open, setOpen] = useState(true);
  const label = cleanLabel(panel.title, panel.render);

  // "Just updated" cue — when the panel's content changes, replay a
  // one-shot magenta ring pulse (Noa's softPulse) so the eye is drawn to
  // what changed. `pulseKey` bumps to restart the animation each time.
  const [pulseKey, setPulseKey] = useState(0);
  const prevContent = useRef<string | undefined>(undefined);
  const content = JSON.stringify(panel.text ?? panel.values ?? null);
  useEffect(() => {
    if (prevContent.current === undefined) { prevContent.current = content; return; }
    if (prevContent.current !== content) {
      prevContent.current = content;
      setPulseKey(k => k + 1);
    }
  }, [content]);

  return (
    <div className={s.cardWrap}>
      {/* Gentle "just updated" blink — a soft tint that fades in/out over
          the card body. Sibling overlay; remounting via key replays it. */}
      {pulseKey > 0 && <span key={pulseKey} className={s.pulse} aria-hidden />}
      <section className={`${s.card} ${selected ? s.cardSel : ''}`}>
        <button type="button" className={s.cardHead} onClick={() => setOpen(o => !o)}>
          <span className={s.cardIcon} aria-hidden>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#9A2295" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON_PATH[panel.render] ?? ICON_PATH.text} />
            </svg>
          </span>
          <span className={s.cardTitle}>{label}</span>
          <span className={s.spacer} />
          <span className={s.typePill}>{TYPE_LABEL[panel.render] ?? panel.render}</span>
          <span className={`${s.chev} ${open ? s.chevOpen : ''}`} aria-hidden>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {open ? (
          <>
            <div className={panel.render === 'text' ? s.narrative : s.cardBody}>
              <PanelBody render={panel.render} text={panel.text} values={panel.values} />
            </div>
            {footer}
          </>
        ) : (
          // Collapsed → a one-line compact template of the same content
          // (Noa's collapsed sections show a summary, not an empty header).
          (() => {
            const summary = compactSummary(panel.render, panel.text, panel.values);
            return summary ? <div className={s.cardCompact}>{summary}</div> : null;
          })()
        )}
      </section>
    </div>
  );
}

export interface PanelSurfaceProps {
  panels: DisplayPanel[];
  icon?: string;
  /** Optional SVG path for a line-art logo mark on a SOFT tinted tile
   *  (Noa's Profiler header). When set it replaces the emoji `icon`. */
  iconSvg?: string;
  title?: string;
  subtitle?: string;
  /** Right-aligned slot on the TITLE row (builder: Open/Logs buttons). */
  headerRight?: ReactNode;
  /** Actions on a SECOND header row (Noa's Refresh / Ask pills). When set
   *  (with/without updatedLabel) the header becomes two rows. */
  headerActions?: ReactNode;
  /** Left side of the second header row — e.g. "Updated 3 messages ago". */
  updatedLabel?: string;
  /** When set, a close (›) button renders at the header's far right — for
   *  the overlay and the customer drawer, so the surface owns its header
   *  entirely (no separate close bar). */
  onClose?: () => void;
  /** Optional label above the BODY cards (e.g. "Sections"). Omitted for a
   *  single flat list (Live Brain) with no header group, where it's noise. */
  sectionLabel?: string;
  /** Optional label above the HEADER group — the pinned `placement:'header'`
   *  panels (e.g. Noa's "Profile Health"). */
  headerLabel?: string;
  /** Per-panel footer (builder run logs). */
  footerFor?: (panel: DisplayPanel) => ReactNode;
  selectedId?: string;
  emptyLabel?: string;
}

export function PanelSurface({
  panels, headerRight, headerActions, updatedLabel, onClose, footerFor, selectedId, emptyLabel, sectionLabel, headerLabel,
  icon = '🧠', iconSvg, title = 'LYBI · LIVE BRAIN',
  subtitle = 'why I’m saying what I’m saying',
}: PanelSurfaceProps) {
  const twoRow = !!(headerActions || updatedLabel);
  const headerPanels = panels.filter(p => p.placement === 'header');
  const bodyPanels = panels.filter(p => p.placement !== 'header');
  const cards = (list: DisplayPanel[]) => (
    <div className={s.cards}>
      {list.map(p => <Card key={p.id} panel={p} selected={p.id === selectedId} footer={footerFor?.(p)} />)}
    </div>
  );
  // A body-group label shows when there's an explicit one, OR when a header
  // group exists (so "Sections" reads as distinct from the header group).
  const bodyLabel = sectionLabel ?? (headerPanels.length > 0 ? 'Profile sections' : null);

  return (
    <div className={s.surface}>
      <header className={`${s.head} ${twoRow ? s.headTwo : ''}`}>
        <div className={s.headTop}>
          <span className={`${s.logo} ${iconSvg ? s.logoSoft : ''}`} aria-hidden>
            {iconSvg
              ? <svg viewBox="0 0 60 60" width="22" height="22" fill="none" stroke="#9A2295" strokeWidth="2.4" strokeLinecap="round"><path d={iconSvg} /></svg>
              : icon}
          </span>
          <div className={s.mark}>
            <div className={s.title}>{title}</div>
            <div className={s.sub}>{subtitle}</div>
          </div>
          {(headerRight || onClose) && (
            <div className={s.headRight}>
              {headerRight}
              {onClose && (
                <button type="button" className={s.close} onClick={onClose} aria-label="Close">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
                </button>
              )}
            </div>
          )}
        </div>
        {twoRow && (
          <div className={s.headMeta}>
            <span className={s.updated}>{updatedLabel}</span>
            <div className={s.headActions}>{headerActions}</div>
          </div>
        )}
      </header>
      <div className={s.body}>
        {panels.length === 0 ? (
          <div className={s.empty}>
            <span className={s.emptyEmoji} aria-hidden>🧠</span>
            <span>{emptyLabel ?? 'Nothing here yet.'}</span>
          </div>
        ) : (
          <>
            {headerPanels.length > 0 && (
              <>
                <div className={s.sectionLabel}>{headerLabel ?? 'Profile Health'}</div>
                {cards(headerPanels)}
              </>
            )}
            {bodyLabel ? (
              <div className={s.sectionLabel} style={headerPanels.length > 0 ? { marginTop: 16 } : undefined}>{bodyLabel}</div>
            ) : null}
            {cards(bodyPanels)}
          </>
        )}
      </div>
    </div>
  );
}
