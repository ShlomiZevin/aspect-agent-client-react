import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatContext } from './ChatContext';
import type { Message } from '../types/chat';
import { useAgentContext } from './AgentContext';
import {
  sendFreedaMessage,
  getOrCreateSessionId,
  resetSession,
  type FreedaMessage,
} from '../services/freedaNextService';

/**
 * Drop-in replacement for ChatProvider that drives the SAME standard chat UI
 * (AppLayout + ChatContainer + Message + ChatInput) but talks to the Freeda 1.0
 * engine via the synchronous `freedaChat` API instead of the v2 server.
 *
 * It provides the full ChatContextValue shape; everything debug / crew /
 * profiler / phone-linking related is a safe no-op (this surface runs in
 * restrictedMode, so those UIs never render).
 */

let idCounter = 0;
const newMessageId = () => `fn_${Date.now()}_${idCounter++}`;

// Map a Freeda 1.0 outgoing message onto a standard assistant Message.
// - text    -> markdown content
// - image   -> markdown image so ReactMarkdown renders it
// - buttons -> append [buttons: a | b] markup that Message renders as buttons
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
  const sessionRef = useRef<string>(getOrCreateSessionId());
  const startedRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callEngine = useCallback(
    async (payload: { text?: string; buttonId?: string; buttonTitle?: string }) => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await sendFreedaMessage({ sessionId: sessionRef.current, ...payload });
        const bot = res.messages.map(toAssistantMessage).filter((m): m is Message => m !== null);
        if (bot.length) setMessages((prev) => [...prev, ...bot]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, options?: { hidden?: boolean }) => {
      if (!text.trim() || isLoading) return;
      setHasStartedChat(true);
      if (!options?.hidden) {
        setMessages((prev) => [
          ...prev,
          { id: newMessageId(), role: 'user', content: text, timestamp: new Date() },
        ]);
      }
      await callEngine({ text });
    },
    [isLoading, callEngine]
  );

  // Proactively start the conversation (Freeda 1.0 greets first), like WhatsApp.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setHasStartedChat(true);
    void callEngine({ text: 'hi' });
  }, [callEngine]);

  const newChat = useCallback(() => {
    sessionRef.current = resetSession();
    setMessages([]);
    setError(null);
    setHasStartedChat(true);
    void callEngine({ text: 'hi' });
  }, [callEngine]);

  const deleteMessagesFrom = useCallback(async (messageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      return idx === -1 ? prev : prev.slice(0, idx);
    });
  }, []);

  const noop = useCallback(() => {}, []);
  const asyncNoop = useCallback(async () => {}, []);

  const value = {
    // Chat state
    messages,
    isLoading,
    isThinking: false,
    currentThinkingStep: '',
    thinkingSteps: [],
    hasStartedChat,
    error,
    sendMessage,
    loadHistory: async () => ({ currentCrewMember: null, metadata: null }),
    newChat,
    clearError: () => setError(null),
    deleteMessage: async () => {},
    deleteMessagesFrom,
    addDeveloperMessage: asyncNoop,

    // Conversation state
    conversationId: sessionRef.current,
    conversations: [],
    conversationMetadata: null,
    createNewChat: () => {
      newChat();
      return sessionRef.current;
    },
    switchToChat: async () => {},
    deleteChat: asyncNoop,
    deleteAllChats: asyncNoop,
    duplicateChat: asyncNoop,
    updateTitle: asyncNoop,
    updateChatTitle: asyncNoop,
    loadConversations: asyncNoop,

    // Crew state (none)
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

    // Debug (off)
    debugMode: false,
    toggleDebug: noop,
    selectedMessageIds: new Set<string>(),
    toggleMessageSelect: noop,
    clearMessageSelection: noop,
    copyMessages: noop,
    copyFromMessage: noop,

    // Config
    agentName: config.agentName,
    baseURL: config.baseURL,

    // Prompt/model overrides (debug only — no-op)
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

    // Fields / context editors (off)
    isFieldsEditorOpen: false,
    setFieldsEditorOpen: noop,
    canShowFieldsEditor: false,
    isContextEditorOpen: false,
    setContextEditorOpen: noop,
    injectTransitionPrompt: asyncNoop,
    fieldsRefreshKey: 0,

    // Profiler (off)
    profileData: null,
    profilerLastRaw: null,
    profilerFreshStart: true,
    setProfilerFreshStart: noop,
    profilerEnabled: false,
    setProfilerEnabled: noop,
    rerunProfiler: asyncNoop,

    // Theme
    selectedTheme,
    setSelectedTheme,

    // Restricted (outside user) — hides admin/dev UI
    restrictedMode: true,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
