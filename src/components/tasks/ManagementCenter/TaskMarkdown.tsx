import type { ReactNode } from 'react';
import { stripAnchor } from './agendaParse';
import { Linkify } from './Linkify';
import { textDir } from './textDir';
import styles from './ManagementCenter.module.css';
import html from './TaskMarkdown.module.css';

/**
 * A task description, rendered readably — headings, bullets (nested by
 * indent), checklists, quotes, code fences, paragraphs with line breaks,
 * **bold**, `code` and links (Linkify). Each block picks its own direction (Hebrew → RTL).
 * Deliberately small: board descriptions are markdown-ish, not full markdown.
 */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+?\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i}><Linkify text={p.slice(2, -2)} /></strong>;
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={i} className={styles.mdCode}>{p.slice(1, -1)}</code>;
        return <span key={i}><Linkify text={p} /></span>;
      })}
    </>
  );
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const CHECK_RE = /^(\s*)[-*]\s+\[( |x|X)\]\s*(.*)$/;
const BULLET_RE = /^(\s*)(?:[-*•]|\d+[.)])\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

/** The board's rich editor saves HTML (pasted screenshots become <img> tags). */
const HTML_RE = /<(img|p|div|br|ul|ol|li|strong|em|b|i|h[1-6]|span|a)(?=[\s>/])[^>]*>/i;

/** Drop what must never run: scripts, inline handlers, javascript: links. */
function cleanHtml(src: string): string {
  const doc = new DOMParser().parseFromString(src, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(el => {
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith('on') || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  return doc.body.innerHTML;
}

export function TaskMarkdown({ text }: { text: string }) {
  if (HTML_RE.test(text)) {
    return <div className={html.html} dir="auto" dangerouslySetInnerHTML={{ __html: cleanHtml(text) }} />;
  }
  // Agenda lines that carry comments end with an id marker — never shown.
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(stripAnchor);
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
