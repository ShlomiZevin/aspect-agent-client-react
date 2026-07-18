/**
 * UserChat — preview the agent under construction.
 *
 * Owns:
 *   - sending turns (SSE → live AddonRunTimeline + token stream)
 *   - lifecycle: new chat, switch via HistoryPanel, delete chat
 *   - per-message delete (single + from-here-down) — visible only
 *     when "Debug controls" is on in settings, so the surface stays
 *     calm for normal use
 *   - rehydrating past assistant messages' addon runs from
 *     `addon_runs` so the historical timeline matches live
 *   - settings popover (debug toggle, RTL) — persisted in localStorage
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBuilder, useCurrentAgent, useCurrentCrew } from '../../state/BuilderContext';
import {
  createConversation,
  deleteConversation,
  deleteMessage,
  fetchConversationMessages,
  fetchRunsForMessage,
  listConversations,
  renameConversation,
  type ConversationListItem,
  type ConversationMessage,
  type PersistedAddonRun,
} from '../../state/builderApi';
import { bodyOfAgent, bodyOfCrew } from '../../state/useProjectSync';
import { sendRuntimeMessage, type RuntimeEvent } from '../../state/runtimeStream';
import { AddonRunTimeline } from '../AddonRun/AddonRunTimeline';
import type { AddonRunSnapshot } from '../AddonRun/AddonRunCard';
import { useConfirm } from '../Confirm/Confirm';
import { HistoryPanel } from './HistoryPanel';
import { ChatSettingsPopover, useChatSettings } from './ChatSettings';
// Report-a-bug reuses the live chat's lightweight modal verbatim — same
// board wiring (assignee chips, screenshots, conversation link). Its CSS
// is fully scoped under `.lybi-chat`, so we mount it inside a scoped
// wrapper div and nothing leaks into the builder's styles.
import { ReportModal } from '../../../live-chat/components/ReportModal';
import { I18N } from '../../../live-chat/i18n';
import '../../../live-chat/liveChat.css';
import styles from './ChatPanel.module.css';

/**
 * A "turn" pairs a user message with the assistant's response and
 * the addon runs that produced it. `userMessageId` /
 * `assistantMessageId` are server-side ids — set once the SSE
 * round-trip is done (live) or at load time (historical).
 */
/**
 * One DC resolution surfaced for this turn — emitted by the server's
 * `dc.resolved` SSE events whenever a `{{dc:FIELD…}}` token resolved
 * against the live brain. Shows which field's enum bible was consulted
 * and which value matched.
 */
interface DcResolution {
  fieldName: string;
  /** `null` for the umbrella `{{dc:F}}`, the section name for
   *  `{{dc:F:S}}`, or `'*'` for the all-sections join. */
  section: string | null;
  matched: string | null; // null = no value matched on the enum
  text: string;
}

interface Turn {
  id: string;
  userText: string;
  userMessageId: number | null;
  assistantText: string;
  assistantMessageId: number | null;
  runs: AddonRunSnapshot[];
  runsLoaded: boolean;
  dcResolutions: DcResolution[];
}

function findOwnerUserId(): string {
  try {
    const v = localStorage.getItem('builder:ownerUserId');
    return v || 'anon';
  } catch {
    return 'anon';
  }
}

function messagesToTurns(messages: ConversationMessage[]): Turn[] {
  const turns: Turn[] = [];
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
        runs: [],
        runsLoaded: false,
        dcResolutions: [],
      });
      i += paired ? 2 : 1;
    } else if (m.role === 'assistant') {
      turns.push({
        id: `turn_a${m.id}`,
        userText: '',
        userMessageId: null,
        assistantText: m.content,
        assistantMessageId: m.id,
        runs: [],
        runsLoaded: false,
        dcResolutions: [],
      });
      i += 1;
    } else {
      i += 1;
    }
  }
  return turns;
}

function snapshotFromPersisted(r: PersistedAddonRun): AddonRunSnapshot {
  const d = (r.runData || {}) as PersistedAddonRun['runData'] & {
    transition?: { to: string; reason?: string };
    broke?: boolean;
    firstTokenMs?: number;
    // Skipped-run fields — set when status === 'skipped'. Without
    // these the AddonRunCard's skipped-state block has nothing to
    // render and the card body comes back empty on history reload.
    // Two shapes today: cap-skip + condition-skip (see AddonRunCard
    // for the union). Legacy persisted rows pre-discriminator are
    // treated as condition-skip by the card.
    filter?: AddonRunSnapshot['filter'];
    skipReason?: string;
  };
  return {
    instanceId:   r.instanceId,
    pluginId:     r.pluginId,
    label:        d.label,
    modelLabel:   d.modelLabel ?? null,
    status:       r.status,
    prompt:       d.prompt,
    rawOutput:    d.rawOutput,
    parsedOutput: d.parsedOutput,
    memoryWrites: d.memoryWrites,
    parseError:   d.parseError,
    transition:   d.transition,
    broke:        d.broke,
    durationMs:   r.durationMs ?? d.durationMs,
    firstTokenMs: d.firstTokenMs,
    filter:       d.filter,
    skipReason:   d.skipReason,
  };
}

