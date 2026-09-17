#!/usr/bin/env node
/**
 * Rewrites Open Graph / Twitter-card meta tags after `vite build`, for two
 * things: the site-wide default (dist/index.html itself, in place) and any
 * per-route override (a full copy of index.html at dist/<route>.html, for a
 * page whose share preview should differ from the site default).
 *
 * Why this exists: the app is a client-side SPA with one index.html and one
 * <title>/<meta> set at build time. Crawlers (WhatsApp, Slack, iMessage,
 * Facebook) read the raw HTML of the URL they're given and do NOT execute
 * JS, so every link on every route previewed with the same placeholder
 * ("AI Agent") and no image at all — including the two live products this
 * one index.html is built for under different Firebase targets, aspect-
 * agents.web.app and lybi.ai. Reported by Shlomi 2026-09-14 (superhist and
 * lybi.ai links both previewed "not good").
 *
 * Usage: node inject-share-pages.cjs <target>, where <target> matches a key
 * of DEFAULTS below and is one of the modes in package.json's deploy:*
 * scripts (aspect, lybi-prod, ...). Run AFTER vite build, BEFORE firebase
 * deploy, against that build's dist/.
 *
 * Site-wide default: strips whatever title, meta description, and og:/twitter:
 * tags are already in dist/index.html (the vite-built placeholder the first
 * time, or a previous run's output if this script runs twice) and writes
 * DEFAULTS[target]'s set in their place, IN index.html itself — not a copy —
 * since every route on that target should get it unless overridden below.
 *
 * Per-route override: takes the JUST-REWRITTEN dist/index.html (so the real
 * hashed <script>/<link> tags are intact and the head already starts from
 * the target's own default rather than the raw placeholder) and, for each
 * entry in PAGES whose target matches, writes a copy with that route's own
 * title/description/image swapped in, at dist/<route>.html. A Firebase
 * Hosting rewrite (firebase.json) then serves that file's bytes at the
 * clean URL, ahead of the SPA catch-all — a real browser gets the exact
 * same app (script tags untouched, React Router renders normally from the
 * real URL) while a crawler sees the route-specific card.
 *
 * Add a new per-route entry here + a matching rewrite in firebase.json to
 * cover another route; add a new target to DEFAULTS to cover another
 * Firebase site.
 */
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

const DEFAULTS = {
  aspect: {
    baseUrl: 'https://aspect-agents.web.app',
    title: 'Aspect Intelligence — AI that investigates your business data',
    description: 'Ask a question and Aspect finds the answer in your real sales, inventory and customer data, then builds the report for you.',
    image: 'https://aspect-agents.web.app/img/og-aspect-default.png',
    siteName: 'Aspect Intelligence',
    locale: 'en_US',
  },
  'lybi-prod': {
    baseUrl: 'https://lybi.ai',
    title: 'LYBI — The Intelligent Relationship System',
    description: "Built for organizations that can't afford to lose the connection with their customers.",
    image: 'https://lybi.ai/img/og-lybi-default.png',
    siteName: 'LYBI',
    locale: 'en_US',
  },
};

const PAGES = [
  {
    target: 'aspect',
    // Old prefix (task #75 moved the canonical URL to /zolstock/intelligence
    // - see the matching entry below). Kept, not moved: this exact address is
    // already out in the world as a share link, and the app's own client-side
    // redirect only runs for a real browser - a crawler reads this raw HTML
    // and never sees the redirect at all, so retiring this entry would
    // regress that link's preview back to the site default.
    route: '/intelligence/zolstock',
    outFile: 'intelligence/zolstock.html',
    title: 'תובנות AI לזול סטוק · Aspect Intelligence',
    description: 'בינה מלאכותית שחוקרת את המכירות, המלאי והרווחיות של זול סטוק ובונה דוחות עסקיים מדויקים תוך דקות — בעברית ובאנגלית.',
    image: `${DEFAULTS.aspect.baseUrl}/img/og-zolstock.png`,
    locale: 'he_IL',
  },
  {
    target: 'aspect',
    // New canonical prefix (task #75) - same card, so anything shared from
    // inside the product from now on previews just as well as the old link.
    route: '/zolstock/intelligence',
    outFile: 'zolstock/intelligence.html',
    title: 'תובנות AI לזול סטוק · Aspect Intelligence',
    description: 'בינה מלאכותית שחוקרת את המכירות, המלאי והרווחיות של זול סטוק ובונה דוחות עסקיים מדויקים תוך דקות — בעברית ובאנגלית.',
    image: `${DEFAULTS.aspect.baseUrl}/img/og-zolstock.png`,
    locale: 'he_IL',
  },
  {
    target: 'aspect',
    // The customer-facing "here is what we are going to build" paper. Shared
    // with the client over WhatsApp, so the card matters more here than on a
    // page people reach from inside the product.
    route: '/aspect/zolstock-purchasing-he',
    outFile: 'aspect/zolstock-purchasing-he.html',
    title: 'מלאי חכם · זול סטוק — מה להזמין, כמה, ומתי',
    description: 'מה אנחנו הולכים לבנות: מערכת שמקדימה את הצורך במקום להציג נתונים בדיעבד — מה להזמין מכל ספק, כמה, ובאיזה תאריך להוציא את ההזמנה. לרכש, למחסן ולסניפים.',
    image: `${DEFAULTS.aspect.baseUrl}/img/og-zolstock-purchasing.png`,
    locale: 'he_IL',
  },
];

function stripExistingMeta(head) {
  return head
    .replace(/<title>.*?<\/title>\s*/is, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, '');
}

function buildHead(base, page) {
  const ogBlock = `
    <title>${page.title}</title>
    <meta name="description" content="${page.description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${page.url}" />
    <meta property="og:title" content="${page.title}" />
    <meta property="og:description" content="${page.description}" />
    <meta property="og:image" content="${page.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${page.locale}" />
    <meta property="og:site_name" content="${page.siteName}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${page.title}" />
    <meta name="twitter:description" content="${page.description}" />
    <meta name="twitter:image" content="${page.image}" />
  </head>`;

  // Drop whatever title/meta/og/twitter tags are already there so re-running
  // this script (or layering a route override on top of the default) never
  // leaves stale or duplicate tags — a crawler reading two og:title tags
  // takes the first one, silently keeping the wrong card.
  return stripExistingMeta(base).replace(/<\/head>/, ogBlock);
}

function main() {
  const target = process.argv[2];
  const site = DEFAULTS[target];
  if (!site) {
    console.error(`[inject-share-pages] unknown or missing target %j — expected one of: ${Object.keys(DEFAULTS).join(', ')}`, target);
    process.exit(1);
  }

  const indexPath = path.join(DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('[inject-share-pages] dist/index.html not found — run vite build first.');
    process.exit(1);
  }

  // 1. Site-wide default, written in place.
  const rawBase = fs.readFileSync(indexPath, 'utf8');
  const defaultHtml = buildHead(rawBase, { ...site, url: site.baseUrl });
  fs.writeFileSync(indexPath, defaultHtml);
  console.log(`[inject-share-pages] wrote default OG tags into index.html for target ${target} (${site.baseUrl})`);

  // 2. Per-route overrides for this target, built from the now-corrected
  // index.html so their <script>/<link> tags are the real hashed bundle
  // paths and their head already starts from the target's own default.
  for (const page of PAGES.filter(p => p.target === target)) {
    const html = buildHead(defaultHtml, { ...page, url: `${site.baseUrl}${page.route}`, siteName: page.siteName || site.siteName });
    const outPath = path.join(DIST, page.outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`[inject-share-pages] wrote ${page.outFile} for ${page.route}`);
  }
}

main();
