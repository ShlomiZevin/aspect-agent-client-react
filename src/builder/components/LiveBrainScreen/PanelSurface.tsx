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
import { PanelBody, compactSummary, panelFooter, type PanelValues } from './PanelTemplates';
import s from './PanelSurface.module.css';

export interface DisplayPanel {
  id: string;
  title: string;
  render: PanelRender;
  text?: string;
  values?: PanelValues;
  /** When this panel last computed (ms). Drives the brain footer's
   *  "UPDATED 2S" — Noa's update cue lives there, not in a typing animation. */
  ranAt?: number;
  /** 'header' → the pinned group at the top (e.g. Profile Health);
   *  anything else → a normal body section. */
  placement?: 'header' | 'body';
}

// Noa's semantic pill labels (uppercased by CSS). Narrative=text,
// Insights=cards, Levels=bars.
const TYPE_LABEL: Record<PanelRender, string> = {
  text: 'Narrative', html: 'HTML', tags: 'Tags', fields: 'Fields', bars: 'Levels', cards: 'Insights', journey: 'Status',
};
// The Live Brain names its panels by TYPE, not by their editorial role — Noa's
// panel library tags them TEXT / TAGS / FIELDS / BARS / CARDS. Only the types
// already converted live here; the rest fall back to the Profiler labels.
const BRAIN_TYPE_LABEL: Partial<Record<PanelRender, string>> = {
  text: 'Text',
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

/**
 * Noa's TEXT panel body: capped at 132px so a long rationale can't crowd the
 * other panels out of view. What fits shows in full; anything longer fades at
 * the cut and opens on "show more".
 */
function ClampedText({ children, moreLabel, lessLabel }: {
  children: ReactNode; moreLabel: string; lessLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const inner = useRef<HTMLDivElement>(null);

  // Measure the CONTENT's natural height (the clamp lives on the wrapper), so
  // the reading stays true while the panel is expanded — and re-measure as
  // the text streams in.
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > CLAMP_PX + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <>
      <div className={`${s.clamp} ${expanded ? s.clampOpen : ''}`}>
        <div ref={inner}>{children}</div>
        {!expanded && overflows && <span className={s.clampFade} aria-hidden />}
      </div>
      {overflows && (
        <button type="button" className={s.moreBtn} onClick={() => setExpanded(v => !v)}>
          {expanded ? lessLabel : moreLabel}
        </button>
      )}
    </>
  );
}
const CLAMP_PX = 132;

function Card({ panel, selected, footer, isBrain, moreLabel, lessLabel }: {
  panel: DisplayPanel; selected?: boolean; footer?: ReactNode; isBrain?: boolean;
  moreLabel: string; lessLabel: string;
}) {
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
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICON_PATH[panel.render] ?? ICON_PATH.text} />
            </svg>
          </span>
          <span className={s.cardTitle}>{label}</span>
          <span className={s.spacer} />
          <span className={s.typePill}>
            {(isBrain ? BRAIN_TYPE_LABEL[panel.render] : undefined) ?? TYPE_LABEL[panel.render] ?? panel.render}
          </span>
          <span className={`${s.chev} ${open ? s.chevOpen : ''}`} aria-hidden>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>
        {open ? (
          <>
            {/* The Profiler frames its narrative in a lilac quote box; the brain
                shows plain prose in the panel body, capped at 132px. */}
            {isBrain && (panel.render === 'text' || panel.render === 'html') ? (
              <div className={`${s.brainText} ${panel.render === 'html' ? s.brainHtml : ''}`}>
                <ClampedText moreLabel={moreLabel} lessLabel={lessLabel}>
                  <PanelBody render={panel.render} text={panel.text} values={panel.values} brain />
                </ClampedText>
              </div>
            ) : (
              <div className={[
                panel.render === 'text' ? s.narrative : s.cardBody,
                // Field rows carry their own 11px rhythm, so the body hugs
                // tighter than the other types (Noa: 4px / 8px).
                isBrain && panel.render === 'fields' ? s.bodyFields : '',
              ].filter(Boolean).join(' ')}>
                <PanelBody render={panel.render} text={panel.text} values={panel.values} brain={isBrain} />
              </div>
            )}
            {/* Noa's per-panel footer (brain look only) — mono metadata row. */}
            {isBrain && (() => {
              const f = panelFooter(panel.render, panel.values, panel.ranAt);
              return f ? (
                <div className={s.cardFoot}>
                  <span>{f.left}</span>
                  <span>{f.right}</span>
                </div>
              ) : null;
            })()}
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
  /** Header mark. A string renders as-is (emoji); a node lets a surface pass
   *  its own artwork (the Live Brain passes Noa's spiral on a gradient tile). */
  icon?: ReactNode;
  /** A card pinned at the TOP of the scroll body, above the panels — Noa's
   *  Live Brain opens with the reasoning animation as its first panel. It
   *  scrolls with the list and shows even when no panels have run yet. */
  leadCard?: ReactNode;
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
  /** Which wall the drawer is docked against — the close chevron sits on
   *  that side and points toward it ("collapse back to the wall"). So a
   *  right-docked panel closes with `›` on the right, a left-docked one
   *  with `‹` on the left. Keeps Live Brain + Profiler consistent whatever
   *  side each ends up on. Default 'right'. */
  dockSide?: 'left' | 'right';
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
  /** Labels for the TEXT panel's expand control (brain look). Localised by
   *  the host; English defaults keep the builder preview working. */
  moreLabel?: string;
  lessLabel?: string;
  /** Which look-and-feel to render. `'profiler'` (default) is Noa's Profiler
   *  design, pinned LTR (English labels). `'brain'` is the Live Brain look —
   *  it follows the surrounding chat direction, so Hebrew content renders RTL
   *  the way Noa's Live Brain page does. Kept separate so tuning one never
   *  touches the other. */
  look?: 'brain' | 'profiler';
}

export function PanelSurface({
  panels, headerRight, headerActions, updatedLabel, onClose, footerFor, selectedId, emptyLabel, sectionLabel, headerLabel,
  icon = '🧠', iconSvg, title = 'LYBI · LIVE BRAIN', dockSide = 'right', leadCard,
  subtitle = 'why I’m saying what I’m saying', look = 'profiler',
  moreLabel = 'Show more', lessLabel = 'Show less',
}: PanelSurfaceProps) {
  const isBrain = look === 'brain';
  // The brain footers say "UPDATED 2S". That has to keep counting up or it
  // lies within a minute of a panel running — one timer for the whole
  // surface, re-rendering the cards so each recomputes its own age.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!isBrain) return;
    const id = setInterval(() => tick(n => n + 1), 20_000);
    return () => clearInterval(id);
  }, [isBrain]);
  const twoRow = !!(headerActions || updatedLabel);
  const closeOnLeft = dockSide === 'left';
  // Noa's Live Brain closes with an X; the Profiler drawer collapses back to
  // its wall, so it keeps the directional chevron.
  const closePath = isBrain
    ? 'M6 6l12 12M18 6L6 18'
    : (closeOnLeft ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6');
  const closeBtn = onClose ? (
    <button type="button" className={s.close} onClick={onClose} aria-label="Close">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={closePath} />
      </svg>
    </button>
  ) : null;
  const headerPanels = panels.filter(p => p.placement === 'header');
  const bodyPanels = panels.filter(p => p.placement !== 'header');
  const cards = (list: DisplayPanel[]) => (
    <div className={s.cards}>
      {list.map(p => (
        <Card
          key={p.id} panel={p} selected={p.id === selectedId} footer={footerFor?.(p)}
          isBrain={isBrain} moreLabel={moreLabel} lessLabel={lessLabel}
        />
      ))}
    </div>
  );
  // A body-group label shows when there's an explicit one, OR when a header
  // group exists (so "Sections" reads as distinct from the header group).
  const bodyLabel = sectionLabel ?? (headerPanels.length > 0 ? 'Profile sections' : null);

  return (
    <div className={`${s.surface} ${isBrain ? s.lookBrain : ''}`} data-look={look} dir={isBrain ? undefined : 'ltr'}>
      <header className={`${s.head} ${twoRow ? s.headTwo : ''}`}>
        <div className={s.headTop}>
          {closeOnLeft && closeBtn}
          <span className={`${s.logo} ${iconSvg ? s.logoSoft : ''}`} aria-hidden>
            {iconSvg
              ? <svg viewBox="0 0 60 60" width="22" height="22" fill="none" stroke="#9A2295" strokeWidth="2.4" strokeLinecap="round"><path d={iconSvg} /></svg>
              : icon}
          </span>
          <div className={s.mark}>
            <div className={s.title}>{title}</div>
            <div className={s.sub}>{subtitle}</div>
          </div>
          {(headerRight || (onClose && !closeOnLeft)) && (
            <div className={s.headRight}>
              {headerRight}
              {!closeOnLeft && closeBtn}
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
        {leadCard ? <div className={s.lead}>{leadCard}</div> : null}
        {panels.length === 0 ? (
          leadCard ? null : (
            <div className={s.empty}>
              <span className={s.emptyEmoji} aria-hidden>🧠</span>
              <span>{emptyLabel ?? 'Nothing here yet.'}</span>
            </div>
          )
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
