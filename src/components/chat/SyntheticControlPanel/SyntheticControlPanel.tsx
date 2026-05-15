import { useCallback, useEffect, useState } from 'react';
import { useChatContext } from '../../../context';
import { advanceConversationTurn, getTestRun } from '../../../services/testRunnerService';
import { getUserById } from '../../../services/adminService';
import type { AdvanceTurnResponse, ConversationMetadata, ConversationOutput, IndividualProfile, TestRun } from '../../../types/testRunner';
import styles from './SyntheticControlPanel.module.css';

/**
 * Phase 0 cockpit panel — rendered in place of ChatInput when a conversation
 * is synthetic (conversation.metadata.synthetic === true). Lets the admin step
 * through the conversation one turn at a time.
 */
export function SyntheticControlPanel() {
  const { conversationMetadata, baseURL, loadHistory, conversationId } = useChatContext();
  const meta = conversationMetadata as ConversationMetadata | null;
  const testRunId = meta?.testRunId as number | undefined;

  const [run, setRun] = useState<TestRun | null>(null);
  const [userPersona, setUserPersona] = useState<IndividualProfile | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleNextTurn = useCallback(async () => {
    if (!testRunId || advancing) return;
    setAdvancing(true);
    setError(null);
    try {
      const result: AdvanceTurnResponse = await advanceConversationTurn(testRunId, baseURL);
      setRun(result.run);
      // Re-load the chat history so the new user+assistant messages appear in the bubble feed
      await loadHistory(conversationId);
      if (result.error) {
        setError(result.error);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Turn failed');
    } finally {
      setAdvancing(false);
    }
  }, [testRunId, advancing, baseURL, loadHistory, conversationId]);

  if (!testRunId) {
    // Should never happen — panel is only rendered when synthetic — but guard anyway.
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

  // Persona summary — fall back to id-only for runs created before the snapshot fix.
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
          status === 'running' ? styles.statusDotRunning :
          status === 'completed' ? styles.statusDotCompleted :
          status === 'failed' ? styles.statusDotFailed :
          ''
        }`} />
        <span className={
          status === 'running' ? styles.statusRunning :
          status === 'completed' ? styles.statusCompleted :
          status === 'failed' ? styles.statusFailed :
          ''
        }>
          {isTerminal
            ? `${status}${terminationReason ? ` · ${terminationReason}` : ''}`
            : `${status} · turn ${turnCount}/${maxTurns}`}
        </span>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.nextBtn}
          onClick={handleNextTurn}
          disabled={advancing || isTerminal}
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
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isTerminal && output.endReason && (
        <div className={styles.terminatedNote}>"{output.endReason}"</div>
      )}
    </div>
  );
}
