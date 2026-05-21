/**
 * UserChat — preview the agent under construction. Sends messages
 * through `/api/agents/:slug/conversations/:convId/messages` and
 * renders both the transcript and a per-turn live addon timeline.
 *
 * The conversation is created server-side on first send; its id is
 * held in component state and reused for subsequent turns within
 * this session.
 */

import { useEffect, useRef, useState } from 'react';
import { useBuilder, useCurrentAgent, useCurrentCrew } from '../../state/BuilderContext';
import { createConversation } from '../../state/builderApi';
import { sendRuntimeMessage, type RuntimeEvent } from '../../state/runtimeStream';
import { AddonRunTimeline } from '../AddonRun/AddonRunTimeline';
import type { AddonRunSnapshot } from '../AddonRun/AddonRunCard';
import styles from './ChatPanel.module.css';

interface Turn {
  id: string;
  userText: string;
  assistantText: string;
  runs: AddonRunSnapshot[];
}

function findOwnerUserId(): string {
  try {
    const v = localStorage.getItem('builder:ownerUserId');
    return v || 'anon';
  } catch {
    return 'anon';
  }
}

export function UserChat() {
  const { doc, isCrewDirty, isAgentDirty, setPreviewConversationId, refreshConversationMemory } = useBuilder();
  const agent = useCurrentAgent();
  const crew = useCurrentCrew();

  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationIdLocal] = useState<number | null>(null);
  const setConversationId = (id: number | null) => {
    setConversationIdLocal(id);
    setPreviewConversationId(id);
  };
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const turnsRef = useRef<Turn[]>(turns);
  turnsRef.current = turns;

  const slug = doc.agents[0]?.slug ?? '';
  const ownerUserId = findOwnerUserId();
  const crewDirty = agent && crew ? isCrewDirty(agent.id, crew.id) : false;
  const agentDirty = agent ? isAgentDirty(agent.id) : false;
  // Either kind of dirty means the runtime can't see the change yet —
  // crew dirty hides addon edits (context.persona toggles, prompts, fields);
  // agent dirty hides persona text, spec, slug rename.
  const dirty = crewDirty || agentDirty;
  const dirtyLabel = agentDirty && crewDirty
    ? 'Agent + crew have unsaved changes'
    : agentDirty
      ? 'Agent has unsaved changes (e.g. persona)'
      : 'Crew has unsaved changes';

  // Reset conversation when the agent slug changes (e.g. different builder open).
  useEffect(() => {
    setConversationId(null);
    setTurns([]);
  }, [slug]);

  const updateLastTurn = (mut: (turn: Turn) => Turn) => {
    setTurns(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), mut(last)];
    });
  };

  const upsertRun = (turn: Turn, partial: Partial<AddonRunSnapshot> & { instanceId: string }): Turn => {
    const idx = turn.runs.findIndex(r => r.instanceId === partial.instanceId);
    if (idx === -1) {
      const fresh: AddonRunSnapshot = {
        pluginId:   'unknown',
        status:     'running',
        ...partial,
      };
      return { ...turn, runs: [...turn.runs, fresh] };
    }
    const merged = { ...turn.runs[idx], ...partial };
    return { ...turn, runs: turn.runs.map((r, i) => (i === idx ? merged : r)) };
  };

  const handleEvent = (e: RuntimeEvent) => {
    switch (e.type) {
      case 'conversation':
        setConversationId(e.conversationId);
        return;
      case 'addon.start':
        updateLastTurn(t => upsertRun(t, {
          instanceId: e.instanceId,
          pluginId:   e.pluginId,
          label:      e.label,
          status:     'running',
        }));
        return;
      case 'addon.prompt':
        updateLastTurn(t => upsertRun(t, {
          instanceId: e.instanceId,
          prompt:     e.prompt,
        }));
        return;
      case 'addon.token':
        updateLastTurn(t => {
          // Stream Talker tokens into the transcript as they arrive.
          return {
            ...t,
            assistantText: t.assistantText + e.token,
          };
        });
        return;
      case 'addon.output':
        updateLastTurn(t => upsertRun(t, {
          instanceId:   e.instanceId,
          status:       'success',
          rawOutput:    e.rawOutput,
          parsedOutput: e.parsedOutput,
          memoryWrites: e.memoryWrites,
          parseError:   e.parseError,
          durationMs:   e.durationMs,
        }));
        return;
      case 'addon.error':
        if (e.instanceId) {
          updateLastTurn(t => upsertRun(t, {
            instanceId: e.instanceId!,
            status:     'error',
            error:      e.error,
          }));
        } else {
          setErrorMsg(e.error.message || 'Runtime error');
        }
        return;
      case 'assistant.message':
        updateLastTurn(t => ({ ...t, assistantText: e.text }));
        return;
      case 'done':
        // Memory may have been mutated by extractors this turn.
        // Refetch so the FieldsPanel shows live values.
        refreshConversationMemory();
        return;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setErrorMsg(null);
    setBusy(true);
    setInput('');

    try {
      let convId = conversationId;
      if (convId === null) {
        const created = await createConversation({ agentSlug: slug, ownerUserId });
        convId = created.conversationId;
        setConversationId(convId);
      }

      const turn: Turn = {
        id: `turn_${Date.now()}`,
        userText: text,
        assistantText: '',
        runs: [],
      };
      setTurns(prev => [...prev, turn]);

      await sendRuntimeMessage({
        agentSlug:      slug,
        conversationId: convId,
        ownerUserId,
        userMessage:    text,
        version:        'viewing',
        onEvent:        handleEvent,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.chat}>
      <div className={styles.chatHeader}>
        <div className={styles.crewBadge}>{crew ? crew.name : 'No crew selected'}</div>
      </div>

      <div className={styles.messages}>
        {turns.length === 0 && !busy && (
          <div className={styles.intro}>
            <p>Try the agent as your end user would.</p>
          </div>
        )}

        {turns.map(t => (
          <div key={t.id} className={styles.turn}>
            <div className={`${styles.msg} ${styles.msgUser}`}>{t.userText}</div>
            {t.runs.length > 0 && <AddonRunTimeline runs={t.runs} />}
            {t.assistantText && (
              <div className={`${styles.msg} ${styles.msgBot}`}>{t.assistantText}</div>
            )}
          </div>
        ))}
      </div>

      {dirty && (
        <div className={styles.dirtyChip}>
          ⚠️ {dirtyLabel} — Save first to include them in the next run.
        </div>
      )}

      {errorMsg && (
        <div className={styles.errorChip}>{errorMsg}</div>
      )}

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type as the user…"
          rows={2}
          disabled={busy}
        />
        <button type="button" className={styles.sendBtn} onClick={send} disabled={busy || !input.trim()}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
