/**
 * SimulationsTab — Admin → Simulations (task #897, phase 1).
 *
 * A simulation is one conversation the server runs by itself, released by
 * an outside AI through the MCP link ("simulate a student opening an
 * account"). This screen is where a person watches them:
 *
 *   left   the agent's simulation jobs, newest first, with their status
 *   right  the selected job's setup (who released it, which version,
 *          which model plays the user, the scenario) and its
 *          conversation — growing while the job runs
 *
 * Jobs are released by the AI through the MCP link — and, for easy
 * testing, from here too: "New simulation" opens a small form with the
 * same details the AI would send.
 *
 * While any job is still going the list re-reads every few seconds; the
 * conversation follows the job's turn count. Nothing animates or blinks —
 * a running job is a steady chip (see the "no blinking" lesson of #888).
 * The list and conversation styles are the Conversations tab's own, so
 * the two screens read as one family.
 */

import { useEffect, useState } from 'react';
import { listSimulations, releaseSimulation, type NewSimulation, type SimulationJob } from '../../state/builderApi';
import { getProviders } from '../../registry/providerModels';
import { Modal } from '../Modal/Modal';
import { ConversationDetail } from './ConversationsTab';
import convStyles from './ConversationsTab.module.css';
import styles from './SimulationsTab.module.css';

const POLL_MS = 3000;

const STATUS_LABEL: Record<SimulationJob['status'], string> = {
  pending: 'Waiting',
  running: 'Running',
  completed: 'Finished',
  failed: 'Failed',
  interrupted: 'Interrupted',
};

const isLive = (j: SimulationJob) => j.status === 'pending' || j.status === 'running';

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function scenarioLine(j: SimulationJob): string {
  return j.kind === 'script'
    ? `Script · ${j.lines?.length ?? 0} line${j.lines?.length === 1 ? '' : 's'}`
    : `Persona · ${j.userModel ?? ''}`;
}

