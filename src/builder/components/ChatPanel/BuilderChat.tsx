/**
 * BuilderChat — talk to Alfred, the in-builder AI helper.
 *
 * P5.1: brainstorm-only. Real streaming chat with persistent history,
 * but no proposal cards / Apply / spec editing yet (those land in
 * P5.2 + P5.3).
 *
 * Model is fixed to Claude Sonnet 4.6 (BUILDER_HELPER_MODEL). The
 * server enforces this; the badge in the header just shows it.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { BUILDER_HELPER_MODEL, formatModelRef } from '../../registry/providerModels';
import { useModels } from '../../registry/useModels';
import {
  createAlfredChat,
  deleteAlfredChat,
  fetchAlfredMessages,
  listAlfredChats,
  renameAlfredChat,
  type AlfredChatListItem,
  type AlfredMessage,
} from '../../state/builderApi';
import { sendAlfredMessage, type AlfredEvent } from '../../state/alfredStream';
import { HistoryPanel } from './HistoryPanel';
import { ChatSettingsPopover, useChatSettings } from './ChatSettings';
import { MarkdownBody } from './MarkdownBody';
import { ApplyPreviewModal } from '../ApplyModal/ApplyPreviewModal';
import styles from './ChatPanel.module.css';

interface Msg {
  /** Server id once known; null for the optimistic local row. */
  id: number | null;
  role: 'user' | 'assistant';
  text: string;
}

function findOwnerUserId(): string {
  try {
    return localStorage.getItem('builder:ownerUserId') || 'anon';
  } catch {
    return 'anon';
  }
}

function fromServer(m: AlfredMessage): Msg | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  return { id: m.id, role: m.role, text: m.content };
}

