/**
 * MarkdownBody — renders Alfred's assistant messages as markdown.
 *
 * Why markdown: Alfred emits structured suggestions — prompts,
 * field tables, JSON snippets, transition recipes. Plain-text bubbles
 * make all of that an unreadable wall. With markdown we get headings,
 * lists, code fences (with copy buttons), and a "Suggestion" callout
 * via blockquotes.
 *
 * Conventions baked in (Alfred's system prompt enforces them):
 *   - Fenced code blocks for any verbatim snippet — prompts, JSON,
 *     field schemas, addon configs.
 *   - Blockquotes (`> ...`) for concrete recommendations the user can
 *     act on. Rendered as the tinted "Suggestion" callout below.
 */

import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './MarkdownBody.module.css';

interface Props {
  text: string;
}

export function MarkdownBody({ text }: Props) {
  return (
    <div className={styles.body}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeRenderer,
          blockquote: ({ children }) => (
            <blockquote className={styles.suggestion}>{children}</blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ─── Code block + inline code ─────────────────────────────────────

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
}

function CodeRenderer({ inline, className, children }: CodeProps) {
  // react-markdown passes the language as `language-xxx` on fenced
  // blocks, no className on inline `code`. That's how we differentiate
  // here without relying on the `inline` flag (which has been flaky
  // across versions).
  const lang = (className || '').replace(/^language-/, '').trim();
  const text = extractText(children);

  // Treat as inline when react-markdown says so OR when there's no
  // language class AND the text is single-line. Errs on the side of
  // showing inline for short stuff so prose doesn't get blocked-out.
  if (inline || (!className && !text.includes('\n'))) {
    return <code className={styles.inlineCode}>{children}</code>;
  }

  return <CodeBlock lang={lang} text={text} />;
}

/**
 * Strip surrounding ASCII or Unicode quote marks from a verbatim
 * block before copying. Alfred occasionally wraps prompts in `"…"`
 * out of habit, even when they're already inside a code fence —
 * pasting that into a Talker prompt field with the quotes attached
 * is annoying. We only strip when first and last char match a
 * known quote pair, so legitimate code that happens to start/end
 * with a quote (a literal "hello" line, say) is preserved unless
 * it's literally the entire content.
 */
const QUOTE_PAIRS: Record<string, string> = {
  '"': '"',
  '\'': '\'',
  '`':  '`',
  '“': '”', // “ ”
  '‘': '’', // ‘ ’
};

function stripWrappingQuotes(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;
  const first = trimmed[0];
  const last  = trimmed[trimmed.length - 1];
  if (QUOTE_PAIRS[first] === last) {
    return trimmed.slice(1, -1).trim();
  }
  return text;
}

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(stripWrappingQuotes(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard rejected — leave state alone.
    }
  };
  return (
    <div className={styles.codeBlockWrap}>
      <div className={styles.codeBlockLang}>
        <span>{lang || 'text'}</span>
        <button
          type="button"
          className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ''}`}
          onClick={onCopy}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className={styles.codeBlockPre}>{text}</pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    const props = (node as { props: { children?: ReactNode } }).props;
    return extractText(props.children);
  }
  return '';
}
