/**
 * ConversationsTab — admin view of ALL conversations for the agent,
 * wired to the V2 runtime (not the legacy V1 conversation store).
 *
 * Left: every conversation for the agent (owner-agnostic, via the new
 * `/api/agents/:slug/admin/conversations` endpoint). Right: the
 * selected conversation's messages, each assistant message expandable
 * into its persisted addon trail (`/messages/:id/runs`) — the same
 * data the in-builder chat renders live.
 *
 * Read-only: this is an inspection surface. Deletion/rename live in the
 * builder chat, not here.
 *
 * Two kinds of conversation land here and are told apart everywhere
 * (task #887): the outside chat ("External", green) and the builder's
 * own test chat ("Builder", indigo). They share ONE list by default; the
 * filter above it narrows to only one kind in a single click. Each row
 * carries its colour stripe and tag, so the kind is visible in "All" too.
 *
 * The opened conversation has an Export button — the same export window
 * the builder chat uses (task #882).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listAdminConversations,
  fetchConversationMessages,
  fetchRunsForMessage,
  type AdminConversationListItem,
  type ConversationMessage,
  type PersistedAddonRun,
} from '../../state/builderApi';
import { formatDuration } from '../../formatDuration';
import { ExportConversationModal } from '../ChatPanel/ExportConversationModal';
import styles from './ConversationsTab.module.css';

interface Props {
  agentSlug: string;
  /** When set, list only this owner's conversations (Users drill-down). */
  userId?: number;
  /** When set, render a "← Back to users" link above the list. */
  backHref?: string;
}

type SourceFilter = 'all' | 'live' | 'builder';
const FILTER_KEY = 'builder:adminConvSource';
const SOURCE_LABEL = { live: 'External', builder: 'Builder' } as const;

