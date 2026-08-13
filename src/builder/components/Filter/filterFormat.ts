/**
 * filterFormat — small helpers for rendering an `AddonFilter` in
 * places that aren't the full editor: chip tooltips, modal-button
 * status labels, run cards. Centralised so the wording stays
 * consistent everywhere.
 *
 * Surfaces both axes of the filter:
 *   - `cap` — "Cap: 3/conv" prefix when present.
 *   - `conditions` + `mode` — the existing field-condition summary.
 */

import type { AddonFilter, TransitionCondition } from '../../types';

/** True when this filter actually gates anything. Centralised so the
 *  chip-badge, AddonModal launcher, and tooltips agree on the
 *  "is there a filter?" check. Cap alone counts. */
export function isFilterActive(filter: AddonFilter | undefined): boolean {
  if (!filter) return false;
  const hasCap = typeof filter.cap === 'number' && filter.cap > 0;
  const hasConds = Array.isArray(filter.conditions) && filter.conditions.length > 0;
  return hasCap || hasConds;
}

/** "Cap: 3/conv" / "Cap: once" — short, fits inline. */
function capLabel(cap: number): string {
  if (cap === 1) return 'Cap: once / conv';
  return `Cap: ${cap} / conv`;
}

/** Short one-line header — used in the chip tooltip. */
export function filterHeadline(filter: AddonFilter | undefined): string {
  if (!isFilterActive(filter)) return 'No filter — addon runs every turn';
  const hasCap = typeof filter!.cap === 'number' && filter!.cap > 0;
  const hasConds = filter!.conditions.length > 0;
  const parts: string[] = [];
  if (hasCap) parts.push(capLabel(filter!.cap as number));
  if (hasConds) {
    const n = filter!.conditions.length;
    const noun = `${n} condition${n === 1 ? '' : 's'}`;
    parts.push(filter!.mode === 'exclude'
      ? `Skip when ${noun} match`
      : `Run when ${noun} match`);
  }
  return parts.join(' · ');
}

/**
 * Inline-readable summary used by the AddonModal launcher button.
 * Same wording as the tooltip header so the surface stays consistent;
 * appends a first-condition preview when conditions are configured.
 *
 * Format:
 *  - No filter         → "No filter — addon runs every turn"
 *  - Cap only          → "Cap: 3 / conv"
 *  - 1 condition       → "[Cap: 3 / conv · ] Run when <readable cond>"
 *  - 2+ conditions     → "[Cap: 3 / conv · ] Run when <readable cond> (+N more)"
 */
export function filterShortSummary(filter: AddonFilter | undefined): string {
  if (!isFilterActive(filter)) return 'No filter — addon runs every turn';
  const hasCap = typeof filter!.cap === 'number' && filter!.cap > 0;
  const hasConds = filter!.conditions.length > 0;
  const parts: string[] = [];
  if (hasCap) parts.push(capLabel(filter!.cap as number));
  if (hasConds) {
    const verb = filter!.mode === 'exclude' ? 'Skip when' : 'Run when';
    const first = conditionLine(filter!.conditions[0]);
    const extra = filter!.conditions.length - 1;
    parts.push(extra > 0 ? `${verb} ${first} (+${extra} more)` : `${verb} ${first}`);
  }
  return parts.join(' · ');
}

/** Render one condition as a short readable line. */
export function conditionLine(c: TransitionCondition): string {
  if (c.type === 'fields-collected') {
    const fs = (c.fields ?? []).join(', ');
    return fs ? `fields collected: ${fs}` : 'fields collected (none picked)';
  }
  if (c.type === 'field') {
    if (c.op === 'is-null') return `${c.field} is empty`;
    if (c.op === 'is-not-null') return `${c.field} has a value`;
    if (c.op === 'in' || c.op === 'not-in') {
      const vals = (c.values ?? []).map(v => String(v)).join(', ');
      return `${c.field} ${c.op} [${vals}]`;
    }
    return `${c.field} ${c.op} ${JSON.stringify(c.value)}`;
  }
  if (c.type === 'formula') {
    return c.expr || '(empty formula)';
  }
  if (c.type === 'run-count') {
    return `runs ≤ ${c.max}`;
  }
  return '';
}

/**
 * Multi-line tooltip — headline + each condition on its own line.
 * Newlines render as line breaks inside a native `title` attribute
 * (which most browsers do), giving the author a quick preview on
 * hover without opening the modal.
 */
export function filterTooltip(filter: AddonFilter | undefined): string {
  const head = filterHeadline(filter);
  if (!isFilterActive(filter)) return head;
  const lines: string[] = [];
  if (filter!.conditions.length > 0) {
    for (const c of filter!.conditions) lines.push(`  • ${conditionLine(c)}`);
  }
  return lines.length > 0 ? `${head}\n${lines.join('\n')}` : head;
}
