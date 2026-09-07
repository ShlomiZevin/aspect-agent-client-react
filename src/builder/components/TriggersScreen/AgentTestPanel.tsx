/**
 * AgentTestPanel — try EVERY trigger on this agent against the chat you
 * have open, without waiting for the clock.
 *
 * ── Why this is not part of the clock strip ────────────────────────
 *
 * It lived inside the clock box for a while, as a panel within a panel,
 * and that was wrong on three counts:
 *
 *   Different jobs.   The clock is system-wide operations — is the
 *                     schedule on, how often, which version. This is
 *                     authoring: try the thing I am building.
 *   Different scope.  The clock covers every agent; this covers this
 *                     agent and one chat. Nesting implied a containment
 *                     that is not true.
 *   Different state.  The clock box tints itself green when running,
 *                     and the nested panel inherited that — suggesting
 *                     these buttons depend on the clock. They do not:
 *                     they work perfectly well while it is paused, and
 *                     that is most of the point of them.
 *
 * So: siblings, not nested. The clock sits above because a trigger card
 * reading "on" while the schedule is paused would be a lie, and the
 * state that governs everything belongs above the things it governs.
 *
 * The panel is deliberately identical in shape to the one inside a
 * single trigger — same classes, same title-and-hint layout. Only the
 * title differs, because only the number of triggers differs.
 *
 * ── Two buttons ────────────────────────────────────────────────────
 *
 *   Will any trigger?   asks. Reports whether that chat is due for each
 *                       trigger, with the arithmetic. Starts nothing.
 *   Run them all now    does. Runs them whether or not they are due.
 *
 * Neither is ever agent-wide or system-wide: the conversation is always
 * the one on screen. Sweeping the world is the clock's job, and the
 * clock alone does it.
 */

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { bodyOfAgent, bodyOfCrew } from '../../state/useProjectSync';
import { fireRound } from '../../state/triggersApi';
import { useActivityLog, stateOfOutcome } from './activityLog';
import styles from './TriggersScreen.module.css';

interface Props {
  agentSlug: string;
  /** Refresh the cards' heartbeat after a real run. */
  onRan?: () => void;
}

export function AgentTestPanel({ agentSlug, onRan }: Props) {
  const { doc, previewConversationId } = useBuilder();
  const { logAsk, logPending, markResolved, dropPending, bumpRuns } = useActivityLog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noConv = previewConversationId === null;

  const go = async (mode: 'simulate' | 'force') => {
    if (previewConversationId === null || busy) return;
    setBusy(true);
    setError(null);
    // A forced round can take as long as the crews do, and until the
    // first event row opens the panel has nothing to show — which read
    // as the button having done nothing. Put a placeholder up now.
    const pendingId = mode === 'force'
      ? logPending({ action: 'run', scope: 'all triggers', scopeAll: true, lines: [] })
      : null;
    if (mode === 'force') bumpRuns();
    try {
      const agent = doc.agents.find(a => a.slug === agentSlug) || doc.agents[0];
      const r = await fireRound({
        agentSlug,
        mode,
        conversationId: previewConversationId,
        triggers: agent?.triggers?.triggers,
        overrideAgentBody: agent ? bodyOfAgent(agent) : undefined,
        overrideCrewBodies: agent
          ? Object.fromEntries(agent.crews.map(c => [c.id, bodyOfCrew(c)]))
          : undefined,
      });

      // One structured line per trigger — name, state, reason — rather
      // than a joined sentence. Stacked in the panel, sentences hid the
      // one thing being compared: whether it ran.
      //
      // "the clock will run it on its next check" rather than "would run
      // now": in a simulation the conditional is wrong. Nothing is
      // hypothetical about it — the trigger IS due, and the clock takes
      // it next pass unless the chat changes first.
      const lines = r.results.map(x => ({
        trigger: x.name || x.triggerId,
        state:   stateOfOutcome(x.outcome),
        detail:  x.outcome === 'would_run'
          ? `${x.why} · the clock will run it on its next check`
          : x.why,
      }));

      // A forced run leaves a server event for everything it actually
      // reached, and the panel reads those. Logging them here as well
      // would show each run twice, once from each source — so in force
      // mode only the triggers that never got that far (switched off, no
      // crew) are worth an entry.
      const worthLogging = mode === 'simulate'
        ? lines
        : lines.filter(l => l.state === 'skipped');

      const note = r.masterOff
        ? 'This agent’s Triggers switch is off, so the clock would skip it.'
        : r.results.length === 0
          ? 'This agent has no triggers yet.'
          : undefined;

      if (mode === 'simulate') {
        logAsk({ action: 'ask', scope: 'all triggers', scopeAll: true, lines, note });
      } else if (pendingId) {
        // The action entry it already put up becomes the record of the
        // press. It keeps only what left NO server row — triggers that
        // were switched off or had no crew — since everything that ran
        // reports itself as its own card below.
        markResolved(pendingId, { lines: worthLogging, note });
        bumpRuns();
        onRan?.();
      }
    } catch (e) {
      if (pendingId) dropPending(pendingId);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.testPanel}>
      <div className={styles.testStrip}>
        <span className={styles.testIcon} aria-hidden>▶</span>

        <span className={styles.testText}>
          <span className={styles.testTitle}>Test every trigger on this agent</span>
          {/* Follows the state rather than assuming one. "Try it on the
              chat you have open" is a lie when there is no chat open, and
              it leaves the reader to work out why the buttons are grey.
              Saying what to do instead is the same sentence's job. */}
          <span className={noConv ? styles.testHintWarn : styles.testHint}>
            {noConv
              ? 'Start a chat, or open one from history — these act on that one chat'
              : 'Acts on the chat you have open. Results appear in the Activity panel.'}
          </span>
        </span>

        <span className={styles.testRowBtns}>
          <button className={styles.checkBtn} disabled={busy || noConv}
            onClick={() => void go('simulate')}
            title={noConv
              ? 'Open a chat in the chat panel first — these only ever act on that one chat.'
              : 'Just tells you. Asks every trigger on this agent whether it would go off for that chat right now, and shows the numbers. It starts nothing: nothing runs and nothing is sent.'}>
            {busy ? 'Working…' : 'Will any trigger?'}
          </button>
          <button className={styles.forceBtn} disabled={busy || noConv}
            onClick={() => void go('force')}
            title={noConv
              ? 'Open a chat in the chat panel first — these only ever act on that one chat.'
              : 'Actually runs every trigger on this agent against that chat now, even ones that are not due yet. They count as real runs: they use up attempts and appear in Admin.'}>
            <span className={styles.runIcon} aria-hidden>▶</span>
            Run them all now
          </button>
        </span>
      </div>

      {error && <div className={styles.testPanelErr}>{error}</div>}
    </div>
  );
}
