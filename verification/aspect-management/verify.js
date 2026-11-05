// Drives the real UI against the stand: seeds through the API, then walks every screen.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const API = 'http://localhost:3000/api/management';
const UI = 'http://localhost:5173/management';
const OUT = 'G:/Shlomi/freeda2/aspect-agent-client-react/verification/aspect-management';
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 300) }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -- ${String(detail).slice(0, 300)}`}`); };

async function call(method, url, body) {
  const res = await fetch(API + url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  return { status: res.status, json };
}
const ok = async (...args) => { const r = await call(...args); if (r.status >= 400) throw new Error(`${args[0]} ${args[1]} -> ${r.status} ${JSON.stringify(r.json)}`); return r.json; };

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
const shift = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const prevWorkday = d => { let x = shift(d, -1); while ([5, 6].includes(new Date(`${x}T00:00:00Z`).getUTCDay())) x = shift(x, -1); return x; };
const workday = prevWorkday(today);

async function seed() {
  const itzik = await ok('POST', '/people', { name: 'איציק', email: 'itzik@aspect.test', role: 'owner' });
  const dana = await ok('POST', '/people', { name: 'דנה', email: 'dana@aspect.test', role: 'developer' });
  const yossi = await ok('POST', '/people', { name: 'יוסי', email: 'yossi@aspect.test', role: 'developer' });

  const alon = await ok('POST', '/clients', { name: 'קבוצת אלון', packageHours: '50', services: [{ name: 'דשבורד מכירות', status: 'פעיל' }, { name: 'סוכן AI ב-Intelligence Center', status: 'בהטמעה' }], nextStep: 'האישור על סוכן ה-AI', nextStepDate: shift(today, 3) });
  const gal = await ok('POST', '/clients', { name: 'מעדני גל', packageHours: '30', services: [], nextStep: '', nextStepDate: '' });
  const flowers = await ok('POST', '/clients', { name: 'רשת פרחי', packageHours: '', services: [] });
  await ok('POST', `/clients/${alon.id}/notes`, { body: 'פגישה עם רון, המנכ"ל', personId: itzik.id });

  const late = await ok('POST', '/projects', { clientId: gal.id, name: 'דשבורד מכירות', hoursBudget: '20', dueDate: shift(today, -5) });
  const over = await ok('POST', '/projects', { clientId: alon.id, name: 'פריסת סוכן AI', hoursBudget: '10', dueDate: shift(today, 30) });
  const fine = await ok('POST', '/projects', { clientId: flowers.id, name: 'דשבורד מלאי', hoursBudget: '100', dueDate: shift(today, 40) });

  await ok('PUT', '/report', { personId: dana.id, date: workday, blocker: 'אין לי גישה לשרת של הלקוח', entries: [
    { clientId: alon.id, projectId: over.id, hours: 10.5, description: 'בניית הסוכן', billable: true },
    { clientId: gal.id, projectId: late.id, hours: 3, description: 'בניית דשבורד מכירות', billable: true },
    { clientId: null, projectId: null, hours: 1, description: 'למידה', billable: false },
  ] });

  const stale = await ok('POST', '/quotes', { clientId: flowers.id, subject: 'הצעה לסוכן AI', amount: '48000', status: 'sent', sentDate: shift(today, -9) });
  await ok('POST', '/quotes', { clientId: gal.id, subject: 'עבודה נוספת מעבר להסכם', amount: '40000', status: 'pending', sentDate: shift(today, -4) });
  await ok('POST', '/quotes', { clientId: alon.id, subject: 'הצעת מחיר בהכנה', amount: '26000', status: 'preparing' });
  const won = await ok('POST', '/quotes', { clientId: alon.id, subject: 'דשבורד מלאי', amount: '120000', status: 'won' });
  await ok('POST', '/quotes', { clientId: flowers.id, subject: 'הצעה שאבדה', amount: '999', status: 'lost' });
  return { itzik, dana, yossi, alon, gal, flowers, late, over, fine, stale, won };
}

async function asPerson(browser, person, viewport) {
  const context = await browser.newContext({ viewport, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  await context.addInitScript(p => {
    localStorage.setItem('aspect_session_aspect', JSON.stringify({ userId: 'test', name: p.name, email: p.email, role: 'user', via: 'password' }));
  }, person);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const settle = page => page.waitForLoadState('networkidle').catch(() => {});

// Latin text on screen that is not a brand, product or test-data name.
async function latinLeaks(page) {
  const text = await page.evaluate(() => document.body.innerText);
  return (text.match(/[A-Za-z]{2,}/g) || []).filter(w => !['Aspect', 'AI', 'Intelligence', 'Center'].includes(w));
}

(async () => {
  const data = await seed();
  const browser = await chromium.launch({ channel: 'chrome' });

  // ---- server rules against real SQL
  const morning = await ok('GET', '/morning');
  const kinds = morning.alerts.map(a => `${a.kind}:${a.name}`);
  console.log(kinds.join(' | '));
  check('morning: late project', kinds.includes('late:מעדני גל'), kinds);
  check('morning: over budget (10.5 of 10)', kinds.includes('over:קבוצת אלון'), kinds);
  check('morning: 3 of 20 hours is not a budget alert', !kinds.includes('near:מעדני גל') && !kinds.includes('over:מעדני גל'), kinds);
  check('morning: blocker', kinds.includes('blocker:דנה'), kinds);
  check('morning: a developer added today is not flagged', !kinds.some(k => k.startsWith('no_report')), kinds);
  check('morning: quote 9 days without follow-up', kinds.includes('no_followup:רשת פרחי'), kinds);
  check('morning: quote at 4 days is not flagged', !kinds.includes('no_followup:מעדני גל'), kinds);

  // ---- server refusals
  check('report: 25 hours refused in Hebrew', (await call('PUT', '/report', { personId: data.dana.id, date: today, entries: [{ clientId: data.gal.id, hours: 25, description: 'x', billable: true }] })).json.error?.includes('שעות'));
  check('report: empty description refused', (await call('PUT', '/report', { personId: data.dana.id, date: today, entries: [{ clientId: data.gal.id, hours: 2, description: ' ', billable: true }] })).status === 400);
  check('report: future day refused', (await call('PUT', '/report', { personId: data.dana.id, date: shift(today, 2), entries: [] })).status === 400);
  check('report: a project of another client refused', (await call('PUT', '/report', { personId: data.dana.id, date: today, entries: [{ clientId: data.gal.id, projectId: data.fine.id, hours: 2, description: 'x', billable: true }] })).status === 400);
  const before = await ok('GET', `/report?personId=${data.dana.id}&date=${workday}`);
  check('report: a refused send changed nothing', before.entries.length === 3, before.entries.length);
  check('person: duplicate email refused in Hebrew', (await call('POST', '/people', { name: 'x', email: 'DANA@aspect.test' })).json.error?.includes('כבר קיים'));
  check('quote: converting a quote that is not won refused', (await call('POST', '/projects', { clientId: data.flowers.id, name: 'x', quoteId: data.stale.id })).status === 400);

  // ---- who gets in
  check('me: on the list', (await ok('GET', '/me?email=DANA@aspect.test')).person?.role === 'developer');
  check('me: aspect admin with no row becomes owner', (await ok('GET', '/me?email=admin@aspect.test&name=Admin')).person?.role === 'owner');
  check('me: aspect account that is not admin stays out', (await ok('GET', '/me?email=stranger@aspect.test')).person === null);
  check('me: unknown address stays out', (await ok('GET', '/me?email=nobody@aspect.test')).person === null);

  // ---- owner, desktop
  const desk = { width: 1536, height: 1024 };
  const owner = await asPerson(browser, data.itzik, desk);
  await owner.goto(UI); await settle(owner);
  check('screen 1: greeting', (await owner.innerText('h1')).includes('בוקר טוב איציק'));
  check('screen 1: root is rtl and Hebrew', await owner.evaluate(() => { const r = document.querySelector('[dir="rtl"][lang="he"]'); return r && getComputedStyle(r).direction === 'rtl'; }));
  await owner.waitForTimeout(600);
  await shot(owner, '1-morning');
  check('screen 1: no stray Latin', (await latinLeaks(owner)).length === 0, await latinLeaks(owner));

  // alert action opens the project
  await owner.locator('button', { hasText: 'לטיפול' }).first().click();
  await owner.waitForSelector('[role="dialog"]');
  check('alert action opens the project', (await owner.locator('[role="dialog"] h2').innerText()).length > 0 && owner.url().includes('/projects'));
  await owner.locator('[role="dialog"] button', { hasText: 'ביטול' }).click();
  check('closing the dialog stays closed', await owner.locator('[role="dialog"]').count() === 0);

  await owner.goto(`${UI}/projects`); await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, '4-projects');
  const projectsText = await owner.locator('main').innerText();
  check('screen 4: late tag', projectsText.includes('באיחור'));
  check('screen 4: over tag', projectsText.includes('חריגה מתקציב'));
  check('screen 4: on-time tag', projectsText.includes('בזמן'));
  check('screen 4: over-budget percent', projectsText.includes('105%'), projectsText);

  await owner.goto(`${UI}/clients`); await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, '3a-clients');
  await owner.locator('div[role="link"]', { hasText: 'קבוצת אלון' }).click();
  await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, '3-client-card');
  const card = await owner.locator('main').innerText();
  check('screen 3: billable hours vs package', /10\.5/.test(card) && card.includes('מתוך 50'), card);
  check('screen 3: services', card.includes('סוכן AI ב-Intelligence Center') && card.includes('בהטמעה'));
  check('screen 3: last note with who', card.includes('פגישה עם רון') && card.includes('איציק'), card);
  check('screen 3: next step', card.includes('האישור על סוכן ה-AI'));

  await owner.locator('button', { hasText: 'עריכה' }).click();
  await owner.locator('[role="dialog"] textarea').fill('שיחת טלפון עם רון');
  await shot(owner, '3b-client-edit');
  await owner.locator('[role="dialog"] button[type="submit"]').click();
  await owner.waitForSelector('[role="dialog"]', { state: 'detached' });
  await settle(owner); await owner.waitForTimeout(300);
  check('screen 3: note added through the modal', (await owner.locator('main').innerText()).includes('שיחת טלפון עם רון'));

  await owner.goto(`${UI}/quotes`); await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, '5-quotes');
  const quotes = await owner.locator('main').innerText();
  check('screen 5: open total (48k+40k+26k)', quotes.includes('114,000'), quotes);
  check('screen 5: lost quote not listed', !quotes.includes('הצעה שאבדה'));
  check('screen 5: 9 days flagged', quotes.includes('9 ימים'));

  // won quote -> project, prefilled, once only
  await owner.locator('button', { hasText: 'הפוך לפרויקט' }).click();
  await owner.waitForSelector('[role="dialog"]');
  await shot(owner, '5b-convert');
  const inputs = await owner.locator('[role="dialog"] input').evaluateAll(els => els.map(e => e.value));
  const clientValue = await owner.locator('[role="dialog"] select').first().inputValue();
  check('convert: client and amount prefilled', clientValue === String(data.alon.id) && inputs.includes('120000'), `${clientValue} ${inputs}`);
  await owner.locator('[role="dialog"] button[type="submit"]').click();
  await owner.waitForSelector('[role="dialog"]', { state: 'detached' });
  await settle(owner); await owner.waitForTimeout(300);
  check('convert: quote now says it became a project', (await owner.locator('main').innerText()).includes('הפך לפרויקט'));
  check('convert: a second conversion refuses', (await call('POST', '/projects', { clientId: data.alon.id, name: 'x', quoteId: data.won.id })).json.error?.includes('כבר הפכה'));
  check('convert: the project exists with the amount', (await ok('GET', '/projects')).projects.some(p => p.name === 'דשבורד מלאי' && p.amount === 120000));

  // follow-up clears the alert
  await owner.goto(`${UI}/quotes?open=${data.stale.id}`); await settle(owner);
  await owner.waitForSelector('[role="dialog"]');
  await owner.locator('[role="dialog"] button', { hasText: 'עקבתי היום' }).click();
  await owner.locator('[role="dialog"] button[type="submit"]').click();
  await owner.waitForSelector('[role="dialog"]', { state: 'detached' });
  await settle(owner);
  check('follow-up clears the alert', !(await ok('GET', '/morning')).alerts.some(a => a.kind === 'no_followup'));

  await owner.goto(`${UI}/team`); await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, 'team');
  check('team: lists developers only', !(await owner.locator('main').innerText()).includes('איציק'));
  await owner.locator('div[role="button"]', { hasText: 'דנה' }).click();
  await owner.waitForSelector('[role="dialog"]'); await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, 'team-person');
  check('team: a person shows reports and the blocker', (await owner.locator('[role="dialog"]').innerText()).includes('אין לי גישה'));
  check('team: one hour reads as natural Hebrew', (await owner.locator('[role="dialog"]').innerText()).includes('שעה אחת') && !(await owner.locator('[role="dialog"]').innerText()).includes('1 שעות'));

  await owner.goto(`${UI}/settings`); await settle(owner); await owner.waitForTimeout(300);
  await shot(owner, 'settings');
  await owner.locator('button', { hasText: 'אדם חדש' }).click();
  await owner.locator('[role="dialog"] button[type="submit"]').click();
  await owner.waitForSelector('[role="dialog"] p');
  check('settings: a refusal shows in Hebrew', /חסר/.test(await owner.locator('[role="dialog"]').innerText()));
  await owner.locator('[role="dialog"] button', { hasText: 'ביטול' }).click();

  // ---- screen 6, real model
  await owner.goto(`${UI}/ask`); await settle(owner); await owner.waitForTimeout(300);
  check('screen 6: greeting', (await owner.innerText('h1')).includes('איך אפשר לעזור, איציק?'));
  const answers = {};
  for (const q of ['מה עשו המפתחים אתמול?', 'מי חורג מהשעות?', 'מה מחכה להחלטה שלי?']) {
    await owner.locator('button', { hasText: q }).click();
    await owner.waitForSelector('text=תשובה', { timeout: 90000 });
    answers[q] = await owner.locator('main section p').innerText();
    const hebrew = (answers[q].match(/[\u0590-\u05FF]/g) || []).length;
    const latin = (answers[q].match(/[A-Za-z]/g) || []).length;
    check(`screen 6: Hebrew answer to "${q}"`, hebrew > 10 && latin < hebrew / 5, answers[q]);
    console.log(`  ${q}\n  -> ${answers[q]}`);
  }
  check('screen 6: yesterday = 14.5 hours reported', /14[.,]5/.test(answers['מה עשו המפתחים אתמול?']), answers['מה עשו המפתחים אתמול?']);
  check('screen 6: names the over-budget project', answers['מי חורג מהשעות?'].includes('אלון'), answers['מי חורג מהשעות?']);
  await shot(owner, '6-ask');
  fs.writeFileSync(path.join(OUT, 'ask-answers.json'), JSON.stringify(answers, null, 2));
  check('owner: no page errors', owner.errors.length === 0, owner.errors.join(' | '));

  // ---- developer, phone
  const phone = { width: 390, height: 844 };
  const dev = await asPerson(browser, data.dana, phone);
  await dev.goto(`${UI}/projects`); await settle(dev); await dev.waitForTimeout(400);
  check('developer: other screens are not reachable', (await dev.locator('main').innerText()).includes('מה עשית היום?') && await dev.locator('nav').count() === 0);
  await shot(dev, '2-report-phone-empty');
  // Both recent clients share the last report date, so the name breaks the tie.
  check('report: recent client prefilled', (await dev.locator('select').first().inputValue()) === String(data.gal.id));
  check('report: the client\'s only project preselected', (await dev.locator('select').nth(1).inputValue()) === String(data.late.id));
  check('report: no horizontal overflow on a phone', await dev.evaluate(() => { const m = document.querySelector('main'); return m.scrollWidth <= m.clientWidth; }));

  await dev.locator('input[type="number"]').first().fill('3');
  await dev.locator('textarea').first().fill('בניית דשבורד מכירות');
  await dev.locator('button', { hasText: 'הוספת שורה' }).click();
  const second = dev.locator('input[type="number"]').nth(1);
  await second.fill('1.5');
  await dev.locator('textarea').nth(1).fill('למידה');
  await dev.locator('select[aria-label="לקוח"]').nth(1).selectOption('internal');
  check('report: internal work defaults to not billable', !(await dev.locator('input[aria-label="לחיוב"]').nth(1).isChecked()));
  check('report: daily total adds up', (await dev.locator('main').innerText()).includes('4.5'));
  await dev.locator('button', { hasText: 'הוספת שורה' }).click(); // left empty on purpose
  await dev.locator('label', { hasText: 'משהו תקוע' }).click();
  await dev.locator('textarea[aria-label="מה תקוע?"]').fill('מחכה לאישור מהלקוח');
  await shot(dev, '2-report-phone');
  await dev.locator('button', { hasText: 'שליחה' }).click();
  await dev.waitForSelector('text=נשלח. תודה!');
  await dev.locator('main').evaluate(m => m.scrollTo(0, m.scrollHeight));
  await shot(dev, '2-report-phone-sent');

  const saved = await ok('GET', `/report?personId=${data.dana.id}&date=${today}`);
  check('report: saved two rows, dropped the empty one', saved.entries.length === 2, JSON.stringify(saved.entries));
  check('report: internal row has no client', saved.entries.some(e => e.clientId === null && !e.billable));
  check('report: blocker saved', saved.blocker === 'מחכה לאישור מהלקוח');

  // a day already sent reopens as sent; resending replaces rather than adds
  await dev.reload(); await settle(dev); await dev.waitForTimeout(300);
  check('report: reopening shows the sent rows', await dev.locator('input[type="number"]').count() === 2);
  await dev.locator('button', { hasText: 'שליחה' }).click();
  await dev.waitForSelector('text=נשלח. תודה!');
  check('report: resending replaces, never doubles', (await ok('GET', `/report?personId=${data.dana.id}&date=${today}`)).entries.length === 2);

  // day navigation
  check('report: cannot go to tomorrow', await dev.locator('button[aria-label="היום הבא"]').isDisabled());
  await dev.locator('button[aria-label="היום הקודם"]').click();
  await settle(dev); await dev.waitForTimeout(300);
  check('report: previous day loads', (await dev.locator('main').innerText()).includes(new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long' }).format(new Date(`${shift(today, -1)}T12:00:00Z`))));
  check('developer: no page errors', dev.errors.length === 0, dev.errors.join(' | '));

  await ok('PUT', '/report', { personId: data.yossi.id, date: today, blocker: '', entries: [{ clientId: data.alon.id, hours: 2, description: 'פגישה', billable: false }] });
  const bookkeeping = await ok('GET', `/clients/${data.alon.id}`);
  check('package counts billable hours only', bookkeeping.hoursThisMonth === 10.5, bookkeeping.hoursThisMonth);

  // ---- not on the list, sign-in screen
  const stranger = await asPerson(browser, { name: 'זר', email: 'stranger@aspect.test' }, desk);
  await stranger.goto(UI); await settle(stranger); await stranger.waitForTimeout(300);
  check('not on the list: says so in Hebrew', (await stranger.locator('main').innerText()).includes('עוד לא ברשימה'));
  await shot(stranger, 'not-on-list');

  const anon = await (await browser.newContext({ viewport: phone, locale: 'he-IL' })).newPage();
  await anon.goto(UI); await settle(anon); await anon.waitForTimeout(800);
  const signInText = await anon.locator('main').innerText();
  check('sign-in: Hebrew', signInText.includes('כניסה למערכת') && signInText.includes('סיסמה'), signInText);
  check('sign-in: no stray Latin', ((signInText.match(/[A-Za-z]{2,}/g) || []).filter(w => !['Aspect', 'Google'].includes(w))).length === 0, signInText);
  await shot(anon, 'sign-in');

  // owner on a phone: the shell must still work
  const ownerPhone = await asPerson(browser, data.itzik, phone);
  await ownerPhone.goto(UI); await settle(ownerPhone); await ownerPhone.waitForTimeout(400);
  await shot(ownerPhone, '1-morning-phone');
  check('owner on a phone: no horizontal overflow', await ownerPhone.evaluate(() => { const m = document.querySelector('main'); return m.scrollWidth <= m.clientWidth; }));
  check('owner on a phone: two blockers from one person cause no page errors', ownerPhone.errors.length === 0, ownerPhone.errors.join(' | '));

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(err => { console.error('CRASH', err); process.exit(2); });
