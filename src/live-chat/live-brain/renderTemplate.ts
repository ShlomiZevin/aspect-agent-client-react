/**
 * Deterministic rich-HTML rendering.
 *
 * The panel's `template` is author-approved static HTML with `{{slot}}`
 * placeholders. At runtime the addon LLM returns ONLY typed values (never
 * HTML). We escape each value and substitute it into its slot; a missing or
 * malformed value falls back to the slot's declared fallback. Any leftover
 * (undeclared) token is stripped. So the worst a bad model response can do
 * is show fallbacks — it can never inject markup, script, or break layout.
 */

import type { SlotDef } from './types';

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeValue(v: string | number): string {
  return String(v).replace(/[&<>"']/g, (c) => ESC[c]);
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

export function renderTemplate(
  template: string,
  values: Record<string, string | number> | undefined,
  schema: SlotDef[] | undefined,
): string {
  let out = template;
  const vals = values ?? {};

  for (const slot of schema ?? []) {
    const raw = vals[slot.name];
    const chosen = isEmpty(raw) ? slot.fallback : raw;
    out = out.split(`{{${slot.name}}}`).join(escapeValue(chosen));
  }

  // Strip any token not covered by the schema so nothing leaks half-rendered.
  return out.replace(/\{\{[^}]+\}\}/g, '');
}
