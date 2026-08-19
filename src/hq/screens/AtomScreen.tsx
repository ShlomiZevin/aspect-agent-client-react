/**
 * HQ — one atom (usually a meeting).
 *
 * Summary, decisions, actions, open questions, and the full transcript
 * underneath. Everything the Scribe produced is editable in place — it will
 * miss an owner or mangle a decision sometimes, and if you can't fix it you
 * stop trusting it within a week (LYBI_HQ.md §2b).
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { IconBack, IconDecision, IconEdit, IconExternal, IconRefresh, IconTrash } from '../icons';
import { deleteAtom, getAtom, patchAtom, rerunScribe } from '../services/hqApi';
import type { Atom } from '../types';
import { sourceOf } from '../sourceOf';
import styles from './AtomScreen.module.css';

/**
 * Length in words. "0k characters" was both jargon and wrong-looking — a short
 * page rounded to zero and read as empty when it simply wasn't long.
 */
function wordsText(chars: number): string {
  const words = Math.round(chars / 5.5);
  if (words < 1000) return `about ${words} words`;
  return `about ${(words / 1000).toFixed(1).replace('.0', '')}k words`;
}

export function AtomScreen() {
  const { id } = useParams<{ id: string }>();
  const atomId = Number(id);
  const navigate = useNavigate();

  const [atom, setAtom] = useState<Atom | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [working, setWorking] = useState(false);

  const load = useCallback(() => {
    if (!Number.isFinite(atomId)) return;
    getAtom(atomId)
      .then(setAtom)
      .catch(() => setAtom(null))
      .finally(() => setLoading(false));
  }, [atomId]);

  useEffect(load, [load]);

  // While the Scribe is mid-flight, poll so the page fills in on its own.
  useEffect(() => {
    if (atom?.scribe_status !== 'running') return;
    const timer = setInterval(load, 3500);
    return () => clearInterval(timer);
  }, [atom?.scribe_status, load]);

  async function save(patch: Partial<Atom>) {
    if (!atom) return;
    setWorking(true);
    try {
      setAtom(await patchAtom(atom.id, patch));
    } finally {
      setWorking(false);
    }
  }

  async function handleRerun() {
    if (!atom) return;
    setWorking(true);
    try {
      await rerunScribe(atom.id);
      setAtom({ ...atom, scribe_status: 'running' });
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (!atom) return;
    if (!window.confirm(`Remove "${atom.title}" from HQ? This also drops it from search.`)) return;
    await deleteAtom(atom.id);
    navigate('../knowledge');
  }

  if (loading) return <div className={styles.screen}><div className={styles.loading}>Loading…</div></div>;
  if (!atom) return <div className={styles.screen}><div className={styles.loading}>Not found.</div></div>;

  const when = atom.occurred_at || atom.ingested_at;
  const isMeeting = atom.kind === 'meeting';
  const source = sourceOf(atom);

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <button className={styles.back} onClick={() => navigate('../knowledge')}>
          <IconBack /> Knowledge
        </button>

        <header className={styles.header}>
          <div className={styles.headTop}>
            <span className={styles.kindChip}>{atom.kind}</span>
            {/* Which system this came from, stated rather than implied by a link. */}
            <span className={styles.sourceChip} title={atom.source_label || source.name}>
              <span aria-hidden="true">{source.icon}</span> {source.name}
            </span>
            {when && (
              <span className={styles.date}>
                {new Date(when).toLocaleDateString(undefined, {
                  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
            )}
            <div className={styles.actions}>
              {/* Any entry, not just meetings. A proposal with no summary is
                  only findable by wording that happens to match its text —
                  a summary makes it findable by what it's ABOUT, in whichever
                  language someone asks. */}
              <button
                className="hqMini"
                onClick={handleRerun}
                disabled={working || atom.scribe_status === 'running'}
                title="Reads the whole thing and writes a summary, decisions and action items"
              >
                <IconRefresh /> {atom.scribe_status === 'done' ? 'Redo summary' : 'Summarise'}
              </button>
              <button
                className="hqMini"
                onClick={() => { setDraftTitle(atom.title); setEditingTitle(true); }}
              >
                <IconEdit /> Rename
              </button>
              <button className="hqMini hqMiniDanger" onClick={handleDelete}>
                <IconTrash /> Remove
              </button>
            </div>
          </div>

          {editingTitle ? (
            <>
              <input
                className={styles.titleInput}
                value={draftTitle}
                autoFocus
                onChange={e => setDraftTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { save({ title: draftTitle }); setEditingTitle(false); } }}
              />
              <div className={styles.editRow}>
                <button className="hqPill" onClick={() => { save({ title: draftTitle }); setEditingTitle(false); }}>Save</button>
                <button className="hqMini" onClick={() => setEditingTitle(false)}>Cancel</button>
              </div>
            </>
          ) : (
            <h1 className={styles.title} dir="auto">{atom.title}</h1>
          )}

          <div className={styles.metaRow}>
            {(atom.participants || []).map((p, i) => <span key={i} className={styles.tag}>{p}</span>)}
            {(atom.projects || []).map((p, i) => <span key={`t${i}`} className={styles.tag}>#{p}</span>)}
            {atom.external_url && (
              <a className={styles.sourceLink} href={atom.external_url} target="_blank" rel="noopener noreferrer">
                {source.open} <IconExternal />
              </a>
            )}
          </div>
        </header>

        {atom.scribe_status === 'running' && (
          <div className={styles.notice}>
            <span className="hqDots"><i /><i /><i /></span>
            The Scribe is reading this — summary, decisions and actions will appear here shortly.
          </div>
        )}
        {atom.scribe_status === 'failed' && (
          <div className={styles.notice}>
            ⚠ The Scribe couldn't process this{atom.error ? ` — ${atom.error}` : ''}. Try re-running it.
          </div>
        )}
        {atom.status === 'failed' && (
          <div className={styles.notice}>
            ⚠ This isn't indexed, so Ask can't find it{atom.error ? ` — ${atom.error}` : ''}.
          </div>
        )}

        {(atom.summary || editingSummary) && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="hqEyebrow">Summary</span>
              {!editingSummary && (
                <button
                  className={styles.editLink}
                  onClick={() => { setDraftSummary(atom.summary || ''); setEditingSummary(true); }}
                >
                  edit
                </button>
              )}
            </div>

            {editingSummary ? (
              <>
                <textarea
                  className={styles.summaryInput}
                  value={draftSummary}
                  autoFocus
                  onChange={e => setDraftSummary(e.target.value)}
                />
                <div className={styles.editRow}>
                  <button className="hqPill" onClick={() => { save({ summary: draftSummary }); setEditingSummary(false); }}>Save</button>
                  <button className="hqMini" onClick={() => setEditingSummary(false)}>Cancel</button>
                </div>
              </>
            ) : (
              <div className={styles.summary} dir="auto">{atom.summary}</div>
            )}
          </section>
        )}

        {atom.decisions?.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="hqEyebrow">Decisions</span>
              <span className={styles.sectionCount}>{atom.decisions.length}</span>
            </div>
            {atom.decisions.map((d, i) => (
              <div key={i} className={styles.decision}>
                <span className={styles.decisionMark}><IconDecision /></span>
                <div className={styles.decisionBody}>
                  <div className={styles.decisionText} dir="auto">{d.text}</div>
                  {d.who && <div className={styles.decisionWho}>{d.who}</div>}
                  {d.quote && <div className={styles.decisionQuote}>"{d.quote}"</div>}
                </div>
              </div>
            ))}
          </section>
        )}

        {atom.actions?.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="hqEyebrow">Action items</span>
              <span className={styles.sectionCount}>{atom.actions.length}</span>
            </div>
            {atom.actions.map((a, i) => (
              <div key={i} className={styles.action}>
                <span className={styles.actionBox} />
                <div className={styles.actionBody}>
                  <div className={styles.actionText} dir="auto">{a.text}</div>
                  {(a.owner || a.due) && (
                    <div className={styles.actionMeta}>
                      {a.owner && <span className={styles.owner}>{a.owner}</span>}
                      {a.due && <span>due {a.due}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {atom.questions?.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <span className="hqEyebrow">Open questions</span>
              <span className={styles.sectionCount}>{atom.questions.length}</span>
            </div>
            {atom.questions.map((q, i) => <div key={i} className={styles.question} dir="auto">{q}</div>)}
          </section>
        )}

        {atom.body && (
          <>
            <button className={styles.transcriptToggle} onClick={() => setShowTranscript(v => !v)}>
              {showTranscript ? '▾' : '▸'} {isMeeting ? 'Full transcript' : 'Full content'}
              {' · '}{wordsText(atom.body.length)}
              {atom.chunk_count > 0 && ' · searchable'}
            </button>

            {showTranscript && (
              <div className={styles.transcript}>
                <div className="hqProse" dir="auto">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{atom.body}</ReactMarkdown>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
