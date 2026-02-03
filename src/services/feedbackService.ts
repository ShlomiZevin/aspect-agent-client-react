/**
 * Feedback Service
 *
 * Handles feedback/comments on assistant messages and tag management.
 */

import type { FeedbackMessage, FeedbackTag, FeedbackStats } from '../types/feedback';

// ─── API Helpers ─────────────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  baseURL: string
): Promise<T> {
  const url = `${baseURL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// ─── Chat Screen Functions ───────────────────────────────────────────

/**
 * Get all tags for an agent (for initial autocomplete cache)
 */
export async function getAllTags(
  agentName: string,
  baseURL: string
): Promise<FeedbackTag[]> {
  const data = await apiRequest<{ tags: FeedbackTag[] }>(
    `/api/agents/${encodeURIComponent(agentName)}/feedback/tags`,
    { method: 'GET' },
    baseURL
  );
  return data.tags;
}

/**
 * Search tags by prefix (autocomplete after 3 chars)
 */
export async function searchTags(
  agentName: string,
  query: string,
  baseURL: string
): Promise<FeedbackTag[]> {
  const data = await apiRequest<{ tags: FeedbackTag[] }>(
    `/api/agents/${encodeURIComponent(agentName)}/feedback/tags/search?q=${encodeURIComponent(query)}`,
    { method: 'GET' },
    baseURL
  );
  return data.tags;
}

/**
 * Get feedback for a specific message
 */
export async function getFeedbackForMessage(
  messageDbId: number,
  baseURL: string
): Promise<{ id: number; feedbackText: string; tags: FeedbackTag[] } | null> {
  const data = await apiRequest<{ feedback: { id: number; feedbackText: string; tags: FeedbackTag[] } | null }>(
    `/api/messages/${messageDbId}/feedback`,
    { method: 'GET' },
    baseURL
  );
  return data.feedback;
}

/**
 * Create or update feedback on a message
 */
export async function createFeedback(
  messageDbId: number,
  feedbackText: string,
  tags: FeedbackTag[],
  baseURL: string,
  existingFeedbackId?: number
): Promise<void> {
  if (existingFeedbackId) {
    // Update existing
    await apiRequest(
      `/api/feedback/${existingFeedbackId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ feedbackText, tags }),
      },
      baseURL
    );
  } else {
    // Create new
    await apiRequest(
      `/api/messages/${messageDbId}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify({ feedbackText, tags }),
      },
      baseURL
    );
  }
}

/**
 * Delete feedback from database
 */
export async function deleteFeedback(
  feedbackId: number,
  baseURL: string
): Promise<void> {
  await apiRequest(
    `/api/feedback/${feedbackId}`,
    { method: 'DELETE' },
    baseURL
  );
}

// ─── Dashboard Functions ─────────────────────────────────────────────

/**
 * Get all feedback messages for an agent (dashboard)
 */
export async function getFeedbackMessages(
  agentName: string,
  baseURL: string
): Promise<FeedbackMessage[]> {
  const data = await apiRequest<{ feedback: FeedbackMessage[] }>(
    `/api/agents/${encodeURIComponent(agentName)}/feedback`,
    { method: 'GET' },
    baseURL
  );

  // Transform dates from strings to Date objects
  return data.feedback.map(fb => ({
    ...fb,
    createdAt: new Date(fb.createdAt),
  }));
}

/**
 * Get feedback stats/aggregations for an agent (dashboard)
 */
export async function getFeedbackStats(
  agentName: string,
  baseURL: string
): Promise<FeedbackStats> {
  const data = await apiRequest<{ stats: FeedbackStats }>(
    `/api/agents/${encodeURIComponent(agentName)}/feedback/stats`,
    { method: 'GET' },
    baseURL
  );
  return data.stats;
}
