/**
 * useCrew Hook
 *
 * Manages crew member state for the chat interface
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAgentCrew } from '../services/crewService';
import type { CrewMember, CrewJourneyStep } from '../types/crew';

export interface UseCrewOptions {
  agentName: string;
  baseURL: string;
  /** Show full journey (all upcoming crews) instead of just next */
  showFullJourney?: boolean;
}

export interface UseCrewReturn {
  /** All crew members for the agent */
  crewMembers: CrewMember[];
  /** Currently active crew member (from SSE or last known) */
  currentCrew: CrewMember | null;
  /** User-selected override (null = automatic routing) */
  selectedOverride: string | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Set override for next message */
  setSelectedOverride: (crewName: string | null) => void;
  /** Clear override (return to automatic) */
  clearOverride: () => void;
  /** Update current crew from SSE event */
  setCurrentCrew: (crew: CrewMember | null) => void;
  /** Refresh crew list from server */
  refreshCrew: () => Promise<void>;
  /** Check if agent has crew members */
  hasCrew: boolean;
  /** Ordered journey steps for visualization */
  journeySteps: CrewJourneyStep[];
  /** Record a crew as visited (called on crew_transition) */
  addVisitedCrew: (crewName: string) => void;
  /** Reset visited crews (called on new chat) */
  resetJourney: () => void;
}

/**
 * Infer visited crews by walking the transitionTo chain from default to current.
 * If currentCrew is reachable from the default via transitionTo, all intermediate
 * crews are considered visited.
 */
function inferVisitedCrews(crewMembers: CrewMember[], currentCrewName: string | null): string[] {
  if (!currentCrewName || crewMembers.length === 0) return [];

  const byName = new Map(crewMembers.map(c => [c.name, c]));
  const defaultCrew = crewMembers.find(c => c.isDefault) || crewMembers[0];

  // If current IS the default, nothing has been visited yet
  if (defaultCrew.name === currentCrewName) return [];

  // Walk from default following transitionTo until we reach currentCrew
  const visited: string[] = [];
  let cursor = defaultCrew;
  const seen = new Set<string>();

  while (cursor && !seen.has(cursor.name)) {
    seen.add(cursor.name);

    if (cursor.name === currentCrewName) {
      // Reached current crew — visited list is complete
      return visited;
    }

    visited.push(cursor.name);

    if (cursor.transitionTo) {
      const next = byName.get(cursor.transitionTo);
      if (next) {
        cursor = next;
        continue;
      }
    }
    break;
  }

  // Could not reach currentCrew via chain — return what we walked
  return visited;
}

export function useCrew(options: UseCrewOptions): UseCrewReturn {
  const { agentName, baseURL, showFullJourney = false } = options;

  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [currentCrew, setCurrentCrew] = useState<CrewMember | null>(null);
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitedCrewNames, setVisitedCrewNames] = useState<string[]>([]);

  // Load crew members on mount or when agent changes
  const loadCrew = useCallback(async () => {
    if (!agentName || !baseURL) return;

    setIsLoading(true);
    setError(null);

    try {
      const crew = await getAgentCrew(agentName, baseURL);
      setCrewMembers(crew);

      // Set default crew as current if none set
      if (!currentCrew && crew.length > 0) {
        const defaultCrew = crew.find(c => c.isDefault) || crew[0];
        setCurrentCrew(defaultCrew);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crew');
    } finally {
      setIsLoading(false);
    }
  }, [agentName, baseURL, currentCrew]);

  useEffect(() => {
    loadCrew();
  }, [agentName, baseURL]); // Don't include loadCrew to avoid infinite loop

  // When currentCrew changes and visitedCrewNames is empty, infer the path
  useEffect(() => {
    if (currentCrew && crewMembers.length > 0 && visitedCrewNames.length === 0) {
      const inferred = inferVisitedCrews(crewMembers, currentCrew.name);
      if (inferred.length > 0) {
        setVisitedCrewNames(inferred);
      }
    }
  }, [currentCrew, crewMembers, visitedCrewNames.length]);

  // Add a crew to the visited list (called on crew_transition from ChatContext)
  const addVisitedCrew = useCallback((crewName: string) => {
    setVisitedCrewNames(prev => {
      if (prev.includes(crewName)) return prev;
      return [...prev, crewName];
    });
  }, []);

  // Reset journey (called on new chat or conversation switch)
  const resetJourney = useCallback(() => {
    setVisitedCrewNames([]);
    // Reset to default crew — will be overridden by history restore if applicable
    const defaultCrew = crewMembers.find(c => c.isDefault) || crewMembers[0] || null;
    setCurrentCrew(defaultCrew);
  }, [crewMembers]);

  // Clear override
  const clearOverride = useCallback(() => {
    setSelectedOverride(null);
  }, []);

  // Check if agent has crew
  const hasCrew = crewMembers.length > 0;

  // Build journey steps from visited + current + upcoming
  const journeySteps = useMemo<CrewJourneyStep[]>(() => {
    if (!currentCrew || crewMembers.length < 2) return [];

    const byName = new Map(crewMembers.map(c => [c.name, c]));
    const steps: CrewJourneyStep[] = [];

    // Completed steps (visited crews)
    for (const name of visitedCrewNames) {
      const crew = byName.get(name);
      if (crew) {
        steps.push({ crew, status: 'completed' });
      }
    }

    // Current step
    steps.push({ crew: currentCrew, status: 'current' });

    // Upcoming steps
    if (showFullJourney) {
      // Walk the entire transitionTo chain for full journey view
      const seen = new Set<string>([currentCrew.name, ...visitedCrewNames]);
      let cursor: CrewMember | undefined = currentCrew;

      while (cursor?.transitionTo) {
        const nextCrew = byName.get(cursor.transitionTo);
        if (!nextCrew || seen.has(nextCrew.name)) break;

        seen.add(nextCrew.name);
        steps.push({ crew: nextCrew, status: 'upcoming' });
        cursor = nextCrew;
      }
    } else {
      // Just show the next crew (default behavior)
      if (currentCrew.transitionTo) {
        const nextCrew = byName.get(currentCrew.transitionTo);
        if (nextCrew) {
          steps.push({ crew: nextCrew, status: 'upcoming' });
        }
      }
    }

    return steps;
  }, [crewMembers, currentCrew, visitedCrewNames, showFullJourney]);

  return {
    crewMembers,
    currentCrew,
    selectedOverride,
    isLoading,
    error,
    setSelectedOverride,
    clearOverride,
    setCurrentCrew,
    refreshCrew: loadCrew,
    hasCrew,
    journeySteps,
    addVisitedCrew,
    resetJourney,
  };
}
