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
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));

const DOOR = { serviceId: 'aspect-agent-server', region: 'europe-west1' };
const ASPECT_ONLY_REWRITES = [
  { source: '/intelligence/*/mcp/**', run: DOOR },
  // The same link pasted without its key: "/**" does not match the bare path,
  // so without this the SPA answered and the AI got an HTML app shell instead
  // of the server's "this link is missing its personal key".
  { source: '/intelligence/*/mcp', run: DOOR },
];

// First, so the catch-all "**" -> /index.html can never shadow them.
config.hosting.rewrites = [...ASPECT_ONLY_REWRITES, ...(config.hosting.rewrites || [])];

fs.writeFileSync(path.join(root, 'firebase.aspect.json'), `${JSON.stringify(config, null, 2)}\n`);
console.log('[firebase-aspect-config] wrote firebase.aspect.json');
