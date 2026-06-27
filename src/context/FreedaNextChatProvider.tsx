import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatContext } from './ChatContext';
import type { Message, Conversation } from '../types/chat';
import type { CrewMember, CrewJourneyStep } from '../types/crew';
import { useAgentContext } from './AgentContext';
import {
  sendFreedaMessage,
  fetchFreedaHistory,
  type FreedaMessage,
  type FreedaHistoryMessage,
} from '../services/freedaNextService';

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
const stepKey = (id: string) => `freedanext:step:${id}`;
const REVEAL_DELAY_MS = 450;

let idCounter = 0;
const newMessageId = () => `fn_${Date.now()}_${idCounter++}`;
const newConversationId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- localStorage helpers --------------------------------------------------

interface StoredMsg { id: string; role: Message['role']; content: string; ts: string; crew?: string }
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
    return raw.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.ts), crewMember: m.crew }));
  } catch { return []; }
}
function saveMsgs(id: string, msgs: Message[]) {
  const raw: StoredMsg[] = msgs.map((m) => ({ id: m.id, role: m.role, content: m.content, ts: m.timestamp.toISOString(), crew: m.crewMember }));
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
  return { id: newMessageId(), role: 'assistant', content, timestamp: new Date(), crewMember: 'Freeda AI' };
}

// Map a server-side history transcript onto standard Message objects.
function historyToMessages(items: FreedaHistoryMessage[]): Message[] {
  const out: Message[] = [];
  for (const m of items) {
    if (m.role === 'user') {
      if (m.text) out.push({ id: m.id, role: 'user', content: m.text, timestamp: new Date() });
      continue;
    }
    let content = '';
    if (m.type === 'image' && m.imageUrl) {
      content = `![](${m.imageUrl})`;
    } else if (m.type === 'buttons') {
      const labels = (m.buttons ?? []).map((b) => b.title).filter(Boolean);
      content = (m.text ?? '').trim();
      if (labels.length) content += `${content ? '\n\n' : ''}[buttons: ${labels.join(' | ')}]`;
    } else {
      content = m.text ?? '';
    }
    if (content) out.push({ id: m.id, role: 'assistant', content, timestamp: new Date(), crewMember: 'Freeda AI' });
  }
  return out;
}

// ---- Freeda flow stages (rendered as the journey stepper at the top) -------
const FREEDA_STAGES = [
  { name: 'welcome', displayName: 'Welcome' },
  { name: 'about_you', displayName: 'About You' },
  { name: 'menstrual', displayName: 'Menstrual Status' },
  { name: 'symptoms', displayName: 'Symptom Check' },
  { name: 'roadmap', displayName: 'Your Roadmap' },
  { name: 'qa', displayName: 'Q&A' },
];

// Map an engine step id onto a journey stage index.
function stageIndexForStep(stepId?: string): number {
  if (!stepId) return 0;
  if (/CollectName|CollectAge|AfterName|postNameIntro/i.test(stepId)) return 1;
  if (/menstrual|stopped|tooYoung|preAssessment/i.test(stepId)) return 2;
  if (/intakeStart|Vasomotor|Emotional|Cognitive|Physical|TopSymptoms|Top3/i.test(stepId)) return 3;
  if (/Summary/i.test(stepId)) return 4;
  if (/generalAma|feedback/i.test(stepId)) return 5;
  return 0;
}

function makeCrew(stage: { name: string; displayName: string }): CrewMember {
  return {
    name: stage.name,
    displayName: stage.displayName,
    description: '',
    isDefault: false,
    model: '',
    collectFields: [],
    fieldsToCollect: [],
    transitionTo: null,
    toolCount: 0,
    hasKnowledgeBase: false,
  };
}

function buildJourney(currentIndex: number): CrewJourneyStep[] {
  return FREEDA_STAGES.map((stage, i) => ({
    crew: makeCrew(stage),
    status: i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'upcoming',
  }));
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
  const [stepIndex, setStepIndex] = useState(0);
  const [isJourneyModalOpen, setJourneyModalOpen] = useState(false);

  const convRef = useRef<string>(conversationId);
  convRef.current = conversationId;
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
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
        const idx = stageIndexForStep(res.step);
        setStepIndex(idx);
        localStorage.setItem(stepKey(id), String(idx));
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

  // Boot: restore the conversation from the URL (if any). No auto-greeting —
  // the welcome screen (quick-question tiles) shows until the user sends the
  // first message, which lazily creates the conversation.
  useEffect(() => {
    const id = urlConvId || '';
    if (bootedRef.current === id) return;
    bootedRef.current = id;

    if (!id) {
      setConversationId('');
      convRef.current = '';
      setMessages([]);
      setStepIndex(0);
      setHasStartedChat(false);
      return;
    }

    setConversationId(id);
    convRef.current = id;
    const cached = loadMsgs(id);
    setMessages(cached);
    setStepIndex(Number(localStorage.getItem(stepKey(id))) || 0);
    setHasStartedChat(cached.length > 0);

    // Pull authoritative history from the server so shared URLs / other
    // browsers / incognito restore the conversation (not just this browser).
    void (async () => {
      try {
        const hist = await fetchFreedaHistory(id);
        if (convRef.current !== id) return;
        const serverMsgs = historyToMessages(hist.messages);
        if (serverMsgs.length === 0) return;
        // Don't drop in-flight local sends (the server snapshot may be stale).
        if (serverMsgs.length < messagesRef.current.length) return;
        setMessages(serverMsgs);
        saveMsgs(id, serverMsgs);
        const idx = stageIndexForStep(hist.step);
        setStepIndex(idx);
        localStorage.setItem(stepKey(id), String(idx));
        setHasStartedChat(true);
      } catch {
        /* keep cache / welcome */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId]);

  const sendMessage = useCallback(
    async (text: string, options?: { hidden?: boolean }) => {
      if (!text.trim() || isLoading) return;
      let id = convRef.current;
      if (!id) {
        // Lazily create the conversation on the first message / tile click.
        id = newConversationId();
        convRef.current = id;
        bootedRef.current = id;
        setConversationId(id);
        navigate(`/freedanext/conversations/${id}`);
      }
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
    [isLoading, callEngine, refreshConversations, navigate]
  );

  // New chat -> back to the welcome screen (no greeting). The conversation is
  // created lazily when the user sends the first message.
  const createNewChat = useCallback(() => {
    bootedRef.current = '';
    convRef.current = '';
    setConversationId('');
    setMessages([]);
    setStepIndex(0);
    setError(null);
    setHasStartedChat(false);
    navigate('/freedanext');
    return '';
  }, [navigate]);

  const switchToChat = useCallback(
    async (id: string) => {
      navigate(`/freedanext/conversations/${id}`);
      bootedRef.current = id;
      setConversationId(id);
      convRef.current = id;
      setMessages(loadMsgs(id));
      setStepIndex(Number(localStorage.getItem(stepKey(id))) || 0);
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

    // Crew journey — show the Freeda flow stages as the top stepper
    crewMembers: FREEDA_STAGES.map(makeCrew),
    currentCrew: makeCrew(FREEDA_STAGES[stepIndex]),
    selectedOverride: null,
    setSelectedOverride: noop,
    hasCrew: true,
    journeySteps: buildJourney(stepIndex),
    isJourneyModalOpen,
    openJourneyModal: () => setJourneyModalOpen(true),
    closeJourneyModal: () => setJourneyModalOpen(false),

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
