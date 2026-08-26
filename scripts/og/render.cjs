#!/usr/bin/env node
/**
 * Renders an OG card HTML file in this folder to a 1200×630 PNG in
 * public/img/, using whatever Chrome or Edge is already installed.
 *
 * Why a headless browser and not an image library: these cards carry Hebrew
 * text and a webfont, so they need a real text shaper. Screenshotting the HTML
 * keeps the card editable as HTML — change the wording, re-run, done — instead
 * of becoming a binary nobody can update.
 *
 * Usage:  node scripts/og/render.cjs og-zolstock-purchasing
 *         (name = the .html basename; the .png gets the same name)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findBrowser() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const found = CANDIDATES.find(p => fs.existsSync(p));
  if (!found) {
    console.error('[og] No Chrome or Edge found. Set CHROME_PATH to a browser binary.');
    process.exit(1);
  }
  return found;
}

function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('[og] Usage: node scripts/og/render.cjs <html-basename>');
    process.exit(1);
  }
  const src = path.join(__dirname, `${name}.html`);
  if (!fs.existsSync(src)) {
    console.error(`[og] ${src} not found.`);
    process.exit(1);
  }
  const out = path.join(__dirname, '..', '..', 'public', 'img', `${name}.png`);

  execFileSync(findBrowser(), [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    // The webfont is fetched over the network; give it time to land before
    // the shot, or the card renders in the fallback family.
    '--virtual-time-budget=6000',
    '--window-size=1200,630',
    `--screenshot=${out}`,
    `file:///${src.replace(/\\/g, '/')}`,
  ], { stdio: 'inherit' });

  const { size } = fs.statSync(out);
  console.log(`[og] wrote public/img/${name}.png (${Math.round(size / 1024)} KB)`);
}

main();
