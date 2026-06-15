/**
 * EnumBibleScreen helpers — pure, no React.
 *
 * The enum bible replaces the per-field Dynamic Context concept: the
 * old per-field DC documents (`agent.dynamicContexts[]`) are gone;
 * shared value knowledge now lives on agent-level enum types
 * (`agent.enums[]`). See `BUILDER_V2_SCHEMA.md`.
 */

import type { EnumSectionDecl, ID } from '../../types';

/**
 * Sanitise a free-text section / enum / value label into a token-safe
 * `name`. Lowercase, non-alphanum → underscore, collapse repeats,
 * trim leading/trailing underscores. Empty input returns ''.
 *
 * Matches what the prompt token parser will accept on the server side
 * (`[^}\s:]+`) — under that grammar `:` and whitespace are the
 * delimiters that would actually break a token. We're stricter here
 * so the resulting names also read cleanly to humans.
 */
export function sanitiseName(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Legacy alias — same sanitiser, kept under the old name for callers
 *  that still reach for it. */
export const sanitiseSectionName = sanitiseName;

export function newEnumId(): ID {
  return `enum_${Math.random().toString(36).slice(2, 10)}`;
}

export function newEnumValueId(): ID {
  return `enumval_${Math.random().toString(36).slice(2, 10)}`;
}

/** Short single-line snippet for tree/columns previews. */
export function snippetOf(text: string | undefined): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > 56 ? t.slice(0, 56) + '…' : t;
}

/**
 * Pick a unique section name within an enum. If `desired` is already
 * declared (case-sensitively), append `_2`, `_3`, … until free.
 */
export function uniqueSectionName(
  desired: string,
  existing: EnumSectionDecl[],
): string {
  // Treat reserved names as "already taken" so a default suggestion of
  // `values` would skip to `values_2`, etc.
  const taken = new Set([
    ...existing.map(s => s.name),
    ...RESERVED_SECTION_NAMES,
  ]);
  if (!taken.has(desired)) return desired;
  let i = 2;
  while (taken.has(`${desired}_${i}`)) i += 1;
  return `${desired}_${i}`;
}

/**
 * Section names that collide with reserved tokens on `{{enum:NAME:…}}`
 * and would shadow the assembler's special-case rendering. The editor
 * forbids these as section names.
 *
 *   - `values` → `{{enum:NAME:values}}` is the inline comma-separated
 *     list of an enum's values; allowing a `values` section would make
 *     the token ambiguous.
 *
 * Add to the set if more reserved keywords show up on the enum prefix.
 */
export const RESERVED_SECTION_NAMES = new Set<string>(['values']);

export function isReservedSectionName(name: string): boolean {
  return RESERVED_SECTION_NAMES.has(name);
}
