/**
 * Embeddable chat popup opened by the floating orb. Docked flush to the
 * bottom-right corner of the viewport (per design) and user-resizable via a
 * drag handle on its top-left corner (min size enforced, grows from there).
 * The expand button (⤢) does NOT navigate away to a separate route — it
 * grows this same panel in place to fill the content area under the current
 * page's header (mockup turn 2c: "expanded to full window under the
 * header"), collapsing back to the windowed size on a second click. Some
 * chrome only makes sense in one mode: the resize handle and floating
 * rounded corner disappear while expanded (there's nothing left to drag or
 * float above), matching 2c's flush full-width panel.
 *
 * Two phases, to get a pixel-accurate match to the design (turn 2b) without
 * touching the real chat's own components/CSS:
 *  1. No conversation yet — bespoke ChatWelcome (hero + quick-question tiles
 *     + input), built fresh to match the mockup exactly.
 *  2. A message was sent — switches to an iframe of
 *     /:datasetId/chat-widget/conversations/:id (AgentChatWidgetPage: same
 *     provider stack/storagePrefix as the dataset's own real page, so the
 *     same conversation/history). The clicked/typed question is handed off
 *     via sessionStorage (see PREFILL_STORAGE_KEY in AgentChatWidgetPage) so
 *     it gets auto-sent into the real conversation instead of making the
 *     user re-click the same question again inside the iframe.
 *
 * `open` toggles visibility rather than unmounting, so the conversation
 * survives close→reopen within the same browser session.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatWelcome } from './ChatWelcome';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { PREFILL_STORAGE_KEY, SCOPE_STORAGE_KEY } from '../../pages/AgentChatWidgetPage';
import { useLanguage } from '../../context/LanguageContext';
import type { ModuleScope } from '../../services/chatService';
import styles from './ChatWidget.module.css';

interface Props {
  datasetId: string;
  open: boolean;
  onClose: () => void;
  /** Height of the page's own header, so the expanded panel sits flush under it instead of covering it. */
  headerHeight: number;
  /** Controlled by the shell (not internal state) so the URL/nav stay in sync with expand/collapse from either the "Data Chat" nav or this widget's own expand button. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Set by the shell (e.g. "Ask a follow-up in chat" on an insight detail
   * page) to start a brand-new conversation with this question, the same way
   * a ChatWelcome quick-question tile does. Consumed once then cleared via
   * onPendingQuestionConsumed so it doesn't re-fire on a later re-render. */
  pendingQuestion?: string | null;
  onPendingQuestionConsumed?: () => void;
  /** Set by the shell when a module surface (e.g. Smart Tune on the
   * Procurement page) opens a SCOPED conversation: a fresh conversation is
   * started and the scope handed to the iframe the same way a prefill
   * question is. Consumed once then cleared via onPendingScopeConsumed. */
  pendingScope?: ModuleScope | null;
  onPendingScopeConsumed?: () => void;
}

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;
const DEFAULT_SIZE = { width: 800, height: 620 };
const SIZE_KEY = 'aspect_intelligence_chat_size';
const HISTORY_WIDTH = 270;

function loadSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return DEFAULT_SIZE;
    const parsed = JSON.parse(raw);
    return {
      width: Math.max(MIN_WIDTH, parsed.width || DEFAULT_SIZE.width),
      height: Math.max(MIN_HEIGHT, parsed.height || DEFAULT_SIZE.height),
    };
  } catch {
    return DEFAULT_SIZE;
  }
}

/** < 640px — the phone layout, where the widget fills the viewport and the
 *  history panel can only be a full-screen overlay, never a side column. */
function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const on = () => setMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return mobile;
}

