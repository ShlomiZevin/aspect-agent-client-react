// Read-only check of /management on the live site against the real server.
//   node verification/aspect-management/site-style/prod-check.mjs
// Only /me is stubbed (to an owner who is not in the database), so the screens
// read the real, still-empty am_* tables. Every non-GET request is aborted and
// counted: this script must never write to the live tool.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = process.env.OUT || path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'https://aspect-agents.web.app';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const owner = { id: 900001, name: 'בדיקה אוטומטית', email: 'check@invalid.example', role: 'owner', active: true };
const session = p => JSON.stringify({ userId: 'check', name: p.name, email: p.email, role: 'admin', via: 'password' });

const browser = await chromium.launch({ executablePath: CHROME });
const problems = [];
let blockedWrites = 0;
const api = [];

async function context({ me, stubMe }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('response', r => {
    if (r.url().includes('/api/')) api.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).host} ${new URL(r.url()).pathname}`);
  });
  await page.route('**/api/**', route => {
    const req = route.request();
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS') { blockedWrites++; return route.abort(); }
    if (stubMe && new URL(req.url()).pathname.endsWith('/api/management/me')) return route.fulfill({ json: { person: owner } });
    return route.continue();
  });
  if (me) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ['aspect_session_aspect', session(me)]);
  return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(800); await page.screenshot({ path: path.join(here, `prod-${name}.png`) }); console.log('  shot', name); };

{ // Sign-in, with the real config from the server.
  const { ctx, page } = await context({});
  await page.goto(`${BASE}/management`);
  await page.waitForSelector('text=כניסה לניהול');
  await shot(page, '00-sign-in');
  await ctx.close();
}
{ // An address with no grant: the real /me answers null and writes nothing.
  const { ctx, page } = await context({ me: owner });
  await page.goto(`${BASE}/management`);
  await page.waitForSelector('text=עוד לא ברשימה');
  await shot(page, '00b-not-on-list');
  await ctx.close();
}
{ // Owner screens on the real data.
  const { ctx, page } = await context({ me: owner, stubMe: true });
  for (const [url, wait, name] of [
    ['/management', 'text=בוקר טוב', '01-morning'],
    ['/management/projects', 'text=פרויקטים פעילים', '02-projects'],
    ['/management/team', 'h1:has-text("צוות")', '03-team'],
    ['/management/clients', 'h1:has-text("לקוחות")', '04-clients'],
    ['/management/quotes', 'text=הכסף שבדרך', '06-quotes'],
    ['/management/ask', 'text=איך אפשר לעזור', '07-ask'],
    ['/management/settings', 'text=מי נמצא ברשימה', '08-settings'],
  ]) {
    await page.goto(`${BASE}${url}`);
    await page.waitForSelector(wait);
    await shot(page, name);
  }
  await ctx.close();
}

await browser.close();
const hosts = [...new Set(api.map(a => a.split(' ')[2]))];
console.log(`\nAPI hosts called: ${hosts.join(', ')}`);
console.log(`API responses: ${api.length}, non-2xx/304: ${api.filter(a => !/^(2\d\d|304) /.test(a)).join(' | ') || 'none'}`);
console.log(`write requests blocked: ${blockedWrites}`);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no page or console errors');
