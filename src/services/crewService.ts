/**
 * Crew Service
 *
 * API calls for crew member management
 */

import type { CrewMember, CrewListResponse } from '../types/crew';

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
