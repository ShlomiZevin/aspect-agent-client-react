// Screenshots of the regrouped admin sidebar + the moved Intelligence admin.
// Run: start `vite --port 5179` (VITE_API_URL pointing at an API), then
//   node verification/admin-menu-restructure/shoot.mjs
// Read-only: only navigates and screenshots, never clicks a toggle or Save.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = process.env.OUT || path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:5179';

const shots = [
  ['zolstock-feedback', '/zolstock/admin/feedback'],
  ['zolstock-intelligence-config', '/zolstock/admin/intelligence/config'],
  ['zolstock-intelligence-insights', '/zolstock/admin/intelligence/insights'],
  ['aspect-intelligence-overview', '/aspect/admin/intelligence-overview'],
  ['freeda-no-dataset', '/freeda/admin/feedback'],
  ['legacy-redirect-prompts', '/intelligence/admin/hypertoy/prompts'],
  ['legacy-redirect-overview', '/intelligence/admin'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
// The prod API rejects a localhost Origin, so API calls are relayed from
// Node without one. GET only — anything that could write is aborted.
await page.route(/\.run\.app\//, async route => {
  const req = route.request();
  if (req.method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET' } });
  }
  if (req.method() !== 'GET') return route.abort();
  const headers = { ...req.headers() };
  delete headers.origin;
  const resp = await route.fetch({ headers });
  return route.fulfill({ response: resp, headers: { ...resp.headers(), 'access-control-allow-origin': '*' } });
});

const errors = [];
page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));

for (const [name, url] of shots) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(here, `${name}.png`) });
  console.log(`${name}: ${url} -> ${new URL(page.url()).pathname}`);
}

// Unfolding a group by hand (and it stays unfolded on the next page).
await page.goto(BASE + '/zolstock/admin/feedback', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Agent' }).click();
await page.getByRole('button', { name: /Platform/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(here, 'zolstock-groups-unfolded.png') });

// Business mode filters the same groups.
await page.goto(BASE + '/zolstock/admin/feedback', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Business' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(here, 'zolstock-business-mode.png') });
await page.getByRole('button', { name: 'Admin' }).click();

console.log(errors.length ? `PAGE ERRORS:\n${errors.join('\n')}` : 'no page errors');
await browser.close();
