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
  bars?: { label: string; value: number; color?: string }[]; // bars
  cards?: { title: string; body: string }[];               // cards
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
  return (
    <span className={`${styles.fieldV} ${flash ? styles.flash : ''}`}>
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
            <span className={styles.barNum}>{clamp(b.value)}</span>
          </div>
          <div className={styles.track}>
            {/* No inline background → the CSS gradient shows. Only an
                explicit author colour overrides it. */}
            <div className={styles.fill} style={{ width: `${clamp(b.value)}%`, ...(b.color ? { background: b.color } : {}) }} />
          </div>
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
          {c.title ? <div className={styles.cardTitle}>{c.title}</div> : null}
          {c.body ? <div className={styles.cardBody}>{c.body}</div> : null}
        </div>
      ))}
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
    default: return null;
  }
}
