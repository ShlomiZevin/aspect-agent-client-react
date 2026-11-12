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
import { useProactivePush } from '../builder/state/useProactivePush';
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
  /** Live web searches (task #967) — shown in the thinking bubble until the
   *  answer starts. */
  webSearches?: Array<{ id: string; query: string | null; kind?: string; status: 'searching' | 'done' | 'error' }>;
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

function newLiveTurn(id: string, userText: string): LiveTurn {
  return {
    id,
    userText,
    userMessageId: null,
    assistantText: '',
    assistantMessageId: null,
    runMap: {},
    thinkRuns: [],
    thinkLoaded: false,
    // Non-null from the start → the "thinking" dots show at once.
    thinkingLabel: '',
    crewId: null,
  };
}

export interface UseLiveChat {
  turns: LiveTurn[];
  convList: ConversationListItem[];
  conversationId: number | null;
  /** Composer lock: true while the LATEST send is waiting for its reply
   *  (or a conversation is loading). It clears the moment the reply is
   *  final (`assistant.message`) — NOT when the stream closes, because
   *  the stream stays open while the turn's background add-ons run
   *  (task #974: 5–8 s of a disabled Send button after the answer). */
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
  const [conversationId, setConversationIdState] = useState<number | null>(null);
  // The open conversation, readable from stream handlers that outlive a
  // switch (a turn's background tail can still be streaming after the
  // customer opened another conversation or started a new one).
  const conversationIdRef = useRef<number | null>(null);
  const setConversationId = useCallback((id: number | null) => {
    conversationIdRef.current = id;
    setConversationIdState(id);
  }, []);
  const [error, setError] = useState<string | null>(null);

