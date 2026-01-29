/**
 * Crew Member Types
 *
 * Types for the multi-agent crew infrastructure
 */

/**
 * Crew member information returned from API
 */
export interface CrewMember {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  collectFields: string[];
  toolCount: number;
}

/**
 * Response from GET /api/agents/:agentName/crew
 */
export interface CrewListResponse {
  agentName: string;
  crew: CrewMember[];
}

/**
 * Crew info sent via SSE
 */
export interface CrewInfoEvent {
  type: 'crew_info';
  crew: CrewMember;
}

/**
 * Crew transition event sent via SSE
 */
export interface CrewTransitionEvent {
  type: 'crew_transition';
  transition: {
    from: string;
    to: string;
    reason: string;
    timestamp: string;
  };
}

/**
 * State for crew management in the chat
 */
export interface CrewState {
  crewMembers: CrewMember[];
  currentCrew: CrewMember | null;
  selectedOverride: string | null;
  isLoading: boolean;
  error: string | null;
}
