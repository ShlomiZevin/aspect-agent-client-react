import { apiRequest, getBaseURL } from './api';
import type { PlaygroundConfig, DesignMessage, SavedPlaygroundConfig } from '../types/playground';

// ========== Design Mode ==========

export async function designChat(
  messages: DesignMessage[],
  currentConfig: PlaygroundConfig | null,
  mode: 'discuss' | 'generate',
  baseURL?: string
): Promise<{ response: string; updatedConfig?: PlaygroundConfig }> {
  return apiRequest('/api/playground/design', {
    method: 'POST',
    body: JSON.stringify({ messages, currentConfig, mode }),
  }, baseURL || getBaseURL());
}

// ========== Crew Registration ==========

export async function registerPlayground(
  sessionId: string,
  agentName: string,
  config: PlaygroundConfig,
  baseURL?: string
): Promise<{ crewName: string; agentName: string }> {
  return apiRequest('/api/playground/register', {
    method: 'POST',
    body: JSON.stringify({ sessionId, agentName, config }),
  }, baseURL || getBaseURL());
}

export async function removePlayground(
  sessionId: string,
  baseURL?: string
): Promise<{ success: boolean }> {
  return apiRequest(`/api/playground/${sessionId}`, {
    method: 'DELETE',
  }, baseURL || getBaseURL());
}

// ========== Save / Load / Delete (GCS) ==========

export async function saveConfig(
  agentName: string,
  name: string,
  config: PlaygroundConfig,
  baseURL?: string
): Promise<{ id: string; name: string; savedAt: string }> {
  return apiRequest('/api/playground/save', {
    method: 'POST',
    body: JSON.stringify({ agentName, name, config }),
  }, baseURL || getBaseURL());
}

export async function listSavedConfigs(
  agentName: string,
  baseURL?: string
): Promise<{ configs: SavedPlaygroundConfig[] }> {
  return apiRequest(`/api/playground/configs/${encodeURIComponent(agentName)}`, {
    method: 'GET',
  }, baseURL || getBaseURL());
}

export async function loadSavedConfig(
  agentName: string,
  id: string,
  baseURL?: string
): Promise<{ name: string; config: PlaygroundConfig; savedAt: string }> {
  return apiRequest(`/api/playground/configs/${encodeURIComponent(agentName)}/${id}`, {
    method: 'GET',
  }, baseURL || getBaseURL());
}

export async function deleteSavedConfig(
  agentName: string,
  id: string,
  baseURL?: string
): Promise<{ success: boolean }> {
  return apiRequest(`/api/playground/configs/${encodeURIComponent(agentName)}/${id}`, {
    method: 'DELETE',
  }, baseURL || getBaseURL());
}

// ========== Export ==========

export async function exportToCrewFile(
  config: PlaygroundConfig,
  baseURL?: string
): Promise<{ source: string }> {
  return apiRequest('/api/playground/export', {
    method: 'POST',
    body: JSON.stringify({ config }),
  }, baseURL || getBaseURL());
}
