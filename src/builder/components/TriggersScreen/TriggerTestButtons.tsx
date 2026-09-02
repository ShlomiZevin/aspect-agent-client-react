/**
 * TriggerTestButtons — the two things you can do to ONE trigger against
 * the chat you have open, without waiting for the clock.
 *
 * ── Why two buttons, and why these words ───────────────────────────
 *
 * They were "Check" and "Run all", which told you nothing: both sound
 * like they do something, and neither says which one actually messages
 * a person. The labels now name the CONSEQUENCE rather than the action:
 *
 *   Will it run?   a question. Reads, answers, changes nothing.
 *   Run it now     a command. It happens whether or not it was due.
 *
 * Both avoid jargon. Earlier tries — "Check", "What's due", "Force run"
 * — each assumed the reader already knew what "due" meant, or that
 * "force" implied there was something to override.
 *
 * They are also styled differently on purpose. The read-only one is a
 * plain ghost button; the one that messages a real person carries an
 * accent border. Two controls that do very different things should not
 * be visually interchangeable — the difference is the safety rail.
 *
 * ── Scope ──────────────────────────────────────────────────────────
 *
 * Both act on the chat open in the builder chat panel and on nothing
 * else. With none open they are disabled and say why. There is no
 * conversation picker and no id shown anywhere: an id means nothing to
 * anyone who has not opened the database.
 *
 * Force run is the real thing — `fireOne`, the same function the clock
 * calls — using the working copies of the trigger, the agent and its
 * crew, exactly as the builder chat does on a user turn. So it uses up
 * one of the trigger's attempts and appears in Admin, and the tooltip
 * says so: a "test" that quietly spends 1 of 3 would be a trap.
 */

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { bodyOfAgent, bodyOfCrew } from '../../state/useProjectSync';
import { checkTrigger, fireTrigger, type FireResult } from '../../state/triggersApi';
import type { AgentDoc, AgentTrigger } from '../../types';
import styles from './TriggersScreen.module.css';

interface Props {
  agentSlug: string;
  /** The doc as edited, so a run uses the working copy. */
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
  spoke:       { label: 'Ran → message sent',    cls: 'runOk',    dot: 'runDotOk' },
  silent:      { label: 'Ran → no message',      cls: 'runQuiet', dot: 'runDotQuiet' },
  filtered:    { label: 'Blocked by conditions', cls: 'runQuiet', dot: 'runDotQuiet' },
  quiet_hours: { label: 'Held — quiet hours',    cls: 'runQuiet', dot: 'runDotQuiet' },
  error:       { label: 'Failed',                cls: 'runBad',   dot: 'runDotBad' },
};

type Shown = { text: string; cls: string; dot: string; title?: string } | null;

export function TriggerTestButtons({ agentSlug, agent, trigger, onRan }: Props) {
  const { previewConversationId } = useBuilder();
  const [busy, setBusy] = useState<'check' | 'run' | null>(null);
  const [shown, setShown] = useState<Shown>(null);

  const noCrew = !trigger.run?.crewId;
  const noConv = previewConversationId === null;

  const scopeWhy = 'Open a chat in the chat panel first — these only ever act on that one chat.';

  const check = async () => {
    if (noConv || busy || previewConversationId === null) return;
    setBusy('check');
    setShown(null);
    try {
      const r = await checkTrigger({ agentSlug, trigger, conversationId: previewConversationId });
      const blocker = r.clauses.find(c => !c.ok);
      setShown(r.wouldFire
        ? { text: `Due now — ${r.reason}`, cls: 'runOk', dot: 'runDotOk' }
        : {
            text: `Not due — ${blocker ? blocker.why : r.reason}`,
            cls: 'runQuiet', dot: 'runDotQuiet',
            title: r.clauses.map(c => `${c.ok ? '✓' : '✗'} ${c.name}: ${c.why}`).join('\n'),
          });
    } catch (e) {
      setShown({ text: e instanceof Error ? e.message : 'Check failed', cls: 'runBad', dot: 'runDotBad' });
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (noConv || noCrew || busy || previewConversationId === null) return;
    setBusy('run');
    setShown(null);
    try {
      // Exactly what the builder chat sends on a user turn: the agent
      // body and the crew this trigger names, as edited. Without these
      // the run would use the last SAVED crew, and "I changed the
      // prompt and it still says the old thing" would be a mystery.
      const crew = agent.crews.find(c => c.id === trigger.run?.crewId);
      const r = await fireTrigger({
        agentSlug,
        trigger,
        conversationId: previewConversationId,
        overrideAgentBody: bodyOfAgent(agent),
        overrideCrewBody: crew ? bodyOfCrew(crew) : null,
      });
      const o = OUTCOME[r.outcome];
      setShown({
        // Kept separate from the outcome: "it sent a message, but the
        // clock would not have picked this chat yet" answers a
        // different question — and usually the real one.
        text: o.label + (r.wouldFire === false ? ' · was not due on its own' : ''),
        cls: o.cls, dot: o.dot, title: r.why || '',
      });
      onRan?.();
    } catch (e) {
      setShown({ text: e instanceof Error ? e.message : 'Run failed', cls: 'runBad', dot: 'runDotBad' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.runWrap}>
      {/* Result sits BEFORE the buttons in the footer's reading order so
          it grows leftwards into empty space. Placed after, every run
          would shove Done sideways under the cursor. */}
      {shown ? (
        <span className={styles.runLine} title={shown.title || ''}>
          <span className={styles[shown.dot]} aria-hidden />
          <span className={styles[shown.cls]}>{shown.text}</span>
        </span>
      ) : (
        // The same sentence the clock bar uses, and it follows the same
        // state: with no chat open it says what to do instead of leaving
        // two grey buttons to explain themselves. Stands down once there
        // is a result — by then it has done its job, and the footer has
        // only so much room.
        <span className={styles.testRowLabel}>
          {noConv ? 'Open or start a chat to try it' : 'Try it on the chat you have open'}
        </span>
      )}

      <span className={styles.testRowBtns}>
        <button
          type="button"
          className={styles.checkBtn}
          onClick={check}
          disabled={noConv || busy !== null}
          title={noConv ? scopeWhy
            : 'Just tells you. Asks whether this trigger is due for the chat you have open, and shows the numbers. Nothing runs and nothing is sent.'}
        >
          {busy === 'check' ? 'Checking…' : 'Will it run?'}
        </button>

        <button
          type="button"
          className={styles.forceBtn}
          onClick={run}
          disabled={noConv || noCrew || busy !== null}
          title={noConv ? scopeWhy
            : noCrew ? 'This trigger has no crew to run. Pick one above.'
            : 'Actually runs this trigger on the chat you have open, now, even if it is not due yet. Uses what is on screen, unsaved edits included. It counts as a real run: it uses up an attempt and appears in Admin.'}
        >
          <span className={styles.runIcon} aria-hidden>{busy === 'run' ? '◌' : '▶'}</span>
          {busy === 'run' ? 'Running…' : 'Run it now'}
        </button>
      </span>
    </div>
  );
}