export function ChatWidget({ datasetId, open, onClose, headerHeight, expanded, onExpandedChange, pendingQuestion, onPendingQuestionConsumed, pendingScope, onPendingScopeConsumed }: Props) {
  const { t } = useLanguage();
  const mobile = useIsMobile();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Expanded mode has room for the sidebar by default, matching mockup 2c — but
  // on a phone there is no "beside", so it stays closed until the ☰ button
  // opens it as a full-screen overlay (see the CSS).
  useEffect(() => { if (expanded && !mobile) setHistoryOpen(true); }, [expanded, mobile]);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [size, setSize] = useState(loadSize);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  useEffect(() => { if (open) setRefreshKey(k => k + 1); }, [open]);

  const onResizeMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const width = Math.min(window.innerWidth, Math.max(MIN_WIDTH, drag.startW - (e.clientX - drag.startX)));
    const height = Math.min(window.innerHeight, Math.max(MIN_HEIGHT, drag.startH - (e.clientY - drag.startY)));
    setSize({ width, height });
  }, []);

  const onResizeUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeUp);
    setSize(s => { localStorage.setItem(SIZE_KEY, JSON.stringify(s)); return s; });
  }, [onResizeMove]);

  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: size.width, startH: size.height };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
  };

  // A prefill that never got consumed (widget closed mid-handoff, a failed
  // mount) must not hijack the NEXT conversation opened — clearing it here is
  // what keeps a stale question from auto-sending into an old thread.
  const selectConversation = (id: string) => {
    sessionStorage.removeItem(PREFILL_STORAGE_KEY);
    setConversationId(id);
    if (mobile) setHistoryOpen(false); // the overlay covered the chat — get back to it
  };
  // "New chat" shows the WIDGET'S OWN welcome (hero + styled tiles), not an
  // empty iframe: mounting a fresh uuid rendered the real chat's generic
  // emoji welcome — a different visual identity from the screen the user was
  // just on. The conversation id is only minted when they actually SEND.
  const newConversation = () => {
    sessionStorage.removeItem(PREFILL_STORAGE_KEY);
    setConversationId(null);
    if (mobile) setHistoryOpen(false);
  };
  const send = (question: string) => {
    sessionStorage.setItem(PREFILL_STORAGE_KEY, question);
    setConversationId(crypto.randomUUID());
  };

  // The conversation frame gets a KEY (fresh iframe per conversation — the
  // old document must not stay painted under the new one) and a veil until
  // its load event: without both, switching conversations showed the previous
  // chat for a beat, then a flash of unthemed content. The veil lives in the
  // PARENT document, where the shell's tokens exist. "Loaded" is DERIVED
  // (which conversation's load event fired vs which is current), so switching
  // resets it with no effect involved.
  const [frameLoadedFor, setFrameLoadedFor] = useState<string | null>(null);
  const frameLoaded = frameLoadedFor === conversationId;

  // "Ask a follow-up in chat" (insight detail page) hands off a question
  // this way instead of calling send() directly — the widget may not even
  // be mounted yet at the moment the shell decides to open it.
  useEffect(() => {
    if (!pendingQuestion) return;
    send(pendingQuestion);
    onPendingQuestionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  // A module surface opened a SCOPED conversation (Smart Tune). Same handoff
  // shape as prefill: write to sessionStorage, mount the iframe on a fresh
  // conversation id. The handoff is BOUND to that id, so a later plain
  // conversation in the same iframe cannot inherit the scope.
  useEffect(() => {
    if (!pendingScope) return;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify({ scope: pendingScope, forConversation: id }));
    setConversationId(id);
    onPendingScopeConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScope]);
  // Mockup 2c's expanded header shows a back arrow instead of the hamburger
  // (the history sidebar is always visible while expanded, nothing to
  // toggle) — it leaves the current conversation and returns to the welcome
  // screen, distinct from the corner icon which shrinks back to windowed.
  const backToWelcome = () => setConversationId(null);

  const started = conversationId !== null;
  const src = conversationId ? `/${datasetId}/chat-widget/conversations/${conversationId}` : '';

  const panelStyle: React.CSSProperties = expanded
    ? { display: open ? 'flex' : 'none', top: headerHeight, right: 0, left: 0, bottom: 0, width: 'auto', height: 'auto' }
    : { display: open ? 'flex' : 'none', width: size.width + (historyOpen ? HISTORY_WIDTH : 0), height: size.height };

  return (
    <div className={`${styles.panel} ${expanded ? styles.panelExpanded : ''}`} style={panelStyle}>
      {!expanded && <div className={styles.resizeHandle} onMouseDown={onResizeDown} title="Drag to resize" />}
      <div className={styles.body}>
        {historyOpen && (
          <ChatHistoryPanel
            datasetId={datasetId}
            activeConversationId={conversationId}
            onSelect={selectConversation}
            onNew={newConversation}
            refreshKey={refreshKey}
            variant={expanded ? 'expanded' : 'docked'}
            onActiveTitleChange={setActiveTitle}
            onClose={mobile ? () => setHistoryOpen(false) : undefined}
          />
        )}
        <div className={styles.chatCol}>
          {!mobile && expanded && started ? (
            <div className={styles.headExpanded}>
              <button className={styles.backBtn} onClick={backToWelcome} aria-label={t('intel.chat.backToWelcome')} title={t('intel.chat.back')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 4l-7 8 7 8" /></svg>
              </button>
              <span className={styles.headExpandedTitle}>{activeTitle || t('intel.nav.chat')}</span>
              {/* No sync-info line here (unlike the mockup's isolated
                  illustration): this widget sits under the Aspect
                  Intelligence page's own header, whose breadcrumb row
                  already shows the identical "Last sync / Data through"
                  text — repeating it here would just be the same two dates
                  printed twice on screen at once. .collapseBtn pushes
                  itself to the right instead (margin-left: auto). */}
              <button className={`${styles.iconBtn} ${styles.collapseBtn}`} onClick={() => onExpandedChange(false)} aria-label={t('intel.chat.collapseChat')} title={t('intel.chat.collapse')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7.5 7.5M3 21l7.5-7.5" /></svg>
              </button>
            </div>
          ) : (
            <div className={styles.head}>
              <button className={`${styles.iconBtn} ${historyOpen ? styles.iconBtnActive : ''}`} onClick={() => setHistoryOpen(o => !o)} aria-label={t('intel.chat.toggleHistory')} title={t('intel.chat.toggleHistory')}>☰</button>
              <span className={styles.headMark}>✦</span>
              <span className={styles.headTitle}>{t('intel.nav.chat')}</span>
              <div className={styles.headActions}>
                <button className={styles.iconBtn} onClick={() => onExpandedChange(!expanded)} aria-label={expanded ? t('intel.chat.collapseChat') : t('intel.chat.expandChat')} title={expanded ? t('intel.chat.collapse') : t('intel.chat.expand')}>
                  {expanded ? '⤡' : '⤢'}
                </button>
                <button className={styles.iconBtn} onClick={onClose} aria-label={t('intel.chat.closeChat')} title={t('intel.chat.minimize')}>−</button>
              </div>
            </div>
          )}
          {started
            ? (
              <div className={styles.frameWrap}>
                <iframe
                  key={conversationId}
                  className={styles.frame}
                  src={src}
                  title={t('intel.nav.chat')}
                  onLoad={() => setFrameLoadedFor(conversationId)}
                  style={{ visibility: frameLoaded ? 'visible' : 'hidden' }}
                />
                {!frameLoaded && (
                  <div className={styles.frameVeil} aria-hidden="true">
                    <span className={styles.frameSpinner} />
                  </div>
                )}
              </div>
            )
            : <ChatWelcome datasetId={datasetId} onSend={send} />}
        </div>
      </div>
    </div>
  );
}