function loadFilter(): SourceFilter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return v === 'live' || v === 'builder' ? v : 'all';
  } catch {
    return 'all';
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ConversationsTab({ agentSlug, userId, backHref }: Props) {
  const [convs, setConvs] = useState<AdminConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilterState] = useState<SourceFilter>(loadFilter);
  const [exportOpen, setExportOpen] = useState(false);
  const setFilter = (f: SourceFilter) => {
    setFilterState(f);
    try { localStorage.setItem(FILTER_KEY, f); } catch { /* private mode */ }
  };

  const loadConvs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listAdminConversations({ agentSlug, userId });
      setConvs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [agentSlug, userId]);

  useEffect(() => { loadConvs(); }, [loadConvs]);
  // Reset selection when the scope changes (e.g. navigating between users).
  useEffect(() => { setSelectedId(null); }, [userId]);

  const counts = {
    all: convs.length,
    live: convs.filter(c => c.source === 'live').length,
    builder: convs.filter(c => c.source === 'builder').length,
  };
  const shown = filter === 'all' ? convs : convs.filter(c => c.source === filter);
  const selected = convs.find(c => c.id === selectedId) ?? null;

  return (
    <div className={styles.wrap}>
      <aside className={styles.list}>
        {backHref && (
          <Link to={backHref} className={styles.backToUsers}>← Back to users</Link>
        )}
        <div className={styles.listHead}>
          <span className={styles.listTitle}>
            {userId ? 'User conversations' : 'Conversations'}
          </span>
          <button type="button" className={styles.refresh} onClick={loadConvs} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
        </div>
        {/* One list by default; one click narrows it to a single kind. */}
        <div className={styles.filter} role="tablist" aria-label="Which conversations to show">
          {(['all', 'live', 'builder'] as const).map(f => (
            <button key={f} type="button" role="tab" aria-selected={filter === f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterOn : ''}`}
              onClick={() => setFilter(f)}
              title={f === 'all' ? 'Every conversation, both kinds'
                : f === 'live' ? 'Only conversations from the outside chat'
                  : "Only conversations from the builder's own test chat"}>
              {f !== 'all' && <span className={`${styles.srcDot} ${styles[`src_${f}`]}`} aria-hidden />}
              {f === 'all' ? 'All' : SOURCE_LABEL[f]}
              <span className={styles.filterCount}>{counts[f]}</span>
            </button>
          ))}
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {!loading && shown.length === 0 && !error && (
          <div className={styles.empty}>
            {convs.length === 0 ? 'No conversations yet for this agent.'
              : `No ${filter === 'live' ? 'external' : 'builder'} conversations.`}
          </div>
        )}
        <div className={styles.listScroll}>
          {shown.map(c => (
            <button
              key={c.id}
              type="button"
              className={`${styles.row} ${c.source ? styles[`row_${c.source}`] : ''} ${c.id === selectedId ? styles.rowActive : ''}`}
              onClick={() => setSelectedId(c.id)}
            >
              <div className={styles.rowName}>{c.name || `Conversation #${c.id}`}</div>
              <div className={styles.rowMeta}>
                <span className={styles.rowOwner}>{c.ownerName || c.ownerUserId || 'unknown'}</span>
                <span className={styles.dot}>·</span>
                <span>{c.messageCount} msg</span>
              </div>
              <div className={styles.rowFoot}>
                <span className={styles.rowTime}>{fmtDate(c.updatedAt)}</span>
                {c.source && <span className={`${styles.srcTag} ${styles[`tag_${c.source}`]}`}>{SOURCE_LABEL[c.source]}</span>}
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.detail}>
        {selectedId == null ? (
          <div className={styles.detailEmpty}>Pick a conversation to inspect its messages and addon trail.</div>
        ) : (
          <>
            <div className={styles.detailHead}>
              <span className={styles.detailTitle}>{selected?.name || `Conversation #${selectedId}`}</span>
              {selected?.source && <span className={`${styles.srcTag} ${styles[`tag_${selected.source}`]}`}>{SOURCE_LABEL[selected.source]}</span>}
              <span className={styles.detailSpacer} />
              <button type="button" className={styles.exportBtn} onClick={() => setExportOpen(true)}
                title="Download or copy this conversation as JSON — to hand to an AI for analysis">
                ⤓ Export
              </button>
            </div>
            <ConversationDetail agentSlug={agentSlug} conversationId={selectedId} />
          </>
        )}
      </section>
      <ExportConversationModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        agentSlug={agentSlug}
        conversationId={selectedId}
      />
    </div>
  );
}

function ConversationDetail({ agentSlug, conversationId }: { agentSlug: string; conversationId: number }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchConversationMessages({ agentSlug, conversationId })
      .then(msgs => { if (!cancelled) setMessages(msgs); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentSlug, conversationId]);

  if (loading) return <div className={styles.detailEmpty}>Loading messages…</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (messages.length === 0) return <div className={styles.detailEmpty}>No messages in this conversation.</div>;

  return (
    <div className={styles.thread}>
      {messages.map(m => (
        <MessageRow key={m.id} agentSlug={agentSlug} message={m} />
      ))}
    </div>
  );
}

function MessageRow({ agentSlug, message }: { agentSlug: string; message: ConversationMessage }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<PersistedAddonRun[] | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const isAssistant = message.role === 'assistant';

  const toggleRuns = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && runs == null && !loadingRuns) {
      setLoadingRuns(true);
      try {
        const r = await fetchRunsForMessage({ agentSlug, messageId: message.id });
        setRuns(r);
      } catch {
        setRuns([]);
      } finally {
        setLoadingRuns(false);
      }
    }
  }, [open, runs, loadingRuns, agentSlug, message.id]);

  return (
    <div className={`${styles.msg} ${styles[`msg_${message.role}`] || ''}`}>
      <div className={styles.msgHead}>
        <span className={styles.role}>{message.role}</span>
        <span className={styles.msgTime}>{fmtDate(message.createdAt)}</span>
        {isAssistant && (
          <button type="button" className={styles.trailBtn} onClick={toggleRuns}>
            {open ? '▾ addon trail' : '▸ addon trail'}
          </button>
        )}
      </div>
      <div className={styles.msgBody}>{message.content || <em className={styles.muted}>(empty)</em>}</div>

      {isAssistant && open && (
        <div className={styles.runs}>
          {loadingRuns && <div className={styles.muted}>Loading addon trail…</div>}
          {!loadingRuns && runs && runs.length === 0 && (
            <div className={styles.muted}>No addon runs recorded for this message.</div>
          )}
          {!loadingRuns && runs && runs.map(r => (
            <div key={r.id} className={styles.run}>
              <div className={styles.runHead}>
                <span className={`${styles.runStatus} ${styles[`status_${r.status}`] || ''}`}>{r.status}</span>
                <span className={styles.runPlugin}>{r.pluginId}</span>
                {r.runData?.label && <span className={styles.runLabel}>{r.runData.label}</span>}
                {r.durationMs != null && <span className={styles.runDur}>{formatDuration(r.durationMs)}</span>}
                {r.runData?.modelLabel && (
                  <span className={styles.runModel}>
                    {r.runData.modelLabel.providerName} · {r.runData.modelLabel.modelName}
                  </span>
                )}
              </div>
              {r.runData?.memoryWrites && r.runData.memoryWrites.length > 0 && (
                <div className={styles.runWrites}>
                  {r.runData.memoryWrites.map((w, i) => (
                    <span key={i} className={styles.write}>
                      {w.field}=<strong>{JSON.stringify(w.value)}</strong>
                    </span>
                  ))}
                </div>
              )}
              {r.runData?.rawOutput && (
                <pre className={styles.runRaw}>{r.runData.rawOutput}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
