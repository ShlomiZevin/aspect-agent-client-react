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
import styles from './ChatPanel.module.css';

/**
 * A "turn" pairs a user message with the assistant's response and
 * the addon runs that produced it. `userMessageId` /
 * `assistantMessageId` are server-side ids — set once the SSE
 * round-trip is done (live) or at load time (historical).
 */
/**
 * One dynamic-context resolution surfaced for this turn. Populated
 * from the server's `dynamic.resolved` SSE events so the user can see
 * which switch fired and which case matched live in the chat.
 */
interface DynamicResolution {
  fieldName: string;
  matched: string | null; // null = fell through to fallback / empty
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
  dynamicResolutions: DynamicResolution[];
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
        dynamicResolutions: [],
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
        dynamicResolutions: [],
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
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationIdLocal] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [convList, setConvList] = useState<ConversationListItem[]>([]);

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
    setBusy(true);
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
      setBusy(false);
    }
  }, [slug, setConversationId, convList]);

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
      const fresh: AddonRunSnapshot = { pluginId: 'unknown', status: 'running', ...partial };
      return { ...turn, runs: [...turn.runs, fresh] };
    }
    const merged = { ...turn.runs[idx], ...partial };
    return { ...turn, runs: turn.runs.map((r, i) => (i === idx ? merged : r)) };
  };

  const handleEvent = (e: RuntimeEvent) => {
    switch (e.type) {
      case 'conversation':
        setConversationId(e.conversationId);
        updateLastTurn(t => ({ ...t, userMessageId: e.messageId }));
        if (e.currentCrewId !== undefined) setCurrentCrewId(e.currentCrewId);
        return;
      case 'addon.start':
        updateLastTurn(t => upsertRun(t, {
          instanceId: e.instanceId,
          pluginId:   e.pluginId,
          label:      e.label,
          modelLabel: e.modelLabel ?? null,
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
        updateLastTurn(t => ({ ...t, assistantText: t.assistantText + e.token }));
        return;
      case 'addon.output':
        updateLastTurn(t => upsertRun(t, {
          instanceId:   e.instanceId,
          label:        e.label,
          modelLabel:   e.modelLabel ?? null,
          status:       'success',
          rawOutput:    e.rawOutput,
          parsedOutput: e.parsedOutput,
          memoryWrites: e.memoryWrites,
          parseError:   e.parseError,
          transition:   e.transition,
          broke:        e.broke,
          durationMs:   e.durationMs,
          firstTokenMs: e.firstTokenMs,
        }));
        // Live-merge any memory writes from this addon into the local
        // cache so the FieldsPanel updates the green value chip the
        // moment the extractor finishes — long before the talker
        // streams a response. Reconciled by refreshConversationMemory
        // at 'done'.
        if (e.memoryWrites && e.memoryWrites.length > 0) {
          applyLocalMemoryWrites(e.memoryWrites);
        }
        // A transition fired — the server already wrote it to
        // metadata. Surface the new crew in the header dropdown so
        // the user sees the handoff land in real time.
        if (e.transition?.to) setCurrentCrewId(e.transition.to);
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
        updateLastTurn(t => ({
          ...t,
          assistantText:       e.text,
          assistantMessageId:  e.messageId,
          runsLoaded:          true,
        }));
        return;
      case 'dynamic.resolved':
        // Append one resolution per server event. We de-dup by
        // fieldName + matched so the same DC resolving twice in one
        // turn (e.g. referenced in both Talker and Thinker prompts)
        // shows once rather than twice.
        updateLastTurn(t => {
          const existing = t.dynamicResolutions ?? [];
          const dedupKey = `${e.fieldName}::${e.matched ?? ''}`;
          if (existing.some(r => `${r.fieldName}::${r.matched ?? ''}` === dedupKey)) return t;
          return {
            ...t,
            dynamicResolutions: [
              ...existing,
              { fieldName: e.fieldName, matched: e.matched, text: e.text },
            ],
          };
        });
        return;
      case 'done':
        refreshConversationMemory();
        reloadConvList();
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
        userMessageId: null,
        assistantText: '',
        assistantMessageId: null,
        runs: [],
        runsLoaded: false,
        dynamicResolutions: [],
      };
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

      await sendRuntimeMessage({
        agentSlug:      slug,
        conversationId: convId,
        ownerUserId,
        userMessage:    text,
        version:        'viewing',
        overrideCrewId: currentCrewId,
        ...(liveAgent ? { overrideAgentBody: bodyOfAgent(liveAgent) } : {}),
        ...(liveCrew  ? { overrideCrewBody:  bodyOfCrew(liveCrew)   } : {}),
        onEvent:        handleEvent,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusy(false);
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
              disabled={busy}
            >
              {headerCrews.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <div className={styles.crewBadge}>No crew selected</div>
          )}
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
        />

        <div className={styles.messages} ref={messagesRef} onScroll={onMessagesScroll}>
          {turns.length === 0 && !busy && (
            <div className={styles.intro}>
              <p>Try the agent as your end user would.</p>
            </div>
          )}

          {turns.map(t => (
            <Turn
              key={t.id}
              turn={t}
              rtl={settings.rtl}
              onExpand={() => loadRunsForTurn(t)}
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

interface TurnProps {
  turn: Turn;
  rtl: boolean;
  onExpand: () => void;
  onDeleteSelf: () => void;
  onDeleteFromHere: () => void;
}

function Turn({ turn, rtl, onExpand, onDeleteSelf, onDeleteFromHere }: TurnProps) {
  const canDelete = turn.userMessageId !== null || turn.assistantMessageId !== null;
  const showRuns = turn.runs.length > 0 || (turn.assistantMessageId !== null && !turn.runsLoaded);
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
      {turn.dynamicResolutions && turn.dynamicResolutions.length > 0 && (
        <DynamicTrail resolutions={turn.dynamicResolutions} />
      )}
      {turn.assistantText && (
        <Bubble
          text={turn.assistantText}
          who="bot"
          rtl={rtl}
          deleteControls={canDelete}
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
  onDeleteSelf: () => void;
  onDeleteFromHere: () => void;
}

function Bubble({ text, who, rtl, deleteControls, onDeleteSelf, onDeleteFromHere }: BubbleProps) {
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
      {deleteControls && (
        <div className={deleteRowClass}>
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

/**
 * Live trail of `{{dynamic:NAME}}` resolutions for this turn — one
 * quiet line per switch that the assembler fired, so the user can
 * see which case loaded and (on hover) the actual text that landed
 * in the prompt. Renders between the addon-run timeline and the
 * assistant bubble.
 */
function DynamicTrail({ resolutions }: { resolutions: DynamicResolution[] }) {
  return (
    <div className={styles.dynamicTrail}>
      {resolutions.map((r, i) => (
        <div
          key={`${r.fieldName}-${r.matched ?? '_none'}-${i}`}
          className={styles.dynamicTrailRow}
          title={r.text || 'No text — fallback was empty.'}
        >
          🎯 <span className={styles.dynamicTrailField}>{r.fieldName}</span>
          {r.matched !== null ? (
            <> = <span className={styles.dynamicTrailValue}>{r.matched}</span></>
          ) : (
            <> · <span className={styles.dynamicTrailFallback}>fallback</span></>
          )}
        </div>
      ))}
    </div>
  );
}
