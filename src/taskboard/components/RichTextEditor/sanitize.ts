// Kept out of RichTextEditor.tsx so that file exports only its component —
// mixing a component and a helper in one module breaks React fast refresh.

/**
 * Strips anything that can execute or navigate before stored markup is rendered.
 *
 * An allowlist, not a blocklist: the editor above only ever produces these tags,
 * so anything else in a stored value did not come from it.
 */
const ALLOWED = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'H3', 'PRE', 'CODE', 'BR', 'DIV', 'P', 'SPAN',
  'UL', 'OL', 'LI', 'IMG', 'INPUT',
]);

export function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (!ALLOWED.has(el.tagName)) {
      // Unwrapped rather than deleted, so the text inside a stray tag survives.
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const keep =
        (el.tagName === 'IMG' && name === 'src' && /^(data:image\/|https:)/.test(attr.value)) ||
        (el.tagName === 'IMG' && name === 'alt') ||
        (el.tagName === 'INPUT' && (name === 'type' || name === 'checked')) ||
        (name === 'class' && attr.value.startsWith('checklist'));
      // Everything else goes, which is what removes every on* handler, style,
      // and any javascript: or data:text/html URL in one rule.
      if (!keep) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'INPUT' && el.getAttribute('type') !== 'checkbox') el.remove();
  }

  return root.innerHTML;
}
