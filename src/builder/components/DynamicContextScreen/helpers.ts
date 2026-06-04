/**
 * DynamicContextScreen helpers — pure, no React.
 *
 * The sentinel keeps the fallback case addressable through the URL
 * without colliding with a real enum value (enum values can't contain
 * `__` adjacency by sanitisation convention, but the underscore-
 * prefix is a stricter guard anyway).
 */

import type {
  DynamicContextCase,
  DynamicContextDef,
  DynamicContextSection,
  FieldDef,
  ID,
} from '../../types';

export const FALLBACK_SEGMENT = '__fallback__';

/**
 * Sanitise a free-text section label into a token-safe `name`.
 * Lowercase, non-alphanum → underscore, collapse repeats, trim
 * leading/trailing underscores. Empty input returns ''.
 *
 * Matches what the prompt token parser will accept on the server
 * side (`[^}\s:]+`) — under that grammar `:` and whitespace are the
 * delimiters that would actually break a token. We're stricter here
 * so the resulting names also read cleanly to humans.
 */
export function sanitiseSectionName(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Stable id-ish for new DC defs. Matches the old modal's helper. */
export function newDcId(): ID {
  return `dc_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Align a DC's cases with the field's enum values. Preserves text /
 * sections for values that still exist; drops cases whose value was
 * removed from the field; adds empty cases for new enum entries.
 * Pure — returns a new DC.
 */
export function syncCases(dc: DynamicContextDef, field: FieldDef): DynamicContextDef {
  const enumVals = field.enumValues ?? [];
  const byValue = new Map(dc.cases.map(c => [c.value, c]));
  const cases: DynamicContextCase[] = enumVals.map(v => byValue.get(v) ?? { value: v, text: '' });
  return { ...dc, cases };
}

/** Short single-line snippet for tree/columns previews. */
export function snippetOf(text: string | undefined): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > 56 ? t.slice(0, 56) + '…' : t;
}

/**
 * Pick a unique section name within a case. If `desired` is already
 * taken (case-sensitively), append `_2`, `_3`, … until free.
 */
export function uniqueSectionName(
  desired: string,
  existing: DynamicContextSection[],
): string {
  const taken = new Set(existing.map(s => s.name));
  if (!taken.has(desired)) return desired;
  let i = 2;
  while (taken.has(`${desired}_${i}`)) i += 1;
  return `${desired}_${i}`;
}
