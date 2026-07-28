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

import { useEffect, useRef, useState } from 'react';
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
function Tags({ tags, active }: { tags: string[]; active: string[] }) {
  const on = new Set(active);
  return (
    <div className={styles.tags}>
      {tags.map((t, i) => (
        <span key={i} className={`${styles.tag} ${on.has(t) ? styles.tagOn : ''}`}>{t}</span>
      ))}
    </div>
  );
}

// ── fields ─────────────────────────────────────────────────────────
/** Flashes once when its value changes — the "recently-changed" cue. */
/** "empty" values ("Not collected", "Unknown", "Not validated yet"…) get a
 *  muted italic look; long values wrap and drop to weight 600 — the same
 *  four value looks Noa uses, all driven by the value (not the demo). */
const EMPTY_RE = /^(not\s+collected|not\s+validated|not\s+provided|unknown|none|n\/?a|—|-)\b/i;
function FieldValue({ v, tag }: { v: string; tag?: boolean }) {
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
  const empty = EMPTY_RE.test((v || '').trim());
  const long = (v || '').length > 24;
  return (
    <span className={`${styles.fieldV} ${flash ? styles.flash : ''} ${empty ? styles.fieldEmpty : ''} ${long ? styles.fieldLong : ''}`}>
      {tag ? <span className={styles.pill}>{v}</span> : v}
    </span>
  );
}
function Fields({ pairs }: { pairs: NonNullable<PanelValues['pairs']> }) {
  return (
    <div className={styles.fields}>
      {pairs.map((p, i) => (
        <div className={styles.fieldRow} key={`${p.k}_${i}`}>
          <span className={styles.fieldK}>{p.k}</span>
          <FieldValue v={p.v} tag={p.tag} />
        </div>
      ))}
    </div>
  );
}

// ── bars ───────────────────────────────────────────────────────────
function Bars({ bars }: { bars: NonNullable<PanelValues['bars']> }) {
  return (
    <div className={styles.bars}>
      {bars.map((b, i) => (
        <div className={styles.bar} key={`${b.label}_${i}`}>
          <div className={styles.barRow}>
            <span className={styles.barLab}>{b.label}</span>
            <span className={styles.barNum}>{clamp(b.value)}%</span>
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
function Cards({ cards }: { cards: NonNullable<PanelValues['cards']> }) {
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

/** A one-line "compact template" of a panel's content — shown when the
 *  card is COLLAPSED (Noa's collapsed sections show a summary line, not an
 *  empty header). Derived from the same values, per render type. */
export function compactSummary(render: PanelRender, text?: string, values?: PanelValues): string {
  const join = (xs: string[]) => xs.filter(Boolean).join(' · ');
  switch (render) {
    case 'text':
    case 'html': {
      const plain = String(text ?? '')
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
export function PanelBody({ render, text, values }: {
  render: PanelRender;
  text?: string;
  values?: PanelValues;
}) {
  switch (render) {
    case 'text': return <PanelMarkdown text={text ?? ''} className={styles.body} />;
    case 'html': return <PanelMarkdown text={text ?? ''} className={styles.body} html />;
    case 'tags': return <Tags tags={values?.tags ?? []} active={values?.active ?? []} />;
    case 'fields': return <Fields pairs={values?.pairs ?? []} />;
    case 'bars': return <Bars bars={values?.bars ?? []} />;
    case 'cards': return <Cards cards={values?.cards ?? []} />;
    case 'journey': return <Journey journey={values?.journey ?? {}} />;
    default: return null;
  }
}