export function SimulationsTab({ agentSlug }: { agentSlug: string }) {
  const [jobs, setJobs] = useState<SimulationJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Bumping `tick` re-reads the list (the refresh button and the poll).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    listSimulations({ agentSlug })
      .then(list => { if (!cancelled) { setJobs(list); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [agentSlug, tick]);

  // Keep reading while something is still going.
  const anyLive = !!jobs?.some(isLive);
  useEffect(() => {
    if (!anyLive) return;
    const t = setInterval(() => setTick(n => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, [anyLive]);

  const selected = jobs?.find(j => j.id === selectedId) ?? null;

  return (
    <div className={convStyles.wrap}>
      <aside className={convStyles.list}>
        <div className={convStyles.listHead}>
          <span className={convStyles.listTitle}>Simulations</span>
          <button type="button" className={convStyles.refresh} onClick={() => setTick(n => n + 1)} title="Refresh">↻</button>
        </div>
        <div className={styles.newRow}>
          <button type="button" className={styles.newBtn} onClick={() => setFormOpen(true)}>+ New simulation</button>
        </div>
        {error && <div className={convStyles.error}>{error}</div>}
        {jobs !== null && jobs.length === 0 && !error && (
          <div className={styles.emptyList}>
            <b>No simulations yet.</b>
            <span>Start one with the button above, or ask your connected AI — for example: “simulate a conversation with this agent as a 19-year-old student opening a first account”.</span>
          </div>
        )}
        <div className={convStyles.listScroll}>
          {(jobs ?? []).map(j => (
            <button
              key={j.id}
              type="button"
              className={`${convStyles.row} ${j.id === selectedId ? convStyles.rowActive : ''}`}
              onClick={() => setSelectedId(j.id)}
            >
              <div className={convStyles.rowName}>{j.label || `Simulation #${j.id}`}</div>
              <div className={convStyles.rowMeta}>
                <span className={convStyles.rowOwner}>{scenarioLine(j)}</span>
                <span className={convStyles.dot}>·</span>
                <span>{j.turns} turn{j.turns === 1 ? '' : 's'}</span>
              </div>
              <div className={convStyles.rowFoot}>
                <span className={convStyles.rowTime}>{fmtDate(j.createdAt)}{j.by ? ` · ${j.by}` : ''}</span>
                <span className={`${styles.status} ${styles[`status_${j.status}`]}`}>{STATUS_LABEL[j.status]}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className={convStyles.detail}>
        {!selected ? (
          <div className={convStyles.detailEmpty}>
            {jobs && jobs.length > 0
              ? 'Pick a simulation to see its setup and its conversation.'
              : 'Simulations appear here with their setup and conversation — started from “New simulation” or by your connected AI.'}
          </div>
        ) : (
          <>
            <div className={convStyles.detailHead}>
              <span className={convStyles.detailTitle}>{selected.label || `Simulation #${selected.id}`}</span>
              <span className={`${styles.status} ${styles[`status_${selected.status}`]}`}>{STATUS_LABEL[selected.status]}</span>
              <span className={convStyles.detailSpacer} />
              <span className={styles.jobId}>#{selected.id}</span>
            </div>

            <div className={styles.setup}>
              <Fact label="Released by" value={selected.by} />
              <Fact label="Version" value={selected.version === 'published' ? 'Published' : 'Active'} />
              <Fact label="User played by" value={selected.kind === 'script' ? 'A fixed script' : selected.userModel} />
              <Fact label="Turns" value={`${selected.turns}${selected.kind === 'persona' && selected.maxTurns ? ` of up to ${selected.maxTurns}` : selected.lines ? ` of ${selected.lines.length}` : ''}`} />
              <Fact label="Started" value={fmtDate(selected.createdAt)} />
              <Fact label="Stopped because" value={selected.stopped ?? (isLive(selected) ? 'Still running' : null)} />
              {selected.startCrew && <Fact label="Started in crew" value={selected.startCrew} />}
              {selected.endedInCrew && <Fact label="Ended in crew" value={selected.endedInCrew} />}
              {selected.persona && <Fact wide label="Persona" value={selected.persona} />}
              {selected.goal && <Fact wide label="Goal" value={selected.goal} />}
              {selected.lines && (
                <Fact wide label="Script" value={selected.lines.map((l, i) => `${i + 1}. ${l}`).join('\n')} />
              )}
              {selected.fields && Object.keys(selected.fields).length > 0 && (
                <Fact wide label="Starting fields" value={Object.entries(selected.fields).map(([k, v]) => `${k} = ${String(v)}`).join('\n')} />
              )}
              {selected.error && <Fact wide danger label="Error" value={selected.error} />}
            </div>

            {selected.conversationId != null && (
              <ConversationDetail
                agentSlug={agentSlug}
                conversationId={selected.conversationId}
                refreshKey={`${selected.turns}:${selected.status}`}
                emptyText={isLive(selected) ? 'Starting — the first messages will appear here.' : 'No messages in this conversation.'}
              />
            )}
          </>
        )}
      </section>
      {formOpen && (
        <NewSimulationModal
          agentSlug={agentSlug}
          onClose={() => setFormOpen(false)}
          onReleased={job => {
            setFormOpen(false);
            setJobs(prev => [job, ...(prev ?? []).filter(j => j.id !== job.id)]);
            setSelectedId(job.id);
            setTick(n => n + 1);
          }}
        />
      )}
    </div>
  );
}

const BY_KEY = 'builder:simulationBy';

/**
 * The same details an AI sends through the MCP link, as a form. Both
 * kinds of user (a persona the platform plays, or a fixed script) share
 * one area of fixed height, and the persona-only settings are disabled
 * rather than hidden for a script — so switching kind never resizes the
 * window.
 */
function NewSimulationModal({ agentSlug, onClose, onReleased }: {
  agentSlug: string;
  onClose: () => void;
  onReleased: (job: SimulationJob) => void;
}) {
  const [by, setBy] = useState(() => { try { return localStorage.getItem(BY_KEY) || ''; } catch { return ''; } });
  const [version, setVersion] = useState<'active' | 'published'>('active');
  const [kind, setKind] = useState<'persona' | 'script'>('persona');
  const [persona, setPersona] = useState('');
  const [goal, setGoal] = useState('');
  const [script, setScript] = useState('');
  const [model, setModel] = useState('');
  const [maxTurns, setMaxTurns] = useState(8);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const providers = getProviders();
  const lines = script.split('\n').map(l => l.trim()).filter(Boolean);
  const ready = !!by.trim() && (kind === 'persona' ? !!persona.trim() : lines.length > 0);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const simulation: NewSimulation = kind === 'persona'
      ? { version, persona: persona.trim(), ...(goal.trim() ? { goal: goal.trim() } : {}), maxTurns, ...(model ? { model } : {}) }
      : { version, lines };
    if (label.trim()) simulation.label = label.trim();
    try {
      try { localStorage.setItem(BY_KEY, by.trim()); } catch { /* private mode */ }
      onReleased(await releaseSimulation({ agentSlug, by: by.trim(), simulation }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="🎭 New simulation"
      width={600}
      footer={
        <>
          <span className={styles.formError}>{error}</span>
          <button type="button" className={styles.formBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${styles.formBtn} ${styles.formBtnPrimary}`} disabled={!ready || busy} onClick={submit}>
            {busy ? 'Starting…' : 'Start simulation'}
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Released by</span>
            <input className={styles.formInput} value={by} onChange={e => setBy(e.target.value)} placeholder="Your name" />
          </label>
          <div className={styles.formField}>
            <span className={styles.formLabel}>Agent version</span>
            <div className={styles.seg}>
              {(['active', 'published'] as const).map(v => (
                <button key={v} type="button" className={`${styles.segBtn} ${version === v ? styles.segOn : ''}`} onClick={() => setVersion(v)}
                  title={v === 'active' ? 'The latest saved version — the one the Builder opens' : 'What customers get'}>
                  {v === 'active' ? 'Active' : 'Published'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.formField}>
          <span className={styles.formLabel}>The user is</span>
          <div className={styles.seg}>
            <button type="button" className={`${styles.segBtn} ${kind === 'persona' ? styles.segOn : ''}`} onClick={() => setKind('persona')}
              title="A model plays the user from a description">A persona</button>
            <button type="button" className={`${styles.segBtn} ${kind === 'script' ? styles.segOn : ''}`} onClick={() => setKind('script')}
              title="The user's messages, written in advance and sent in order">A fixed script</button>
          </div>
        </div>

        <div className={styles.scenario}>
          {kind === 'persona' ? (
            <>
              <label className={styles.formField}>
                <span className={styles.formLabel}>Who they are</span>
                <textarea className={styles.formArea} dir="auto" rows={3} value={persona} onChange={e => setPersona(e.target.value)}
                  placeholder="Dana, 19, student, opening her first bank account. Impatient, writes short messages." />
              </label>
              <label className={styles.formField}>
                <span className={styles.formLabel}>What they want <i>(optional)</i></span>
                <input className={styles.formInput} dir="auto" value={goal} onChange={e => setGoal(e.target.value)}
                  placeholder="Find out the fees without giving a phone number" />
              </label>
            </>
          ) : (
            <label className={styles.formField}>
              <span className={styles.formLabel}>The user's messages — one per line, sent in order</span>
              <textarea className={`${styles.formArea} ${styles.formAreaTall}`} dir="auto" value={script} onChange={e => setScript(e.target.value)}
                placeholder={'Hi\nI\'m a student\nWhat are the fees?'} />
            </label>
          )}
        </div>

        <div className={styles.formRow}>
          <label className={styles.formField}>
            <span className={styles.formLabel}>Model that plays the user</span>
            <select className={styles.formInput} value={model} disabled={kind === 'script'} onChange={e => setModel(e.target.value)}>
              <option value="">Default — the everyday model</option>
              {providers.map(p => (
                <optgroup key={p.id} label={p.label}>
                  {p.models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={`${styles.formField} ${styles.formFieldNarrow}`}>
            <span className={styles.formLabel}>Turn limit</span>
            <input className={styles.formInput} type="number" min={1} max={30} value={maxTurns} disabled={kind === 'script'}
              onChange={e => setMaxTurns(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
          </label>
        </div>

        <label className={styles.formField}>
          <span className={styles.formLabel}>Name for this simulation <i>(optional)</i></span>
          <input className={styles.formInput} dir="auto" value={label} onChange={e => setLabel(e.target.value)} placeholder="impatient student" />
        </label>
      </div>
    </Modal>
  );
}

function Fact({ label, value, wide, danger }: { label: string; value: string | null | undefined; wide?: boolean; danger?: boolean }) {
  return (
    <div className={`${styles.fact} ${wide ? styles.factWide : ''}`}>
      <span className={styles.factLabel}>{label}</span>
      <span className={`${styles.factValue} ${danger ? styles.factDanger : ''}`} dir="auto">{value || '—'}</span>
    </div>
  );
}
