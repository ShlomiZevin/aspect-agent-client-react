/**
 * RunOnConversation — "run this trigger, now, on the conversation I am
 * looking at".
 *
 * ── Why it is scoped to the open conversation ──────────────────────
 *
 * The blast radius is one conversation, and it is the one already on
 * screen beside this modal. There is no conversation picker and no id
 * to type: you can only act on what you are currently looking at, so
 * "which conversation did I just message?" is never a question. With no
 * conversation open the button is disabled and says why.
 *
 * That is a deliberately smaller capability than the clock has. The
 * clock acts on everyone who matches; a person pressing a button should
 * not be able to do that by accident, and has never needed to.
 *
 * ── It is the real thing, not a simulation ─────────────────────────
 *
 * The endpoint calls `fireOne`, the same function the clock's sweep
 * calls once per matched conversation. Same quiet hours, same Filter,
 * same crew, same event row. Which means a run from here is a REAL
 * nudge: it counts against the trigger's attempt cap and appears in
 * Admin → Triggers like any other. The button says so, because a "test"
 * that quietly spends one of three attempts would be a trap.
 *
 * It also runs the version you are LOOKING AT, not the last saved one:
 * the trigger, the agent body and the named crew all go up as working
 * copies — the same three the builder chat already sends on a user
 * turn. So typing a message and firing the trigger exercise identical
 * bodies, and a prompt you just edited takes effect without a
 * save-and-hope round trip.
 *
 * The one thing not required to pass is the type's timing — pressing
 * the button means "pretend this one is due", which is the entire point
 * of not waiting a day to see what the crew writes. Whether the clock
 * WOULD have chosen it is reported back rather than assumed.
 */

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { bodyOfAgent, bodyOfCrew } from '../../state/useProjectSync';
import { fireTrigger, type FireResult } from '../../state/triggersApi';
import type { AgentDoc, AgentTrigger } from '../../types';
import styles from './TriggersScreen.module.css';

interface Props {
  agentSlug: string;
  /** The doc as edited, so the run uses the working copy. */
  agent: AgentDoc;
  trigger: AgentTrigger;
  /** Refresh the heartbeat afterwards — a run writes a real event. */
  onRan?: () => void;
}

/**
 * How each outcome reads.
 *
 * "Ran → no message" rather than "stayed silent": a trigger starts the
 * crew's CHAIN, and whether that chain ends in a message is the chain's
 * decision. Wording it as the trigger having gone quiet suggests
 * something failed, when a chain that runs and says nothing is a
 * perfectly normal — often correct — result.
 */
const OUTCOME: Record<FireResult['outcome'], { label: string; cls: string; dot: string }> = {
  spoke:       { label: 'Ran → message sent',       cls: 'runOk',    dot: 'runDotOk' },
  silent:      { label: 'Ran → no message',         cls: 'runQuiet', dot: 'runDotQuiet' },
  filtered:    { label: 'Blocked by conditions',    cls: 'runQuiet', dot: 'runDotQuiet' },
  quiet_hours: { label: 'Held — quiet hours',       cls: 'runQuiet', dot: 'runDotQuiet' },
  error:       { label: 'Failed',                   cls: 'runBad',   dot: 'runDotBad' },
};

export function RunOnConversation({ agentSlug, agent, trigger, onRan }: Props) {
  const { previewConversationId } = useBuilder();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FireResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noCrew = !trigger.run?.crewId;
  const noConv = previewConversationId === null;
  const disabled = busy || noConv || noCrew;

  // One reason at a time, most-blocking first — a tooltip listing every
  // possible problem is one nobody reads. No conversation id anywhere:
  // "the open chat" is what the author can actually see.
  const why = noConv
    ? 'Start or open a chat in the builder chat panel first. This button only ever acts on that one chat.'
    : noCrew
      ? 'This trigger has no crew to run. Pick one above.'
      : 'Run this trigger on the open chat now, even if it is not due yet. Uses exactly what is on screen, unsaved edits included. A real run: it uses up one attempt and appears in Admin.';

  const run = async () => {
    if (disabled || previewConversationId === null) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Exactly what the builder chat sends on a user turn: the agent
      // body and the crew this trigger names, as edited. Without these
      // the run would use the last SAVED crew, and "I changed the
      // prompt and it still says the old thing" would be a mystery.
      const crew = agent.crews.find(c => c.id === trigger.run?.crewId);
      setResult(await fireTrigger({
        agentSlug,
        trigger,
        conversationId: previewConversationId,
        overrideAgentBody: bodyOfAgent(agent),
        overrideCrewBody: crew ? bodyOfCrew(crew) : null,
      }));
      onRan?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setBusy(false);
    }
  };

  const shown = result ? OUTCOME[result.outcome] : null;

  return (
    <div className={styles.runWrap}>
      {/* Result sits BEFORE the button in the footer's reading order so
          it grows leftwards into empty space. Placed after, every run
          would shove Done sideways under the cursor. */}
      {error && (
        <span className={styles.runLine}>
          <span className={styles.runDotBad} aria-hidden />
          <span className={styles.runBad}>{error}</span>
        </span>
      )}

      {!error && shown && (
        <span className={styles.runLine} title={result?.why || ''}>
          <span className={styles[shown.dot]} aria-hidden />
          <span className={styles[shown.cls]}>
            {shown.label}
            {/* Kept separate from the outcome: "it sent a message, but
                the clock would not have picked this chat yet" answers a
                different question — and usually the real one. */}
            {result?.wouldFire === false && (
              <span className={styles.runNote}> · not due yet on its own</span>
            )}
          </span>
        </span>
      )}

      <button
        type="button"
        className={styles.runBtn}
        onClick={run}
        disabled={disabled}
        title={why}
      >
        <span className={styles.runIcon} aria-hidden>{busy ? '◌' : '▶'}</span>
        {busy ? 'Running…' : 'Run on the open chat'}
      </button>
    </div>
  );
}
