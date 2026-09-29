/**
 * Readable rendering of a Targeted KB text (task #830).
 *
 * The old screen showed value text in a monospace <pre>: no wrapping,
 * Hebrew cut off at the edge, `{{…}}` indistinguishable from prose. This
 * renders it as text a person reads:
 *
 *   - each paragraph picks its own direction (`dir="auto"`), so Hebrew is
 *     right-to-left and an English paragraph stays left-to-right;
 *   - light formatting: `#`/`##` headings, `-`/`*` bullets, `>` quotes,
 *     `**bold**`;
 *   - `{{token}}` as a small chip (always left-to-right inside it), and a
 *     builder note `{{# … }}` greyed — it never reaches the agent;
 *   - tables keep their existing card rendering (MarkdownWithTables) and
 *     stay clickable to edit.
 *
 * Display only: the stored text is never altered.
 */

import type { ReactNode } from 'react';
import { MarkdownWithTables } from '../TableEditor/MarkdownWithTables';
import styles from './TargetedKbPage.module.css';

const TOKEN_RE = /(\{\{#\s[\s\S]*?\}\}|\{\{[^{}]+\}\}|\*\*[^*]+\*\*)/g;

/** Tokens, notes and bold inside one line. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const t = m[0];
    const key = `${keyBase}-${i++}`;
    if (t.startsWith('{{#')) {
      out.push(<span key={key} className={styles.note} title="Builder note — never sent to the agent">{t.slice(3, -2).trim()}</span>);
    } else if (t.startsWith('{{')) {
      out.push(<bdi key={key} className={styles.chip} dir="ltr">{t}</bdi>);
    } else {
      out.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    }
    last = start + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** One stretch of prose (no tables) → paragraphs, headings, lists. */
export function Prose({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return null;
        const key = `b${bi}`;
        const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
        if (h && lines.length === 1) {
          return <div key={key} dir="auto" className={h[1].length === 1 ? styles.h1 : styles.h2}>{inline(h[2], key)}</div>;
        }
        if (lines.every(l => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={key} dir="auto" className={styles.list}>
              {lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ''), `${key}-${li}`)}</li>)}
            </ul>
          );
        }
        if (lines.every(l => /^\s*>\s?/.test(l))) {
          return (
            <blockquote key={key} dir="auto" className={styles.quote}>
              {lines.map((l, li) => <div key={li}>{inline(l.replace(/^\s*>\s?/, ''), `${key}-${li}`)}</div>)}
            </blockquote>
          );
        }
        // A paragraph keeps its single line breaks — authors lay text out
        // line by line (e.g. a list of example phrases).
        return (
          <p key={key} dir="auto" className={styles.para}>
            {lines.map((l, li) => (
              <span key={li}>{li > 0 && <br />}{inline(l, `${key}-${li}`)}</span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export function RichText({ text, onEditTable, empty }: {
  text: string;
  /** Clicking a table opens the table editor with that table's source. */
  onEditTable?: (sourceMd: string, range: { start: number; end: number }) => void;
  empty?: string;
}) {
  if (!text.trim()) return <p className={styles.emptyText}>{empty ?? 'Nothing written yet.'}</p>;
  return (
    <div className={styles.rich}>
      <MarkdownWithTables
        text={text}
        onEditTable={onEditTable ?? (() => {})}
        renderProse={slice => <Prose text={slice} />}
      />
    </div>
  );
}
