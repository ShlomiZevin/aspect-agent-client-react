/**
 * TriggerTestButtons — the two things you can do to ONE trigger against
 * the chat you have open, without waiting for the clock.
 *
 * ── Why two buttons, and why these words ───────────────────────────
 *
 *   Will it trigger?   a question. Reads, answers, changes nothing.
 *   Run it now         a command. It happens whether or not it would
 *                      have triggered by itself.
 *
 * The two verbs differ deliberately. "Will it run?" was ambiguous
 * against "Run it now" beside it — read quickly, it asks whether
 * pressing the BUTTON runs something. "Trigger" asks about the thing
 * itself, in the word the screen already uses for it, and cannot be
 * confused with the action on the other button.
 *
 * They are also styled differently on purpose. The read-only one is a
 * plain ghost button; the one that messages a real person carries an
 * accent border. Two controls that do very different things should not
 * be visually interchangeable — the difference is the safety rail.
 *
 * The pair sits in its OWN panel above Delete/Done — a tinted band
 * with a title, not a bare row. Sharing a line with Delete and Done put
 * three unrelated jobs together and made "Run it now" read like a way
 * of saving; a bare row after that fixed the grouping but left the
 * buttons visually unattached to the words explaining them.
 *
 * ── Neither shows its own result ───────────────────────────────────
 *
 * Both close this modal and report into the Activity panel. There is
 * one place to read what happened, and it is the same place whether the
 * run came from here, from the clock strip, or from the clock itself —
 * so "what did that do?" never depends on which button you pressed.
 * A result rendered in this footer would also be the one thing you
 * pressed the button to see, hidden behind the thing you pressed it in.
 *
 * ── Scope ──────────────────────────────────────────────────────────
 *
 * Both act on the chat open in the builder chat panel and on nothing
 * else. With none open they are disabled and the line beside them says
 * what to do instead. There is no conversation picker and no id shown
 * anywhere: an id means nothing to anyone who has not opened the
 * database.
 *
 * Run it now is the real thing — `fireOne`, the same function the clock
 * calls — using the working copies of the trigger, the agent and its
 * crew, exactly as the builder chat does on a user turn. So it uses up
 * one of the trigger's attempts and appears in Admin, and the tooltip
 * says so: a "test" that quietly spends 1 of 3 would be a trap.
 */

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { bodyOfAgent, bodyOfCrew } from '../../state/useProjectSync';
import { checkTrigger, fireTrigger } from '../../state/triggersApi';
import { useActivityLog } from './activityLog';
import type { AgentDoc, AgentTrigger } from '../../types';
import styles from './TriggersScreen.module.css';

interface Props {
  agentSlug: string;
  /** The doc as edited, so a run uses the working copy. */
  agent: AgentDoc;
  trigger: AgentTrigger;
  /** Refresh the heartbeat afterwards — a run writes a real event. */
  onRan?: () => void;
  /**
   * Closed after either button.
   *
   * The result belongs in the Activity panel, and the panel is behind
   * this modal. Leaving it open would mean the one thing you pressed
   * the button to see is the one thing you cannot see.
   */
  onDone?: () => void;
}

export function TriggerTestButtons({ agentSlug, agent, trigger, onRan, onDone }: Props) {
  const { previewConversationId } = useBuilder();
  const { logAsk, logPending, markResolved, dropPending, bumpRuns } = useActivityLog();
  const [busy, setBusy] = useState<'check' | 'run' | null>(null);

  const noCrew = !trigger.run?.crewId;
  const noConv = previewConversationId === null;
  const name = trigger.name || 'This trigger';

  const scopeWhy = 'Open a chat in the chat panel first — these only ever act on that one chat.';

  const check = async () => {
    if (noConv || busy || previewConversationId === null) return;
    setBusy('check');
    // Close FIRST, then work. Waiting for the answer meant the modal
    // sat open for as long as the request took — seconds, for a run —
    // which read as a broken button. The panel is where this reports,
    // and it shows "running now" from the server the moment the row
    // opens, so leaving immediately loses nothing.
    onDone?.();
    try {
      const r = await checkTrigger({ agentSlug, trigger, conversationId: previewConversationId });
      const blocker = r.clauses.find(c => !c.ok);
      logAsk({
        action: 'ask',
        scope: name,
        lines: [{
          trigger: name,
          state: r.wouldFire ? 'due' : 'notDue',
          // "will run on the next check", not "would run": nothing is
          // hypothetical once it is due — the clock takes it next pass.
          detail: r.wouldFire
            ? `${r.reason} · the clock will run it on its next check`
            : (blocker ? blocker.why : r.reason),
        }],
      });
    } catch (e) {
      logAsk({
        action: 'ask', scope: name,
        lines: [{ trigger: name, state: 'failed', detail: e instanceof Error ? e.message : 'Check failed' }],
      });
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    if (noConv || noCrew || busy || previewConversationId === null) return;
    setBusy('run');
    // Close first, then let the panel narrate.
    onDone?.();
    // A placeholder RIGHT NOW. The server takes a second or two to open
    // its event row, and until then the panel would show nothing at all
    // — so pressing the button looked like it had done nothing.
    const pendingId = logPending({ action: 'run', scope: name, lines: [] });
    bumpRuns();
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
      onRan?.();
      // Deliberately NOT logged here. The run left a real server event,
      // and that row already says it was started by hand — the panel
      // reads it and labels the entry "You ran". Logging as well put the
      // same run on screen twice, once from each source.
      void r;
      // Stops the spinner. The entry stays as the record of the press;
      // what the run produced arrives as its own row.
      markResolved(pendingId);
      bumpRuns();
    } catch (e) {
      // A request that never reached `fireOne` leaves no server row, so
      // this is the only record of it.
      dropPending(pendingId);
      logAsk({
        action: 'run', scope: name,
        lines: [{ trigger: name, state: 'failed', detail: e instanceof Error ? e.message : 'Run failed' }],
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    /* A panel, not a line. As a bare row between the form and
       Delete/Done it read as leftover UI: nothing tied the two buttons
       to the grey words beside them, and the tag was too quiet to say
       what the row was for. A tinted band with a title states the job
       once, and the state line under it explains the buttons —
       including why they are disabled, which is the case someone is
       most likely to be stuck on. */
    <div className={styles.testStrip}>
      <span className={styles.testIcon} aria-hidden>▶</span>

      <span className={styles.testText}>
        <span className={styles.testTitle}>Test this trigger</span>
        <span className={noConv ? styles.testHintWarn : styles.testHint}>
          {noConv
            ? 'Open or start a chat in the chat panel first — these act on that one chat'
            : 'Acts on the chat you have open. Results appear in the Activity panel.'}
        </span>
      </span>

      <span className={styles.testRowBtns}>
        <button
          type="button"
          className={styles.checkBtn}
          onClick={check}
          disabled={noConv || busy !== null}
          title={noConv ? scopeWhy
            : 'Just tells you. Asks whether this trigger would go off for the chat you have open right now, and shows the numbers. It does not start it: nothing runs and nothing is sent. The answer appears in the Activity panel.'}
        >
          {busy === 'check' ? 'Checking…' : 'Will it trigger?'}
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
