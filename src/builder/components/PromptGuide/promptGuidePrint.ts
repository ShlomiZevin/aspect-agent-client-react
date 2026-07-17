/**
 * promptGuidePrint — renders the prompt guide as a standalone,
 * print-friendly HTML page and opens the browser's print dialog, where
 * "Save as PDF" produces the shareable document. Zero dependencies —
 * the browser's print engine gives us perfect Hebrew/RTL for free,
 * which PDF libraries famously don't.
 *
 * Content comes from the same data the modal renders
 * (promptGuideContent.ts) — one source, two surfaces.
 */

import {
  GUIDE_GROUPS,
  GUIDE_SCENARIO,
  GUIDE_SIGILS,
  GUIDE_UI,
  type GuideLang,
} from './promptGuideContent';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Assistant', system-ui, sans-serif;
    color: #111827; margin: 0; padding: 32px 40px; font-size: 12.5px; line-height: 1.55;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: #4b5563; margin: 0 0 14px; }
  .golden {
    background: #eef2ff; border: 1px solid #c7d2fe; color: #4338ca;
    border-radius: 8px; padding: 9px 12px; margin-bottom: 16px; font-weight: 500;
  }
  .card {
    border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px;
    margin-bottom: 16px; background: #fafafa; page-break-inside: avoid;
  }
  .card.scenario { background: #ecfeff; border-color: #a5f3fc; }
  .cardTitle { font-weight: 800; font-size: 13px; margin-bottom: 8px; }
  .sigilGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; }
  .sigilRow { display: flex; align-items: center; gap: 8px; }
  kbd {
    font-family: Consolas, Menlo, monospace; font-size: 12px; font-weight: 700;
    color: #4f46e5; background: #fff; border: 1px solid #d1d5db; border-bottom-width: 2px;
    border-radius: 5px; padding: 0 6px; min-width: 22px; text-align: center; display: inline-block;
  }
  ul, ol { margin: 0; padding-inline-start: 20px; }
  li { margin-bottom: 4px; }
  h2 {
    font-size: 15.5px; margin: 20px 0 6px; padding-top: 8px;
    border-top: 2px solid #eef2f7; page-break-after: avoid;
  }
  .groupIntro { color: #4b5563; margin: 0 0 8px; }
  .walkthrough {
    border: 1px dashed #d1d5db; border-radius: 8px; background: #fafafa;
    padding: 10px 12px 10px 28px; margin-bottom: 10px; page-break-inside: avoid;
  }
  [dir="rtl"] .walkthrough { padding: 10px 28px 10px 12px; }
  .entry {
    border: 1px solid #e5e7eb; border-radius: 8px; padding: 9px 12px;
    margin-bottom: 8px; page-break-inside: avoid;
  }
  .token {
    font-family: Consolas, Menlo, monospace; font-size: 12px; font-weight: 700;
    color: #4f46e5; background: #eef2ff; border: 1px solid #c7d2fe;
    border-radius: 5px; padding: 1px 7px; direction: ltr; display: inline-block;
  }
  .badge {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
    color: #92400e; background: #fef3c7; border: 1px solid #fcd34d;
    border-radius: 999px; padding: 0 7px; margin-inline-start: 6px;
  }
  .what { margin: 5px 0; }
  .exRow { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  pre {
    margin: 0; font-family: Consolas, Menlo, monospace; font-size: 10.5px; line-height: 1.5;
    background: #f8fafc; border: 1px solid #eef2f7; border-radius: 6px; padding: 6px 9px;
    white-space: pre-wrap; word-break: break-word; direction: ltr; text-align: left;
  }
  pre.out { background: #ecfdf5; border-color: #a7f3d0; }
  .exLabel {
    display: block; font-family: inherit; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; margin-bottom: 2px;
  }
  @media print { body { padding: 0; } }
`;

export function buildGuidePrintHtml(lang: GuideLang): string {
  const he = lang === 'he';
  const parts: string[] = [];

  parts.push(`<h1>📖 ${esc(GUIDE_UI.title[lang])}</h1>`);
  parts.push(`<p class="subtitle">${esc(GUIDE_UI.subtitle[lang])}</p>`);
  parts.push(`<div class="golden">💡 ${esc(GUIDE_UI.golden[lang])}</div>`);

  parts.push(`<div class="card"><div class="cardTitle">${esc(GUIDE_UI.shortcuts[lang])}</div><div class="sigilGrid">${
    GUIDE_SIGILS.map(s =>
      `<div class="sigilRow"><kbd dir="ltr">${esc(s.sigil)}</kbd><span>${esc(s.what[lang])}</span></div>`,
    ).join('')
  }</div></div>`);

  parts.push(`<div class="card scenario"><div class="cardTitle">🛍️ ${esc(GUIDE_UI.scenarioTitle[lang])}</div><ul>${
    GUIDE_SCENARIO.map(l => `<li>${esc(l[lang])}</li>`).join('')
  }</ul></div>`);

  for (const group of GUIDE_GROUPS) {
    parts.push(`<h2>${esc(group.icon)} ${esc(group.title[lang])}</h2>`);
    if (group.intro) parts.push(`<p class="groupIntro">${esc(group.intro[lang])}</p>`);
    if (group.walkthrough) {
      parts.push(`<ol class="walkthrough">${group.walkthrough.map(s => `<li>${esc(s[lang])}</li>`).join('')}</ol>`);
    }
    for (const e of group.entries) {
      const badge = e.badge ? `<span class="badge">${esc(e.badge[lang])}</span>` : '';
      const sigil = e.sigil ? ` <kbd dir="ltr">${esc(e.sigil)}</kbd>` : '';
      let example = '';
      if (e.example) {
        const out = e.renders
          ? `<pre class="out"><span class="exLabel">🤖 ${esc(GUIDE_UI.modelGets[lang])}</span>${esc(e.renders)}</pre>`
          : '';
        example = `<div class="exRow"><pre><span class="exLabel">✏️ ${esc(GUIDE_UI.youWrite[lang])}</span>${esc(e.example)}</pre>${out}</div>`;
      }
      parts.push(`<div class="entry"><span class="token">${esc(e.token)}</span>${sigil}${badge}<p class="what">${esc(e.what[lang])}</p>${example}</div>`);
    }
  }

  return `<!doctype html>
<html lang="${lang}" dir="${he ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${esc(GUIDE_UI.title[lang])}</title>
<style>${PRINT_CSS}</style>
</head>
<body>${parts.join('\n')}</body>
</html>`;
}

/** Open the print-ready page and trigger the print dialog ("Save as
 *  PDF" there produces the document). */
export function openGuidePrintWindow(lang: GuideLang): void {
  const w = window.open('', '_blank', 'noopener=no');
  if (!w) return;
  w.document.open();
  w.document.write(buildGuidePrintHtml(lang));
  w.document.close();
  // Give the new document a beat to lay out before printing.
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* user closed it */ } }, 350);
}
