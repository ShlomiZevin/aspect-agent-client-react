// Screenshot every admin page (read-only: API calls relayed GET-only).
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE = process.env.BASE || 'https://aspect-agents.web.app';
const OUT = process.env.OUT || './audit';
const W = Number(process.env.W || 2000);
fs.mkdirSync(OUT, { recursive: true });

const z = '/zolstock/admin/';
const pages = [
  ['01-feedback', z + 'feedback'],
  ['02-users', z + 'users'],
  ['03-test-runner', z + 'test-runner'],
  ['04-crew', z + 'crew'],
  ['05-crew-editor', z + 'crew-editor'],
  ['06-playground', z + 'playground'],
  ['07-knowledge-base', z + 'knowledge-base'],
  ['08-dynamic-kb', z + 'dynamic-kb'],
  ['09-library', z + 'library'],
  ['10-int-config', z + 'intelligence/config'],
  ['11-int-prompts', z + 'intelligence/prompts'],
  ['12-int-quick-questions', z + 'intelligence/quick-questions'],
  ['13-int-insights', z + 'intelligence/insights'],
  ['14-data-loader', z + 'data-loader'],
  ['15-query-optimizer', z + 'query-optimizer'],
  ['16-modules', z + 'modules'],
  ['17-taskboard', z + 'taskboard'],
  ['18-settings', z + 'settings'],
  ['19-int-overview', z + 'intelligence-overview'],
  ['20-billing', z + 'billing'],
  ['21-llm-usage', z + 'llm-usage'],
  ['22-cloud-run-logs', z + 'cloud-run-logs'],
  ['23-freeda-task-board', '/freeda/admin/task-board'],
  ['24-freeda-podcast', '/freeda/admin/podcast'],
  ['25-banking-v2-trends', '/banking-v2/admin/conversation-trends'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: 1040 } });
await page.route(/\.run\.app\//, async route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
  if (req.method() !== 'GET' || /stream/.test(req.url())) return route.abort();
  const headers = { ...req.headers() };
  delete headers.origin;
  const resp = await route.fetch({ headers });
  return route.fulfill({ response: resp, headers: { ...resp.headers(), 'access-control-allow-origin': '*' } });
});
// Same super-admin unlock the admin's own browser has (read-only use).
await page.addInitScript(() => { try { localStorage.setItem('super_admin_key', '6724'); } catch {} });
const errors = [];
page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
for (const [name, url] of pages) {
  if (only && !only.test(name)) continue;
  try {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch { /* long-polling pages never go idle — screenshot anyway */ }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: process.env.FULL === '1' });
  console.log(name);
}
console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
