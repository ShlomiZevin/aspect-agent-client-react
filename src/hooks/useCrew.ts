/**
 * useCrew Hook
 *
 * Manages crew member state for the chat interface
 */

import { useState, useEffect, useCallback } from 'react';
import { getAgentCrew } from '../services/crewService';
import type { CrewMember } from '../types/crew';

export interface UseCrewOptions {
  agentName: string;
  baseURL: string;
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
}

export function useCrew(options: UseCrewOptions): UseCrewReturn {
  const { agentName, baseURL } = options;

  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [currentCrew, setCurrentCrew] = useState<CrewMember | null>(null);
  const [selectedOverride, setSelectedOverride] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Clear override
  const clearOverride = useCallback(() => {
    setSelectedOverride(null);
  }, []);

  // Check if agent has crew
  const hasCrew = crewMembers.length > 0;

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
    hasCrew
  };
}