export function UserChat() {
  const {
    doc,
    isCrewDirty,
    isAgentDirty,
    setPreviewConversationId,
    refreshConversationMemory,
    applyLocalMemoryWrites,
    applyLiveBrainSnapshot,
  } = useBuilder();
  const agent = useCurrentAgent();
  const crew = useCurrentCrew();
  const confirm = useConfirm();

  const [settings, setSetting] = useChatSettings();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  // Two-piece input gate (replaces the old all-or-nothing `busy`):
  //  - `awaitingTalker` — true while the user is waiting for the
  //    LATEST send's Talker to start producing the reply. Clears the
  //    moment that Talker's `addon.output` event arrives (i.e. the
  //    user-facing response is fully streamed). Offline-lane addons
  //    that fire later don't keep this true.
  //  - `inFlightCount` — number of `sendRuntimeMessage` streams still
  //    running (each turn opens one). New sends are dropped when this
  //    hits MAX_INFLIGHT so offline work can't pile up indefinitely.
  const [awaitingTalker, setAwaitingTalker] = useState(false);
  const [inFlightCount, setInFlightCount] = useState(0);
  const [conversationId, setConversationIdLocal] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [convList, setConvList] = useState<ConversationListItem[]>([]);
  // Bot-message text a bug report was opened for (null = modal closed).
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  useEffect(() => {
    if (toastMsg === null) return;
    const id = setTimeout(() => setToastMsg(null), 2500);
    return () => clearTimeout(id);
  }, [toastMsg]);

  // `currentCrewId` = the crew the next turn will route to. Bound to
  // the dropdown. Updated by:
  //   - user picking from the dropdown (sticky override)
  //   - 'conversation' SSE event (saved DB pointer at turn start)
  //   - 'addon.output' transition (router moved the conversation)
  //   - loadConversation (reads metadata.currentCrewId)
  //   - new chat / slug change (cleared → falls back to default crew)
  const [currentCrewId, setCurrentCrewId] = useState<string | null>(null);

  const turnsRef = useRef<Turn[]>(turns);
  turnsRef.current = turns;
  const messagesRef = useRef<HTMLDivElement>(null);

  // Concurrency cap — how many `sendRuntimeMessage` streams the user
  // can have open at once. When the offline lane (Summarizer etc.)
  // is still draining for a previous turn, the user CAN submit a
  // follow-up; we just refuse new sends once this many streams are
  // in flight to keep server load (and UI weirdness) bounded.
  const MAX_INFLIGHT = 3;

  // Track which addon instance IDs are the Talker so an `addon.output`
  // event can flip the gate the moment the user-facing reply ends,
  // not when the whole offline lane finishes. Populated on the
  // Talker's `addon.start` event; entries are dropped on `addon.output`.
  const talkerInstanceIdsRef = useRef<Set<string>>(new Set());

  // The latest send's turn id — used to decide whether a Talker
  // `addon.output` event should clear `awaitingTalker`. We only clear
  // the gate for the LATEST send (older sends' Talker outputs would
  // arrive late if the user already sent a follow-up).
  const latestSendTurnIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom. Tricky because the chat has TWO async
  // content sources after a history load:
  //   1. Messages (synchronous after fetchConversationMessages).
  //   2. Per-turn addon_runs — each TurnTimeline lazy-fetches its
  //      own runs, then setTurns adds them, expanding the layout
  //      after the initial scroll has already landed.
  //
  // Strategy:
  //   - wasAtBottomRef tracks whether the user is following along.
  //     Updated by the onScroll handler.
  //   - When conversationId changes we enter a brief "grace period"
  //     during which every layout effect force-scrolls to bottom,
  //     so the lazy-loaded timelines pull the view down with them.
  //   - After the grace period (covers ~3s of async loading), we
  //     fall back to "only if the user is near the bottom".
  const wasAtBottomRef = useRef(true);
  const switchedAtRef  = useRef<number>(0);
  const GRACE_MS = 3000;

  // Reset the grace timer whenever we switch conversations. Also
  // optimistically mark the user as "at bottom" so the very first
  // turns→effect that fires lands a scroll.
  useEffect(() => {
    switchedAtRef.current = Date.now();
    wasAtBottomRef.current = true;
  }, [conversationId]);

  // useLayoutEffect — runs synchronously after DOM mutation but
  // before paint, so scrollHeight reflects the just-rendered content.
  useLayoutEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const inGrace = Date.now() - switchedAtRef.current < GRACE_MS;
    if (inGrace || wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, conversationId]);

  const onMessagesScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const slug = doc.agents[0]?.slug ?? '';
  const ownerUserId = findOwnerUserId();

  // Resolve the crew the next turn will be routed to. Priority:
  //   1. currentCrewId (live runtime pointer — survives transitions,
  //      also set by the dropdown below)
  //   2. agent's defaultCrewId (what new conversations start on)
  //   3. the viewing crew (sidebar context — for an empty session)
  const headerAgent = doc.agents[0];
  const headerCrews = headerAgent?.crews ?? [];
  const effectiveCrewId = currentCrewId
    || headerAgent?.defaultCrewId
    || crew?.id
    || null;
  const crewDirty = agent && crew ? isCrewDirty(agent.id, crew.id) : false;
  const agentDirty = agent ? isAgentDirty(agent.id) : false;
  const dirty = crewDirty || agentDirty;
  const dirtyLabel = agentDirty && crewDirty
    ? 'Agent + crew have unsaved changes'
    : agentDirty
      ? 'Agent has unsaved changes (e.g. persona)'
      : 'Crew has unsaved changes';

  const setConversationId = useCallback((id: number | null) => {
    setConversationIdLocal(id);
    setPreviewConversationId(id);
  }, [setPreviewConversationId]);

  const reloadConvList = useCallback(async () => {
    if (!slug) return;
    try {
      const list = await listConversations({ agentSlug: slug, ownerUserId });
      setConvList(list);
    } catch (err) {
      console.warn('[builder] listConversations failed:', err);
    }
  }, [slug, ownerUserId]);

  useEffect(() => {
    setConversationId(null);
    setTurns([]);
    setConvList([]);
    setCurrentCrewId(null);
    reloadConvList();
  }, [slug, setConversationId, reloadConvList]);

  const loadConversation = useCallback(async (convId: number) => {
    // Reuse the input gate while the conversation is being fetched —
    // user-facing meaning is the same ("hold on, the chat isn't ready
    // yet") and it avoids introducing a third loading state just for
    // this one async op.
    setAwaitingTalker(true);
    setErrorMsg(null);
    try {
      const msgs = await fetchConversationMessages({ agentSlug: slug, conversationId: convId });
      const built = messagesToTurns(msgs);
      setTurns(built);
      setConversationId(convId);
      // Pull metadata.currentCrewId out of the cached conversation list
      // entry so the header chip reflects where the conversation left
      // off. Cheap; the list is already fetched.
      const cached = convList.find(c => c.id === convId);
      const meta = cached?.metadata as { currentCrewId?: string } | undefined;
      setCurrentCrewId(meta?.currentCrewId ?? null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setAwaitingTalker(false);
    }
  }, [slug, setConversationId, convList]);

  // Deep-link: the customer Live chat links back here with `?c=<convId>`
  // ("Open in builder"). Load that conversation once on mount so the
  // builder lands on the same thread the user was just looking at.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || !slug) return;
    const c = new URLSearchParams(window.location.search).get('c');
    if (c && /^\d+$/.test(c)) {
      deepLinkedRef.current = true;
      loadConversation(Number(c));
    }
    // loadConversation is stable enough for a one-shot deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadRunsForTurn = useCallback(async (turn: Turn) => {
    if (turn.runsLoaded || turn.assistantMessageId === null) return;
    try {
      const runs = await fetchRunsForMessage({ agentSlug: slug, messageId: turn.assistantMessageId });
      const snapshots = runs.map(snapshotFromPersisted);
      setTurns(prev =>
        prev.map(t => (t.id === turn.id ? { ...t, runs: snapshots, runsLoaded: true } : t)),
      );
    } catch (err) {
      console.warn('[builder] fetchRunsForMessage failed:', err);
      setTurns(prev => prev.map(t => (t.id === turn.id ? { ...t, runsLoaded: true } : t)));
    }
  }, [slug]);

  // Address a specific turn by id. Used by `makeHandleEvent` so every
  // streamed event lands on the turn that opened its own stream — not
  // on "the last turn", which would be wrong once the user has
  // multiple sends in flight simultaneously.
  const updateTurn = (turnId: string, mut: (turn: Turn) => Turn) => {
    setTurns(prev => prev.map(t => (t.id === turnId ? mut(t) : t)));
  };

  const upsertRun = (turn: Turn, partial: Partial<AddonRunSnapshot> & { instanceId: string }): Turn => {
    const idx = turn.runs.findIndex(r => r.instanceId === partial.instanceId);
    if (idx === -1) {
      const fresh: AddonRunSnapshot = { pluginId: 'unknown', status: 'running', ...partial };
      return { ...turn, runs: [...turn.runs, fresh] };
    }
    const merged = { ...turn.runs[idx], ...partial };
    return { ...turn, runs: turn.runs.map((r, i) => (i === idx ? merged : r)) };
  };

  // Per-send event handler factory. The captured `turnId` lets us
  // route every event to the SPECIFIC turn that opened this stream
  // instead of "the last turn" — once multiple sends can be in flight
  // simultaneously, "last" is the wrong target for older streams.
  const makeHandleEvent = (turnId: string) => (e: RuntimeEvent) => {
    switch (e.type) {
      case 'conversation':
        setConversationId(e.conversationId);
        updateTurn(turnId, t => ({ ...t, userMessageId: e.messageId }));
        if (e.currentCrewId !== undefined) setCurrentCrewId(e.currentCrewId);
        return;
      case 'addon.start':
        // Remember which instance IDs are this stream's Talker so the
        // gate can flip the moment its output lands — without scanning
        // every run to look up its pluginId. Cleared on `addon.output`.
        if (e.pluginId === 'talker') {
          talkerInstanceIdsRef.current.add(e.instanceId);
        }
        updateTurn(turnId, t => upsertRun(t, {
          instanceId: e.instanceId,
          pluginId:   e.pluginId,
          label:      e.label,
          modelLabel: e.modelLabel ?? null,
          lane:       e.lane,
          status:     'running',
        }));
        return;
      case 'addon.prompt':
        updateTurn(turnId, t => upsertRun(t, {
          instanceId:   e.instanceId,
          prompt:       e.prompt,
          historyCount: e.historyCount,
          historyMode:  e.historyMode,
        }));
        return;
      case 'addon.token':
        updateTurn(turnId, t => ({ ...t, assistantText: t.assistantText + e.token }));
        return;
      case 'addon.output': {
        // Split memory/thinking writes from summary writes. The card
        // and the local memory cache understand the domain-keyed
        // shape; summary writes are flat-per-name and live on a
        // different brain section (refreshed via the post-`done`
        // memory refetch, not via the optimistic local merge).
        const domainWrites = (e.memoryWrites ?? []).filter(
          (w): w is { kind?: 'memory' | 'thinking'; domain: string | null; field: string; value: unknown } => {
            const k = (w as { kind?: string } | null)?.kind;
            // Summary writes live on a different section; Live Brain
            // panel writes ({ kind: 'panel', panelId, entry }) have no
            // domain/field and must never reach the memory cache.
            return !w || (k !== 'summary' && k !== 'panel');
          },
        );
        updateTurn(turnId, t => upsertRun(t, {
          instanceId:   e.instanceId,
          label:        e.label,
          modelLabel:   e.modelLabel ?? null,
          status:       'success',
          rawOutput:    e.rawOutput,
          parsedOutput: e.parsedOutput,
          memoryWrites: domainWrites,
          parseError:   e.parseError,
          transition:   e.transition,
          broke:        e.broke,
          durationMs:   e.durationMs,
          firstTokenMs: e.firstTokenMs,
          lane:         e.lane,
          historyMode:  e.historyMode,
          historyCount: e.historyCount,
        }));
        // Talker just finished — release the input gate IF this stream
        // is the latest send. Older sends' Talker outputs (which would
        // arrive after the user already submitted a follow-up) don't
        // touch the gate; the follow-up's own Talker will clear it.
        if (talkerInstanceIdsRef.current.has(e.instanceId)) {
          talkerInstanceIdsRef.current.delete(e.instanceId);
          if (latestSendTurnIdRef.current === turnId) {
            setAwaitingTalker(false);
            latestSendTurnIdRef.current = null;
          }
        }
        // Live-merge any memory/thinking writes from this addon into
        // the local cache so the FieldsPanel updates the green value
        // chip the moment the extractor finishes — long before the
        // talker streams a response. Summary writes don't participate
        // — they get picked up by the next refreshConversationMemory.
        if (domainWrites.length > 0) {
          applyLocalMemoryWrites(domainWrites);
        }
      }
        // A transition fired — the server already wrote it to
        // metadata. Surface the new crew in the header dropdown so
        // the user sees the handoff land in real time.
        if (e.transition?.to) setCurrentCrewId(e.transition.to);
        return;
      case 'addon.error':
        if (e.instanceId) {
          updateTurn(turnId, t => upsertRun(t, {
            instanceId: e.instanceId!,
            status:     'error',
            error:      e.error,
          }));
        } else {
          setErrorMsg(e.error.message || 'Runtime error');
        }
        return;
      case 'addon.skipped':
        updateTurn(turnId, t => upsertRun(t, {
          instanceId: e.instanceId,
          label:      e.label,
          modelLabel: e.modelLabel ?? null,
          lane:       e.lane,
          status:     'skipped',
          filter:     e.filter,
          skipReason: e.reason,
          durationMs: e.durationMs,
        }));
        return;
      case 'assistant.message':
        updateTurn(turnId, t => ({
          ...t,
          assistantText:       e.text,
          assistantMessageId:  e.messageId,
          runsLoaded:          true,
        }));
        return;
      case 'dc.resolved':
        // Append one resolution per server event. De-dup by fieldName
        // + section + matched so the same lookup resolving twice in
        // one turn (e.g. referenced in both Talker and Thinker prompts)
        // shows once. Distinct token forms ({{dc:F}}, {{dc:F:S}},
        // {{dc:F:*}}) surface separately — the author wrote each for
        // a reason.
        updateTurn(turnId, t => {
          const existing = t.dcResolutions ?? [];
          const dedupKey = `${e.fieldName}::${e.section ?? ''}::${e.matched ?? ''}`;
          if (existing.some(r => `${r.fieldName}::${r.section ?? ''}::${r.matched ?? ''}` === dedupKey)) return t;
          return {
            ...t,
            dcResolutions: [
              ...existing,
              { fieldName: e.fieldName, section: e.section, matched: e.matched, text: e.text },
            ],
          };
        });
        return;
      case 'enum.resolved':
        // Aggregate enum tokens don't carry a "matched" live value —
        // they dump every value's content. Today we don't surface
        // them in the per-turn trail (the trail is still wired only
        // to `dcResolutions`); pass through so the SSE switch stays
        // exhaustive and TS doesn't complain.
        return;
      case 'brain.snapshot':
        // Live Brain panels finished computing for this turn — push the
        // render-ready list into context so the Live Brain screen updates
        // live off this stream (no refetch, no Refresh button).
        applyLiveBrainSnapshot(e.panels);
        return;
      case 'done':
        refreshConversationMemory();
        reloadConvList();
        return;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    // Block while waiting for the latest send's Talker reply. Cleared
    // the moment its `addon.output` lands — offline-lane work after
    // that doesn't keep this true.
    if (awaitingTalker) return;
    // Concurrency cap — refuse new sends when too many streams are
    // still draining (e.g. offline-lane work piled up because the
    // user is sending follow-ups faster than the offline addons
    // finish). Drop silently is too quiet; flash an inline message.
    if (inFlightCount >= MAX_INFLIGHT) {
      setErrorMsg(`Too many turns in flight (${MAX_INFLIGHT} max). Wait for an offline addon to finish, then try again.`);
      return;
    }
    setErrorMsg(null);
    setAwaitingTalker(true);
    setInFlightCount(c => c + 1);
    setInput('');

    const turn: Turn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userText: text,
      userMessageId: null,
      assistantText: '',
      assistantMessageId: null,
      runs: [],
      runsLoaded: false,
      dcResolutions: [],
    };
    latestSendTurnIdRef.current = turn.id;

    try {
      let convId = conversationId;
      if (convId === null) {
        const created = await createConversation({ agentSlug: slug, ownerUserId });
        convId = created.conversationId;
        setConversationId(convId);
      }

      setTurns(prev => [...prev, turn]);

      // Ship the working-copy bodies along with the request so the
      // server runs the unsaved state. Resolve "which crew" the same
      // way the server resolveRunnable would: explicit override → the
      // agent's defaultCrewId → fall back to the first crew so the
      // runtime always has something to run.
      const liveAgent = doc.agents.find(a => a.slug === slug);
      const targetCrewId =
        currentCrewId
        || liveAgent?.defaultCrewId
        || liveAgent?.crews[0]?.id
        || null;
      const liveCrew = targetCrewId
        ? liveAgent?.crews.find(c => c.id === targetCrewId) ?? null
        : null;

      // Cascading transitions can land on ANY crew this turn, not just
      // the one currentCrewId points at. Sending every crew's working
      // body means a Transition Router cascade hops into the target's
      // UNSAVED edits, not the stale DB body. Cheap (just JSON of the
      // builder doc) and side-steps "second crew's prompt is wrong"
      // confusion when the user is iterating on the target.
      const overrideCrewBodies = liveAgent
        ? Object.fromEntries(liveAgent.crews.map(c => [c.id, bodyOfCrew(c)]))
        : undefined;

      await sendRuntimeMessage({
        agentSlug:      slug,
        conversationId: convId,
        ownerUserId,
        userMessage:    text,
        version:        'viewing',
        overrideCrewId: currentCrewId,
        ...(liveAgent ? { overrideAgentBody: bodyOfAgent(liveAgent) } : {}),
        ...(liveCrew  ? { overrideCrewBody:  bodyOfCrew(liveCrew)   } : {}),
        ...(overrideCrewBodies ? { overrideCrewBodies } : {}),
        onEvent:        makeHandleEvent(turn.id),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setInFlightCount(c => Math.max(0, c - 1));
      // Defensive: if the stream closed without us ever seeing the
      // Talker's `addon.output` (network error, no Talker addon in
      // the chain, etc.) AND this was still the latest send, release
      // the gate so the user isn't stuck waiting forever.
      if (latestSendTurnIdRef.current === turn.id) {
        setAwaitingTalker(false);
        latestSendTurnIdRef.current = null;
      }
    }
  };

  // ── History / settings actions ────────────────────────────────────

  const onNewChat = () => {
    setConversationId(null);
    setTurns([]);
    setErrorMsg(null);
    setCurrentCrewId(null);
    setHistoryOpen(false);
  };

  const onPickConversation = (id: number) => {
    if (id === conversationId) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(false);
    loadConversation(id);
  };

  const onRenameConversation = async (id: number, name: string) => {
    try {
      await renameConversation({ agentSlug: slug, conversationId: id, name });
      setConvList(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const onDeleteFromHistory = async (id: number) => {
    try {
      await deleteConversation({ agentSlug: slug, conversationId: id });
      setConvList(prev => prev.filter(c => c.id !== id));
      if (id === conversationId) onNewChat();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const onDeleteManyFromHistory = async (ids: number[]) => {
    try {
      // Sequential — the endpoint is per-conversation; a handful of
      // rows doesn't justify parallel fan-out.
      for (const id of ids) {
        await deleteConversation({ agentSlug: slug, conversationId: id });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
    setConvList(prev => prev.filter(c => !ids.includes(c.id)));
    if (conversationId !== null && ids.includes(conversationId)) onNewChat();
  };

  // ── Per-message delete (debug controls) ───────────────────────────

  const deleteTurnSelf = async (turn: Turn) => {
    if (conversationId === null) return;
    const ok = await confirm({
      title: 'Delete this message?',
      message: 'Removes just this message (and its addon runs).',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      if (turn.userMessageId !== null) {
        await deleteMessage({ agentSlug: slug, conversationId, messageId: turn.userMessageId });
      }
      if (turn.assistantMessageId !== null) {
        await deleteMessage({ agentSlug: slug, conversationId, messageId: turn.assistantMessageId });
      }
      setTurns(prev => prev.filter(t => t.id !== turn.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const deleteTurnFromHere = async (turn: Turn) => {
    if (conversationId === null) return;
    const anchor = turn.userMessageId ?? turn.assistantMessageId;
    if (anchor === null) return;
    const ok = await confirm({
      title: 'Delete from here down?',
      message: 'Removes this message and every message after it (with their addon runs).',
      confirmLabel: 'Delete from here',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteMessage({ agentSlug: slug, conversationId, messageId: anchor, fromHereDown: true });
      setTurns(prev => {
        const idx = prev.findIndex(t => t.id === turn.id);
        return idx < 0 ? prev : prev.slice(0, idx);
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className={styles.chat}>
      <div className={styles.userChatHeader}>
        <div className={styles.headerRowTop}>
          <button
            type="button"
            className={`${styles.headerBtn} ${historyOpen ? styles.headerBtnActive : ''}`}
            onClick={() => setHistoryOpen(o => !o)}
            title="History"
          >
            📂 <span className={styles.headerBtnLabel}>History</span>
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={onNewChat}
            title="New chat"
            disabled={turns.length === 0 && conversationId === null}
          >
            ＋ <span className={styles.headerBtnLabel}>New</span>
          </button>
          <div className={styles.headerSpacer} />
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => {
              const suffix = conversationId !== null ? `/c/${conversationId}` : '';
              window.open(`/${slug}/live${suffix}`, '_blank', 'noopener');
            }}
            title="Open the full chat (internal, no login)"
            disabled={!slug}
          >
            ↗ <span className={styles.headerBtnLabel}>Admin</span>
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={() => window.open(`/${slug}/go`, '_blank', 'noopener')}
            title="Open the limited customer chat (login-gated, /go)"
            disabled={!slug}
          >
            ↗ <span className={styles.headerBtnLabel}>User</span>
          </button>
          <div className={styles.settingsWrap}>
            <button
              type="button"
              ref={settingsBtnRef}
              className={`${styles.headerBtn} ${settingsOpen ? styles.headerBtnActive : ''}`}
              onClick={() => setSettingsOpen(o => !o)}
              title="Settings"
            >
              ⚙
            </button>
            <ChatSettingsPopover
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              triggerRef={settingsBtnRef}
              settings={settings}
              onChange={setSetting}
              showAddonRunsToggle
            />
          </div>
        </div>
        <div className={styles.headerRowBottom}>
          {headerCrews.length > 0 ? (
            <select
              className={styles.crewSelect}
              value={effectiveCrewId ?? ''}
              onChange={e => setCurrentCrewId(e.target.value || null)}
              title="Route the next message to this crew. Transition Routers can move it mid-conversation."
              disabled={awaitingTalker}
            >
              {headerCrews.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className={styles.crewBadge}>No crew selected</div>
          )}
          {/* Pin swap chips retired from the chat header — the user's
              preference is to surface this stuff only inside the live
              memory / brain panel (where collected fields also live).
              Brain panel shows pinned values with the 🎯 badge so
              the swap UI is reachable there. */}
        </div>
      </div>

      <div className={styles.chatBody}>
        <HistoryPanel
          open={historyOpen}
          conversations={convList}
          activeId={conversationId}
          onClose={() => setHistoryOpen(false)}
          onPick={onPickConversation}
          onNew={onNewChat}
          onRename={onRenameConversation}
          onDelete={onDeleteFromHistory}
          onDeleteMany={onDeleteManyFromHistory}
        />

        <div className={styles.messages} ref={messagesRef} onScroll={onMessagesScroll}>
          {turns.length === 0 && !awaitingTalker && (
            <div className={styles.intro}>
              <p>Try the agent as your end user would.</p>
            </div>
          )}

          {turns.map((t, i) => (
            <Turn
              key={t.id}
              turn={t}
              rtl={settings.rtl}
              showTimeline={settings.showAddonRuns}
              awaiting={awaitingTalker && i === turns.length - 1}
              onExpand={() => loadRunsForTurn(t)}
              onReport={text => setReportFor(text)}
              onDeleteSelf={() => deleteTurnSelf(t)}
              onDeleteFromHere={() => deleteTurnFromHere(t)}
            />
          ))}
        </div>
      </div>

      {dirty && (
        <div className={styles.dirtyChip}>
          ⚠️ {dirtyLabel} — running against the unsaved working copy. Changes apply to this session only and may be lost if not saved.
        </div>
      )}

      {errorMsg && <div className={styles.errorChip}>{errorMsg}</div>}
      {toastMsg && <div className={styles.dirtyChip}>{toastMsg}</div>}

      {/* Scoped wrapper so the live chat's `.lybi-chat .modal…` styles
          apply; `lybi-host` strips the class's fixed full-screen layout
          so the wrapper is inert in the builder (the modal scrim is
          position:fixed on its own). */}
      {/* data-theme is required: every theme var (--surface-2,
          --border-2, --text…) lives under [data-theme] selectors. The
          builder is light-only, so pin light. The inline overrides
          re-derive the whole modal palette from the builder's indigo
          instead of Lybi magenta (every surface/border/gradient is
          color-mixed from --mag/--pur on this element), and drop the
          Assistant font in favour of the builder's. */}
      <div
        className="lybi-chat lybi-host"
        data-theme="light"
        dir="ltr"
        style={{
          '--mag': '#6366f1',
          '--pur': '#4f46e5',
          '--pur2': '#6366f1',
          '--grad': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          fontFamily: 'inherit',
        } as React.CSSProperties}
      >
        <ReportModal
          open={reportFor !== null}
          t={I18N.en}
          messageText={reportFor ?? ''}
          agentSlug={slug}
          scenario="builder"
          conversationId={conversationId}
          onClose={() => setReportFor(null)}
          onDone={msg => { setReportFor(null); setToastMsg(msg); }}
        />
      </div>

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
          disabled={awaitingTalker}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={send}
          disabled={awaitingTalker || !input.trim() || inFlightCount >= MAX_INFLIGHT}
        >
          {awaitingTalker ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// PinSwapChips retired: the user wants pin overrides only in the
// live memory / brain panel. That surface now exposes a value picker
// directly on each pinned-field row (see BrainPanel.MemorySection).

interface TurnProps {
  turn: Turn;
  rtl: boolean;
  /** When false, the addon-run timeline is not rendered — plain chat
   *  view. Also skips the lazy runs fetch (TurnTimeline's mount
   *  effect) until the user toggles activity back on. */
  showTimeline: boolean;
  /** True while this turn is the one currently streaming. Drives the
   *  minimal "thinking…" line when the timeline is hidden. */
  awaiting: boolean;
  onExpand: () => void;
  onReport: (messageText: string) => void;
  onDeleteSelf: () => void;
  onDeleteFromHere: () => void;
}

function Turn({ turn, rtl, showTimeline, awaiting, onExpand, onReport, onDeleteSelf, onDeleteFromHere }: TurnProps) {
  const canDelete = turn.userMessageId !== null || turn.assistantMessageId !== null;
  const showRuns = showTimeline
    && (turn.runs.length > 0 || (turn.assistantMessageId !== null && !turn.runsLoaded));
  // Clean-view feedback: with the timeline hidden the user would stare
  // at nothing until the talker's first token. Show a one-line pulse
  // with the currently-running addon's name; it disappears the moment
  // the answer starts streaming.
  const showThinking = !showTimeline && awaiting && turn.assistantText === '';
  const runningLabel = (() => {
    for (let i = turn.runs.length - 1; i >= 0; i--) {
      const r = turn.runs[i];
      if (r.status === 'running') return r.label || r.pluginId;
    }
    return null;
  })();
  return (
    <div className={styles.turn}>
      {turn.userText && (
        <Bubble
          text={turn.userText}
          who="user"
          rtl={rtl}
          deleteControls={canDelete}
          onDeleteSelf={onDeleteSelf}
          onDeleteFromHere={onDeleteFromHere}
        />
      )}
      {showRuns && <TurnTimeline turn={turn} onExpand={onExpand} />}
      {showThinking && (
        <div className={styles.thinkingLine}>
          <span className={styles.thinkingPulse} />
          {runningLabel ?? 'Thinking'}…
        </div>
      )}
      {/* DC resolutions are surfaced in the BrainPanel — keep them out
          of the chat area to reduce noise. The SSE event + the data on
          `turn.dcResolutions` are still produced and stored; only
          the chat-area display is suppressed here. */}
      {turn.assistantText && (
        <Bubble
          text={turn.assistantText}
          who="bot"
          rtl={rtl}
          deleteControls={canDelete}
          onReport={() => onReport(turn.assistantText)}
          onDeleteSelf={onDeleteSelf}
          onDeleteFromHere={onDeleteFromHere}
        />
      )}
    </div>
  );
}

interface BubbleProps {
  text: string;
  who: 'user' | 'bot';
  rtl: boolean;
  deleteControls: boolean;
  /** Bot bubbles only — opens the lightweight bug-report modal. */
  onReport?: () => void;
  onDeleteSelf: () => void;
  onDeleteFromHere: () => void;
}

function Bubble({ text, who, rtl, deleteControls, onReport, onDeleteSelf, onDeleteFromHere }: BubbleProps) {
  // Each bubble + its delete row live in a self-contained group so
  // hover state is per-bubble (user-hover doesn't reveal the bot's
  // delete buttons and vice versa). The group is full chat width so
  // the buttons still sit at the chat's edge regardless of bubble
  // length.
  const bubbleClass = `${styles.msg} ${who === 'user' ? styles.msgUser : styles.msgBot} ${rtl ? styles.msgRtl : ''}`;
  const deleteRowClass = `${styles.deleteRow} ${who === 'user' ? styles.deleteRowUser : styles.deleteRowBot}`;
  return (
    <div className={styles.bubbleGroup}>
      <div className={bubbleClass}>{text}</div>
      {(deleteControls || onReport) && (
        <div className={deleteRowClass}>
          {onReport && (
            <button
              type="button"
              className={styles.deleteIcon}
              onClick={onReport}
              title="Report a bug on this message"
            >
              🐞
            </button>
          )}
          {deleteControls && (
            <>
              <button
                type="button"
                className={styles.deleteIcon}
                onClick={onDeleteSelf}
                title="Delete this message"
              >
                🗑
              </button>
              <button
                type="button"
                className={styles.deleteIcon}
                onClick={onDeleteFromHere}
                title="Delete from here down"
              >
                🗑↓
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TurnTimeline({ turn, onExpand }: { turn: Turn; onExpand: () => void }) {
  useEffect(() => {
    if (!turn.runsLoaded && turn.runs.length === 0) onExpand();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.id]);

  if (turn.runs.length === 0) return null;
  return <AddonRunTimeline runs={turn.runs} />;
}

// TODO(builder): `DynamicTrail` was added in the recent builder merge but is never
// rendered, so `tsc --noUnusedLocals` fails the whole client build. Commented out
// (not deleted) to unblock the build + zolstock deploy — wire it in where intended
// or remove it. Preserved verbatim below.
//
// /**
//  * Live trail of `{{dynamic:NAME}}` resolutions for this turn — one
//  * quiet line per switch that the assembler fired, so the user can
//  * see which case loaded and (on hover) the actual text that landed
//  * in the prompt. Renders between the addon-run timeline and the
//  * assistant bubble.
//  */
// function DynamicTrail({ resolutions }: { resolutions: DynamicResolution[] }) {
//   return (
//     <div className={styles.dynamicTrail}>
//       {resolutions.map((r, i) => (
//         <div
//           key={`${r.fieldName}-${r.section ?? '_u'}-${r.matched ?? '_none'}-${i}`}
//           className={styles.dynamicTrailRow}
//           title={r.text || 'No text — fallback was empty.'}
//         >
//           🎯 <span className={styles.dynamicTrailField}>{r.fieldName}</span>
//           {r.section !== null && (
//             <> : <span className={styles.dynamicTrailField}>{r.section}</span></>
//           )}
//           {r.matched !== null ? (
//             <> = <span className={styles.dynamicTrailValue}>{r.matched}</span></>
//           ) : (
//             <> · <span className={styles.dynamicTrailFallback}>fallback</span></>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }
