import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatContext } from './ChatContext';
import type { Message, Conversation } from '../types/chat';
import { useAgentContext } from './AgentContext';
import { sendFreedaMessage, type FreedaMessage } from '../services/freedaNextService';

/**
 * Drop-in replacement for ChatProvider that drives the SAME standard chat UI
 * (AppLayout + ChatContainer + Message + ChatInput) but talks to the Freeda 1.0
 * engine via the synchronous `freedaChat` API.
 *
 * To match the standard chat behaviour it:
 *  - keeps the conversation id in the URL (`/freedanext/conversations/:id`),
 *  - persists message history + the conversation list in localStorage so a
 *    reload restores the chat,
 *  - shows the "thinking" indicator while the engine is working,
 *  - reveals the engine's (multi-bubble) reply with small pauses instead of
 *    dumping it all at once.
 *
 * Engine state lives server-side in Firestore keyed by the conversation id
 * (used as the freedaChat sessionId).
 */

const LIST_KEY = 'freedanext:list';
const msgsKey = (id: string) => `freedanext:msgs:${id}`;
const REVEAL_DELAY_MS = 450;

let idCounter = 0;
const newMessageId = () => `fn_${Date.now()}_${idCounter++}`;
const newConversationId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- localStorage helpers --------------------------------------------------

interface StoredMsg { id: string; role: Message['role']; content: string; ts: string }
interface StoredConv { id: string; title: string; createdAt: string; updatedAt: string }

function loadList(): StoredConv[] {
  try { return JSON.parse(localStorage.getItem(LIST_KEY) || '[]'); } catch { return []; }
}
function saveList(list: StoredConv[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list));
}
function loadMsgs(id: string): Message[] {
  try {
    const raw: StoredMsg[] = JSON.parse(localStorage.getItem(msgsKey(id)) || '[]');
    return raw.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.ts) }));
  } catch { return []; }
}
function saveMsgs(id: string, msgs: Message[]) {
  const raw: StoredMsg[] = msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, ts: m.timestamp.toISOString() }));
  localStorage.setItem(msgsKey(id), JSON.stringify(raw));
}
function upsertConv(id: string, title: string) {
  const list = loadList();
  const now = new Date().toISOString();
  const existing = list.find((c) => c.id === id);
  if (existing) {
    existing.updatedAt = now;
    if (title && (!existing.title || existing.title === 'New chat')) existing.title = title;
  } else {
    list.unshift({ id, title: title || 'New chat', createdAt: now, updatedAt: now });
  }
  list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  saveList(list);
  return list;
}

function toConversations(list: StoredConv[]): Conversation[] {
  return list.map((c) => ({
    id: c.id,
    title: c.title,
    messageCount: 0,
    createdAt: new Date(c.createdAt),
    updatedAt: new Date(c.updatedAt),
  }));
}

// Map a Freeda 1.0 outgoing message onto a standard assistant Message.
function toAssistantMessage(m: FreedaMessage): Message | null {
  let content = '';
  if (m.type === 'image' && m.imageUrl) {
    content = `![](${m.imageUrl})`;
  } else if (m.type === 'buttons') {
    const labels = (m.buttons ?? []).map((b) => b.title).filter(Boolean);
    content = (m.text ?? '').trim();
    if (labels.length) content += `${content ? '\n\n' : ''}[buttons: ${labels.join(' | ')}]`;
  } else if (m.type === 'text') {
    content = m.text ?? '';
  }
  if (!content) return null;
  return { id: newMessageId(), role: 'assistant', content, timestamp: new Date() };
}

