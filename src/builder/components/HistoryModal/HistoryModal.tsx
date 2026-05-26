/**
 * HistoryModal — the agent change log.
 *
 * One card per logical change. An Alfred Apply that touched multiple
 * bodies in one operation lands as multiple log rows sharing an
 * `applyGroupId` — the modal groups those into a single card so the
 * user sees "this Apply changed agent + Welcome crew" as one entry,
 * not three separate rows.
 *
 * Body snapshots (body_before / body_after) live on the server but
 * are NOT shown here — the log is for "what & why", not for raw JSON
 * diffs. If we ever need an audit view we can layer it on top.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { listAgentLog, type AgentLogEntry } from '../../state/builderApi';
import styles from './HistoryModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  /** Used to surface "you" instead of an opaque random suffix when the
   *  log row's appliedBy matches the current browser owner. */
  currentOwnerUserId: string;
}

interface LogGroup {
  /** Stable key for React. */
  key: string;
  /** All rows in this card (same applyGroupId, or a single row when null). */
  rows: AgentLogEntry[];
}

function groupEntries(rows: AgentLogEntry[]): LogGroup[] {
  // Rows arrive newest-first. Group consecutive same-applyGroupId rows
  // into one card; null groups never collapse with each other.
  const out: LogGroup[] = [];
  for (const row of rows) {
    const last = out[out.length - 1];
    if (
      last &&
      row.applyGroupId &&
      last.rows[0].applyGroupId === row.applyGroupId
    ) {
      last.rows.push(row);
    } else {
      out.push({
        key: row.applyGroupId ? `g_${row.applyGroupId}` : `r_${row.id}`,
        rows: [row],
      });
    }
  }
  return out;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function shortenOwner(id: string, currentOwner: string): string {
  // Until we have real auth, every builder session generates a random
  // `builder-owner-XXXXXXXX-YYYYY` id stored in localStorage. Surfacing
  // it raw is useless — they're random bytes. Resolve to "you" when it
  // matches this browser; otherwise truncate so the row stays readable.
  if (id === currentOwner) return 'you';
  if (id.startsWith('builder-owner-')) {
    return id.slice('builder-owner-'.length).slice(0, 8);
  }
  return id.length > 12 ? id.slice(0, 12) + '…' : id;
}

export function HistoryModal({ open, onClose, agentId, agentName, currentOwnerUserId }: Props) {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<AgentLogEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErrorMsg(null);
    setEntries([]);
    let cancelled = false;
    (async () => {
      try {
        const rows = await listAgentLog(agentId);
        if (cancelled) return;
        setEntries(rows);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, agentId]);

  const groups = groupEntries(entries);

  const footer = (
    <button type="button" className={styles.btn} onClick={onClose}>Close</button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change history — ${agentName}`}
      badge={entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : undefined}
      width={680}
      footer={footer}
    >
      <p className={styles.intro}>
        Newest first. Alfred applies and manual "Validate &amp; Log" entries land in
        the same stream.
      </p>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading history…</span>
        </div>
      )}

      {!loading && errorMsg && (
        <div className={styles.errorChip}>{errorMsg}</div>
      )}

      {!loading && !errorMsg && entries.length === 0 && (
        <div className={styles.empty}>
          No log entries yet. Apply a change via Alfred or use the
          <strong> ✓ Log</strong> button next to Save to record a manual edit.
        </div>
      )}

      {!loading && !errorMsg && groups.length > 0 && (
        <div className={styles.list}>
          {groups.map(g => <Card key={g.key} group={g} currentOwnerUserId={currentOwnerUserId} />)}
        </div>
      )}
    </Modal>
  );
}

function Card({ group, currentOwnerUserId }: { group: LogGroup; currentOwnerUserId: string }) {
  const lead = group.rows[0];
  const isMulti = group.rows.length > 1;

  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span
          className={`${styles.actor} ${lead.actor === 'alfred' ? styles.actorAlfred : styles.actorManual}`}
        >
          {lead.actor === 'alfred' ? '✨ Alfred' : '👤 Manual'}
        </span>
        <span className={styles.timestamp} title={new Date(lead.appliedAt).toLocaleString()}>
          {relativeTime(lead.appliedAt)}
        </span>
        <span className={styles.appliedBy}>by {shortenOwner(lead.appliedBy, currentOwnerUserId)}</span>
      </header>

      {/* Which entities were touched. */}
      <div className={styles.entities}>
        {group.rows.map(r => (
          <span key={r.id} className={styles.entityChip}>
            <span className={styles.entityKind}>{r.entity}</span>
            {r.entityName || r.entityId}
          </span>
        ))}
      </div>

      {/* What changed. For multi-target Alfred applies, show the lead
       * row's whatChanged (which holds the consolidator's overall
       * description) AND each target's per-body what_to_do underneath. */}
      {!isMulti && lead.whatChanged && (
        <p className={styles.whatChanged}>{lead.whatChanged}</p>
      )}
      {isMulti && (
        <>
          {group.rows.map(r => (
            <div key={r.id} className={styles.targetSubblock}>
              <div className={styles.targetLabel}>
                {r.entity}: {r.entityName || r.entityId}
              </div>
              <p className={styles.whatChanged}>{r.whatChanged}</p>
            </div>
          ))}
        </>
      )}

      {lead.reason && (
        <p className={styles.reason}>
          <span className={styles.reasonLabel}>Why:</span>
          {lead.reason}
        </p>
      )}
    </article>
  );
}
