/**
 * Schibsted Grotesk + Public Sans carry NO Hebrew glyphs, so every Hebrew
 * string in Intelligence used to fall through to whatever system-ui resolved
 * to — visibly a different typeface next to the Latin text, and worst at
 * large weights (task #79: the app title on Otto's building screen).
 * Assistant is this repo's Hebrew face already (TeamPlanPage, hq.css); it
 * only ever renders the glyphs the Latin fonts lack, since fallback is
 * per-character and the Latin fonts come first in the stack.
 */
const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700;800&family=Public+Sans:wght@400;500;600;700&family=Assistant:wght@400;500;600;700;800&display=swap';

export function ensureIntelligenceFontsLoaded() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}
