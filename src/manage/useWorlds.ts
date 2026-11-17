/**
 * The worlds the right panel can offer (task #985): "all agents" plus one
 * card per agent, each with today's status (תקין / N to handle).
 *
 *   unlocked (Lybi team)  → every agent, from the "all" read
 *   locked, one agent     → only that agent (its own read)
 *   locked, "all"         → none (the unlock gate is showing)
 */

import { useEffect, useState } from 'react';
import { manageService } from '../services/manageService';
import type { ManageAgentSummary } from '../types/manage';

const REFRESH_MS = 2 * 60 * 1000;

export function useWorlds(agentSlug: string | null, unlocked: boolean): ManageAgentSummary[] | null {
  const [state, setState] = useState<{ key: string; agents: ManageAgentSummary[] } | null>(null);
  const [tick, setTick] = useState(0);
  const key = `${unlocked ? 'all' : agentSlug || '-'}|${tick}`;

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const load = unlocked
      ? manageService.getAllProblems('today').then(d => d.agents.filter(a => !a.archived || a.slug === agentSlug))
      : agentSlug
        ? manageService.getAgentProblems(agentSlug, 'today').then(d => (d.agent ? [d.agent] : []))
        : Promise.resolve([] as ManageAgentSummary[]);
    load
      .then(agents => { if (alive) setState({ key, agents }); })
      .catch(() => { if (alive) setState({ key, agents: [] }); });
    return () => { alive = false; };
    // `key` carries every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state ? state.agents : null;
}
