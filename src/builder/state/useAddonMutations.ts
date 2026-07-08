/**
 * useAddonMutations — unified addon mutation API across the two scopes
 * (agent-cortex vs crew-addons). Returns the same call shape regardless
 * of where the addons live, so ChainCanvas / AddonModal / etc don't
 * need to branch on scope at every call site.
 *
 *   - `crewId = null` → operates on `agent.cortex[]`
 *   - `crewId = ID`   → operates on `agent.crews[*].addons[]`
 *
 * Mutations dispatch through the BuilderContext setters that already
 * handle persistence + dirty tracking. This hook is a thin
 * scope-router, not a separate state surface.
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import type {
  AddonContext,
  AddonInstance,
  AddonLane,
  ID,
  OutputType,
} from '../types';

export interface AddonMutations {
  /** True when scope === agent. Surfaces here so consumers can switch
   *  UI copy / restricted-plugin filtering without re-deriving. */
  isAgentScope: boolean;
  add:           (instance: AddonInstance) => void;
  updateConfig:  (instanceId: ID, nextConfig: unknown) => void;
  updateContext: (instanceId: ID, nextContext: AddonContext) => void;
  setOutputType: (instanceId: ID, nextType: OutputType) => void;
  setEnabled:    (instanceId: ID, enabled: boolean) => void;
  /** Toggle whether this blocking-lane addon joins the previous
   *  addon's parallel step (`‖`) or starts a new one (`→`). */
  setJoinsPreviousStep: (instanceId: ID, joins: boolean) => void;
  remove:        (instanceId: ID) => void;
  reorderInLane: (lane: AddonLane, fromIdx: number, toIdx: number) => void;
}

export function useAddonMutations(agentId: ID, crewId: ID | null): AddonMutations {
  const {
    addAddon,
    updateAddonConfig,
    updateAddonContext,
    setAddonOutputType,
    setAddonEnabled,
    setAddonJoinsPreviousStep,
    removeAddon,
    reorderAddonInLane,
    addAgentAddon,
    updateAgentAddonConfig,
    updateAgentAddonContext,
    setAgentAddonOutputType,
    setAgentAddonEnabled,
    setAgentAddonJoinsPreviousStep,
    removeAgentAddon,
    reorderAgentAddonInLane,
  } = useBuilder();

  return useMemo<AddonMutations>(() => {
    if (crewId === null) {
      return {
        isAgentScope:  true,
        add:           (instance)                  => addAgentAddon(agentId, instance),
        updateConfig:  (instanceId, next)          => updateAgentAddonConfig(agentId, instanceId, next),
        updateContext: (instanceId, next)          => updateAgentAddonContext(agentId, instanceId, next),
        setOutputType: (instanceId, next)          => setAgentAddonOutputType(agentId, instanceId, next),
        setEnabled:    (instanceId, enabled)       => setAgentAddonEnabled(agentId, instanceId, enabled),
        setJoinsPreviousStep: (instanceId, joins)  => setAgentAddonJoinsPreviousStep(agentId, instanceId, joins),
        remove:        (instanceId)                => removeAgentAddon(agentId, instanceId),
        reorderInLane: (lane, fromIdx, toIdx)      => reorderAgentAddonInLane(agentId, lane, fromIdx, toIdx),
      };
    }
    return {
      isAgentScope:  false,
      add:           (instance)                  => addAddon(agentId, crewId, instance),
      updateConfig:  (instanceId, next)          => updateAddonConfig(agentId, crewId, instanceId, next),
      updateContext: (instanceId, next)          => updateAddonContext(agentId, crewId, instanceId, next),
      setOutputType: (instanceId, next)          => setAddonOutputType(agentId, crewId, instanceId, next),
      setEnabled:    (instanceId, enabled)       => setAddonEnabled(agentId, crewId, instanceId, enabled),
      setJoinsPreviousStep: (instanceId, joins)  => setAddonJoinsPreviousStep(agentId, crewId, instanceId, joins),
      remove:        (instanceId)                => removeAddon(agentId, crewId, instanceId),
      reorderInLane: (lane, fromIdx, toIdx)      => reorderAddonInLane(agentId, crewId, lane, fromIdx, toIdx),
    };
  }, [
    agentId, crewId,
    addAddon, updateAddonConfig, updateAddonContext, setAddonOutputType,
    setAddonEnabled, setAddonJoinsPreviousStep, removeAddon, reorderAddonInLane,
    addAgentAddon, updateAgentAddonConfig, updateAgentAddonContext,
    setAgentAddonOutputType, setAgentAddonEnabled, setAgentAddonJoinsPreviousStep,
    removeAgentAddon, reorderAgentAddonInLane,
  ]);
}
