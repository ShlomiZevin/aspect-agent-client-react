import { apiRequest } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TranscriptStatus = 'none' | 'pending' | 'running' | 'completed' | 'failed';
export type SummaryStatus    = 'none' | 'pending' | 'running' | 'completed' | 'failed';
export type TranscriptProvider = 'openai' | 'google';
export type SummaryProvider    = 'openai' | 'google' | 'anthropic';

export interface PodcastEpisode {
  id: number;
  title: string;

  audio_file_name: string | null;
  audio_file_url:  string | null;
  audio_file_size: number | null;
  audio_mime_type: string | null;

  transcript_status:   TranscriptStatus;
  transcript_provider: TranscriptProvider | null;
  transcript_url:      string | null;
  transcript_text:     string | null;
  transcript_error:    string | null;
  transcribed_at:      string | null;

  summary_status:   SummaryStatus;
  summary_provider: SummaryProvider | null;
  summary_model:    string | null;
  summary_prompt:   string | null;
  summary_url:      string | null;
  summary_text:     string | null;
  summary_error:    string | null;
  summarized_at:    string | null;

  created_at: string;
  updated_at: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function uploadEpisode(
  file: File,
  title: string,
  baseURL?: string
): Promise<PodcastEpisode> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);

  const base = baseURL ?? '';
  const response = await fetch(`${base}/api/podcast/episodes`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'Upload failed');
  }

  const data = await response.json();
  return data.episode as PodcastEpisode;
}

export async function listEpisodes(baseURL?: string): Promise<PodcastEpisode[]> {
  const data = await apiRequest<{ episodes: PodcastEpisode[] }>(
    '/api/podcast/episodes',
    { method: 'GET' },
    baseURL
  );
  return data.episodes;
}

export async function getEpisode(id: number, baseURL?: string): Promise<PodcastEpisode> {
  const data = await apiRequest<{ episode: PodcastEpisode }>(
    `/api/podcast/episodes/${id}`,
    { method: 'GET' },
    baseURL
  );
  return data.episode;
}

export async function deleteEpisode(id: number, baseURL?: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/api/podcast/episodes/${id}`,
    { method: 'DELETE' },
    baseURL
  );
}

export async function startTranscription(
  id: number,
  provider: TranscriptProvider,
  baseURL?: string
): Promise<{ status: string }> {
  return apiRequest<{ status: string }>(
    `/api/podcast/episodes/${id}/transcribe`,
    {
      method: 'POST',
      body: JSON.stringify({ provider }),
    },
    baseURL
  );
}

export async function summarizeEpisode(
  id: number,
  options: { provider: SummaryProvider; model: string; prompt: string },
  baseURL?: string
): Promise<PodcastEpisode> {
  const data = await apiRequest<{ episode: PodcastEpisode }>(
    `/api/podcast/episodes/${id}/summarize`,
    {
      method: 'POST',
      body: JSON.stringify(options),
    },
    baseURL
  );
  return data.episode;
}

export async function getDefaultSummaryPrompt(baseURL?: string): Promise<string> {
  const data = await apiRequest<{ prompt: string }>(
    '/api/podcast/default-summary-prompt',
    { method: 'GET' },
    baseURL
  );
  return data.prompt;
}
