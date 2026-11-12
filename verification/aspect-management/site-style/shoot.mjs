// Screenshots of Aspect Management in the platform's look, every screen and
// dialog, desktop + phone, for owner, developer and a stranger.
//
// Run: `npx vite build --mode aspect && npx vite preview --port 5180`, then
//   node verification/aspect-management/site-style/shoot.mjs
// Needs `playwright-core` and a local Chrome (CHROME env var to override).
//
// Read-only: every /api/management/* call is answered from the sample data
// below, so nothing reaches a real server; a write attempt is answered too and
// counted. The sample data is invented for the pictures.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = process.env.OUT || path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:5180';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const owner = { id: 1, name: 'איציק כהן', email: 'itzik@aspect.co.il', role: 'owner', active: true };
const dev = { id: 2, name: 'יוסי לוי', email: 'yossi@aspect.co.il', role: 'developer', active: true };

const projects = [
  { id: 11, clientId: 1, clientName: 'קבוצת אלון', name: 'פריסת סוכן AI', hoursBudget: 120, hoursUsed: 126, dueDate: '2026-11-01', status: 'active', amount: 48000, pct: 105, late: true, lateDays: 11, over: true, near: false },
  { id: 12, clientId: 2, clientName: 'מעדני גל', name: 'דשבורד מכירות', hoursBudget: 80, hoursUsed: 41, dueDate: '2026-11-07', status: 'active', amount: 22000, pct: 51, late: true, lateDays: 5, over: false, near: false },
  { id: 13, clientId: 3, clientName: 'רשת פרחי', name: 'הטמעת Insights', hoursBudget: 60, hoursUsed: 53, dueDate: '2026-12-15', status: 'active', amount: 18000, pct: 88, late: false, lateDays: 0, over: false, near: true },
  { id: 14, clientId: 4, clientName: 'טבע נאות', name: 'בוט שירות לקוחות', hoursBudget: 100, hoursUsed: 32, dueDate: '2027-01-20', status: 'active', amount: 36000, pct: 32, late: false, lateDays: 0, over: false, near: false },
  { id: 15, clientId: 1, clientName: 'קבוצת אלון', name: 'אינטגרציה ל-Priority', hoursBudget: null, hoursUsed: 14, dueDate: null, status: 'active', amount: null, pct: null, late: false, lateDays: 0, over: false, near: false },
];

const clients = [
  { id: 1, name: 'קבוצת אלון', logoUrl: null, packageHours: 40, services: [{ name: 'סוכן AI', status: 'פעיל' }, { name: 'Insights', status: 'בהטמעה' }], nextStep: 'פגישת סטטוס חודשית', nextStepDate: '2026-11-18', hoursThisMonth: 46.5, activeProjects: 2 },
  { id: 2, name: 'מעדני גל', logoUrl: null, packageHours: 20, services: [{ name: 'דשבורד', status: 'פעיל' }], nextStep: 'הצגת גרסה ראשונה', nextStepDate: '2026-11-14', hoursThisMonth: 12, activeProjects: 1 },
  { id: 3, name: 'רשת פרחי', logoUrl: null, packageHours: null, services: [{ name: 'Insights', status: 'בהטמעה' }], nextStep: '', nextStepDate: null, hoursThisMonth: 9.25, activeProjects: 1 },
  { id: 4, name: 'טבע נאות', logoUrl: null, packageHours: 30, services: [{ name: 'בוט שירות', status: 'מושהה' }], nextStep: 'לחכות לחומרים מהלקוח', nextStepDate: null, hoursThisMonth: 3, activeProjects: 1 },
];

const people = [
  { ...owner, hoursPreviousWorkday: 0, hoursThisMonth: 0, lastReportDate: null },
  { ...dev, hoursPreviousWorkday: 7.5, hoursThisMonth: 61, lastReportDate: today },
  { id: 3, name: 'דנה שמש', email: 'dana@aspect.co.il', role: 'developer', active: true, hoursPreviousWorkday: 0, hoursThisMonth: 38.5, lastReportDate: '2026-11-09' },
  { id: 4, name: 'רון אברהם', email: 'ron@aspect.co.il', role: 'developer', active: false, hoursPreviousWorkday: 0, hoursThisMonth: 0, lastReportDate: '2026-10-02' },
];

