/**
 * useLiveChat — the customer-facing chat state machine.
 *
 * A trimmed port of the builder's UserChat turn logic: pairs each user
 * message with the assistant response, streams tokens into the bubble,
 * and collects every NON-talker addon output as the turn's "thinking
 * process" (surfaced only in DEBUG mode). No crew UI, no working-copy
 * overrides, no memory panel — it runs the agent's version chosen by
 * the caller (customer surfaces pass `'published'`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createConversation,
  deleteConversation as apiDeleteConversation,
  deleteMessage,
  fetchConversationMessages,
  fetchLiveBrain,
  fetchProfiler,
  refreshProfiler as apiRefreshProfiler,
  askProfiler as apiAskProfiler,
  fetchRunsForMessage,
  listConversations,
  renameConversation as apiRenameConversation,
  type ConversationListItem,
  type ConversationMessage,
  type LiveBrainPanelData,
  type LiveBrainFrame,
  type ProfilerPanelData,
  type ProfilerFrame,
  type ProfilerAskConfig,
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
  /** Render-ready Live Brain panels for the open conversation. Pushed
   *  live off the chat stream (`brain.snapshot`) and hydrated once when
   *  an existing conversation is opened — no polling, no refetch. */
  livePanels: LiveBrainPanelData[];
  /** Presentation frame (arrangement / open mode) for the surface. */
  liveFrame: LiveBrainFrame | null;
  /** Render-ready Profiler panels for the open conversation. Pushed live
   *  off the chat stream (`profiler.panel`) + hydrated on open, exactly
   *  like `livePanels`. */
  profilerPanels: ProfilerPanelData[];
  /** Presentation frame (open mode) for the Profiler surface. */
  profilerFrame: ProfilerFrame | null;
  /** Ask-Profiler config for this agent (enabled + preset chips), or null
   *  when the agent has no Profiler / Ask disabled. */
  profilerAsk: ProfilerAskConfig | null;
  /** Ask the profile a question about itself. Resolves to the answer. */
  askProfiler: (question: string) => Promise<string>;
  /** Hard-refresh the whole Profiler now (recompute every panel). */
  refreshProfiler: () => Promise<void>;
  /** True while a Profiler hard-refresh is running. */
  profilerRefreshing: boolean;
  send: (text: string) => Promise<void>;
  renameConversation: (id: number, name: string) => Promise<void>;
  deleteConversations: (ids: number[]) => Promise<void>;
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
  version: 'viewing' | 'active' | 'published';
}

