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
interface Turn {
  id: string;
  userText: string;
  userMessageId: number | null;
  assistantText: string;
  assistantMessageId: number | null;
  runs: AddonRunSnapshot[];
  runsLoaded: boolean;
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
      });
      i += 1;
    } else {
      i += 1;
    }
  }
  return turns;
}

function snapshotFromPersisted(r: PersistedAddonRun): AddonRunSnapshot {
  const d = r.runData || {};
  return {
    instanceId:   r.instanceId,
    pluginId:     r.pluginId,
    label:        d.label,
    status:       r.status,
    prompt:       d.prompt,
    rawOutput:    d.rawOutput,
    parsedOutput: d.parsedOutput,
    memoryWrites: d.memoryWrites,
    parseError:   d.parseError,
    durationMs:   r.durationMs ?? d.durationMs,
  };
}

export function UserChat() {
  const { doc, isCrewDirty, isAgentDirty, setPreviewConversationId, refreshConversationMemory } = useBuilder();
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
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setBusy(false);
    }
  }, [slug, setConversationId]);

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
        updateLastTurn(t => ({ ...t, assistantText: t.assistantText + e.token }));
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
        updateLastTurn(t => ({
          ...t,
          assistantText:       e.text,
          assistantMessageId:  e.messageId,
          runsLoaded:          true,
        }));
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
          <div className={styles.crewBadge}>{crew ? crew.name : 'No crew selected'}</div>
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
          ⚠️ {dirtyLabel} — Save first to include them in the next run.
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