export function FreedaNextChatProvider({ children }: { children: ReactNode }) {
  const { config, selectedTheme, setSelectedTheme } = useAgentContext();
  const navigate = useNavigate();
  const { conversationId: urlConvId } = useParams<{ conversationId: string }>();

  const [conversationId, setConversationId] = useState<string>(urlConvId || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(() => toConversations(loadList()));
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convRef = useRef<string>(conversationId);
  convRef.current = conversationId;
  const bootedRef = useRef<string | null>(null);

  const refreshConversations = useCallback((list?: StoredConv[]) => {
    setConversations(toConversations(list ?? loadList()));
  }, []);

  // Send a turn to the engine and reveal the reply with pacing.
  const callEngine = useCallback(
    async (id: string, payload: { text?: string; buttonId?: string; buttonTitle?: string }) => {
      setError(null);
      setIsThinking(true);
      setIsLoading(true);
      try {
        const res = await sendFreedaMessage({ sessionId: id, ...payload });
        setIsThinking(false);
        const bot = res.messages.map(toAssistantMessage).filter((m): m is Message => m !== null);
        for (let i = 0; i < bot.length; i++) {
          if (convRef.current !== id) break; // user switched conversations
          setMessages((prev) => {
            const next = [...prev, bot[i]];
            saveMsgs(id, next);
            return next;
          });
          if (i < bot.length - 1) await sleep(REVEAL_DELAY_MS);
        }
      } catch (e) {
        setIsThinking(false);
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Start a fresh conversation: new id, URL, greeting.
  const startConversation = useCallback(
    (id: string) => {
      setConversationId(id);
      convRef.current = id;
      setMessages([]);
      setError(null);
      setHasStartedChat(true);
      void callEngine(id, { text: 'hi' });
    },
    [callEngine]
  );

  // Boot: resolve the conversation from the URL, or create a new one.
  useEffect(() => {
    const id = urlConvId || '';

    if (!id) {
      // No conversation in the URL -> create one and navigate to it.
      if (bootedRef.current === '<creating>') return;
      bootedRef.current = '<creating>';
      navigate(`/freedanext/conversations/${newConversationId()}`, { replace: true });
      return;
    }

    if (bootedRef.current === id) return;
    bootedRef.current = id;
    setConversationId(id);
    convRef.current = id;
    const stored = loadMsgs(id);
    if (stored.length > 0) {
      setMessages(stored);
      setHasStartedChat(true);
    } else {
      startConversation(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId]);

  const sendMessage = useCallback(
    async (text: string, options?: { hidden?: boolean }) => {
      const id = convRef.current;
      if (!text.trim() || isLoading || !id) return;
      setHasStartedChat(true);
      if (!options?.hidden) {
        setMessages((prev) => {
          const next: Message[] = [...prev, { id: newMessageId(), role: 'user', content: text, timestamp: new Date() }];
          saveMsgs(id, next);
          return next;
        });
        refreshConversations(upsertConv(id, text.slice(0, 60)));
      }
      await callEngine(id, { text });
      upsertConv(id, '');
      refreshConversations();
    },
    [isLoading, callEngine, refreshConversations]
  );

  const createNewChat = useCallback(() => {
    const id = newConversationId();
    navigate(`/freedanext/conversations/${id}`);
    bootedRef.current = id;
    startConversation(id);
    return id;
  }, [navigate, startConversation]);

  const switchToChat = useCallback(
    async (id: string) => {
      navigate(`/freedanext/conversations/${id}`);
      bootedRef.current = id;
      setConversationId(id);
      convRef.current = id;
      setMessages(loadMsgs(id));
      setHasStartedChat(true);
      setError(null);
    },
    [navigate]
  );

  const deleteChat = useCallback(
    async (id: string) => {
      localStorage.removeItem(msgsKey(id));
      const list = loadList().filter((c) => c.id !== id);
      saveList(list);
      refreshConversations(list);
      if (id === convRef.current) createNewChat();
    },
    [refreshConversations, createNewChat]
  );

  const deleteAllChats = useCallback(async () => {
    for (const c of loadList()) localStorage.removeItem(msgsKey(c.id));
    saveList([]);
    refreshConversations([]);
    createNewChat();
  }, [refreshConversations, createNewChat]);

  const updateChatTitle = useCallback(async (id: string, title: string) => {
    const list = loadList();
    const c = list.find((x) => x.id === id);
    if (c) { c.title = title; saveList(list); refreshConversations(list); }
  }, [refreshConversations]);

  const deleteMessagesFrom = useCallback(async (messageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      const next = idx === -1 ? prev : prev.slice(0, idx);
      if (convRef.current) saveMsgs(convRef.current, next);
      return next;
    });
  }, []);

  const noop = useCallback(() => {}, []);
  const asyncNoop = useCallback(async () => {}, []);

  const value = {
    messages,
    isLoading,
    isThinking,
    currentThinkingStep: isThinking ? 'Message received' : '',
    thinkingSteps: [],
    hasStartedChat,
    error,
    sendMessage,
    loadHistory: async () => ({ currentCrewMember: null, metadata: null }),
    newChat: noop,
    clearError: () => setError(null),
    deleteMessage: async () => {},
    deleteMessagesFrom,
    addDeveloperMessage: asyncNoop,

    conversationId,
    conversations,
    conversationMetadata: null,
    createNewChat,
    switchToChat,
    deleteChat,
    deleteAllChats,
    duplicateChat: asyncNoop,
    updateTitle: asyncNoop,
    updateChatTitle,
    loadConversations: async () => refreshConversations(),

    // Crew (none)
    crewMembers: [],
    currentCrew: null,
    selectedOverride: null,
    setSelectedOverride: noop,
    hasCrew: false,
    journeySteps: [],
    isJourneyModalOpen: false,
    openJourneyModal: noop,
    closeJourneyModal: noop,

    // Phone linking (unused)
    linkedPhone: null,
    linkPhone: asyncNoop,
    goMobile: asyncNoop,

    // Debug (off, no shortcut wired)
    debugMode: false,
    toggleDebug: noop,
    selectedMessageIds: new Set<string>(),
    toggleMessageSelect: noop,
    clearMessageSelection: noop,
    copyMessages: noop,
    copyFromMessage: noop,

    agentName: config.agentName,
    baseURL: config.baseURL,

    setPromptOverride: noop,
    setModelOverride: noop,
    setFallbackOverride: noop,
    personaOverride: null,
    setPersonaOverride: noop,
    setKBOverride: noop,
    setThinkingPromptOverride: noop,
    setThinkingModelOverride: noop,
    thinkerDisabled: {},
    setThinkerDisabled: noop,
    setTemperatureOverride: noop,
    setTopKOverride: noop,

    isFieldsEditorOpen: false,
    setFieldsEditorOpen: noop,
    canShowFieldsEditor: false,
    isContextEditorOpen: false,
    setContextEditorOpen: noop,
    injectTransitionPrompt: asyncNoop,
    fieldsRefreshKey: 0,

    profileData: null,
    profilerLastRaw: null,
    profilerFreshStart: true,
    setProfilerFreshStart: noop,
    profilerEnabled: false,
    setProfilerEnabled: noop,
    rerunProfiler: asyncNoop,

    selectedTheme,
    setSelectedTheme,

    // Not an "outside user" surface — render the full standard chat (thinking
    // indicator, history) just like /freeda. Debug stays off (no shortcut).
    restrictedMode: false,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
