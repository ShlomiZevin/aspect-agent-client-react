/**
 * Multi-value fields (task #947) — client mirror of
 * `aspect-agent-server/builder/runtime/multiValue.js`. Change both.
 *
 * A field is multi-value when it is an enum field (Choice / Targeted KB)
 * with `multiple: true` and not pinned. Its memory value is a list of the
 * enum's values, kept in the enum's authored order; a stored single value
 * reads as a list of one.
 */
import type { EnumTypeDef, FieldDef } from '../types';

export function isMultiField(def: Pick<FieldDef, 'type' | 'source'> & { multiple?: boolean } | null | undefined): boolean {
  return !!(def && def.type === 'enum' && def.multiple === true && def.source !== 'pinned');
}

/** Any stored value → a clean list of strings. */
export function valuesOf(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter(v => v !== undefined && v !== null)
      .map(v => String(v).trim())
      .filter(Boolean);
  }
  const s = String(raw).trim();
  return s ? [s] : [];
}

/** De-duplicate and sort into the enum's authored order. */
export function orderByEnum(values: unknown, enumDef: EnumTypeDef | null | undefined): string[] {
  const list = [...new Set(valuesOf(values))];
  const order = new Map<string, number>();
  (enumDef?.values ?? []).forEach((v, i) => {
    if (v && typeof v.value === 'string' && !order.has(v.value)) order.set(v.value, i);
  });
  const rank = (v: string) => (order.has(v) ? order.get(v)! : Number.MAX_SAFE_INTEGER);
  return list
    .map((v, i) => ({ v, i }))
    .sort((a, b) => (rank(a.v) - rank(b.v)) || (a.i - b.i))
    .map(x => x.v);
}

/** How the condition ops read on a multi-value field (#947) — the editor,
 *  the Rules summary, the crew map and the server's run-card "why" line
 *  (conditionMatcher LIST_WORDS) all say these words. */
export const LIST_OP_WORDS: Partial<Record<string, string>> = {
  'equals':     'includes',
  'not-equals': "doesn't include",
  'in':         'includes any of',
  'not-in':     'includes none of',
};

/** How a multi-value field reads inline: `a, b`. */
export function formatList(values: unknown): string {
  return valuesOf(values).join(', ');
}
