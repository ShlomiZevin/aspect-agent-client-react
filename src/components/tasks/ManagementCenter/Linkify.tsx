import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { splitBold } from './agendaParse';
import styles from './ManagementCenter.module.css';

/**
 * URLs in board text (now: lines, agenda lines and their details, task
 * descriptions) become real links that open in a new tab. A link never
 * triggers the row / line it sits in: its click and keys stop there.
 *
 * Long URLs are shown short (host + path, ellipsis); the full URL is the
 * link's title. The link is isolated left-to-right, so a URL inside a Hebrew
 * line keeps its own order without flipping the line around it.
 */

// http(s) only; stops at whitespace, quotes, angle brackets and Hebrew letters.
const URL_RE = /https?:\/\/[^\s<>"'֐-׿]+/g;
const TRAILING_RE = /[.,;:!?…]+$/;
const MAX_SHOWN = 42;

/** Trailing punctuation and an unbalanced closing bracket belong to the sentence, not the URL. */
function trimUrl(raw: string): string {
  let url = raw.replace(TRAILING_RE, '');
  for (const [open, close] of [['(', ')'], ['[', ']']] as const) {
    while (url.endsWith(close) && url.split(close).length > url.split(open).length) {
      url = url.slice(0, -1).replace(TRAILING_RE, '');
    }
  }
  return url;
}

/** "https://www.github.com/a/b?x=1#y" → "github.com/a/b" (query and hash dropped), capped with an ellipsis. */
function shortUrl(url: string): string {
  let shown = url;
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    shown = u.host.replace(/^www\./, '') + path;
    if (u.search || u.hash) shown += '…';
  } catch {
    shown = url.replace(/^https?:\/\//, '');
  }
  return shown.length > MAX_SHOWN ? `${shown.slice(0, MAX_SHOWN - 1)}…` : shown;
}

const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

/** Plain text with its URLs as links. */
export function Linkify({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    const start = m.index ?? 0;
    if (!url || url.length < 'https://x'.length) continue;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.textLink}
        title={url}
        dir="ltr"
        onClick={stop}
        onKeyDown={stop}
        onMouseDown={stop}
      >
        {shortUrl(url)}
      </a>,
    );
    last = start + url.length;
  }
  if (last === 0) return <>{text}</>;
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

/** `**bold**` + links — agenda lines, their details, notes. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((p, i) => (p.bold
        ? <strong key={i}><Linkify text={p.text} /></strong>
        : <span key={i}><Linkify text={p.text} /></span>))}
    </>
  );
}
