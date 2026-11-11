#!/usr/bin/env node
/**
 * Writes firebase.aspect.json — firebase.json plus the rewrites that only the
 * aspect-agents site may carry — and `deploy:aspect` deploys with it.
 *
 * Why a generated file: firebase.json is shared by the aspect, lybi-prod and
 * freeda deploys, and a Cloud Run rewrite names a service that exists only in
 * the aspect-agents project; the other deploys would be rejected. Generating
 * keeps firebase.json the single source for everything else (headers, other
 * rewrites), so the two cannot drift. The output is gitignored.
 *
 * The rewrite: the "build with your own AI" door (task #96). Clients get
 * https://aspect-agents.web.app/intelligence/<slug>/mcp/<token> and never see
 * the backend's address — Hosting PROXIES to Cloud Run (not a 302, which would
 * expose it and turn an MCP POST into a GET), and the server builds every URL
 * in its guide from X-Forwarded-Host, so they stay on this domain too.
 *
 * The aspect site talks ONLY to Aspect's own server, `aspect-server`
 * (2026-11-11). The Origin server it used before stays as Lybi's frozen
 * benchmark. firebase.json and public/lybi-site still name Origin because the
 * lybi-prod and freeda deploys share them, so this script repoints the aspect
 * copies: the /builder/mcp redirect here, and the built lybi-site pages in dist/.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));

const ORIGIN_SERVER = 'https://aspect-agent-server-1018338671074.europe-west1.run.app';
const ASPECT_SERVER = 'https://aspect-server-1018338671074.europe-west1.run.app';

const DOOR = { serviceId: 'aspect-server', region: 'europe-west1' };
const ASPECT_ONLY_REWRITES = [
  { source: '/intelligence/*/mcp/**', run: DOOR },
  // The same link pasted without its key: "/**" does not match the bare path,
  // so without this the SPA answered and the AI got an HTML app shell instead
  // of the server's "this link is missing its personal key".
  { source: '/intelligence/*/mcp', run: DOOR },
  // ZolStock creative daily store inventory (tasks #106 / #107): the link Reut's
  // Qlik loads. The server answers with a redirect to a signed storage URL.
  { source: '/zolstock/creative-stock/**', run: DOOR },
  // The same table at a plain, keyless address the client asked for:
  // /zolstock/intelligence/data/creative-stock (server routes/intelligence-data.routes.js).
  { source: '/zolstock/intelligence/data/**', run: DOOR },
];

// First, so the catch-all "**" -> /index.html can never shadow them.
config.hosting.rewrites = [...ASPECT_ONLY_REWRITES, ...(config.hosting.rewrites || [])];

for (const r of config.hosting.redirects || []) {
  if (typeof r.destination === 'string') r.destination = r.destination.replace(ORIGIN_SERVER, ASPECT_SERVER);
}

fs.writeFileSync(path.join(root, 'firebase.aspect.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log('[firebase-aspect-config] wrote firebase.aspect.json');

// The static Lybi pages are copied into dist/ as-is from public/, so the
// server address in them is rewritten here, after the build.
const lybiSite = path.join(root, 'dist', 'lybi-site');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
if (fs.existsSync(lybiSite)) {
  for (const file of walk(lybiSite).filter(f => /\.(html|js)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes(ORIGIN_SERVER)) continue;
    fs.writeFileSync(file, text.split(ORIGIN_SERVER).join(ASPECT_SERVER));
    console.log(`[firebase-aspect-config] ${path.relative(root, file)} -> aspect-server`);
  }
}
