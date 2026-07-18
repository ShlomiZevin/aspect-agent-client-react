/**
 * PanelMarkdown — the Live Brain `text` renderer.
 *
 * Renders a panel's string as Markdown AND safe HTML, so an author (or an
 * AI panel) can return GitHub-flavoured Markdown, raw HTML, or a mix — and
 * style it. `rehype-raw` parses the embedded HTML; `rehype-sanitize` then
 * strips anything dangerous (scripts, iframes, event handlers,
 * javascript: URLs) while KEEPING presentational markup — layout tags plus
 * `style`/`class` — so styled cards render.
 *
 * Deliberately SEPARATE from the chat's MarkdownBody: enabling raw HTML
 * here must never change how chat messages render.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Options as SanitizeSchema } from 'rehype-sanitize';

// Extend GitHub's safe default schema: allow common layout tags + inline
// `style`/`class` so panels can present rich, styled content. Everything
// dangerous stays blocked — script/iframe/object are simply not added to
// the tag allow-list, and event-handler / javascript: attributes are not
// in the attribute allow-list, so the sanitizer drops them.
const SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  // Remove these elements AND all their text content — so a model that
  // returns a whole HTML document doesn't leak the <style> CSS or the
  // <title> as visible text (the tag is stripped, but without this its
  // text children would render). Everything useful lives in <body>, which
  // is unwrapped so its children survive.
  strip: ['script', 'style', 'head', 'title', 'noscript', 'link', 'meta'],
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'div', 'span', 'section', 'article', 'header', 'footer',
    'small', 'u', 'mark', 'figure', 'figcaption', 'time', 'address',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'style', 'className', 'class',
    ],
  },
};

/**
 * `html` opts into raw-HTML rendering (the `html` panel render). Without
 * it — the `text` / Markdown render — embedded HTML is escaped, exactly
 * like a normal Markdown surface.
 */
export function PanelMarkdown({ text, className, html }: { text: string; className?: string; html?: boolean }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={html ? [rehypeRaw, [rehypeSanitize, SCHEMA]] : []}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
