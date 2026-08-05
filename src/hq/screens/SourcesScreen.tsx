/**
 * HQ — Sources.
 *
 * Connector health. Boring, and it's what keeps HQ trustworthy: if a sync
 * silently stopped, an answer built on a stale archive still reads confident.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconRefresh, IconTrash } from '../icons';
import { deleteSource, listSources, resyncSource } from '../services/hqApi';
import type { Source } from '../types';
import styles from './SourcesScreen.module.css';

interface Props { onChanged?: () => void }

const ICONS: Record<string, string> = {
  notion: '🗂', upload: '📎', url: '🔗', text: '✎', drive: '📁', meet: '🎥',
};

function relativeTime(value: string | null): string {
  if (!value) return 'never';
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SourcesScreen({ onChanged }: Props) {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    listSources()
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function handleResync(source: Source) {
    setBusyId(source.id);
    try {
      await resyncSource(source.id);
      load();
      onChanged?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Re-sync failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleForget(source: Source) {
    if (!window.confirm(
      `Forget "${source.label}"? The pages already imported stay in HQ — only the connection is removed.`
    )) return;

    await deleteSource(source.id);
    load();
    onChanged?.();
  }

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <span className={`hqEyebrow ${styles.eyebrow}`}>Where it comes from</span>
        <h1 className={styles.title}>Sources</h1>
        <p className={styles.subtitle}>
          Where HQ's knowledge comes from, and whether it's still current.
        </p>

        {loading && <div className={styles.loading}>Loading…</div>}

        {!loading && sources.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyMark}><img src="/img/lybi-spiral.png" alt="" /></div>
            <div className={styles.emptyTitle}>Nothing connected yet</div>
            <div className={styles.emptyHint}>Drop a Notion link and it'll show up here.</div>
          </div>
        )}

        <div className={styles.list}>
          {sources.map(source => {
            const dotClass =
              source.last_status === 'ok'      ? styles.dotOk   :
              source.last_status === 'failed'  ? styles.dotErr  :
              source.last_status === 'syncing' ? styles.dotSync : styles.dotWarn;

            return (
              <div key={source.id} className={styles.card}>
                <span className={styles.icon}>{ICONS[source.kind] || '◇'}</span>

                <div className={styles.body}>
                  <div className={styles.name} dir="auto">{source.label}</div>
                  <div className={styles.meta}>
                    <span className={styles.status}>
                      <span className={`${styles.dot} ${dotClass}`} />
                      {source.last_status}
                    </span>
                    <span>· {source.atom_count} item{source.atom_count === 1 ? '' : 's'}</span>
                    <span>· synced {relativeTime(source.last_sync_at)}</span>
                    {source.config?.notionType && <span>· Notion {source.config.notionType}</span>}
                  </div>
                  {source.last_error && <div className={styles.errorText}>{source.last_error}</div>}
                </div>

                <div className={styles.controls}>
                  {source.kind === 'notion' && (
                    <button
                      className="hqMini"
                      onClick={() => handleResync(source)}
                      disabled={busyId === source.id}
                    >
                      <IconRefresh /> {busyId === source.id ? 'Syncing…' : 'Re-sync'}
                    </button>
                  )}
                  <button className="hqMini" onClick={() => navigate('../library')}>View</button>
                  <button
                    className="hqMini hqMiniDanger"
                    onClick={() => handleForget(source)}
                    disabled={busyId === source.id}
                  >
                    <IconTrash /> Forget
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
