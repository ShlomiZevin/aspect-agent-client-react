import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatContext } from '../../../context';
import {
  advanceConversationTurn,
  cancelConversationRun,
  getTestRun,
  runConversationToCompletion,
} from '../../../services/testRunnerService';
import { getUserById } from '../../../services/adminService';
import type { AdvanceTurnResponse, ConversationMetadata, ConversationOutput, IndividualProfile, TestRun } from '../../../types/testRunner';
import styles from './SyntheticControlPanel.module.css';

/**
 * Cockpit panel — rendered in place of ChatInput when a conversation
 * is synthetic (conversation.metadata.synthetic === true).
 *
 * - "▶ Next turn" advances exactly one user→assistant exchange.
 * - "⏩ Run to completion" kicks off a server-side loop and polls until terminal.
 * - "⏸ Stop" cancels a running loop cleanly between turns.
 */
export function SyntheticControlPanel() {
  const { conversationMetadata, baseURL, loadHistory, conversationId } = useChatContext();
  const meta = conversationMetadata as ConversationMetadata | null;
  const testRunId = meta?.testRunId as number | undefined;

  const [run, setRun] = useState<TestRun | null>(null);
  const [userPersona, setUserPersona] = useState<IndividualProfile | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [looping, setLooping] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastTurnCountRef = useRef<number>(0);

  // Fetch initial run state so we know turnCount, status, persona, etc.
  useEffect(() => {
    if (!testRunId) return;
    let cancelled = false;
    getTestRun(testRunId, baseURL).then(r => {
      if (!cancelled) setRun(r);
    }).catch(err => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load test run');
    });
    return () => { cancelled = true; };
  }, [testRunId, baseURL]);

  // Fallback: if the run lacks a persona snapshot, fetch the synthetic user
  // and pull persona from users.metadata. Handles runs created before persona-in-input.
  useEffect(() => {
    if (!run) return;
    const input = run.input as { persona?: IndividualProfile; userId?: number };
    if (input.persona || !input.userId || userPersona) return;
    let cancelled = false;
    getUserById(input.userId, baseURL).then(u => {
      const p = u?.metadata?.persona as IndividualProfile | undefined;
      if (!cancelled && p) setUserPersona(p);
    }).catch(() => { /* ignore — keep id-only fallback */ });
    return () => { cancelled = true; };
  }, [run, baseURL, userPersona]);

  // Polling: while the loop is running, refetch run state every 2.5s and
  // refresh the chat feed when new turns land.
  useEffect(() => {
    if (!looping || !testRunId) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const fresh = await getTestRun(testRunId, baseURL);
        if (cancelled) return;
        setRun(fresh);
        const newTurnCount = (fresh.output as ConversationOutput | undefined)?.turnCount || 0;
        if (newTurnCount !== lastTurnCountRef.current) {
          lastTurnCountRef.current = newTurnCount;
          // New turns landed — refresh chat bubble feed
          await loadHistory(conversationId);
        }
        if (['completed', 'failed', 'cancelled'].includes(fresh.status)) {
          setLooping(false);
          setCancelling(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Polling failed');
        }
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [looping, testRunId, baseURL, loadHistory, conversationId]);

  const handleNextTurn = useCallback(async () => {
    if (!testRunId || advancing || looping) return;
    setAdvancing(true);
    setError(null);
    try {
      const result: AdvanceTurnResponse = await advanceConversationTurn(testRunId, baseURL);
      setRun(result.run);
      lastTurnCountRef.current = (result.run.output as ConversationOutput | undefined)?.turnCount || 0;
      await loadHistory(conversationId);
      if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Turn failed');
    } finally {
      setAdvancing(false);
    }
  }, [testRunId, advancing, looping, baseURL, loadHistory, conversationId]);

  const handleRunToCompletion = useCallback(async () => {
    if (!testRunId || advancing || looping) return;
    setError(null);
    try {
      lastTurnCountRef.current = (run?.output as ConversationOutput | undefined)?.turnCount || 0;
      await runConversationToCompletion(testRunId, baseURL);
      setLooping(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start loop');
    }
  }, [testRunId, advancing, looping, baseURL, run]);

  const handleCancel = useCallback(async () => {
    if (!testRunId || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelConversationRun(testRunId, baseURL);
      // Polling effect will pick up the terminal state and stop the loop.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
      setCancelling(false);
    }
  }, [testRunId, cancelling, baseURL]);

  if (!testRunId) {
    return null;
  }

  const input = (run?.input || {}) as { persona?: IndividualProfile; personaId?: string; maxTurns?: number };
  const persona = input.persona || userPersona;
  const personaId = input.personaId;
  const output = (run?.output || {}) as ConversationOutput;
  const turnCount = output.turnCount || 0;
  const maxTurns = input.maxTurns || 30;
  const status = run?.status || 'pending';
  const terminationReason = output.terminationReason || null;
  const isTerminal = ['completed', 'failed', 'cancelled'].includes(status);

  const personaLine = persona
    ? `${persona.name || persona.id} · ${persona.motivation_primary || ''} · ${persona.difficulty || ''}`.trim()
    : run
      ? (personaId ? `Persona ${personaId}` : 'Synthetic conversation')
      : 'Loading…';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.badge}>🤖 SYNTHETIC</span>
        <span className={styles.personaLine}>{personaLine}</span>
      </div>

      <div className={styles.statusLine}>
        <span className={`${styles.statusDot} ${
          status === 'running' || looping ? styles.statusDotRunning :
          status === 'completed' ? styles.statusDotCompleted :
          status === 'failed' ? styles.statusDotFailed :
          status === 'cancelled' ? styles.statusDotFailed :
          ''
        }`} />
        <span className={
          status === 'running' || looping ? styles.statusRunning :
          status === 'completed' ? styles.statusCompleted :
          status === 'failed' || status === 'cancelled' ? styles.statusFailed :
          ''
        }>
          {isTerminal
            ? `${status}${terminationReason ? ` · ${terminationReason}` : ''}`
            : looping
              ? `looping · turn ${turnCount}/${maxTurns}`
              : `${status} · turn ${turnCount}/${maxTurns}`}
        </span>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.nextBtn}
          onClick={handleNextTurn}
          disabled={advancing || looping || isTerminal}
          title={isTerminal ? 'Conversation has ended' : 'Generate one more user→assistant exchange'}
        >
          {advancing ? (
            <><span className={styles.spinner} /> Working…</>
          ) : isTerminal ? (
            <>Conversation ended</>
          ) : (
            <>▶ Next turn</>
          )}
        </button>

        {!isTerminal && !looping && (
          <button
            className={styles.runBtn}
            onClick={handleRunToCompletion}
            disabled={advancing}
            title="Run all remaining turns to completion"
          >
            ⏩ Run to completion
          </button>
        )}

        {looping && (
          <button
            className={styles.stopBtn}
            onClick={handleCancel}
            disabled={cancelling}
            title="Stop after the current turn"
          >
            {cancelling ? (<><span className={styles.spinner} /> Stopping…</>) : <>⏸ Stop</>}
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isTerminal && output.endReason && (
        <div className={styles.terminatedNote}>"{output.endReason}"</div>
      )}
    </div>
  );
}