  // ── Input gate (task #974) ──────────────────────────────────────
  // A turn's SSE stream stays open after the reply, while its OFFLINE
  // lane / Live Brain / Profiler run. The composer used to unlock only
  // when the stream closed. Now:
  //  - `awaitingReply` — the latest send has no final reply yet. Cleared
  //    on `assistant.message` (or `turn.stopped` / `done` / an error).
  //  - A new send goes out at once, even while the previous turn's
  //    offline add-ons are still running — the same as the Builder chat.
  //  - `streamsOpen` — any stream still open (tail included). Proactive
  //    push stays paused until it is 0, as it did while `busy`.
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streamsOpen, setStreamsOpen] = useState(0);
  const awaitingReplyRef = useRef(false);
  const loadingRef = useRef(false);
  const latestSendRef = useRef<string | null>(null);
  const busy = awaitingReply || loading;

  const releaseComposer = useCallback(() => {
    latestSendRef.current = null;
    awaitingReplyRef.current = false;
    setAwaitingReply(false);
  }, []);
  /** The reply of `turnId` is final — unlock if it is still the latest send. */
  const replyDone = useCallback((turnId: string) => {
    if (latestSendRef.current === turnId) releaseComposer();
  }, [releaseComposer]);
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

  // Events update THEIR turn by id — never "the last turn": a previous
  // turn's tail can still be streaming after the next turn was added
  // (#974), and a turn that is no longer on screen is simply skipped.
  const updateTurn = useCallback((turnId: string, mut: (t: LiveTurn) => LiveTurn) => {
    setTurns(prev => {
      const idx = prev.findIndex(t => t.id === turnId);
      if (idx === -1) return prev;
      const next = prev.slice();
      next[idx] = mut(prev[idx]);
      return next;
    });
  }, []);

  const reloadConvList = useCallback(async () => {
    if (!slug) return;
    try {
      setConvList(await listConversations({ agentSlug: slug, ownerUserId, source: 'live' }));
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
    releaseComposer();
    resetLivePanels();
    resetProfilerPanels();
    reloadConvList();
  }, [slug, reloadConvList, resetLivePanels, resetProfilerPanels, setConversationId, releaseComposer]);

  /** The SSE handler of ONE send — bound to its turn and conversation. */
  const makeHandleEvent = useCallback((turnId: string, convId: number) => (e: RuntimeEvent) => {
    const onScreen = () => conversationIdRef.current === convId;
    switch (e.type) {
      case 'conversation':
        if (onScreen()) setConversationId(e.conversationId);
        updateTurn(turnId, t => ({
          ...t,
          userMessageId: e.messageId,
          crewId: e.currentCrewId ?? t.crewId,
        }));
        return;
      case 'addon.start':
        updateTurn(turnId, t => ({
          ...t,
          runMap: { ...t.runMap, [e.instanceId]: e.pluginId },
          // Surface activity so the customer sees a "thinking…" pulse even
          // before the talker streams. Cleared once the response lands.
          thinkingLabel: e.label || e.pluginId,
        }));
        return;
      case 'addon.token':
        updateTurn(turnId, t => ({ ...t, assistantText: t.assistantText + e.token }));
        return;
      case 'addon.websearch':
        updateTurn(turnId, t => {
          const list = t.webSearches ?? [];
          const idx = list.findIndex(s => s.id === e.id);
          const next = {
            id: e.id,
            query: e.query ?? (idx >= 0 ? list[idx].query : null),
            kind: e.kind ?? (idx >= 0 ? list[idx].kind : undefined),
            status: e.status,
          };
          return { ...t, webSearches: idx === -1 ? [...list, next] : list.map((s, i) => (i === idx ? next : s)) };
        });
        return;
      case 'addon.output':
        updateTurn(turnId, t => {
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
          if (onScreen()) setError(e.error.message || 'Runtime error');
          updateTurn(turnId, t => ({ ...t, thinkingLabel: null }));
          replyDone(turnId);
        }
        return;
      case 'assistant.message':
        updateTurn(turnId, t => ({
          ...t,
          assistantText: e.text,
          assistantMessageId: e.messageId,
          thinkLoaded: true,
          thinkingLabel: null,
        }));
        // The reply is final and saved — the customer may type AND send
        // now. The stream stays open for the background add-ons (#974).
        replyDone(turnId);
        return;
      case 'turn.stopped':
        updateTurn(turnId, t => ({ ...t, thinkingLabel: null }));
        replyDone(turnId);
        return;
      case 'brain.panel': {
        // Panels belong to the open conversation — a tail that finishes
        // after the customer switched away must not paint the new one.
        if (!onScreen()) return;
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
        if (!onScreen()) return;
        const map = profilerPanelsRef.current;
        if (e.panel) map.set(e.panelId, { index: e.index, panel: e.panel });
        else map.delete(e.panelId);
        setProfilerPanels([...map.values()].sort((a, b) => a.index - b.index).map(x => x.panel));
        return;
      }
      case 'done':
        updateTurn(turnId, t => ({ ...t, thinkingLabel: null }));
        replyDone(turnId); // a turn with no reply text never sends assistant.message
        reloadConvList();
        return;
      default:
        return;
    }
  }, [updateTurn, replyDone, reloadConvList, setConversationId]);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || awaitingReplyRef.current || loadingRef.current || !slug) return;
    setError(null);
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    latestSendRef.current = turnId;
    awaitingReplyRef.current = true;
    setAwaitingReply(true);
    setStreamsOpen(n => n + 1);
    let sentConvId: number | null = null;
    try {
      let convId = conversationIdRef.current;
      if (convId === null) {
        const created = await createConversation({ agentSlug: slug, ownerUserId, source: 'live' });
        convId = created.conversationId;
        setConversationId(convId);
        // Fresh conversation: pull the Profiler meta (Ask config + frame)
        // once so the Ask button/chips appear; the panels themselves
        // arrive live via `profiler.panel` (don't overwrite them here).
        fetchProfiler({ agentSlug: slug, conversationId: convId, ownerUserId, version })
          .then(res => { setProfilerFrame(res?.frame ?? null); setProfilerAsk(res?.ask ?? null); })
          .catch(() => {});
      }
      sentConvId = convId;
      setTurns(prev => [...prev, newLiveTurn(turnId, text)]);

      // Sent at once, like the Builder chat — the previous turn's offline
      // add-ons are not waited for (they never block a reply).
      await sendRuntimeMessage({
        agentSlug: slug,
        conversationId: convId,
        ownerUserId,
        userMessage: text,
        version,
        onEvent: makeHandleEvent(turnId, convId),
      });
    } catch (err) {
      // Not when the customer has moved to another conversation meanwhile.
      if (sentConvId === null || conversationIdRef.current === sentConvId) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setStreamsOpen(n => Math.max(0, n - 1));
      // Defensive: the stream closed without a final-reply event (network
      // error, no Talker) — never leave the composer or the dots stuck.
      updateTurn(turnId, t => (t.thinkingLabel === null ? t : { ...t, thinkingLabel: null }));
      replyDone(turnId);
    }
  }, [slug, ownerUserId, version, makeHandleEvent, updateTurn, replyDone, setConversationId]);

  const loadConversation = useCallback(async (id: number) => {
    if (!slug) return;
    // Opening a conversation abandons any reply still on its way in the
    // one on screen (its events are bound to a turn that is gone).
    releaseComposer();
    loadingRef.current = true;
    setLoading(true);
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
      loadingRef.current = false;
      setLoading(false);
    }
  }, [slug, ownerUserId, version, resetLivePanels, resetProfilerPanels, releaseComposer, setConversationId]);

  const refresh = useCallback(async () => {
    await reloadConvList();
    if (conversationId !== null) await loadConversation(conversationId);
  }, [reloadConvList, conversationId, loadConversation]);

  // ── Proactive messages ────────────────────────────────────────────
  // The agent can now speak without being spoken to (Triggers). When one
  // of those lands, reload the conversation through the SAME path a
  // history load uses, so a pushed message renders identically to one
  // that was already there.
  //
  // Paused while any of the user's own streams is open (its background
  // tail included, #974) or a conversation is loading: those events are
  // being applied to the turns on screen, and reloading underneath would
  // fight that. Nothing is lost — the message is already saved, so it
  // appears on the next reload either way.
  useProactivePush({
    agentSlug: slug,
    conversationId,
    paused: streamsOpen > 0 || loading,
    onArrived: () => { void refresh(); },
  });

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
      releaseComposer();
      resetLivePanels();
      resetProfilerPanels();
    }
    reloadConvList();
  }, [slug, conversationId, reloadConvList, resetLivePanels, resetProfilerPanels, setConversationId, releaseComposer]);

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
    // A reply still on its way belongs to the conversation left behind.
    releaseComposer();
    resetLivePanels();
    resetProfilerPanels();
  }, [resetLivePanels, resetProfilerPanels, setConversationId, releaseComposer]);

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
