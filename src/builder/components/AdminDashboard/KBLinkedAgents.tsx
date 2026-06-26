/**
 * LinkedAgents — manage which agents a KB (Pinecone namespace) is linked
 * to. KB↔agent is a visibility many-to-many: a KB shows in an agent's
 * builder only when a link exists. This row lets the user link/unlink the
 * current agent and any other agent, so a shared KB can serve several.
 */

import { useCallback, useEffect, useState } from 'react';
import { getKbAgents, linkKb, unlinkKb, type LinkedAgent } from '../../../services/pineconeService';
import { listProjects, type ProjectListItem } from '../../state/builderApi';
import styles from './KBWorkbench.module.css';

/** Same convention as the Canvas/Chat views — owner id lives in localStorage. */
function findOwnerUserId(): string {
  try { return localStorage.getItem('builder:ownerUserId') || 'anon'; } catch { return 'anon'; }
}

export function LinkedAgents({ namespace, currentAgentId, onChanged }: {
  namespace: string; currentAgentId: string; onChanged: () => void;
}) {
  const ownerUserId = findOwnerUserId();
  const [linked, setLinked] = useState<LinkedAgent[]>([]);
  const [allAgents, setAllAgents] = useState<ProjectListItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setLinked(await getKbAgents(namespace)); } catch { setLinked([]); }
  }, [namespace]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { listProjects({ ownerUserId }).then(setAllAgents).catch(() => setAllAgents([])); }, [ownerUserId]);

  const linkedIds = new Set(linked.map(a => a.agentId));
  const currentLinked = linkedIds.has(currentAgentId);
  const unlinkedAgents = allAgents.filter(a => !linkedIds.has(a.agentId));

  const doLink = async (agentId: string) => {
    setBusy(true);
    try { await linkKb(agentId, namespace); await load(); onChanged(); }
    finally { setBusy(false); setAdding(false); }
  };
  const doUnlink = async (agentId: string) => {
    setBusy(true);
    try { await unlinkKb(agentId, namespace); await load(); onChanged(); }
    finally { setBusy(false); }
  };

  return (
    <div className={styles.linkedRow}>
      <span className={styles.linkedLabel}>Linked agents</span>
      <div className={styles.linkedChips}>
        {linked.length === 0 && <span className={styles.linkedEmpty}>Not linked to any agent.</span>}
        {linked.map(a => (
          <span key={a.agentId}
            className={`${styles.linkedChip} ${a.agentId === currentAgentId ? styles.linkedChipCurrent : ''}`}>
            {a.name}{a.agentId === currentAgentId ? ' · this' : ''}
            <button type="button" className={styles.linkedX} title="Unlink" disabled={busy}
              onClick={() => doUnlink(a.agentId)}>×</button>
          </span>
        ))}
        {!currentLinked && (
          <button type="button" className={styles.linkBtn} disabled={busy} onClick={() => doLink(currentAgentId)}>
            + Link this agent
          </button>
        )}
        {adding ? (
          <select className={styles.linkSelect} disabled={busy} defaultValue=""
            onChange={e => { if (e.target.value) doLink(e.target.value); }}>
            <option value="" disabled>Pick an agent…</option>
            {unlinkedAgents.map(a => <option key={a.agentId} value={a.agentId}>{a.agentName}</option>)}
          </select>
        ) : (
          unlinkedAgents.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={() => setAdding(true)}>+ Link another</button>
          )
        )}
      </div>
    </div>
  );
}
