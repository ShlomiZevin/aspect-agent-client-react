/** HQ — Library. Everything HQ holds, newest first. */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconCheck, IconDecision, IconSearch } from '../icons';
import { listAtoms } from '../services/hqApi';
import type { Atom } from '../types';
import styles from './LibraryScreen.module.css';

const FILTERS = [
  { key: '',        label: 'Everything' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'doc',     label: 'Docs' },
  { key: 'note',    label: 'Notes' },
];

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('');
}

function AtomCard({ atom, onOpen }: { atom: Atom; onOpen: () => void }) {
  const isMeeting = atom.kind === 'meeting';
  const people = atom.participants || [];

  return (
    <button className={styles.card} onClick={onOpen}>
      <div className={styles.cardTop}>
        <span className={`${styles.kindChip} ${!isMeeting ? styles.kindChipMuted : ''}`}>
          {atom.kind}
        </span>
        <span className={styles.cardDate}>{formatDate(atom.occurred_at || atom.ingested_at)}</span>
      </div>

      <div className={styles.cardTitle} dir="auto">{atom.title}</div>

      {atom.summary && <div className={styles.cardSummary} dir="auto">{atom.summary}</div>}

      <div className={styles.cardFoot}>
        {atom.scribe_status === 'running' && (
          <span className={styles.pending}>
            <span className="hqDots"><i /><i /><i /></span>
            summarising
          </span>
        )}
        {atom.scribe_status === 'failed' && <span className={styles.failed}>summary failed</span>}

        {atom.decisions?.length > 0 && (
          <span className={`${styles.stat} ${styles.statHot}`}>
            <IconDecision /> {atom.decisions.length} decision{atom.decisions.length === 1 ? '' : 's'}
          </span>
        )}
        {atom.actions?.length > 0 && (
          <span className={styles.stat}>
            <IconCheck /> {atom.actions.length} action{atom.actions.length === 1 ? '' : 's'}
          </span>
        )}
        {atom.status === 'failed' && <span className={styles.failed}>not indexed</span>}

        {people.length > 0 && (
          <span className={styles.people}>
            {people.slice(0, 4).map((p, i) => (
              <span key={i} className={styles.person} title={p}>{initials(p)}</span>
            ))}
          </span>
        )}
      </div>
    </button>
  );
}

export function LibraryScreen() {
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Debounced so typing doesn't fire a request per keystroke.
    const timer = setTimeout(() => {
      listAtoms({ kind: kind || undefined, search: search || undefined, limit: 200 })
        .then(result => { if (!cancelled) setAtoms(result); })
        .catch(() => { if (!cancelled) setAtoms([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, search ? 320 : 0);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [kind, search]);

  // Anything still summarising means the Scribe is mid-flight — poll until
  // it settles so cards fill in without a manual refresh.
  const hasRunning = useMemo(
    () => atoms.some(a => a.scribe_status === 'running'),
    [atoms],
  );

  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => {
      listAtoms({ kind: kind || undefined, search: search || undefined, limit: 200 })
        .then(setAtoms)
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [hasRunning, kind, search]);

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headInner}>
          <span className={`hqEyebrow ${styles.eyebrow}`}>Everything we know</span>
          <h1 className={styles.title}>Library</h1>
          <div className={styles.controls}>
            <div className={styles.searchWrap}>
              <IconSearch />
              <input
                className={styles.search}
                value={search}
                dir="auto"
                placeholder="Search titles and content…"
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.filters}>
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  className={`hqGhostPill ${kind === f.key ? styles.filterActive : ''}`}
                  onClick={() => setKind(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.list}>
          {loading && atoms.length === 0 && <div className={styles.loading}>Loading…</div>}

          {!loading && atoms.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyMark}>
                <img src="/img/lybi-spiral.png" alt="" />
              </div>
              <div className={styles.emptyTitle}>
                {search || kind ? 'Nothing matches that' : 'HQ is empty'}
              </div>
              <div className={styles.emptyHint}>
                {search || kind
                  ? 'Try a different search or filter.'
                  : 'Head to Drop and paste your Notion meetings database.'}
              </div>
            </div>
          )}

          {atoms.map(atom => (
            <AtomCard key={atom.id} atom={atom} onOpen={() => navigate(String(atom.id))} />
          ))}
        </div>
      </div>
    </div>
  );
}
