/**
 * Profiler Service
 *
 * API calls for profiler configuration management (debug mode)
 */

import { apiRequest, getBaseURL } from './api';

export interface ProfilerConfig {
  prompt: string | null;
  model: string;
  provider: string | null;
  maxTokens: number;
  confidenceThreshold: number;
}

export interface ProfilerConfigResponse {
  agentName: string;
  hasProfiler: boolean;
  hasOverrides: boolean;
  config: ProfilerConfig | null;
  codeDefault: {
    prompt: string | null;
    model: string;
    provider: string | null;
  } | null;
}

/**
 * Get profiler config for an agent
 */
export async function getProfilerConfig(
  agentName: string,
  baseURL?: string
): Promise<ProfilerConfigResponse> {
  const url = baseURL || getBaseURL();
  return apiRequest<ProfilerConfigResponse>(
    `/api/agents/${encodeURIComponent(agentName)}/profiler/config`,
    { method: 'GET' },
    url
  );
}

/**
 * Update profiler config (runtime override)
 */
export async function updateProfilerConfig(
  agentName: string,
  updates: { prompt?: string; model?: string; provider?: string; confidenceThreshold?: number },
  baseURL?: string
): Promise<{ success: boolean; config: Partial<ProfilerConfig> }> {
  const url = baseURL || getBaseURL();
  return apiRequest<{ success: boolean; config: Partial<ProfilerConfig> }>(
    `/api/agents/${encodeURIComponent(agentName)}/profiler/config`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
    url
  );
}

/**
 * Reset profiler config to code default
 */
export async function resetProfilerConfig(
  agentName: string,
  baseURL?: string
): Promise<{ success: boolean }> {
  const url = baseURL || getBaseURL();
  return apiRequest<{ success: boolean }>(
    `/api/agents/${encodeURIComponent(agentName)}/profiler/config/reset`,
    { method: 'POST' },
    url
  );
}

/**
 * Ask the profiler a question about the current profile
 */
export async function askProfiler(
  agentName: string,
  conversationId: string,
  question: string,
  baseURL?: string
): Promise<{ answer: string }> {
  const url = baseURL || getBaseURL();
  return apiRequest<{ answer: string }>(
    `/api/agents/${encodeURIComponent(agentName)}/profiler/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, question }),
    },
    url
  );
}

/**
 * Clear profile data for a conversation's user (start fresh)
 */
export async function clearProfileData(
  conversationId: string,
  baseURL?: string
): Promise<{ success: boolean }> {
  const url = baseURL || getBaseURL();
  return apiRequest<{ success: boolean }>(
    `/api/conversation/${encodeURIComponent(conversationId)}/context/profile_data`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'user' }),
    },
    url
  );
}
