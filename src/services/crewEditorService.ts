/**
 * Crew Editor Service
 *
 * API calls for the AI-assisted crew member file editor.
 * Enables super users to view, edit, and apply changes to
 * file-based crew member source code.
 */

import type {
  CrewEditorMessage,
  CrewSourceResponse,
  CrewChatResponse,
  CrewApplyResponse,
  CrewVersionInfo
} from '../types/crew';

/**
 * Read the source code of a crew member file.
 *
 * @param agentName - Agent name
 * @param crewName - Crew member name
 * @param baseURL - API base URL
 * @returns Source code, file path, and last modified timestamp
 */
export async function getCrewSource(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<CrewSourceResponse> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/source`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to read crew source: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Chat with Claude AI about editing a crew member file.
 *
 * @param agentName - Agent name
 * @param crewName - Crew member name
 * @param messages - Conversation history
 * @param currentSource - Current crew file source code
 * @param baseURL - API base URL
 * @returns Claude's response and optionally an updated source file
 */
export async function chatWithClaude(
  agentName: string,
  crewName: string,
  messages: CrewEditorMessage[],
  currentSource: string,
  baseURL: string
): Promise<CrewChatResponse> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, currentSource })
    }
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Chat failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Apply new source code to a crew member file.
 * Server will validate, backup to GCS, write to disk, and hot-reload.
 *
 * @param agentName - Agent name
 * @param crewName - Crew member name
 * @param source - New source code to apply
 * @param baseURL - API base URL
 * @returns Success status, optional error, and backup version
 */
export async function applyCrewSource(
  agentName: string,
  crewName: string,
  source: string,
  baseURL: string
): Promise<CrewApplyResponse> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/apply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    }
  );

  const data: CrewApplyResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Apply failed: ${response.statusText}`);
  }

  return data;
}

/**
 * List backed-up versions for a crew member.
 */
export async function listVersions(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<CrewVersionInfo[]> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to list versions: ${response.statusText}`);
  }

  const data = await response.json();
  return data.versions;
}

/**
 * Get the source code of a specific backed-up version.
 */
export async function getVersionSource(
  agentName: string,
  crewName: string,
  timestamp: string,
  baseURL: string
): Promise<string> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/${encodeURIComponent(timestamp)}`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to get version: ${response.statusText}`);
  }

  const data = await response.json();
  return data.source;
}

/**
 * Restore a backed-up version (validate + backup current + write + hot-reload).
 */
export async function restoreVersion(
  agentName: string,
  crewName: string,
  timestamp: string,
  baseURL: string
): Promise<CrewApplyResponse> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/${encodeURIComponent(timestamp)}/restore`,
    { method: 'POST' }
  );

  const data: CrewApplyResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Restore failed: ${response.statusText}`);
  }

  return data;
}

/**
 * Delete a backed-up version from GCS.
 */
export async function deleteVersion(
  agentName: string,
  crewName: string,
  timestamp: string,
  baseURL: string
): Promise<void> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/${encodeURIComponent(timestamp)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Delete failed: ${response.statusText}`);
  }
}
