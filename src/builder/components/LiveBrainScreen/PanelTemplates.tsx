/**
 * PanelTemplates — the ONE set of Live Brain render bodies, shared by the
 * builder preview AND the customer surface. This is the presentation
 * layer: it consumes render + values (the data contract) and knows
 * nothing about where they came from. Restyle here → both surfaces
 * change; the engine/data is never touched.
 *
 * Six templates (task 754): text, html, tags, fields, bars, cards.
 * Colours come from CSS vars (--lb-accent etc.) so each host themes it
 * (builder = indigo, customer = brand). Update animations live here too
 * (flash / highlight-slide / fill-grow / card-in), gated by
 * prefers-reduced-motion in the stylesheet.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PanelRender } from '../../types';
import { PanelMarkdown } from './PanelMarkdown';
import styles from './PanelTemplates.module.css';

/** The render-ready value shape per template (mirrors the server's
 *  panelShapes output). One of these keys is populated per render. */
export interface PanelValues {
  text?: string;                                            // text / html
  tags?: string[];                                          // tags
  active?: string[];                                        // tags
  pairs?: { k: string; v: string; tag?: boolean }[];        // fields
  bars?: { label: string; value: number; color?: string; caption?: string }[]; // bars (caption = Noa's sub-label)
  cards?: { title: string; body: string; tag?: string }[]; // cards (tag = a status pill, e.g. EMERGING)
  journey?: {                                              // journey / status
    rows?: { k: string; v: string; pill?: boolean }[];
    readiness?: { label?: string; value: number };
    next?: string;
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, Number(n) || 0));

// ── tags ───────────────────────────────────────────────────────────
/** How many chips the brain shows before folding the rest behind "+N".
 *  Noa's rule: a long list must not swallow the panel. */
const TAGS_VISIBLE = 8;

function Tags({ tags, active, brain }: { tags: string[]; active: string[]; brain?: boolean }) {
  const on = new Set(active);
  const [expanded, setExpanded] = useState(false);
  const hidden = brain && !expanded ? Math.max(0, tags.length - TAGS_VISIBLE) : 0;
  const shown = hidden > 0 ? tags.slice(0, TAGS_VISIBLE) : tags;
  return (
    <div className={styles.tags}>
      {shown.map((t, i) => (
        <span key={i} className={`${styles.tag} ${on.has(t) ? styles.tagOn : ''}`}>{t}</span>
      ))}
      {hidden > 0 && (
        <button type="button" className={styles.tagMore} onClick={() => setExpanded(true)}>
          +{hidden}
        </button>
      )}
    </div>
  );
}

// ── fields ─────────────────────────────────────────────────────────
/** Flashes once when its value changes — the "recently-changed" cue. */
/** "empty" values ("Not collected", "Unknown", "Not validated yet"…) get a
 *  muted italic look; long values wrap and drop to weight 600 — the same
 *  four value looks Noa uses, all driven by the value (not the demo). */
const EMPTY_RE = /^(not\s+collected|not\s+validated|not\s+provided|unknown|none|n\/?a|—|-)\b/i;

/**
 * Split "1.4 words" / "120,000 ₪" / "3" into a number and its unit, or null
 * when the value is prose. The brain sets numbers in mono and pins them LTR
 * (Noa's rule) so a column of figures lines up and a Hebrew row can't flip
 * the digits — the unit stays in the body font beside it.
 */
function splitNumeric(v: string): { num: string; unit: string } | null {
  const m = (v || '').trim().match(/^([+-]?\d[\d,  ]*(?:[.,]\d+)?)\s*(.{0,12})$/);
  if (!m) return null;
  const num = m[1].trim();
  const unit = (m[2] ?? '').trim();
  // A trailing chunk with its own digits isn't a unit ("3 / 4", "2 of 5").
  if (/\d/.test(unit)) return null;
  return { num, unit };
}

function FieldValue({ v, tag, brain }: { v: string; tag?: boolean; brain?: boolean }) {
  const [flash, setFlash] = useState(false);
  const prev = useRef(v);
  useEffect(() => {
    if (prev.current !== v) {
      prev.current = v;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      return () => clearTimeout(t);
    }
  }, [v]);
  const text = (v || '').trim();
  const empty = EMPTY_RE.test(text);
  const long = (v || '').length > 24;

  // Noa keeps an uncollected field VISIBLE — a dash plus a "not yet collected"
  // chip — so the shape of the profile still reads. The chip carries whatever
  // phrase the panel returned; a bare dash needs no chip.
  if (brain && empty) {
    const phrase = /^[—-]+$/.test(text) ? '' : text;
    return (
      <span className={`${styles.fieldV} ${styles.fieldBlank}`}>
        <span className={styles.fieldDash}>—</span>
        {phrase && <span className={styles.fieldBlankPill}>{phrase}</span>}
      </span>
    );
  }

  const numeric = brain && !tag ? splitNumeric(text) : null;
  if (numeric) {
    return (
      <span className={`${styles.fieldV} ${flash ? styles.flash : ''}`}>
        <span className={styles.fieldNum} dir="ltr">{numeric.num}</span>
        {numeric.unit && <span className={styles.fieldUnit}>{numeric.unit}</span>}
      </span>
    );
  }

  return (
    <span className={`${styles.fieldV} ${flash ? styles.flash : ''} ${empty ? styles.fieldEmpty : ''} ${long ? styles.fieldLong : ''}`}>
      {tag ? <span className={styles.pill}>{v}</span> : v}
    </span>
  );
}
function Fields({ pairs, brain }: { pairs: NonNullable<PanelValues['pairs']>; brain?: boolean }) {
  return (
    <div className={styles.fields}>
      {pairs.map((p, i) => (
        <div className={styles.fieldRow} key={`${p.k}_${i}`}>
          <span className={styles.fieldK}>{p.k}</span>
          <FieldValue v={p.v} tag={p.tag} brain={brain} />
        </div>
      ))}
    </div>
  );
}