const data = {
  morning: {
    today,
    clientCount: clients.length,
    alerts: [
      { kind: 'late', severity: 'action', action: 'לטיפול', name: 'מעדני גל', line: 'פרויקט באיחור של 5 ימים', detail: 'דשבורד מכירות', target: { type: 'project', id: 12 } },
      { kind: 'over', severity: 'action', action: 'לטיפול', name: 'קבוצת אלון', line: 'חריגה משעות התקציב: 105%', detail: 'פריסת סוכן AI', target: { type: 'project', id: 11 } },
      { kind: 'blocker', severity: 'action', action: 'לטיפול', name: 'דנה', line: 'משהו תקוע: אין לי גישה לשרת של הלקוח', target: { type: 'person', id: 3 } },
      { kind: 'no_report', severity: 'attention', action: 'לתזכורת', name: 'דנה שמש', line: 'לא דיווחה שעות אתמול', target: { type: 'person', id: 3 } },
      { kind: 'no_followup', severity: 'attention', action: 'לעקוב', name: 'רשת פרחי', line: 'הצעת מחיר ללא מעקב כבר 9 ימים', detail: 'הרחבת Insights', target: { type: 'quote', id: 21 } },
    ],
  },
  people: { people },
  personReports: {
    entries: [
      { id: 1, date: today, hours: 5, description: 'חיבור הסוכן ל-CRM', billable: true, clientName: 'קבוצת אלון', projectName: 'פריסת סוכן AI' },
      { id: 2, date: today, hours: 2.5, description: 'ישיבת צוות', billable: false, clientName: null, projectName: null },
      { id: 3, date: '2026-11-11', hours: 8, description: 'גרפים לדשבורד', billable: true, clientName: 'מעדני גל', projectName: 'דשבורד מכירות' },
    ],
    blockers: [{ date: '2026-11-11', body: 'מחכה למפתח API מהלקוח' }],
  },
  clients: { clients },
  client: {
    ...clients[0],
    openItems: 3,
    projects: projects.filter(p => p.clientId === 1),
    lastNote: { date: '2026-11-10', body: 'רוצים להרחיב את הסוכן גם לסניפים בצפון. לשלוח הצעה עד סוף החודש.', personName: 'איציק כהן' },
  },
  projects: { projects },
  report: {
    date: today,
    entries: [
      { clientId: 1, projectId: 11, hours: 5, description: 'חיבור הסוכן ל-CRM', billable: true },
      { clientId: null, projectId: null, hours: 1.5, description: 'ישיבת צוות', billable: false },
    ],
    blocker: '',
    clients: clients.map((c, i) => ({ id: c.id, name: c.name, recent: i < 2 })),
    projects: projects.map(p => ({ id: p.id, clientId: p.clientId, name: p.name })),
  },
  quotes: {
    openTotal: 124000,
    open: [
      { id: 21, clientId: 3, clientName: 'רשת פרחי', subject: 'הרחבת Insights', amount: 42000, status: 'sent', sentDate: '2026-11-03', lastFollowupDate: null, closedDate: null, projectId: null, ageDays: 9 },
      { id: 22, clientId: 1, clientName: 'קבוצת אלון', subject: 'סוכן לסניפי הצפון', amount: 58000, status: 'preparing', sentDate: null, lastFollowupDate: null, closedDate: null, projectId: null, ageDays: 2 },
      { id: 23, clientId: 2, clientName: 'מעדני גל', subject: 'תמיכה שנתית', amount: 24000, status: 'pending', sentDate: '2026-11-06', lastFollowupDate: '2026-11-10', closedDate: null, projectId: null, ageDays: 2 },
    ],
    closed: [
      { id: 24, clientId: 4, clientName: 'טבע נאות', subject: 'בוט שירות לקוחות', amount: 36000, status: 'won', sentDate: '2026-10-20', lastFollowupDate: null, closedDate: '2026-11-04', projectId: 14, ageDays: 0 },
      { id: 25, clientId: 2, clientName: 'מעדני גל', subject: 'דוח חודשי אוטומטי', amount: 9000, status: 'won', sentDate: '2026-10-28', lastFollowupDate: null, closedDate: '2026-11-09', projectId: null, ageDays: 0 },
    ],
  },
  ask: { answer: 'אתמול דיווחו שני מפתחים, יחד 7.5 שעות:\n• יוסי: 5 שעות על פריסת סוכן AI לקבוצת אלון, ושעה וחצי ישיבת צוות.\n• דנה לא דיווחה.\nפרויקט אחד חורג מהתקציב: פריסת סוכן AI (105%).' },
};

let writes = 0;

