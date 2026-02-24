/**
 * Crew Service
 *
 * API calls for crew member management
 */

import type {
  CrewMember,
  CrewListResponse,
  CrewMemberConfig,
  CrewMemberCreateRequest,
  CrewMemberUpdateRequest,
  CrewGenerateResponse,
  CrewExportResponse
} from '../types/crew';
import type { TransitionLogicConfig } from '../types/chat';

/**
 * Get all crew members for an agent
 *
 * @param agentName - Name of the agent
 * @param baseURL - API base URL
 * @returns Array of crew members
 */
export async function getAgentCrew(
  agentName: string,
  baseURL: string
): Promise<CrewMember[]> {
  try {
    const response = await fetch(`${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew`);

    if (!response.ok) {
      throw new Error(`Failed to fetch crew: ${response.statusText}`);
    }

    const data: CrewListResponse = await response.json();
    return data.crew || [];
  } catch (error) {
    console.error('Error fetching agent crew:', error);
    return [];
  }
}

// ============================================
// Dashboard Crew Management API
// ============================================

/**
 * Get a single crew member by name
 *
 * @param agentName - Name of the agent
 * @param crewName - Name of the crew member
 * @param baseURL - API base URL
 * @returns Crew member config or null
 */
export async function getCrewMember(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<CrewMemberConfig | null> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members/${encodeURIComponent(crewName)}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch crew member: ${response.statusText}`);
    }

    const data = await response.json();
    return data.crewMember || null;
  } catch (error) {
    console.error('Error fetching crew member:', error);
    return null;
  }
}

/**
 * Create a new crew member
 *
 * @param agentName - Name of the agent
 * @param config - Crew member configuration
 * @param baseURL - API base URL
 * @returns Created crew member or null on error
 */
export async function createCrewMember(
  agentName: string,
  config: CrewMemberCreateRequest,
  baseURL: string
): Promise<CrewMemberConfig | null> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to create crew member: ${response.statusText}`);
    }

    const data = await response.json();
    return data.crewMember || null;
  } catch (error) {
    console.error('Error creating crew member:', error);
    throw error;
  }
}

/**
 * Update an existing crew member
 *
 * @param agentName - Name of the agent
 * @param crewName - Name of the crew member to update
 * @param updates - Fields to update
 * @param baseURL - API base URL
 * @returns Updated crew member or null on error
 */
export async function updateCrewMember(
  agentName: string,
  crewName: string,
  updates: CrewMemberUpdateRequest,
  baseURL: string
): Promise<CrewMemberConfig | null> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members/${encodeURIComponent(crewName)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to update crew member: ${response.statusText}`);
    }

    const data = await response.json();
    return data.crewMember || null;
  } catch (error) {
    console.error('Error updating crew member:', error);
    throw error;
  }
}

/**
 * Delete a crew member (soft delete)
 *
 * @param agentName - Name of the agent
 * @param crewName - Name of the crew member to delete
 * @param baseURL - API base URL
 * @returns Success status
 */
export async function deleteCrewMember(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members/${encodeURIComponent(crewName)}`,
      {
        method: 'DELETE'
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete crew member: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting crew member:', error);
    return false;
  }
}

/**
 * Generate a crew member from natural language description
 *
 * @param agentName - Name of the agent
 * @param description - Natural language description of the crew member
 * @param baseURL - API base URL
 * @returns Generated crew config or error
 */
export async function generateCrewMember(
  agentName: string,
  description: string,
  baseURL: string
): Promise<CrewGenerateResponse> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members/generate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || `Failed to generate crew member: ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      config: data.config
    };
  } catch (error) {
    console.error('Error generating crew member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get transition logic for a specific crew member (for debug panel)
 *
 * @param agentName - Name of the agent
 * @param crewName - Name of the crew member
 * @param baseURL - API base URL
 * @returns Transition logic config or null
 */
export async function getCrewTransitionLogic(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<TransitionLogicConfig | null> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members/${encodeURIComponent(crewName)}/transition-logic`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch transition logic: ${response.statusText}`);
    }

    const data = await response.json();
    return data.transitionLogic || null;
  } catch (error) {
    console.error('Error fetching transition logic:', error);
    return null;
  }
}

/**
 * Export a crew member to .crew.js file code
 *
 * @param agentName - Name of the agent
 * @param crewName - Name of the crew member to export
 * @param baseURL - API base URL
 * @returns Generated code and filename or error
 */
export async function exportCrewMember(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<CrewExportResponse> {
  try {
    const response = await fetch(
      `${baseURL}/api/agents/${encodeURIComponent(agentName)}/crew-members/${encodeURIComponent(crewName)}/export`,
      {
        method: 'POST'
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || `Failed to export crew member: ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      code: data.code,
      filename: data.filename
    };
  } catch (error) {
    console.error('Error exporting crew member:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
