/**
 * crewGraph — the Crew map's model (task #855), derived from the agent
 * itself so it can never drift from what actually runs.
 *
 * A conversation changes crew in exactly two ways, both on the add-on
 * chain: a Rules add-on's `transition` action, or a Transition Router.
 * Either can sit in a crew (moves FROM that crew) or in the agent-level
 * chain (moves from ANY crew). Triggers never change crew, and picking a
 * crew by hand in the Builder is a testing shortcut — neither is a move.
 * Disabled add-ons and paused rules are skipped: they don't run.
 *
 * Mirrors the server's builder/services/crewMap.js — keep them in step.
 */

import type {
  AgentDoc, AddonInstance, CrewDoc, ID, RulesAddonConfig, TransitionCondition, TransitionRouterConfig,
} from '../../types';

export const ANY_CREW = '*';

export interface CrewMove {
  id: string;
  /** Source crew id, or ANY_CREW for an agent-level add-on. */
  from: ID;
  to: ID;
  /** False when the target crew no longer exists. */
  toExists: boolean;
  /** The new crew answers in the same turn (fireImmediately, default on). */
  sameTurn: boolean;
  /** Plain-language conditions, all of which must hold. Empty = always. */
  when: string[];
  /** Where the move is configured — what "Edit" opens. */
  source: { crewId: ID | null; instanceId: ID; label: string };
}

export interface CrewMap {
  startId: ID | null;
  crews: CrewDoc[];
  moves: CrewMove[];
  /** Fewest moves from the start crew. Absent = never reached. */
  depth: Map<ID, number>;
  unreachable: ID[];
  /** Reachable crews no move leaves (agent-level moves excepted). */
  noWayOut: ID[];
  brokenMoves: CrewMove[];
}