function answer(url, method, me) {
  const p = new URL(url).pathname.replace(/^.*\/api\/management/, '');
  if (method !== 'GET') { writes++; return p === '/ask' ? data.ask : { id: 99, saved: 1 }; }
  if (p === '/me') return { person: me };
  if (p === '/morning') return data.morning;
  if (p === '/people') return data.people;
  if (/^\/people\/\d+\/reports$/.test(p)) return data.personReports;
  if (p === '/clients') return data.clients;
  if (/^\/clients\/\d+$/.test(p)) return data.client;
  if (p === '/projects') return data.projects;
  if (p === '/report') return data.report;
  if (p === '/quotes') return data.quotes;
  return null;
}

const SESSION = person => JSON.stringify({ userId: `u${person.id}`, name: person.name, email: person.email, role: 'admin', via: 'password' });

async function open(browser, { viewport, me, signedIn = true }) {
  const context = await browser.newContext({ viewport, locale: 'he-IL', deviceScaleFactor: viewport.width < 500 ? 2 : 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('**/api/management/**', route => {
    const body = answer(route.request().url(), route.request().method(), me);
    return body ? route.fulfill({ json: body }) : route.fulfill({ status: 404, json: { error: 'not mocked' } });
  });
  await page.route('**/api/auth/signin/config**', route => route.fulfill({ json: { enabled: true, purpose: 'gate', google: false, password: true, clientId: '' } }));
  if (signedIn) {
    await context.addInitScript(([key, value]) => { localStorage.setItem(key, value); }, ['aspect_session_aspect', SESSION(me ?? owner)]);
  }
  return { context, page, errors };
}

async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(here, `${name}.png`), fullPage: false });
  console.log('  shot', name);
}

const browser = await chromium.launch({ executablePath: CHROME });
const allErrors = [];
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };

// Sign-in and "not on the list".
{
  const { context, page, errors } = await open(browser, { viewport: desktop, signedIn: false });
  await page.goto(`${BASE}/management`);
  await page.waitForSelector('input');
  await shot(page, '00-sign-in');
  await context.close();
  allErrors.push(...errors.map(e => `sign-in: ${e}`));
}
{
  const { context, page, errors } = await open(browser, { viewport: desktop, me: null });
  await page.goto(`${BASE}/management`);
  await page.waitForSelector('text=עוד לא ברשימה');
  await shot(page, '00b-not-on-list');
  await context.close();
  allErrors.push(...errors.map(e => `not-on-list: ${e}`));
}

// Owner: every screen and dialog.
for (const [label, viewport] of [['desktop', desktop], ['phone', phone]]) {
  const { context, page, errors } = await open(browser, { viewport, me: owner });
  const go = async (url, wait, name) => {
    await page.goto(`${BASE}${url}`);
    await page.waitForSelector(wait);
    await shot(page, `${label}-${name}`);
  };
  await go('/management', 'text=מחכה לך היום', '01-morning');
  await go('/management/projects', 'text=פרויקטים פעילים', '02-projects');
  await go('/management/projects?open=11', 'role=dialog', '02b-project-dialog');
  await go('/management/team', 'text=יוסי לוי', '03-team');
  await go('/management/team?person=2', 'role=dialog', '03b-person-dialog');
  await go('/management/clients', 'text=מעדני גל', '04-clients');
  await go('/management/clients/1', 'text=הערה אחרונה', '05-client-card');
  await page.click('text=עריכה');
  await page.waitForSelector('role=dialog');
  await shot(page, `${label}-05b-client-edit`);
  await go('/management/quotes', 'text=הצעות פתוחות', '06-quotes');
  await go('/management/quotes?open=21', 'role=dialog', '06b-quote-dialog');
  await go('/management/ask', 'text=איך אפשר לעזור', '07-ask');
  await page.click('text=מה עשו המפתחים אתמול?');
  await page.waitForSelector('text=תשובה');
  await shot(page, `${label}-07b-ask-answer`);
  await go('/management/settings', 'text=מי נמצא ברשימה', '08-settings');
  await go('/management/report', 'text=מה עשית היום?', '09-report');
  await page.check('text=משהו תקוע');
  await shot(page, `${label}-09b-report-stuck`);
  await context.close();
  allErrors.push(...errors.map(e => `owner ${label}: ${e}`));
}

// Developer: the report screen only.
for (const [label, viewport] of [['desktop', desktop], ['phone', phone]]) {
  const { context, page, errors } = await open(browser, { viewport, me: dev });
  await page.goto(`${BASE}/management`);
  await page.waitForSelector('text=מה עשית היום?');
  await shot(page, `${label}-10-developer`);
  await context.close();
  allErrors.push(...errors.map(e => `developer ${label}: ${e}`));
}

await browser.close();
console.log(`\nwrite calls answered locally: ${writes} (the ask question only)`);
console.log(allErrors.length ? `ERRORS:\n${allErrors.join('\n')}` : 'no page errors');
