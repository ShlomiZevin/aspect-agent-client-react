/**
 * filterFormat — small helpers for rendering an `AddonFilter` in
 * places that aren't the full editor: chip tooltips, modal-button
 * status labels, run cards. Centralised so the wording stays
 * consistent everywhere.
 */

import type { AddonFilter, TransitionCondition } from '../../types';

/** Short one-line header — "Run when 3 conditions" / "Skip when matches". */
export function filterHeadline(filter: AddonFilter | undefined): string {
  if (!filter || !Array.isArray(filter.conditions) || filter.conditions.length === 0) {
    return 'No filter — addon runs every turn';
  }
  const n = filter.conditions.length;
  const noun = `${n} condition${n === 1 ? '' : 's'}`;
  return filter.mode === 'exclude'
    ? `Skip when ${noun} match`
    : `Run when ${noun} match`;
}

/**
 * Inline-readable summary — "Run when tier = enterprise (+1 more)".
 * Used by the AddonModal launcher button so the author sees WHAT the
 * gate looks at without opening the editor. Falls back to
 * `filterHeadline` for the empty / no-conditions case.
 *
 * Format:
 *  - 0 conditions  → "No filter — addon runs every turn"
 *  - 1 condition   → "Run when <readable cond>"
 *  - 2+ conditions → "Run when <readable cond> (+N more)"
 * (Same shape with "Skip when" for `exclude` mode.)
 */
export function filterShortSummary(filter: AddonFilter | undefined): string {
  if (!filter || !Array.isArray(filter.conditions) || filter.conditions.length === 0) {
    return 'No filter — addon runs every turn';
  }
  const verb = filter.mode === 'exclude' ? 'Skip when' : 'Run when';
  const first = conditionLine(filter.conditions[0]);
  if (filter.conditions.length === 1) return `${verb} ${first}`;
  const extra = filter.conditions.length - 1;
  return `${verb} ${first} (+${extra} more)`;
}

/** Render one condition as a short readable line. */
export function conditionLine(c: TransitionCondition): string {
  if (c.type === 'fields-collected') {
    const fs = (c.fields ?? []).join(', ');
    return fs ? `fields collected: ${fs}` : 'fields collected (none picked)';
  }
  if (c.type === 'field') {
    if (c.op === 'in' || c.op === 'not-in') {
      const vals = (c.values ?? []).map(v => String(v)).join(', ');
      return `${c.field} ${c.op} [${vals}]`;
    }
    return `${c.field} ${c.op} ${JSON.stringify(c.value)}`;
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
  if (!filter || filter.conditions.length === 0) return head;
  const lines = filter.conditions.map(c => `  • ${conditionLine(c)}`);
  return `${head}\n${lines.join('\n')}`;
}
