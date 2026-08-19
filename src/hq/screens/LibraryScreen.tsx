/**
 * HQ — Knowledge. Everything HQ has read, newest first.
 *
 * Every card has to answer three questions without anyone asking: what is this,
 * where did it come from, and what can HQ do with it. A title and a date can't
 * do that, so each entry says its own kind in words, names its origin, and
 * states plainly when there's no summary yet.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { IconCheck, IconDecision, IconSearch, IconTrash } from '../icons';
import { listAtoms, resetHQ } from '../services/hqApi';
import type { Atom } from '../types';
import { sourceOf } from '../sourceOf';
import styles from './LibraryScreen.module.css';

const FILTERS = [
  { key: '',        label: 'Everything' },
  { key: 'meeting', label: 'Meetings' },
  { key: 'doc',     label: 'Documents' },
  { key: 'note',    label: 'Notes' },
];

/** What each kind actually is, in the words someone would use out loud. */
const KIND: Record<string, { label: string; what: string }> = {
  meeting:    { label: 'Meeting',    what: 'Notes or a transcript from a call' },
  doc:        { label: 'Document',   what: 'A page or document' },
  note:       { label: 'Note',       what: 'Something typed straight into HQ' },
  transcript: { label: 'Transcript', what: 'A word-for-word recording' },
  page:       { label: 'Page',       what: 'A page from a connected app' },
  decision:   { label: 'Decision',   what: 'A decision recorded on its own' },
};

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('');
}

function AtomCard({ atom, onOpen }: { atom: Atom; onOpen: () => void }) {
  const kind = KIND[atom.kind] || { label: atom.kind, what: '' };
  const source = sourceOf(atom);
  const people = atom.participants || [];
  const isMeeting = atom.kind === 'meeting';

  return (
    <button className={styles.card} onClick={onOpen}>
      <div className={styles.cardTop}>
        <span className={`${styles.kindChip} ${!isMeeting ? styles.kindChipMuted : ''}`} title={kind.what}>
          {kind.label}
        </span>
        <span className={styles.cardOrigin} title={atom.source_label || source.name}>
          <span aria-hidden="true">{source.icon}</span> {source.name}
        </span>
        <span className={styles.cardDate}>{formatDate(atom.occurred_at || atom.ingested_at)}</span>
      </div>

      <div className={styles.cardTitle} dir="auto">{atom.title}</div>

      {atom.summary ? (
        <div className={styles.cardSummary} dir="auto">{atom.summary}</div>
      ) : atom.scribe_status === 'running' ? (
        <div className={styles.cardSummaryMuted}>
          <span className="hqDots"><i /><i /><i /></span>
          Writing a summary of this…
        </div>
      ) : (
        <div className={styles.cardSummaryMuted}>
          No summary written — HQ can still search every word of it.
        </div>
      )}

      <div className={styles.cardFoot}>
        {atom.scribe_status === 'failed' && (
          <span className={styles.failed}>the summary didn't work</span>
        )}
        {atom.status === 'failed' && <span className={styles.failed}>HQ couldn't read this</span>}

        {atom.decisions?.length > 0 && (
          <span className={`${styles.stat} ${styles.statHot}`}>
            <IconDecision /> {atom.decisions.length} decision{atom.decisions.length === 1 ? '' : 's'}
          </span>
        )}
        {atom.actions?.length > 0 && (
          <span className={styles.stat}>
            <IconCheck /> {atom.actions.length} thing{atom.actions.length === 1 ? '' : 's'} to do
          </span>
        )}

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
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [reloadKey, setReloadKey] = useState(0);

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
  }, [kind, search, reloadKey]);

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

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      await resetHQ();
      setConfirmReset(false);
      setReloadKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't clear HQ");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headInner}>
          <span className={`hqEyebrow ${styles.eyebrow}`}>Everything HQ has read</span>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Knowledge</h1>
            {atoms.length > 0 && (
              <button className={styles.resetBtn} onClick={() => setConfirmReset(true)}>
                <IconTrash />
                Erase everything
              </button>
            )}
          </div>
          <p className={styles.subtitle}>
            Each entry is one thing HQ read and can answer from — a meeting, a document, a note.
            Open one to see its summary, decisions and who was there.
          </p>
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
          {error && <div className={styles.errorBox}>{error}</div>}

          {loading && atoms.length === 0 && <div className={styles.loading}>Loading…</div>}

          {!loading && atoms.length === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyMark}>
                <img src="/img/lybi-spiral.png" alt="" />
              </div>
              <div className={styles.emptyTitle}>
                {search || kind ? 'Nothing matches that' : 'HQ hasn’t read anything yet'}
              </div>
              <div className={styles.emptyHint}>
                {search || kind
                  ? 'Try a different search or filter.'
                  : 'Go to Integrations to pick pages from Notion, or Add to paste something straight in.'}
              </div>
            </div>
          )}

          {atoms.map(atom => (
            <AtomCard key={atom.id} atom={atom} onOpen={() => navigate(String(atom.id))} />
          ))}

        </div>
      </div>

      {confirmReset && (
        <div className={styles.modalWrap} onClick={() => !resetting && setConfirmReset(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalMark}><IconTrash /></div>
            <div className={styles.modalTitle}>Erase everything HQ knows?</div>
            <p className={styles.modalBody}>
              All <b>{atoms.length}</b> entries are deleted and HQ will answer nothing until you
              bring things back in. This can't be undone.
            </p>
            <ul className={styles.modalList}>
              <li>Nothing is deleted in Notion, Drive or anywhere else</li>
              <li>The search index is wiped clean too — no leftovers</li>
              <li>Your page list stays, so bringing things back is a few clicks</li>
            </ul>
            <div className={styles.modalActions}>
              <button className="hqMini" onClick={() => setConfirmReset(false)} disabled={resetting}>
                Cancel
              </button>
              <button className={styles.confirmDanger} onClick={handleReset} disabled={resetting}>
                {resetting ? 'Erasing…' : `Erase all ${atoms.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
