/**
 * IndexSettingsModal — the demoted Pinecone infra panel.
 *
 * Index/connection management (list · create · activate · delete) used
 * to be a whole "Settings" tab. It's low-level and rarely touched, so
 * in the V2 KB workbench it lives behind the ⚙ gear instead. Reuses the
 * existing pineconeService calls.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  listPineconeIndexes,
  createPineconeIndex,
  deletePineconeIndex,
  activatePineconeIndex,
  type ConnectionStatus,
  type PineconeIndex,
} from '../../../services/pineconeService';
import { useConfirm } from '../Confirm/Confirm';
import styles from './KBWorkbench.module.css';

interface Props {
  status: ConnectionStatus;
  onClose: () => void;
  onChanged: () => void;
}

export function IndexSettingsModal({ status, onClose, onChanged }: Props) {
  const confirm = useConfirm();
  const [indexes, setIndexes] = useState<PineconeIndex[]>([]);
  const [active, setActive] = useState<string | null>(status.indexName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await listPineconeIndexes();
      setIndexes(r.indexes);
      setActive(r.activeIndex ?? status.indexName);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, [status.indexName]);

  useEffect(() => { load(); }, [load]);

  const handleActivate = async (name: string) => {
    setError(null);
    try { await activatePineconeIndex(name); setActive(name); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleDelete = async (name: string) => {
    const ok = await confirm({
      title: `Delete index "${name}"?`,
      message: 'This permanently deletes the index and every knowledge base (namespace) inside it. This cannot be undone.',
      confirmLabel: 'Delete index',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try { await deletePineconeIndex(name); load(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const handleCreate = async () => {
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!name) return;
    setCreating(true); setError(null);
    try { await createPineconeIndex(name, 1536, 'cosine'); setNewName(''); load(); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setCreating(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>Pinecone indexes</span>
          <button type="button" className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <p className={styles.modalHint}>
          An index is the underlying vector store. You normally need just one;
          knowledge bases live inside it as namespaces.
        </p>

        {error && <div className={styles.error}>{error}</div>}
        {loading && <div className={styles.muted}>Loading…</div>}

        <div className={styles.idxList}>
          {indexes.map(idx => (
            <div key={idx.name} className={styles.idxRow}>
              <div className={styles.idxMain}>
                <span className={styles.idxName}>{idx.name}</span>
                {idx.name === active && <span className={styles.idxActive}>active</span>}
                <span className={styles.idxMeta}>{idx.dimension}d · {idx.metric} · {idx.cloud}/{idx.region} · {idx.status}</span>
              </div>
              <div className={styles.idxActions}>
                {idx.name !== active && (
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => handleActivate(idx.name)}>Use</button>
                )}
                <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => handleDelete(idx.name)}>Delete</button>
              </div>
            </div>
          ))}
          {!loading && indexes.length === 0 && <div className={styles.muted}>No indexes yet.</div>}
        </div>

        <div className={styles.newRow} style={{ marginTop: 12 }}>
          <input
            className={styles.newInput}
            value={newName}
            placeholder="new-index-name (1536 · cosine)"
            onChange={e => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
          />
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={handleCreate} disabled={creating || !newName.trim()}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
