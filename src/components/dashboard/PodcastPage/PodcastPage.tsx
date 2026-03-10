import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './PodcastPage.module.css';
import {
  uploadEpisode,
  listEpisodes,
  getEpisode,
  deleteEpisode,
  startTranscription,
  summarizeEpisode,
  getDefaultSummaryPrompt,
  type PodcastEpisode,
  type TranscriptProvider,
  type SummaryProvider,
} from '../../../services/podcastService';

interface Props {
  baseURL?: string;
}

const SUMMARY_MODELS: Record<SummaryProvider, { label: string; models: string[] }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  },
  google: {
    label: 'Google (Gemini)',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
  },
};

const STATUS_COLORS: Record<string, string> = {
  none:      '#9ca3af',
  pending:   '#f59e0b',
  running:   '#3b82f6',
  completed: '#10b981',
  failed:    '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  none:      'Not started',
  pending:   'Queued...',
  running:   'Processing...',
  completed: 'Completed',
  failed:    'Failed',
};

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'pending' || status === 'running';
  return (
    <span
      className={`${styles.statusBadge} ${isActive ? styles.statusBadgePulse : ''}`}
      style={{ background: STATUS_COLORS[status] ?? '#9ca3af' }}
    >
      {isActive && <span className={styles.spinner} />}
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Episode card (expanded view)
// ─────────────────────────────────────────────────────────────────────────────

interface EpisodeCardProps {
  episode: PodcastEpisode;
  baseURL?: string;
  defaultPrompt: string;
  onRefresh: (id: number) => void;
  onDelete: (id: number) => void;
}

function EpisodeCard({ episode, baseURL, defaultPrompt, onRefresh, onDelete }: EpisodeCardProps) {
  const [expanded, setExpanded]               = useState(false);
  const [transcriptProvider, setTranscriptProvider] = useState<TranscriptProvider>('openai');
  const [summaryProvider, setSummaryProvider] = useState<SummaryProvider>('anthropic');
  const [summaryModel, setSummaryModel]       = useState('claude-opus-4-6');
  const [summaryPrompt, setSummaryPrompt]     = useState(defaultPrompt);
  const [summaryLoading, setSummaryLoading]   = useState(false);
  const [viewMode, setViewMode]               = useState<'transcript' | 'summary' | null>(null);
  const [deleting, setDeleting]               = useState(false);

  const ep = episode;
  const isTranscribing = ep.transcript_status === 'pending' || ep.transcript_status === 'running';
  const isSummarizing  = summaryLoading;

  // When provider changes, reset model to first option
  const handleProviderChange = (p: SummaryProvider) => {
    setSummaryProvider(p);
    setSummaryModel(SUMMARY_MODELS[p].models[0]);
  };

  const handleTranscribe = async () => {
    try {
      await startTranscription(ep.id, transcriptProvider, baseURL);
      onRefresh(ep.id);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSummarize = async () => {
    setSummaryLoading(true);
    try {
      const updated = await summarizeEpisode(ep.id, {
        provider: summaryProvider,
        model: summaryModel,
        prompt: summaryPrompt,
      }, baseURL);
      onRefresh(updated.id);
    } catch (err: any) {
      alert('Summarization error: ' + err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete episode "${ep.title}"?`)) return;
    setDeleting(true);
    try {
      await deleteEpisode(ep.id, baseURL);
      onDelete(ep.id);
    } catch (err: any) {
      alert('Delete error: ' + err.message);
      setDeleting(false);
    }
  };

  return (
    <div className={styles.episodeCard}>
      {/* Header */}
      <div className={styles.episodeHeader} onClick={() => setExpanded(x => !x)}>
        <div className={styles.episodeMeta}>
          <span className={styles.episodeIcon}>🎙️</span>
          <div>
            <div className={styles.episodeTitle}>{ep.title}</div>
            <div className={styles.episodeSubtitle}>
              {ep.audio_file_name && <span>{ep.audio_file_name}</span>}
              {ep.audio_file_size && <span> · {formatBytes(ep.audio_file_size)}</span>}
              <span> · {new Date(ep.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className={styles.episodeStatuses}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Transcript</span>
            <StatusBadge status={ep.transcript_status} />
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Summary</span>
            <StatusBadge status={ep.summary_status} />
          </div>
          <button
            className={styles.chevron}
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            aria-label="Toggle"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className={styles.episodeBody}>

          {/* ── Transcription section ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Transcription</h3>

            <div className={styles.controls}>
              <label className={styles.controlLabel}>Provider</label>
              <select
                className={styles.select}
                value={transcriptProvider}
                onChange={e => setTranscriptProvider(e.target.value as TranscriptProvider)}
                disabled={isTranscribing}
              >
                <option value="openai">OpenAI Whisper</option>
                <option value="google">Google Gemini</option>
              </select>

              <button
                className={styles.btnPrimary}
                onClick={handleTranscribe}
                disabled={isTranscribing}
              >
                {isTranscribing ? 'Transcribing...' : ep.transcript_status === 'completed' ? 'Re-transcribe' : 'Transcribe'}
              </button>
            </div>

            {ep.transcript_status === 'failed' && ep.transcript_error && (
              <div className={styles.errorBox}>Error: {ep.transcript_error}</div>
            )}

            {ep.transcript_status === 'running' && (
              <div className={styles.infoBox}>
                Transcription is running in the background. This page updates automatically every 5 seconds.
              </div>
            )}

            {ep.transcript_text && (
              <div className={styles.viewSection}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setViewMode(viewMode === 'transcript' ? null : 'transcript')}
                >
                  {viewMode === 'transcript' ? 'Hide Transcript' : 'View Transcript'}
                </button>
                {viewMode === 'transcript' && (
                  <pre className={styles.textView}>{ep.transcript_text}</pre>
                )}
              </div>
            )}
          </section>

          {/* ── Summary section ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Summary</h3>

            {!ep.transcript_text && (
              <p className={styles.hintText}>Complete transcription first to enable summarization.</p>
            )}

            {ep.transcript_text && (
              <>
                <div className={styles.controls}>
                  <label className={styles.controlLabel}>Provider</label>
                  <select
                    className={styles.select}
                    value={summaryProvider}
                    onChange={e => handleProviderChange(e.target.value as SummaryProvider)}
                    disabled={isSummarizing}
                  >
                    {(Object.keys(SUMMARY_MODELS) as SummaryProvider[]).map(p => (
                      <option key={p} value={p}>{SUMMARY_MODELS[p].label}</option>
                    ))}
                  </select>

                  <label className={styles.controlLabel}>Model</label>
                  <select
                    className={styles.select}
                    value={summaryModel}
                    onChange={e => setSummaryModel(e.target.value)}
                    disabled={isSummarizing}
                  >
                    {SUMMARY_MODELS[summaryProvider].models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>

                  <button
                    className={styles.btnPrimary}
                    onClick={handleSummarize}
                    disabled={isSummarizing}
                  >
                    {isSummarizing ? 'Summarizing...' : ep.summary_status === 'completed' ? 'Re-summarize' : 'Summarize'}
                  </button>
                </div>

                <div className={styles.promptSection}>
                  <label className={styles.controlLabel}>Prompt</label>
                  <textarea
                    className={styles.promptTextarea}
                    value={summaryPrompt}
                    onChange={e => setSummaryPrompt(e.target.value)}
                    disabled={isSummarizing}
                    rows={8}
                  />
                </div>
              </>
            )}

            {ep.summary_status === 'failed' && ep.summary_error && (
              <div className={styles.errorBox}>Error: {ep.summary_error}</div>
            )}

            {ep.summary_text && (
              <div className={styles.viewSection}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setViewMode(viewMode === 'summary' ? null : 'summary')}
                >
                  {viewMode === 'summary' ? 'Hide Summary' : 'View Summary'}
                </button>
                {ep.summary_provider && (
                  <span className={styles.modelTag}>{ep.summary_provider} / {ep.summary_model}</span>
                )}
                {viewMode === 'summary' && (
                  <pre className={styles.textView}>{ep.summary_text}</pre>
                )}
              </div>
            )}
          </section>

          {/* ── Delete ── */}
          <div className={styles.dangerZone}>
            <button
              className={styles.btnDanger}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Episode'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function PodcastPage({ baseURL }: Props) {
  const [episodes, setEpisodes]           = useState<PodcastEpisode[]>([]);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [error, setError]                 = useState<string | null>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const pollingRef                        = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ids of episodes currently transcribing (need polling)
  const activeIds = episodes
    .filter(e => e.transcript_status === 'pending' || e.transcript_status === 'running')
    .map(e => e.id);

  const loadEpisodes = useCallback(async () => {
    try {
      const eps = await listEpisodes(baseURL);
      setEpisodes(eps);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  const refreshEpisode = useCallback(async (id: number) => {
    try {
      const updated = await getEpisode(id, baseURL);
      setEpisodes(prev => prev.map(e => e.id === id ? updated : e));
    } catch { /* ignore */ }
  }, [baseURL]);

  // Initial load
  useEffect(() => {
    loadEpisodes();
    getDefaultSummaryPrompt(baseURL).then(setDefaultPrompt).catch(() => {});
  }, [loadEpisodes, baseURL]);

  // Polling for active transcriptions
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (activeIds.length > 0) {
      pollingRef.current = setInterval(async () => {
        await Promise.all(activeIds.map(id => refreshEpisode(id)));
      }, 5000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeIds.join(','), refreshEpisode]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const title = prompt('Episode title:', file.name.replace(/\.[^.]+$/, '')) || file.name;

    setUploading(true);
    setUploadProgress(`Uploading 0%`);

    try {
      const episode = await uploadEpisode(file, title, baseURL, (pct) => {
        setUploadProgress(`Uploading ${pct}%`);
      });
      setEpisodes(prev => [episode, ...prev]);
      setUploadProgress('');
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteEpisode = (id: number) => {
    setEpisodes(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Podcast Episodes</h1>
          <p className={styles.subtitle}>
            Upload audio episodes, transcribe with AI, and generate structured summaries.
          </p>
        </div>

        <div className={styles.headerActions}>
          {activeIds.length > 0 && (
            <span className={styles.pollingIndicator}>
              <span className={styles.spinner} />
              {activeIds.length} transcription{activeIds.length > 1 ? 's' : ''} in progress
            </span>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.mp4"
            className={styles.fileInput}
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <button
            className={styles.btnPrimary}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? uploadProgress || 'Uploading...' : '+ Upload Episode'}
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>Loading episodes...</div>
      ) : episodes.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎙️</div>
          <p>No episodes yet. Upload an audio file to get started.</p>
        </div>
      ) : (
        <div className={styles.episodeList}>
          {episodes.map(ep => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              baseURL={baseURL}
              defaultPrompt={defaultPrompt}
              onRefresh={refreshEpisode}
              onDelete={handleDeleteEpisode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
