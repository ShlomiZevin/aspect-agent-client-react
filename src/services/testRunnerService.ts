/**
 * Test Runner Service
 *
 * API calls for automated agent testing — individual generation, conversation simulation, review.
 */

import { apiRequest, getBaseURL } from './api';
import type { TestRun, CreateTestRunData, TestRunFilters, TestRunConfig } from '../types/testRunner';

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
