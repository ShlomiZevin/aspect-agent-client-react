/**
 * Prompt Service
 *
 * API calls for crew member prompt management (debug mode)
 */

import type { CrewMemberPrompt, PromptVersion } from '../types/promptEditor';
import { apiRequest, getBaseURL } from './api';

/**
 * Get all prompts for all crew members of an agent
 */
export async function getAgentPrompts(
  agentName: string,
  baseURL?: string
): Promise<CrewMemberPrompt[]> {
  const url = baseURL || getBaseURL();
  const response = await apiRequest<{ agentName: string; prompts: CrewMemberPrompt[] }>(
    `/api/agents/${encodeURIComponent(agentName)}/prompts`,
    { method: 'GET' },
    url
  );
  return response.prompts;
}

/**
 * Get prompt versions for a specific crew member
 */
export async function getCrewPromptVersions(
  agentName: string,
  crewName: string,
  baseURL?: string
): Promise<{ crewMemberId: string; versions: PromptVersion[] }> {
  const url = baseURL || getBaseURL();
  return apiRequest<{ crewMemberId: string; versions: PromptVersion[] }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts`,
    { method: 'GET' },
    url
  );
}

/**
 * Get the active prompt for a crew member
 */
export async function getActivePrompt(
  agentName: string,
  crewName: string,
  baseURL?: string
): Promise<{ crewMemberId: string; prompt: PromptVersion | null; source: 'database' | 'code' }> {
  const url = baseURL || getBaseURL();
  return apiRequest<{ crewMemberId: string; prompt: PromptVersion | null; source: 'database' | 'code' }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts/active`,
    { method: 'GET' },
    url
  );
}

/**
 * Create a new prompt version (Save as New Version)
 */
export interface SaveVersionPayload {
  prompt: string;
  name?: string;
  transitionSystemPrompt?: string;
  model?: string;
  provider?: string;
  kbSources?: string[];
  persona?: string;
  thinkingPrompt?: string;
}

export async function createPromptVersion(
  agentName: string,
  crewName: string,
  payload: SaveVersionPayload,
  baseURL?: string,
): Promise<PromptVersion> {
  const url = baseURL || getBaseURL();
  const response = await apiRequest<{ success: boolean; version: PromptVersion }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    url
  );
  return response.version;
}

/**
 * Update an existing prompt version (Save/Overwrite)
 */
export async function updatePromptVersion(
  agentName: string,
  crewName: string,
  versionId: string | number,
  payload: SaveVersionPayload,
  baseURL?: string,
): Promise<PromptVersion> {
  const url = baseURL || getBaseURL();
  const response = await apiRequest<{ success: boolean; version: PromptVersion }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts/${versionId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    url
  );
  return response.version;
}

/**
 * Activate a specific prompt version
 */
export async function activatePromptVersion(
  agentName: string,
  crewName: string,
  versionId: string | number,
  baseURL?: string
): Promise<PromptVersion> {
  const url = baseURL || getBaseURL();
  const response = await apiRequest<{ success: boolean; version: PromptVersion }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts/${versionId}/activate`,
    { method: 'POST' },
    url
  );
  return response.version;
}

/**
 * Revert to code default (deactivate all DB versions)
 */
export async function revertToCode(
  agentName: string,
  crewName: string,
  baseURL?: string
): Promise<void> {
  const url = baseURL || getBaseURL();
  await apiRequest<{ success: boolean }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts/revert-to-code`,
    { method: 'POST' },
    url
  );
}

/**
 * Delete a prompt version
 */
export async function deletePromptVersion(
  agentName: string,
  crewName: string,
  versionId: string | number,
  baseURL?: string
): Promise<void> {
  const url = baseURL || getBaseURL();
  await apiRequest<{ success: boolean }>(
    `/api/agents/${encodeURIComponent(agentName)}/crew/${encodeURIComponent(crewName)}/prompts/${versionId}`,
    { method: 'DELETE' },
    url
  );
}
