#!/usr/bin/env node
/**
 * Generates per-route Open Graph / Twitter-card share pages after `vite build`.
 *
 * Why this exists: the app is a client-side SPA with one index.html and one
 * <title>/<meta> set. Crawlers (WhatsApp, Slack, iMessage, Facebook) read the
 * raw HTML of the URL they're given and do NOT execute JS, so every shared
 * link — no matter the route — previewed with the same generic "AI Agent /
 * AI-powered assistant" card.
 *
 * This script takes the ALREADY-BUILT dist/index.html (so the <script>/<link>
 * tags are the real hashed bundle paths Vite produced — never hand-write
 * those, they change every build) and, for each entry below, writes a copy
 * with just the title, description, and og/twitter meta tags swapped, at
 * dist/<route>.html. A Firebase Hosting rewrite (firebase.json) then serves
 * that file's bytes at the clean URL, ahead of the SPA catch-all — so a real
 * browser gets the exact same app (script tags are untouched, React Router
 * reads the real URL and renders normally) while a crawler sees a proper
 * title/description/image.
 *
 * Add a new entry here + a matching rewrite in firebase.json to cover
 * another route.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const BASE_URL = 'https://aspect-agents.web.app';

const PAGES = [
  {
    route: '/intelligence/zolstock',
    outFile: 'intelligence/zolstock.html',
    title: 'תובנות AI לזול סטוק · Aspect Intelligence',
    description: 'בינה מלאכותית שחוקרת את המכירות, המלאי והרווחיות של זול סטוק ובונה דוחות עסקיים מדויקים תוך דקות — בעברית ובאנגלית.',
    image: `${BASE_URL}/img/og-zolstock.png`,
    locale: 'he_IL',
  },
];

function buildHead(base, page) {
  const ogBlock = `
    <title>${page.title}</title>
    <meta name="description" content="${page.description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${BASE_URL}${page.route}" />
    <meta property="og:title" content="${page.title}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:image" content="${page.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${page.locale}" />
    <meta property="og:site_name" content="Aspect Intelligence" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${page.title}" />
    <meta name="twitter:description" content="${page.description}" />
    <meta name="twitter:image" content="${page.image}" />
  </head>`;

  // Drop the generic <title>/<meta name="description"> from the built
  // index.html and swap in the page-specific block right before </head>,
  // so the real (hashed) <script>/<link> tags earlier in <head> are untouched.
  return base
    .replace(/<title>.*?<\/title>\s*/s, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
    .replace(/<\/head>/, ogBlock);
}

function main() {
  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('[inject-share-pages] dist/index.html not found — run vite build first.');
    process.exit(1);
  }
  const base = fs.readFileSync(indexPath, 'utf8');

  for (const page of PAGES) {
    const html = buildHead(base, page);
    const outPath = path.join(DIST, page.outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`[inject-share-pages] wrote ${page.outFile} for ${page.route}`);
  }
}

main();