export function BuilderChat() {
  useModels();
  const { doc } = useBuilder();

  const slug = doc.agents[0]?.slug ?? '';
  const ownerUserId = findOwnerUserId();

  const [chatId, setChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chats, setChats] = useState<AlfredChatListItem[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [settings, setSetting] = useChatSettings();

  const messagesRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const wasAtBottomRef = useRef(true);

  // Auto-scroll: keep glued to bottom unless user scrolls up.
  useLayoutEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    if (wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onMessagesScroll = () => {
    const el = messagesRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const reloadChatList = useCallback(async () => {
    if (!slug) return [] as AlfredChatListItem[];
    try {
      const list = await listAlfredChats({ agentSlug: slug, ownerUserId });
      setChats(list);
      return list;
    } catch (err) {
      console.warn('[alfred] list chats failed:', err);
      return [];
    }
  }, [slug, ownerUserId]);

  const loadChat = useCallback(async (id: number) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const msgs = await fetchAlfredMessages(id);
      setMessages(msgs.map(fromServer).filter((m): m is Msg => m !== null));
      setChatId(id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setBusy(false);
    }
  }, []);

  // Load chat list on mount / when slug changes. Auto-open the most
  // recent chat so returning users land back in their last brainstorm
  // instead of an empty pane.
  useEffect(() => {
    setChatId(null);
    setMessages([]);
    setChats([]);
    setErrorMsg(null);
    let cancelled = false;
    (async () => {
      const list = await reloadChatList();
      if (cancelled) return;
      if (list.length > 0) await loadChat(list[0].id);
    })();
    return () => { cancelled = true; };
  }, [slug, reloadChatList, loadChat]);

  const updateLast = (mut: (msg: Msg) => Msg) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), mut(last)];
    });
  };

  const handleEvent = (e: AlfredEvent) => {
    switch (e.type) {
      case 'conversation':
        setChatId(e.chatId);
        return;
      case 'alfred.start':
        // Open an empty assistant bubble — id stays null until the
        // final `alfred.message` carries the persisted row id. Token
        // events stream into the last bubble in the list.
        setMessages(prev => [...prev, { id: null, role: 'assistant', text: '' }]);
        return;
      case 'alfred.token':
        updateLast(m => ({ ...m, text: m.text + e.token }));
        return;
      case 'alfred.message':
        // Final text (server-side full string) — replaces the streamed
        // accumulation in case anything got dropped.
        updateLast(m => ({ ...m, id: e.messageId, text: e.text }));
        return;
      case 'alfred.error':
        setErrorMsg(e.error.message || 'Alfred ran into a problem');
        return;
      case 'done':
        reloadChatList();
        return;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !slug) return;
    setErrorMsg(null);
    setBusy(true);
    setInput('');

    try {
      // Lazy-create the chat on first send. Avoids empty rows piling
      // up if the user opens BuilderChat without ever typing.
      let id = chatId;
      if (id === null) {
        const created = await createAlfredChat({ agentSlug: slug, ownerUserId });
        id = created.chatId;
        setChatId(id);
      }

      setMessages(prev => [...prev, { id: null, role: 'user', text }]);
      wasAtBottomRef.current = true;

      await sendAlfredMessage({
        chatId:      id,
        agentSlug:   slug,
        ownerUserId,
        userMessage: text,
        onEvent:     handleEvent,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setBusy(false);
    }
  };

  const onNewChat = () => {
    setChatId(null);
    setMessages([]);
    setErrorMsg(null);
    setHistoryOpen(false);
  };

  const onPickChat = (id: number) => {
    setHistoryOpen(false);
    if (id !== chatId) loadChat(id);
  };

  const onRenameChat = async (id: number, name: string) => {
    try {
      await renameAlfredChat({ chatId: id, name });
      setChats(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const onDeleteChat = async (id: number) => {
    try {
      await deleteAlfredChat(id);
      setChats(prev => prev.filter(c => c.id !== id));
      if (id === chatId) onNewChat();
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
            title="Chat history"
          >
            📂 <span className={styles.headerBtnLabel}>History</span>
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={onNewChat}
            title="New chat"
            disabled={messages.length === 0 && chatId === null}
          >
            ＋ <span className={styles.headerBtnLabel}>New</span>
          </button>
          <div className={styles.headerSpacer} />
          <button
            type="button"
            className={styles.applyBtn}
            onClick={() => setApplyOpen(true)}
            disabled={!chatId || messages.length === 0 || busy}
            title={
              !chatId || messages.length === 0
                ? 'Send Alfred a message first'
                : 'Apply the changes you and Alfred have agreed on'
            }
          >
            ✨ Apply
          </button>
          <div className={styles.settingsWrap}>
            <button
              type="button"
              ref={settingsBtnRef}
              className={`${styles.headerBtn} ${settingsOpen ? styles.headerBtnActive : ''}`}
              onClick={() => setSettingsOpen(o => !o)}
              title={`Settings · model: ${formatModelRef(BUILDER_HELPER_MODEL)}`}
            >
              ⚙
            </button>
            <ChatSettingsPopover
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              triggerRef={settingsBtnRef}
              settings={settings}
              onChange={setSetting}
              modelLabel={formatModelRef(BUILDER_HELPER_MODEL)}
            />
          </div>
        </div>
      </div>

      <div className={styles.chatBody}>
        <HistoryPanel
          open={historyOpen}
          conversations={chats}
          activeId={chatId}
          onClose={() => setHistoryOpen(false)}
          onPick={onPickChat}
          onNew={onNewChat}
          onRename={onRenameChat}
          onDelete={onDeleteChat}
        />

        <div className={styles.messages} ref={messagesRef} onScroll={onMessagesScroll}>
          {messages.length === 0 && !busy && (
            <div className={styles.intro}>
              <p>
                I see your project, persona, crews, and fields. Tell me what you
                want to design or refine — I'll think out loud with you.
              </p>
            </div>
          )}

          {messages.map((m, i) => {
            const cls = `${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot} ${settings.rtl ? styles.msgRtl : ''}`;
            const placeholder = m.role === 'assistant' && busy ? '…' : '';
            return (
              <div key={m.id ?? `local_${i}`} className={cls}>
                {m.role === 'assistant'
                  ? (m.text ? <MarkdownBody text={m.text} /> : placeholder)
                  : (m.text || placeholder)}
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && <div className={styles.errorChip}>{errorMsg}</div>}

      {chatId !== null && (
        <ApplyPreviewModal
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          chatId={chatId}
          agentSlug={slug}
          ownerUserId={ownerUserId}
        />
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
          placeholder="Brainstorm with Alfred…"
          rows={2}
          disabled={busy}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={send}
          disabled={busy || !input.trim()}
        >
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
