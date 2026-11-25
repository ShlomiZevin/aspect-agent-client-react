/** Lybi Gate — small formatters shared by the page and its windows. */

import type { GateLogRow, GateStoredValue } from './gateApi';
import { G } from './gateCopy';

/** Server timestamps are UTC without a zone (the platform's columns). */
export function fmtTime(at: string | null | undefined): string {
  if (!at) return '—';
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(at) ? at : `${at}Z`);
  if (Number.isNaN(d.getTime())) return '—';
  const today = new Date();
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return d.toDateString() === today.toDateString() ? time : `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} ${time}`;
}

/** How a stored value reads on screen (never the sealed text itself). */
export function storedText(x: GateStoredValue): string {
  if (x.empty) return G.stEmpty;
  if (x.a === 'hide') return G.stHide;
  if (x.a === 'enc') return G.stEnc;
  if (x.a === 'token') return `${x.t} · 🔒`;
  if (x.a === 'conv') return `${x.v} · 🔒`;
  return x.v ?? '';
}

/** One line of details for a log row — names and counts only (that is all the log holds). */
export function logDetails(r: GateLogRow): string {
  const s = r.summary as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof s.name === 'string') parts.push(s.name);
  if (typeof s.key === 'string') parts.push(`מפתח: ${s.key}`);
  if (typeof s.file === 'string') parts.push(s.file);
  if (typeof s.records === 'number') parts.push(`${s.records} רשומות`);
  if (s.sent && typeof s.sent === 'object') parts.push(`נשלחו: ${Object.entries(s.sent as Record<string, string>).map(([k, a]) => `${k} (${a})`).join(', ')}`);
  if (Array.isArray(s.newFields) && s.newFields.length) parts.push(`שדות חדשים: ${(s.newFields as string[]).length}`);
  if (s.actions && typeof s.actions === 'object') parts.push(Object.entries(s.actions as Record<string, number>).map(([a, n]) => `${a} ${n}`).join(' · '));
  if (typeof s.fields === 'number') parts.push(`${s.fields} שדות`);
  if (typeof s.reason === 'string') parts.push(s.reason === 'bad or revoked key' ? 'מפתח שגוי או מבוטל' : s.reason);
  if (typeof s.prefix === 'string') parts.push(s.prefix);
  if (typeof s.error === 'string') parts.push(s.error);
  if (r.policyVersion) parts.push(`גרסה ${r.policyVersion}`);
  if (r.actor && r.direction === 'admin') parts.push(r.actor);
  return parts.join(' · ');
}
