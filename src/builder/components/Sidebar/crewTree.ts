/**
 * CREWS sidebar hierarchy (task #855) — pure helpers.
 *
 * The tree is MANUAL and DISPLAY ONLY: `agent.crewTree.parents` maps a crew
 * to the crew it is shown under. It never affects routing — the runtime
 * doesn't read it. Sibling order is the crews' own order (`agent.crews`,
 * persisted by the existing drag-reorder), so a move = a new parent (maybe)
 * + a new global order (maybe).
 *
 * Server twin (MCP read/validate): aspect-agent-server/builder/services/crewTree.js
 * Design: lybi-website/art-source/ui/crew-tree-855/
 */

import type { CrewDoc, ID } from '../../types';

/**
 * Effective parent of each crew: only when the parent exists and walking
 * up never loops. Anything else (stale id, loop written from outside) is
 * shown at the top level — the list must never lose a crew.
 */
export function effectiveParents(crews: CrewDoc[], raw: Record<ID, ID> | undefined): Map<ID, ID> {
  const ids = new Set(crews.map(c => c.id));
  const out = new Map<ID, ID>();
  if (!raw) return out;
  for (const c of crews) {
    const p = raw[c.id];
    if (!p || !ids.has(p)) continue;
    const seen = new Set<ID>([c.id]);
    let cur: ID | undefined = p;
    let ok = true;
    while (cur) {
      if (seen.has(cur)) { ok = false; break; }
      seen.add(cur);
      const up: ID | undefined = raw[cur];
      cur = up && ids.has(up) ? up : undefined;
    }
    if (ok) out.set(c.id, p);
  }
  return out;
}

/** Children of each parent (null = top level), in the crews' order. */
export function childrenMap(crews: CrewDoc[], parents: Map<ID, ID>): Map<ID | null, ID[]> {
  const m = new Map<ID | null, ID[]>();
  for (const c of crews) {
    const p = parents.get(c.id) ?? null;
    if (!m.has(p)) m.set(p, []);
    m.get(p)!.push(c.id);
  }
  return m;
}

/** `id` and everything under it. */
export function subtreeOf(id: ID, kids: Map<ID | null, ID[]>): Set<ID> {
  const out = new Set<ID>([id]);
  const stack = [id];
  while (stack.length) {
    for (const k of kids.get(stack.pop()!) ?? []) { out.add(k); stack.push(k); }
  }
  return out;
}

export interface TreeRow {
  crew: CrewDoc;
  depth: number;
  hasKids: boolean;
  /** Number of crews under it (any depth) — shown when collapsed. */
  descendants: number;
  isLast: boolean;
  /** Per ancestor level (0..depth-2): does that ancestor's line continue below? */
  guides: boolean[];
}

/** The visible rows, depth-first, skipping what's under a collapsed crew. */
export function visibleRows(
  crews: CrewDoc[],
  kids: Map<ID | null, ID[]>,
  collapsed: Set<ID>,
): TreeRow[] {
  const byId = new Map(crews.map(c => [c.id, c]));
  const rows: TreeRow[] = [];
  const walk = (parent: ID | null, depth: number, guides: boolean[]) => {
    const list = kids.get(parent) ?? [];
    list.forEach((id, i) => {
      const crew = byId.get(id)!;
      const childIds = kids.get(id) ?? [];
      const isLast = i === list.length - 1;
      rows.push({
        crew, depth, isLast, guides,
        hasKids: childIds.length > 0,
        descendants: subtreeOf(id, kids).size - 1,
      });
      if (childIds.length && !collapsed.has(id)) {
        walk(id, depth + 1, depth === 0 ? [] : [...guides, !isLast]);
      }
    });
  };
  walk(null, 0, []);
  return rows;
}

/**
 * Place `moved` under `parent` (null = top level) at sibling `index`, and
 * return the new global crew order. Siblings are ordered by the global
 * order, so inserting right before the sibling that should follow (or
 * right after the last one) puts it exactly there.
 */
export function placeInOrder(
  order: ID[],
  moved: ID,
  parent: ID | null,
  index: number,
  parents: Map<ID, ID>,
): ID[] {
  const rest = order.filter(id => id !== moved);
  const sibs = rest.filter(id => (parents.get(id) ?? null) === parent);
  let at: number;
  if (index < sibs.length) at = rest.indexOf(sibs[Math.max(0, index)]);
  else if (sibs.length) at = rest.indexOf(sibs[sibs.length - 1]) + 1;
  else if (parent) at = rest.indexOf(parent) + 1;
  else at = rest.length;
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

export type DropZone = 'before' | 'inside' | 'after';

export interface MoveResult {
  order: ID[];
  /** The new raw parents map (only real entries). */
  parents: Record<ID, ID>;
}

/**
 * Work out a move. Returns null when it isn't allowed (onto itself or
 * anywhere inside its own subtree — that would be a loop).
 */
export function computeMove(args: {
  crews: CrewDoc[];
  parents: Map<ID, ID>;
  moved: ID;
  /** Drop target; null with zone 'inside' = top level, at the end. */
  target: ID | null;
  zone: DropZone;
  /** Is the target expanded with visible children? ('after' then = first child.) */
  targetOpen?: boolean;
}): MoveResult | null {
  const { crews, parents, moved, target, zone, targetOpen } = args;
  const order = crews.map(c => c.id);
  const kids = childrenMap(crews, parents);
  let parent: ID | null;
  let index: number;
  if (target === null) {
    parent = null;
    index = Number.MAX_SAFE_INTEGER;
  } else if (zone === 'inside') {
    parent = target;
    index = Number.MAX_SAFE_INTEGER;
  } else if (zone === 'after' && targetOpen && (kids.get(target)?.length ?? 0) > 0) {
    parent = target;
    index = 0;
  } else {
    parent = parents.get(target) ?? null;
    const sibs = (kids.get(parent) ?? []).filter(id => id !== moved);
    index = sibs.indexOf(target) + (zone === 'after' ? 1 : 0);
  }
  if (parent !== null && subtreeOf(moved, kids).has(parent)) return null;
  const nextParents = new Map(parents);
  if (parent) nextParents.set(moved, parent); else nextParents.delete(moved);
  return {
    order: placeInOrder(order, moved, parent, index, nextParents),
    parents: Object.fromEntries(nextParents),
  };
}
