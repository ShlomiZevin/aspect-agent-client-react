/**
 * useLiveChat — the customer-facing chat state machine.
 *
 * A trimmed port of the builder's UserChat turn logic: pairs each user
 * message with the assistant response, streams tokens into the bubble,
 * and collects every NON-talker addon output as the turn's "thinking
 * process" (surfaced only in DEBUG mode). No crew UI, no working-copy
 * overrides, no memory panel — it runs the agent's `active` version.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  createConversation,
  deleteMessage,
  fetchConversationMessages,
  fetchRunsForMessage,
  listConversations,
  type ConversationListItem,
  type ConversationMessage,
} from '../builder/state/builderApi';
import { sendRuntimeMessage, type RuntimeEvent } from '../builder/state/runtimeStream';

export interface ThinkRun {
  instanceId: string;
  pluginId: string;
  label?: string;
  parsedOutput?: unknown;
  rawOutput?: string;
}

export interface LiveTurn {
  id: string;
  userText: string;
  userMessageId: number | null;
  assistantText: string;
  assistantMessageId: number | null;
  /** instanceId → pluginId, learned from addon.start (output lacks pluginId). */
  runMap: Record<string, string>;
  /** Non-talker addon outputs — the "thinking process". */
  thinkRuns: ThinkRun[];
  /** True once thinkRuns reflect the full turn (live done OR historical fetch). */
  thinkLoaded: boolean;
  /** Live label of whatever addon is currently running (for the "thinking…"
   *  indicator shown before the talker starts streaming). Cleared on finish. */
  thinkingLabel: string | null;
  /** Crew that produced this turn's response (from the `conversation` event
   *  + any transition). Used to label the bubble. Null when unknown. */
  crewId: string | null;
}

function pairMessagesToTurns(messages: ConversationMessage[]): LiveTurn[] {
  const turns: LiveTurn[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === 'user') {
      const next = messages[i + 1];
      const paired = next && next.role === 'assistant' ? next : null;
      turns.push({
        id: `turn_${m.id}`,
        userText: m.content,
        userMessageId: m.id,
        assistantText: paired ? paired.content : '',
        assistantMessageId: paired ? paired.id : null,
        runMap: {},
        thinkRuns: [],
        thinkLoaded: false,
        thinkingLabel: null,
        crewId: null,
      });
      i += paired ? 2 : 1;
    } else if (m.role === 'assistant') {
      turns.push({
        id: `turn_a${m.id}`,
        userText: '',
        userMessageId: null,
        assistantText: m.content,
        assistantMessageId: m.id,
        runMap: {},
        thinkRuns: [],
        thinkLoaded: false,
        thinkingLabel: null,
        crewId: null,
      });
      i += 1;
    } else {
      i += 1;
    }
  }
  return turns;
}

export interface UseLiveChat {
  turns: LiveTurn[];
  convList: ConversationListItem[];
  conversationId: number | null;
  busy: boolean;
  error: string | null;
  send: (text: string) => Promise<void>;
  newChat: () => void;
  refresh: () => Promise<void>;
  loadConversation: (id: number) => Promise<void>;
  loadThinkRuns: (turn: LiveTurn) => Promise<void>;
  deleteTurn: (turn: LiveTurn) => Promise<void>;
  deleteFromHere: (turn: LiveTurn) => Promise<void>;
  clearError: () => void;
}

interface Args {
  slug: string;
  ownerUserId: string;
  version: 'viewing' | 'active';
}

