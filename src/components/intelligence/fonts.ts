const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700;800&family=Public+Sans:wght@400;500;600;700&display=swap';

export function ensureIntelligenceFontsLoaded() {
  if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONTS_HREF;
  document.head.appendChild(link);
}