// ── bars ───────────────────────────────────────────────────────────
function Bars({ bars, brain }: { bars: NonNullable<PanelValues['bars']>; brain?: boolean }) {
  return (
    <div className={styles.bars}>
      {bars.map((b, i) => (
        <div className={styles.bar} key={`${b.label}_${i}`}>
          <div className={styles.barRow}>
            <span className={styles.barLab}>{b.label}</span>
            {/* The brain's measures are scores on a scale the footer states,
                so they're bare numbers; the Profiler's bars are percentages. */}
            <span className={styles.barNum} dir="ltr">{clamp(b.value)}{brain ? '' : '%'}</span>
          </div>
          <div className={styles.track}>
            {/* No inline background → the CSS gradient shows. Only an
                explicit author colour overrides it. */}
            <div className={styles.fill} style={{ width: `${clamp(b.value)}%`, ...(b.color ? { background: b.color } : {}) }} />
          </div>
          {/* Noa's per-bar sub-label under the track (e.g. "Warming up"). */}
          {b.caption ? <div className={styles.barCaption}>{b.caption}</div> : null}
        </div>
      ))}
    </div>
  );
}

// ── cards ──────────────────────────────────────────────────────────
function Cards({ cards, brain }: { cards: NonNullable<PanelValues['cards']>; brain?: boolean }) {
  // The brain's card is a stacked, bordered box with THREE parts: a mono
  // eyebrow naming the source ("DOC · 03"), a real title, then the body.
  // The Profiler's insight card sets the title itself as the mono eyebrow —
  // a different shape for a different job, so they don't share markup.
  if (brain) {
    return (
      <div className={styles.cards}>
        {cards.map((c, i) => (
          <div className={styles.card} key={`${c.title}_${i}`}>
            {c.tag ? <div className={styles.cardEyebrow} dir="ltr">{c.tag}</div> : null}
            {c.title ? <div className={styles.cardHeading}>{c.title}</div> : null}
            {c.body ? <div className={styles.cardBody}>{c.body}</div> : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.cards}>
      {cards.map((c, i) => (
        <div className={styles.card} key={`${c.title}_${i}`}>
          {(c.title || c.tag) ? (
            <div className={styles.cardTitleRow}>
              {c.title ? <span className={styles.cardTitle}>{c.title}</span> : <span />}
              {c.tag ? <span className={styles.cardTag}>{c.tag}</span> : null}
            </div>
          ) : null}
          {c.body ? <div className={styles.cardBody}>{c.body}</div> : null}
        </div>
      ))}
    </div>
  );
}

/** Noa's Live Brain per-panel FOOTER — a mono metadata row (left + right),
 *  computed from the panel's values. Only the `brain` look shows it. */
export function panelFooter(render: PanelRender, values?: PanelValues, ranAt?: number): { left: ReactNode; right: ReactNode } | null {
  switch (render) {
    case 'tags': {
      const total = values?.tags?.length ?? 0;
      const on = values?.active?.length ?? 0;
      if (!total) return null;
      // Noa's fixed legend: two real swatches on the left, the count on the
      // right — so "on" is readable even where the colour doesn't survive.
      return {
        left: (
          <span className={styles.legend}>
            <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchOn}`} />ON</span>
            <span className={styles.legendItem}><span className={`${styles.swatch} ${styles.swatchOff}`} />OFF</span>
          </span>
        ),
        right: `${on} / ${total} ON`,
      };
    }
    case 'fields': {
      const pairs = values?.pairs ?? [];
      if (!pairs.length) return null;
      const filled = pairs.filter(p => p.v && !EMPTY_RE.test(p.v.trim())).length;
      return { left: `${filled} / ${pairs.length} FILLED`, right: agoLabel(ranAt) };
    }
    case 'bars': {
      const n = values?.bars?.length ?? 0;
      if (!n) return null;
      // Her order: the scale first (it's what makes the numbers comparable),
      // the count second.
      return { left: 'SCALE 0–100', right: `${n} MEASURES` };
    }
    case 'cards': {
      const n = values?.cards?.length ?? 0;
      if (!n) return null;
      return { left: 'NONE SELECTED', right: `${n} RETRIEVED` };
    }
    case 'text':
    case 'html':
      // Noa's TEXT footer carries the update cue, nothing else — the type is
      // already named in the head, so repeating it here is noise. HTML isn't
      // in her library, so it follows TEXT.
      return { left: '', right: agoLabel(ranAt) || 'READY' };
    default:
      return null;
  }
}

/** "UPDATED 2S" — how the brain announces that a panel recomputed. Panels
 *  update in chunks, never by typing, so this label IS the cue. */
export function agoLabel(ranAt?: number): string {
  if (!ranAt) return '';
  const secs = Math.max(0, Math.round((Date.now() - ranAt) / 1000));
  if (secs < 60) return `UPDATED ${secs}S`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `UPDATED ${mins}M`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `UPDATED ${hrs}H` : `UPDATED ${Math.round(hrs / 24)}D`;
}

/** A one-line "compact template" of a panel's content — shown when the
 *  card is COLLAPSED (Noa's collapsed sections show a summary line, not an
 *  empty header). Derived from the same values, per render type. */
export function compactSummary(render: PanelRender, text?: string, values?: PanelValues): string {
  const join = (xs: string[]) => xs.filter(Boolean).join(' · ');
  switch (render) {
    case 'text':
    case 'html': {
      const plain = String(text ?? '')
        .replace(/<[^>]*>/g, ' ')            // an HTML panel's markup is not a summary
        .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, ' ')
        .replace(/[#*_`>~-]/g, '')           // strip common markdown marks
        .replace(/\s+/g, ' ')
        .trim();
      return plain.length > 90 ? `${plain.slice(0, 88)}…` : plain;
    }
    case 'tags': {
      const active = values?.active ?? [];
      const list = active.length ? active : (values?.tags ?? []);
      return join(list.slice(0, 5));
    }
    case 'fields':
      return join((values?.pairs ?? []).slice(0, 4).map(p => `${p.v}`));
    case 'bars':
      return join((values?.bars ?? []).slice(0, 4).map(b => `${b.label} ${clamp(b.value)}`));
    case 'cards':
      return join((values?.cards ?? []).slice(0, 4).map(c => c.title));
    case 'journey': {
      const j = values?.journey;
      const rows = (j?.rows ?? []).slice(0, 3).map(r => r.v);
      return join(rows.length ? rows : [j?.next ?? '']);
    }
    default:
      return '';
  }
}

// ── journey / status ────────────────────────────────────────────────
function Journey({ journey }: { journey: NonNullable<PanelValues['journey']> }) {
  const rows = journey.rows ?? [];
  const r = journey.readiness;
  return (
    <div className={styles.journey}>
      {rows.map((row, i) => {
        const long = (row.v || '').length > 28;
        return (
          <div className={`${styles.jRow} ${long ? styles.jRowLong : ''}`} key={`${row.k}_${i}`}>
            <span className={styles.jK}>{row.k}</span>
            {row.pill
              ? <span className={styles.jPill}>{row.v}</span>
              : <span className={`${styles.jV} ${long ? styles.jVLong : ''}`}>{row.v}</span>}
          </div>
        );
      })}
      {(r || journey.next) && (
        <div className={styles.jReady}>
          {r && (
            <>
              <div className={styles.jReadyHead}>
                <span className={styles.jReadyLab}>{r.label || 'Journey readiness'}</span>
                <span className={styles.jReadyNum}>{clamp(r.value)}%</span>
              </div>
              <div className={styles.track}><div className={styles.fill} style={{ width: `${clamp(r.value)}%` }} /></div>
            </>
          )}
          {journey.next ? (
            <div className={styles.jNext}>
              <svg className={styles.jNextIcon} viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9A2295" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              <span className={styles.jNextText}><strong>Suggested next step:</strong> {journey.next}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** The template slot — draws a panel's body for its render type. */
export function PanelBody({ render, text, values, brain }: {
  render: PanelRender;
  text?: string;
  values?: PanelValues;
  /** Live Brain look — enables Noa's brain-only behaviours (chip overflow). */
  brain?: boolean;
}) {
  switch (render) {
    case 'text': return <PanelMarkdown text={text ?? ''} className={styles.body} />;
    case 'html': return <PanelMarkdown text={text ?? ''} className={styles.body} html />;
    case 'tags': return <Tags tags={values?.tags ?? []} active={values?.active ?? []} brain={brain} />;
    case 'fields': return <Fields pairs={values?.pairs ?? []} brain={brain} />;
    case 'bars': return <Bars bars={values?.bars ?? []} brain={brain} />;
    case 'cards': return <Cards cards={values?.cards ?? []} brain={brain} />;
    case 'journey': return <Journey journey={values?.journey ?? {}} />;
    default: return null;
  }
}
