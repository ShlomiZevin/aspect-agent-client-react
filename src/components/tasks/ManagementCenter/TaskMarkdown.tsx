import type { ReactNode } from 'react';
import { textDir } from './textDir';
import styles from './ManagementCenter.module.css';

/**
 * A task description, rendered readably — headings, bullets (nested by
 * indent), checklists, quotes, code fences, paragraphs with line breaks,
 * **bold** and `code`. Each block picks its own direction (Hebrew → RTL).
 * Deliberately small: board descriptions are markdown-ish, not full markdown.
 */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+?\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i} className={styles.mdCode}>{p.slice(1, -1)}</code>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const CHECK_RE = /^(\s*)[-*]\s+\[( |x|X)\]\s*(.*)$/;
const BULLET_RE = /^(\s*)(?:[-*•]|\d+[.)])\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

export function TaskMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    const joined = para.join('\n');
    out.push(
      <p key={k++} className={styles.mdP} dir={textDir(joined)}>
        {para.map((l, i) => (
          <span key={i}>{i > 0 && <br />}<Inline text={l} /></span>
        ))}
      </p>,
    );
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim().startsWith('```')) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++; }
      out.push(<pre key={k++} className={styles.mdPre} dir="ltr">{code.join('\n')}</pre>);
      continue;
    }
    if (!raw.trim()) { flushPara(); continue; }
    const h = raw.match(HEADING_RE);
    if (h) {
      flushPara();
      out.push(<div key={k++} className={h[1].length <= 2 ? styles.mdH : styles.mdH3} dir={textDir(h[2])}><Inline text={h[2]} /></div>);
      continue;
    }
    const c = raw.match(CHECK_RE);
    const b = c ? null : raw.match(BULLET_RE);
    if (c || b) {
      flushPara();
      const indent = Math.min(3, Math.floor(((c ? c[1] : b![1]) || '').replace(/\t/g, '  ').length / 2));
      const body = c ? c[3] : b![2];
      out.push(
        <div key={k++} className={styles.mdLi} dir={textDir(body)} style={{ paddingInlineStart: 18 + indent * 18 }}>
          <span className={styles.mdMark} aria-hidden="true">{c ? (c[2] === ' ' ? '☐' : '☑') : '–'}</span>
          <Inline text={body} />
        </div>,
      );
      continue;
    }
    const q = raw.match(QUOTE_RE);
    if (q) {
      flushPara();
      out.push(<div key={k++} className={styles.mdQuote} dir={textDir(q[1])}><Inline text={q[1]} /></div>);
      continue;
    }
    para.push(raw.trim());
  }
  flushPara();
  return <>{out}</>;
}