export function useLiveChat({ slug, ownerUserId, version }: Args): UseLiveChat {
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [convList, setConvList] = useState<ConversationListItem[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePanels, setLivePanels] = useState<LiveBrainPanelData[]>([]);
  const [liveFrame, setLiveFrame] = useState<LiveBrainFrame | null>(null);
  // Panels merged by id (per-panel live updates); derived into the sorted
  // `livePanels` array. A ref so the SSE handler always sees the latest.
  const livePanelsRef = useRef<Map<string, { index: number; panel: LiveBrainPanelData }>>(new Map());
  const resetLivePanels = useCallback(() => {
    livePanelsRef.current = new Map();
    setLivePanels([]);
    setLiveFrame(null);
  }, []);

  // Profiler surface — same machinery as Live Brain, separate state.
  const [profilerPanels, setProfilerPanels] = useState<ProfilerPanelData[]>([]);
  const [profilerFrame, setProfilerFrame] = useState<ProfilerFrame | null>(null);
  const [profilerAsk, setProfilerAsk] = useState<ProfilerAskConfig | null>(null);
  const [profilerRefreshing, setProfilerRefreshing] = useState(false);
  const profilerPanelsRef = useRef<Map<string, { index: number; panel: ProfilerPanelData }>>(new Map());
  const resetProfilerPanels = useCallback(() => {
    profilerPanelsRef.current = new Map();
    setProfilerPanels([]);
    setProfilerFrame(null);
    setProfilerAsk(null);
  }, []);

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
    resetLivePanels();
    resetProfilerPanels();
    reloadConvList();
  }, [slug, reloadConvList, resetLivePanels, resetProfilerPanels]);

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
          // Everything else — including Live Brain panels — is agent
          // activity worth surfacing in the reasoning trail (live).
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
      case 'brain.panel': {
        // Merge one panel as it arrives (panel-by-panel). Hidden/cleared
        // → remove it. Re-derive the sorted array so the UI updates just
        // that card (with its own animation).
        const map = livePanelsRef.current;
        if (e.panel) map.set(e.panelId, { index: e.index, panel: e.panel });
        else map.delete(e.panelId);
        setLivePanels([...map.values()].sort((a, b) => a.index - b.index).map(x => x.panel));
        return;
      }
      case 'profiler.panel': {
        // Same per-panel merge as brain.panel, for the Profiler surface.
        const map = profilerPanelsRef.current;
        if (e.panel) map.set(e.panelId, { index: e.index, panel: e.panel });
        else map.delete(e.panelId);
        setProfilerPanels([...map.values()].sort((a, b) => a.index - b.index).map(x => x.panel));
        return;
      }
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
        // Fresh conversation: pull the Profiler meta (Ask config + frame)
        // once so the Ask button/chips appear; the panels themselves
        // arrive live via `profiler.panel` (don't overwrite them here).
        fetchProfiler({ agentSlug: slug, conversationId: convId, ownerUserId, version })
          .then(res => { setProfilerFrame(res?.frame ?? null); setProfilerAsk(res?.ask ?? null); })
          .catch(() => {});
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
      // Hydrate the Live Brain from stored state — the ONE fetch this
      // feature needs (past turns didn't stream to this client). New
      // turns update it live, panel by panel, via `brain.panel`.
      try {
        const res = await fetchLiveBrain({ agentSlug: slug, conversationId: id, ownerUserId, version });
        const list = Array.isArray(res?.panels) ? res.panels : [];
        const map = new Map<string, { index: number; panel: LiveBrainPanelData }>();
        list.forEach((panel, index) => map.set(panel.id, { index, panel }));
        livePanelsRef.current = map;
        setLivePanels(list);
        setLiveFrame(res?.frame ?? null);
      } catch {
        resetLivePanels();
      }
      // Hydrate the Profiler too (same one-fetch-on-open pattern).
      try {
        const res = await fetchProfiler({ agentSlug: slug, conversationId: id, ownerUserId, version });
        const list = Array.isArray(res?.panels) ? res.panels : [];
        const map = new Map<string, { index: number; panel: ProfilerPanelData }>();
        list.forEach((panel, index) => map.set(panel.id, { index, panel }));
        profilerPanelsRef.current = map;
        setProfilerPanels(list);
        setProfilerFrame(res?.frame ?? null);
        setProfilerAsk(res?.ask ?? null);
      } catch {
        resetProfilerPanels();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setBusy(false);
    }
  }, [slug, ownerUserId, version, resetLivePanels, resetProfilerPanels]);

  const refresh = useCallback(async () => {
    await reloadConvList();
    if (conversationId !== null) await loadConversation(conversationId);
  }, [reloadConvList, conversationId, loadConversation]);

  /** Delete one or more conversations. If the active one is among
   *  them, the chat resets to a fresh (unsaved) state. */
  const deleteConversations = useCallback(async (ids: number[]) => {
    if (!slug || ids.length === 0) return;
    try {
      for (const id of ids) {
        await apiDeleteConversation({ agentSlug: slug, conversationId: id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
    setConvList(prev => prev.filter(c => !ids.includes(c.id)));
    if (conversationId !== null && ids.includes(conversationId)) {
      setConversationId(null);
      setTurns([]);
      resetLivePanels();
      resetProfilerPanels();
    }
    reloadConvList();
  }, [slug, conversationId, reloadConvList, resetLivePanels, resetProfilerPanels]);

  const renameConversation = useCallback(async (id: number, name: string) => {
    const trimmed = name.trim();
    if (!slug || !trimmed) return;
    // Optimistic — the drawer shows the new name immediately; the
    // reload afterwards reconciles with the server.
    setConvList(prev => prev.map(c => (c.id === id ? { ...c, name: trimmed } : c)));
    try {
      await apiRenameConversation({ agentSlug: slug, conversationId: id, name: trimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      reloadConvList();
    }
  }, [slug, reloadConvList]);

  const newChat = useCallback(() => {
    setConversationId(null);
    setTurns([]);
    setError(null);
    resetLivePanels();
    resetProfilerPanels();
  }, [resetLivePanels, resetProfilerPanels]);

  const askProfiler = useCallback(async (question: string): Promise<string> => {
    const q = question.trim();
    if (!q || !slug || conversationId === null) return '';
    const res = await apiAskProfiler({ agentSlug: slug, conversationId, ownerUserId, question: q, version });
    return res?.answer || '';
  }, [slug, conversationId, ownerUserId, version]);

  const refreshProfiler = useCallback(async (): Promise<void> => {
    if (!slug || conversationId === null || profilerRefreshing) return;
    setProfilerRefreshing(true);
    try {
      const res = await apiRefreshProfiler({ agentSlug: slug, conversationId, ownerUserId, version });
      const list = Array.isArray(res?.panels) ? res.panels : [];
      const map = new Map<string, { index: number; panel: ProfilerPanelData }>();
      list.forEach((panel, index) => map.set(panel.id, { index, panel }));
      profilerPanelsRef.current = map;
      setProfilerPanels(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profiler refresh failed');
    } finally {
      setProfilerRefreshing(false);
    }
  }, [slug, conversationId, ownerUserId, version, profilerRefreshing]);

  const loadThinkRuns = useCallback(async (turn: LiveTurn) => {
    if (turn.thinkLoaded || turn.assistantMessageId === null || !slug) return;
    try {
      const runs = await fetchRunsForMessage({ agentSlug: slug, messageId: turn.assistantMessageId });
      const thinkRuns: ThinkRun[] = runs
        // Only the talker is excluded (it IS the reply). Everything else,
        // Live Brain panels included, is agent activity worth showing.
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
    turns, convList, conversationId, busy, error, livePanels, liveFrame,
    profilerPanels, profilerFrame, profilerAsk, askProfiler, refreshProfiler, profilerRefreshing,
    send, newChat, refresh, loadConversation, loadThinkRuns,
    renameConversation, deleteConversations, deleteTurn, deleteFromHere, clearError,
  };
}
