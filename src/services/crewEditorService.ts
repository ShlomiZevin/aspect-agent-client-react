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
  CrewVersionInfo,
  ProjectFileInfo
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
 * Server will validate, backup NEW source to GCS, write to disk,
 * hot-reload, and set the backup as default.
 *
 * @param agentName - Agent name
 * @param crewName - Crew member name
 * @param source - New source code to apply
 * @param baseURL - API base URL
 * @param name - Optional version name
 * @returns Success status, optional error, and backup version
 */
export async function applyCrewSource(
  agentName: string,
  crewName: string,
  source: string,
  baseURL: string,
  name?: string
): Promise<CrewApplyResponse> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/apply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, ...(name ? { name } : {}) })
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
 * Returns versions array and project file info.
 */
export async function listVersions(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<{ versions: CrewVersionInfo[]; projectFile: ProjectFileInfo | null }> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to list versions: ${response.statusText}`);
  }

  const data = await response.json();
  return { versions: data.versions, projectFile: data.projectFile || null };
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
 * Get the default version marker for a crew member.
 */
export async function getDefaultVersion(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<{ timestamp: string; setAt: string } | null> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/default`
  );

  if (!response.ok) return null;

  const data = await response.json();
  return data.default || null;
}

/**
 * Set a version as the default (known-good) version.
 */
export async function setDefaultVersion(
  agentName: string,
  crewName: string,
  timestamp: string,
  baseURL: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/${encodeURIComponent(timestamp)}/set-default`,
    { method: 'POST' }
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to set default: ${response.statusText}`);
  }

  return response.json();
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

/**
 * Unset the default version — reverts to project file.
 */
export async function unsetDefaultVersion(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/default`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to unset default: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the backed-up project file source from GCS.
 */
export async function getProjectFileSource(
  agentName: string,
  crewName: string,
  baseURL: string
): Promise<string> {
  const response = await fetch(
    `${baseURL}/api/admin/crew/${encodeURIComponent(agentName)}/${encodeURIComponent(crewName)}/versions/project`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || `Failed to get project file: ${response.statusText}`);
  }

  const data = await response.json();
  return data.source;
}
