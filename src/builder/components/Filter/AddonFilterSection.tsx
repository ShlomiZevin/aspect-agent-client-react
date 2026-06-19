/**
 * AddonFilterSection — per-addon "should this run?" gate.
 *
 * Thin wrapper over the shared `FilterEditor`. Sources the addon's
 * live filter via `useAddonMutations`, pipes changes back, and
 * defaults addon-flavoured copy ("run / runs").
 *
 * Two independent axes (cap + conditions) are owned by FilterEditor;
 * the addon path is just the plumbing.
 */

import { useAddonMutations } from '../../state/useAddonMutations';
import { FilterEditor } from './FilterEditor';
import type { AddonFilter, AddonInstance, ID } from '../../types';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  instance: AddonInstance;
}

export function AddonFilterSection({ agentId, crewId, instance }: Props) {
  const muts = useAddonMutations(agentId, crewId);
  const ctx = instance.context;
  const filter: AddonFilter = ctx.filter ?? { conditions: [], mode: 'include' };

  const handleChange = (next: AddonFilter) =>
    muts.updateContext(instance.instanceId, { ...ctx, filter: next });

  return (
    <FilterEditor
      agentId={agentId}
      crewId={crewId}
      filter={filter}
      onChange={handleChange}
      verb="run"
      verbs="runs"
      skippedSentence='Skipped runs show as "skipped" cards in the chat timeline with the reason.'
      emptyMessage="No conditions — only the cap above gates this addon."
    />
  );
}
