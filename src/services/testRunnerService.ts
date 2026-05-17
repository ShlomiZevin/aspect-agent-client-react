/**
 * Test Runner Service
 *
 * API calls for automated agent testing — individual generation, conversation simulation, review.
 */

import { apiRequest, getBaseURL } from './api';
import type {
  TestRun,
  CreateTestRunData,
  TestRunFilters,
  TestRunConfig,
  UpdateTestConfigData,
  IndividualProfile,
  StartConversationResponse,
  AdvanceTurnResponse,
  SyntheticUserUpsertResponse,
} from '../types/testRunner';

export async function getTestRuns(
  filters: TestRunFilters = {},
  baseURL?: string
): Promise<TestRun[]> {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.agentName) params.append('agentName', filters.agentName);
  if (filters.status) params.append('status', filters.status);

  const queryString = params.toString();
  const endpoint = `/api/admin/test-runs${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{ runs: TestRun[] }>(endpoint, { method: 'GET' }, baseURL || getBaseURL());
  return response.runs;
}

export async function getTestRun(id: number, baseURL?: string): Promise<TestRun> {
  return apiRequest<TestRun>(`/api/admin/test-runs/${id}`, { method: 'GET' }, baseURL || getBaseURL());
}

export async function createTestRun(data: CreateTestRunData, baseURL?: string): Promise<TestRun> {
  return apiRequest<TestRun>('/api/admin/test-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, baseURL || getBaseURL());
}

export async function executeTestRun(id: number, baseURL?: string): Promise<TestRun> {
  return apiRequest<TestRun>(`/api/admin/test-runs/${id}/execute`, {
    method: 'POST',
  }, baseURL || getBaseURL());
}

export async function deleteTestRun(id: number, baseURL?: string): Promise<void> {
  await apiRequest(`/api/admin/test-runs/${id}`, { method: 'DELETE' }, baseURL || getBaseURL());
}

export async function getTestRunConfig(agentName: string, baseURL?: string): Promise<TestRunConfig> {
  return apiRequest<TestRunConfig>(
    `/api/admin/test-runs/config/${encodeURIComponent(agentName)}`,
    { method: 'GET' },
    baseURL || getBaseURL()
  );
}

export async function updateTestRunInput(id: number, inputUpdates: Record<string, unknown>, baseURL?: string): Promise<TestRun> {
  return apiRequest<TestRun>(`/api/admin/test-runs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputUpdates),
  }, baseURL || getBaseURL());
}

export async function saveTestRunOutput(id: number, output: unknown, baseURL?: string): Promise<TestRun> {
  return apiRequest<TestRun>(`/api/admin/test-runs/${id}/save-output`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ output }),
  }, baseURL || getBaseURL());
}

export async function updateTestRunConfig(
  agentName: string,
  data: UpdateTestConfigData,
  baseURL?: string
): Promise<TestRunConfig> {
  return apiRequest<TestRunConfig>(
    `/api/admin/test-runs/config/${encodeURIComponent(agentName)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
    baseURL || getBaseURL()
  );
}

// ============================================================
// Step 3: Conversation simulator (Phase 0)
// ============================================================

/** Upsert a synthetic user from a persona. Idempotent. */
export async function upsertSyntheticUser(
  persona: IndividualProfile,
  populationRunId?: number | null,
  baseURL?: string
): Promise<SyntheticUserUpsertResponse> {
  return apiRequest<SyntheticUserUpsertResponse>(
    `/api/admin/test-runner/synthetic-users/upsert`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, populationRunId: populationRunId || null }),
    },
    baseURL || getBaseURL()
  );
}

/** Start a fresh synthetic conversation. Returns a URL to open in the chat UI. */
export async function startSyntheticConversation(
  opts: {
    agentName: string;
    persona: IndividualProfile;
    populationRunId?: number | null;
    maxTurns?: number;
    model?: string;
  },
  baseURL?: string
): Promise<StartConversationResponse> {
  return apiRequest<StartConversationResponse>(
    `/api/admin/test-runner/conversations/start`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    },
    baseURL || getBaseURL()
  );
}

/** Advance ONE turn of a synthetic conversation (the cockpit's Next-turn button). */
export async function advanceConversationTurn(
  testRunId: number,
  baseURL?: string
): Promise<AdvanceTurnResponse> {
  return apiRequest<AdvanceTurnResponse>(
    `/api/admin/test-runs/${testRunId}/turn`,
    { method: 'POST' },
    baseURL || getBaseURL()
  );
}

/** Kick off a server-side loop driving the conversation to termination. Returns immediately (202). */
export async function runConversationToCompletion(
  testRunId: number,
  baseURL?: string
): Promise<{ runId: number; status: string; message: string; alreadyTerminal?: boolean }> {
  return apiRequest(
    `/api/admin/test-runs/${testRunId}/run-to-completion`,
    { method: 'POST' },
    baseURL || getBaseURL()
  );
}

/** Cooperative cancellation — the loop checks the flag between turns. */
export async function cancelConversationRun(
  testRunId: number,
  baseURL?: string
): Promise<TestRun> {
  return apiRequest<TestRun>(
    `/api/admin/test-runs/${testRunId}/cancel`,
    { method: 'POST' },
    baseURL || getBaseURL()
  );
}

/** Generate next synthetic user message in isolation (for debugging persona prompt). */
export async function previewSyntheticUserMessage(
  opts: { persona: IndividualProfile; transcript: Array<{ role: string; content: string }>; agentName: string },
  baseURL?: string
): Promise<{ message: string; end: boolean; reason?: string }> {
  return apiRequest(
    `/api/admin/test-runner/synthetic-user/next-message`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    },
    baseURL || getBaseURL()
  );
}
