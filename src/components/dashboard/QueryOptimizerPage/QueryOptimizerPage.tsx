import { useState, useEffect, useCallback } from 'react';
import styles from './QueryOptimizerPage.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
type QueryType = 'slow' | 'error' | 'timeout';

interface SlowQuery {
  id: number;
  agent_name: string;
  schema_name: string;
  question: string;
  sql: string;
  duration_ms: number;
  rows_returned: number | null;
  created_at: string;
  analyzed_at: string | null;
  dismissed_at: string | null;
  query_type: QueryType;
  error_message: string | null;
  recommendation: Recommendation | null;
}

interface Recommendation {
  issue: string;
  recommendation: string;
  sql: string;
  confidence: 'high' | 'medium' | 'low';
  estimatedImprovement: string;
}

interface OptimizationJob {
  id: number;
  slow_query_id: number;
  agent_name: string;
  schema_name: string;
  job_type: string;
  description: string;
  sql: string;
  status: JobStatus;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getQueryStatus(q: SlowQuery, jobs: OptimizationJob[]): 'new' | 'analyzed' | 'optimized' | 'dismissed' {
  if (q.dismissed_at) return 'dismissed';
  if (jobs.some(j => j.slow_query_id === q.id && j.status !== 'failed')) return 'optimized';
  if (q.analyzed_at && q.recommendation) return 'analyzed';
  return 'new';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatJobDuration(job: OptimizationJob): string {
  if (!job.started_at) return '—';
  const end = job.completed_at ? new Date(job.completed_at) : new Date();
  const start = new Date(job.started_at);
  const secs = Math.round((end.getTime() - start.getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_LABELS = {
  new:       { label: '⚪ New',       className: styles.statusNew },
  analyzed:  { label: '🔍 Analyzed',  className: styles.statusAnalyzed },
  optimized: { label: '✅ Optimized', className: styles.statusOptimized },
  dismissed: { label: '🚫 Dismissed', className: styles.statusDismissed },
};

const QUERY_TYPE_LABELS: Record<QueryType, { label: string; className: string }> = {
  slow:    { label: '🐢 Slow',    className: styles.typeSlow },
  error:   { label: '🔴 Error',   className: styles.typeError },
  timeout: { label: '⏱️ Timeout', className: styles.typeTimeout },
};

const JOB_STATUS_LABELS: Record<JobStatus, { label: string; className: string }> = {
  pending:   { label: '⏳ Pending',   className: styles.jobPending },
  running:   { label: '🟡 Running',   className: styles.jobRunning },
  completed: { label: '✅ Completed', className: styles.jobCompleted },
  failed:    { label: '❌ Failed',    className: styles.jobFailed },
};

// ─── SqlPreview ────────────────────────────────────────────────────────────────

function SqlPreview({ sql }: { sql: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = sql.trim().split('\n');
  const preview = lines.slice(0, 2).join('\n');
  return (
    <div className={styles.sqlPreview}>
      <pre className={styles.sqlCode}>{expanded ? sql.trim() : preview + (lines.length > 2 ? '\n...' : '')}</pre>
      {lines.length > 2 && (
        <button className={styles.expandBtn} onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show all (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

// ─── AnalysisPanel ─────────────────────────────────────────────────────────────

function AnalysisPanel({
  query,
  baseURL,
  onAnalyzed,
  onExecute,
}: {
  query: SlowQuery;
  baseURL: string;
  onAnalyzed: (id: number, rec: Recommendation) => void;
  onExecute: (q: SlowQuery) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = query.recommendation;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${baseURL}/api/admin/slow-queries/${query.id}/analyze`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');
      onAnalyzed(query.id, data.recommendation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const confidenceClass = rec
    ? rec.confidence === 'high' ? styles.confHigh
    : rec.confidence === 'medium' ? styles.confMedium
    : styles.confLow
    : '';

  return (
    <div className={styles.analysisPanel}>
      <div className={styles.analysisPanelHeader}>
        <div className={styles.analysisPanelTitle}>Analysis — Query #{query.id}</div>
        <div className={styles.analysisPanelMeta}>
          Duration: <strong>{formatDuration(query.duration_ms)}</strong> &nbsp;|&nbsp;
          Schema: <strong>{query.schema_name}</strong>
        </div>
      </div>

      <div className={styles.analysisPanelQuestion}>
        <span className={styles.questionLabel}>Question</span>
        <span className={styles.questionText}>{query.question || '(direct SQL)'}</span>
      </div>

      <div className={styles.analysisPanelSql}>
        <span className={styles.sectionLabel}>SQL</span>
        <SqlPreview sql={query.sql} />
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {!rec && (
        <button className={styles.analyzeBtn} onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? '⏳ Running EXPLAIN...' : '🔍 Run EXPLAIN & Analyze'}
        </button>
      )}

      {rec && (
        <div className={styles.recommendationBox}>
          <div className={styles.recHeader}>
            <span className={styles.recTitle}>Recommendation</span>
            <span className={`${styles.confBadge} ${confidenceClass}`}>
              {rec.confidence} confidence
            </span>
          </div>
          <div className={styles.recIssue}><strong>Issue:</strong> {rec.issue}</div>
          <div className={styles.recText}><strong>Fix:</strong> {rec.recommendation}</div>
          <div className={styles.recImprovement}><strong>Expected improvement:</strong> {rec.estimatedImprovement}</div>
          <div className={styles.recSqlLabel}>Suggested SQL:</div>
          <pre className={styles.recSql}>{rec.sql}</pre>
          <button className={styles.executeBtn} onClick={() => onExecute(query)}>
            ⚡ Execute Optimization
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

interface QueryOptimizerPageProps {
  agentName: string;
  baseURL: string;
}

type TypeFilter = 'all' | QueryType;

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'slow',    label: '🐢 Slow' },
  { value: 'error',   label: '🔴 Error' },
  { value: 'timeout', label: '⏱️ Timeout' },
];

export function QueryOptimizerPage({ agentName: _agentName, baseURL }: QueryOptimizerPageProps) {
  const [queries, setQueries] = useState<SlowQuery[]>([]);
  const [jobs, setJobs] = useState<OptimizationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<SlowQuery | null>(null);
  const [expandedSql, setExpandedSql] = useState<number | null>(null);
  const [executing, setExecuting] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sqRes, jobRes] = await Promise.all([
        fetch(`${baseURL}/api/admin/slow-queries`),
        fetch(`${baseURL}/api/admin/optimization-jobs`),
      ]);
      const sqData = await sqRes.json();
      const jobData = await jobRes.json();
      setQueries(sqData.slowQueries || []);
      setJobs(jobData.jobs || []);
    } catch (err) {
      console.error('Failed to load query optimizer data:', err);
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDismiss = async (id: number) => {
    await fetch(`${baseURL}/api/admin/slow-queries/${id}/dismiss`, { method: 'POST' });
    setQueries(prev => prev.map(q => q.id === id ? { ...q, dismissed_at: new Date().toISOString() } : q));
    if (selectedQuery?.id === id) setSelectedQuery(null);
  };

  const handleAnalyzed = (id: number, rec: Recommendation) => {
    setQueries(prev => prev.map(q =>
      q.id === id ? { ...q, recommendation: rec, analyzed_at: new Date().toISOString() } : q
    ));
    setSelectedQuery(prev => prev?.id === id ? { ...prev, recommendation: rec, analyzed_at: new Date().toISOString() } : prev);
  };

  const handleExecute = async (query: SlowQuery) => {
    if (!query.recommendation) return;
    setExecuting(query.id);
    try {
      const res = await fetch(`${baseURL}/api/admin/optimization-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slowQueryId: query.id,
          agentName: query.agent_name,
          schemaName: query.schema_name,
          jobType: 'create_index',
          description: query.recommendation.recommendation,
          sql: query.recommendation.sql,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create job');
      setJobs(prev => [data.job, ...prev]);
      setSelectedQuery(null);
    } catch (err) {
      console.error('Execute failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setExecuting(null);
    }
  };

  const activeQueries = queries.filter(q => !q.dismissed_at);
  const filteredQueries = typeFilter === 'all'
    ? activeQueries
    : activeQueries.filter(q => (q.query_type ?? 'slow') === typeFilter);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Query Optimizer</h1>
          <p className={styles.pageSubtitle}>
            Monitor slow queries and create indexes to improve performance
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* ── Slow Queries ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={styles.sectionTitle}>
                Slow Queries
                <span className={styles.badge}>{filteredQueries.length}</span>
              </h2>
              <p className={styles.sectionHint}>Slow, failed, and timed-out queries</p>
            </div>
            <div className={styles.filterTabs}>
              {TYPE_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.filterTab} ${typeFilter === opt.value ? styles.filterTabActive : ''}`}
                  onClick={() => setTypeFilter(opt.value)}
                >
                  {opt.label}
                  {opt.value !== 'all' && (
                    <span className={styles.filterCount}>
                      {activeQueries.filter(q => (q.query_type ?? 'slow') === opt.value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Agent</th>
                <th>Question</th>
                <th>Duration</th>
                <th>SQL</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className={styles.emptyCell}>Loading...</td></tr>
              )}
              {!loading && filteredQueries.map(q => {
                const status = getQueryStatus(q, jobs);
                const typeInfo = QUERY_TYPE_LABELS[q.query_type ?? 'slow'];
                const isErrorEntry = q.query_type === 'error' || q.query_type === 'timeout';
                return (
                  <>
                    <tr
                      key={q.id}
                      className={`${styles.queryRow} ${isErrorEntry ? styles.queryRowError : ''} ${selectedQuery?.id === q.id ? styles.queryRowSelected : ''}`}
                      onClick={() => setSelectedQuery(prev => prev?.id === q.id ? null : q)}
                    >
                      <td className={styles.cellMuted}>{formatTime(q.created_at)}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${typeInfo.className}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td><span className={styles.agentBadge}>{q.agent_name}</span></td>
                      <td className={styles.questionCell} dir="rtl">
                        {q.question || '—'}
                        {isErrorEntry && q.error_message && (
                          <div className={styles.errorInline} title={q.error_message}>
                            {q.error_message.length > 60 ? q.error_message.slice(0, 60) + '…' : q.error_message}
                          </div>
                        )}
                      </td>
                      <td><span className={styles.durationBadge}>{formatDuration(q.duration_ms)}</span></td>
                      <td>
                        <button
                          className={styles.sqlToggleBtn}
                          onClick={e => { e.stopPropagation(); setExpandedSql(prev => prev === q.id ? null : q.id); }}
                        >
                          {expandedSql === q.id ? 'Hide SQL' : 'View SQL'}
                        </button>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${STATUS_LABELS[status].className}`}>
                          {STATUS_LABELS[status].label}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className={styles.actionBtns}>
                          {!isErrorEntry && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => setSelectedQuery(prev => prev?.id === q.id ? null : q)}
                            >
                              {selectedQuery?.id === q.id ? 'Close' : 'Analyze'}
                            </button>
                          )}
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnGhost}`}
                            onClick={() => handleDismiss(q.id)}
                          >
                            Dismiss
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedSql === q.id && (
                      <tr key={`sql-${q.id}`}>
                        <td colSpan={8} className={styles.sqlExpandedCell}>
                          {isErrorEntry && q.error_message && (
                            <div className={styles.sqlExpandedError}>{q.error_message}</div>
                          )}
                          <pre className={styles.sqlExpanded}>{q.sql || '(no SQL generated)'}</pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {!loading && filteredQueries.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.emptyCell}>
                    {typeFilter === 'all'
                      ? 'No slow queries detected. Queries slower than 5s will appear here automatically.'
                      : `No ${typeFilter} queries.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Analysis Panel ── */}
      {selectedQuery && (
        <section className={styles.section}>
          <AnalysisPanel
            key={selectedQuery.id}
            query={selectedQuery}
            baseURL={baseURL}
            onAnalyzed={handleAnalyzed}
            onExecute={executing === selectedQuery.id ? () => {} : handleExecute}
          />
          {executing === selectedQuery.id && (
            <div className={styles.executingMsg}>⚙️ Creating optimization job...</div>
          )}
        </section>
      )}

      {/* ── Optimization Jobs ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Optimization Jobs
            <span className={styles.badge}>{jobs.length}</span>
          </h2>
          <p className={styles.sectionHint}>Index creation and optimization tasks</p>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} className={styles.jobRow}>
                  <td className={styles.cellMuted}>#{job.id}</td>
                  <td><span className={styles.jobTypeBadge}>{job.job_type}</span></td>
                  <td className={styles.jobDescription}>{job.description}</td>
                  <td>
                    <span className={`${styles.jobStatusBadge} ${JOB_STATUS_LABELS[job.status].className}`}>
                      {JOB_STATUS_LABELS[job.status].label}
                    </span>
                    {job.status === 'failed' && job.error_message && (
                      <div className={styles.jobErrorMessage} title={job.error_message}>
                        {job.error_message}
                      </div>
                    )}
                  </td>
                  <td className={styles.cellMuted}>{job.started_at ? formatTime(job.started_at) : '—'}</td>
                  <td className={styles.cellMuted}>{formatJobDuration(job)}</td>
                </tr>
              ))}
              {!loading && jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No optimization jobs yet. Analyze a slow query and click Execute to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