export function useLiveChat({ slug, ownerUserId, version }: Args): UseLiveChat {
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [convList, setConvList] = useState<ConversationListItem[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLastTurn = useCallback((mut: (t: LiveTurn) => LiveTurn) => {
    setTurns(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), mut(last)];
    });
  }, []);

  const reloadConvList = useCallback(async () => {
    if (!slug) return;
    try {
      setConvList(await listConversations({ agentSlug: slug, ownerUserId }));
    } catch (err) {
      console.warn('[live] listConversations failed:', err);
    }
  }, [slug, ownerUserId]);

  // Reset + (re)load the conversation list whenever the agent changes.
  useEffect(() => {
    setConversationId(null);
    setTurns([]);
    setConvList([]);
    setError(null);
    reloadConvList();
  }, [slug, reloadConvList]);

  const handleEvent = useCallback((e: RuntimeEvent) => {
    switch (e.type) {
      case 'conversation':
        setConversationId(e.conversationId);
        updateLastTurn(t => ({
          ...t,
          userMessageId: e.messageId,
          crewId: e.currentCrewId ?? t.crewId,
        }));
        return;
      case 'addon.start':
        updateLastTurn(t => ({
          ...t,
          runMap: { ...t.runMap, [e.instanceId]: e.pluginId },
          // Surface activity so the customer sees a "thinking…" pulse even
          // before the talker streams. Cleared once the response lands.
          thinkingLabel: e.label || e.pluginId,
        }));
        return;
      case 'addon.token':
        updateLastTurn(t => ({ ...t, assistantText: t.assistantText + e.token }));
        return;
      case 'addon.output':
        updateLastTurn(t => {
          // A transition router can move the conversation to a new crew —
          // reflect that as the responding crew for this turn.
          const crewId = e.transition?.to ?? t.crewId;
          const pluginId = t.runMap[e.instanceId] ?? 'unknown';
          if (pluginId === 'talker') return { ...t, crewId }; // talker IS the response, not "thinking"
          const run: ThinkRun = {
            instanceId: e.instanceId,
            pluginId,
            label: e.label,
            parsedOutput: e.parsedOutput,
            rawOutput: e.rawOutput,
          };
          const idx = t.thinkRuns.findIndex(r => r.instanceId === e.instanceId);
          const thinkRuns = idx === -1
            ? [...t.thinkRuns, run]
            : t.thinkRuns.map((r, i) => (i === idx ? run : r));
          return { ...t, thinkRuns, crewId };
        });
        return;
      case 'addon.error':
        // Only a fatal (instanceId === null) error should surface — a
        // single failed extractor must not break the customer bubble.
        if (e.instanceId === null) {
          setError(e.error.message || 'Runtime error');
          updateLastTurn(t => ({ ...t, thinkingLabel: null }));
        }
        return;
      case 'assistant.message':
        updateLastTurn(t => ({
          ...t,
          assistantText: e.text,
          assistantMessageId: e.messageId,
          thinkLoaded: true,
          thinkingLabel: null,
        }));
        return;
      case 'done':
        updateLastTurn(t => ({ ...t, thinkingLabel: null }));
        reloadConvList();
        return;
      default:
        return;
    }
  }, [updateLastTurn, reloadConvList]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || busy || !slug) return;
    setError(null);
    setBusy(true);
    try {
      let convId = conversationId;
      if (convId === null) {
        const created = await createConversation({ agentSlug: slug, ownerUserId });
        convId = created.conversationId;
        setConversationId(convId);
      }
      setTurns(prev => [...prev, {
        id: `turn_${Date.now()}`,
        userText: text,
        userMessageId: null,
        assistantText: '',
        assistantMessageId: null,
        runMap: {},
        thinkRuns: [],
        thinkLoaded: false,
        thinkingLabel: null,
        crewId: null,
      }]);
      await sendRuntimeMessage({
        agentSlug: slug,
        conversationId: convId,
        ownerUserId,
        userMessage: text,
        version,
        onEvent: handleEvent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [busy, slug, conversationId, ownerUserId, version, handleEvent]);

  const loadConversation = useCallback(async (id: number) => {
    if (!slug) return;
    setBusy(true);
    setError(null);
    try {
      const msgs = await fetchConversationMessages({ agentSlug: slug, conversationId: id });
      setTurns(pairMessagesToTurns(msgs));
      setConversationId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setBusy(false);
    }
  }, [slug]);

  const refresh = useCallback(async () => {
    await reloadConvList();
    if (conversationId !== null) await loadConversation(conversationId);
  }, [reloadConvList, conversationId, loadConversation]);

  const newChat = useCallback(() => {
    setConversationId(null);
    setTurns([]);
    setError(null);
  }, []);

  const loadThinkRuns = useCallback(async (turn: LiveTurn) => {
    if (turn.thinkLoaded || turn.assistantMessageId === null || !slug) return;
    try {
      const runs = await fetchRunsForMessage({ agentSlug: slug, messageId: turn.assistantMessageId });
      const thinkRuns: ThinkRun[] = runs
        .filter(r => r.pluginId !== 'talker')
        .map(r => ({
          instanceId: r.instanceId,
          pluginId: r.pluginId,
          label: r.runData?.label,
          parsedOutput: r.runData?.parsedOutput,
          rawOutput: r.runData?.rawOutput,
        }));
      setTurns(prev => prev.map(t => (t.id === turn.id ? { ...t, thinkRuns, thinkLoaded: true } : t)));
    } catch (err) {
      console.warn('[live] fetchRunsForMessage failed:', err);
      setTurns(prev => prev.map(t => (t.id === turn.id ? { ...t, thinkLoaded: true } : t)));
    }
  }, [slug]);

  const deleteTurn = useCallback(async (turn: LiveTurn) => {
    if (conversationId === null || !slug) return;
    try {
      if (turn.userMessageId !== null) {
        await deleteMessage({ agentSlug: slug, conversationId, messageId: turn.userMessageId });
      }
      if (turn.assistantMessageId !== null) {
        await deleteMessage({ agentSlug: slug, conversationId, messageId: turn.assistantMessageId });
      }
      setTurns(prev => prev.filter(t => t.id !== turn.id));
      reloadConvList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [conversationId, slug, reloadConvList]);

  const deleteFromHere = useCallback(async (turn: LiveTurn) => {
    if (conversationId === null || !slug) return;
    const anchor = turn.userMessageId ?? turn.assistantMessageId;
    if (anchor === null) return;
    try {
      await deleteMessage({ agentSlug: slug, conversationId, messageId: anchor, fromHereDown: true });
      setTurns(prev => {
        const idx = prev.findIndex(t => t.id === turn.id);
        return idx < 0 ? prev : prev.slice(0, idx);
      });
      reloadConvList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }, [conversationId, slug, reloadConvList]);

  const clearError = useCallback(() => setError(null), []);

  return {
    turns, convList, conversationId, busy, error,
    send, newChat, refresh, loadConversation, loadThinkRuns,
    deleteTurn, deleteFromHere, clearError,
  };
}