/** `account_holder_age` → `account holder age`. */
export function humanize(name: unknown): string {
  return String(name ?? '').replace(/^#/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function valueText(v: unknown): string {
  if (v === true || v === 'true') return 'yes';
  if (v === false || v === 'false') return 'no';
  return humanize(v);
}

function listText(values: unknown[] | undefined): string {
  const vals = (values ?? []).map(valueText).filter(Boolean);
  if (vals.length <= 3) return vals.length > 1 ? `${vals.slice(0, -1).join(', ')} or ${vals[vals.length - 1]}` : (vals[0] ?? '…');
  return `${vals.slice(0, 2).join(', ')} or ${vals.length - 2} more`;
}

const OP_WORDS: Record<string, string> = {
  'not-equals': 'is not', contains: 'contains', 'starts-with': 'starts with', 'ends-with': 'ends with',
  gt: '>', gte: '≥', lt: '<', lte: '≤',
};

/** A formula the way a person would say it: tokens become names. */
function formulaText(expr: string): string {
  return expr
    .replace(/Number\.isInteger\(\s*([^)]*?)\s*\)/g, '$1 is a number')
    .replace(/parseInt\(\s*([^,)]*?)\s*(,\s*\d+\s*)?\)/g, '$1')
    .replace(/\{\{\s*#?([^}]+?)\s*\}\}/g, (_, n) => humanize(n))
    .replace(/&&/g, ' and ').replace(/\|\|/g, ' or ')
    .replace(/>=/g, '≥').replace(/<=/g, '≤').replace(/===?/g, '=').replace(/!==?/g, '≠')
    .replace(/\s+/g, ' ')
    .trim();
}

export function conditionText(c: TransitionCondition): string {
  if (c.type === 'fields-collected') {
    const fs = (c.fields ?? []).map(humanize);
    return fs.length ? `${fs.join(', ')} ${fs.length === 1 ? 'is' : 'are'} known` : 'always';
  }
  if (c.type === 'run-count') return `at most ${c.max} time${c.max === 1 ? '' : 's'}`;
  if (c.type === 'formula') return formulaText(c.expr || '') || 'always';
  if (c.type === 'field') {
    const f = humanize(c.field);
    switch (c.op) {
      case 'is-null': return `${f} is still unknown`;
      case 'is-not-null': return `${f} is known`;
      case 'in': return `${f} is ${listText(c.values)}`;
      case 'not-in': return `${f} is not ${listText(c.values)}`;
      case 'equals':
        if (c.value === true || c.value === 'true') return f;
        if (c.value === false || c.value === 'false') return `not ${f}`;
        return `${f} is ${valueText(c.value)}`;
      default: return `${f} ${OP_WORDS[c.op] ?? c.op} ${valueText(c.value)}`;
    }
  }
  return '';
}

function movesFromChain(addons: AddonInstance[] | undefined, from: ID, crewId: ID | null, out: CrewMove[]) {
  for (const inst of addons ?? []) {
    if (inst.enabled === false) continue;
    if (inst.pluginId === 'rules') {
      const cfg = (inst.config ?? {}) as Partial<RulesAddonConfig>;
      (cfg.rules ?? []).forEach((rule, i) => {
        if (rule.enabled === false) return;
        for (const act of rule.actions ?? []) {
          if (act.type !== 'transition' || !act.target) continue;
          out.push({
            id: `${inst.instanceId}:${rule.id || i}:${act.target}`,
            from, to: act.target, toExists: true,
            sameTurn: act.fireImmediately !== false,
            when: (rule.conditions ?? []).map(conditionText).filter(Boolean),
            source: { crewId, instanceId: inst.instanceId, label: `${cfg.name || 'Rules'} · rule ${i + 1}` },
          });
        }
      });
    } else if (inst.pluginId === 'transition-router') {
      const cfg = (inst.config ?? {}) as Partial<TransitionRouterConfig>;
      if (!cfg.target || !(cfg.conditions ?? []).length) continue; // not configured → never fires
      out.push({
        id: `${inst.instanceId}:${cfg.target}`,
        from, to: cfg.target, toExists: true,
        sameTurn: cfg.fireImmediately !== false,
        when: (cfg.conditions ?? []).map(conditionText).filter(Boolean),
        source: { crewId, instanceId: inst.instanceId, label: cfg.name || 'Transition Router' },
      });
    }
  }
}

export function buildCrewMap(agent: AgentDoc): CrewMap {
  const crews = agent.crews ?? [];
  const ids = new Set(crews.map(c => c.id));
  const moves: CrewMove[] = [];
  movesFromChain(agent.cortex, ANY_CREW, null, moves);
  for (const crew of crews) movesFromChain(crew.addons, crew.id, crew.id, moves);
  for (const m of moves) m.toExists = ids.has(m.to);

  const startId = agent.defaultCrewId && ids.has(agent.defaultCrewId) ? agent.defaultCrewId : (crews[0]?.id ?? null);

  // Fewest moves from the start. An agent-level move can fire from any
  // crew, so once anything is reached its targets are one step further.
  const depth = new Map<ID, number>();
  if (startId) {
    depth.set(startId, 0);
    const queue: ID[] = [startId];
    const anyTargets = moves.filter(m => m.from === ANY_CREW && m.toExists).map(m => m.to);
    while (queue.length) {
      const at = queue.shift()!;
      const d = depth.get(at)!;
      const next = [...moves.filter(m => m.from === at && m.toExists).map(m => m.to), ...anyTargets];
      for (const to of next) {
        if (!depth.has(to)) { depth.set(to, d + 1); queue.push(to); }
      }
    }
  }

  const unreachable = crews.filter(c => !depth.has(c.id)).map(c => c.id);
  const noWayOut = crews
    .filter(c => depth.has(c.id) && !moves.some(m => m.from === c.id && m.toExists && m.to !== c.id))
    .map(c => c.id);
  const brokenMoves = moves.filter(m => !m.toExists);

  return { startId, crews, moves, depth, unreachable, noWayOut, brokenMoves };
}
