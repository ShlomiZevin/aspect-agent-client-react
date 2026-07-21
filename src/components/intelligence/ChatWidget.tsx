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
 *     /hypertoy/chat-widget/conversations/:id (HyperToyChatWidgetPage: same
 *     provider stack/storagePrefix as the real /hypertoy page, so the same
 *     conversation/history). The clicked/typed question is handed off via
 *     sessionStorage (see PREFILL_STORAGE_KEY in HyperToyChatWidgetPage) so
 *     it gets auto-sent into the real conversation instead of making the
 *     user re-click the same question again inside the iframe.
 *
 * `open` toggles visibility rather than unmounting, so the conversation
 * survives close→reopen within the same browser session.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatWelcome } from './ChatWelcome';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import { PREFILL_STORAGE_KEY } from '../../pages/HyperToyChatWidgetPage';
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

export function ChatWidget({ datasetId, open, onClose, headerHeight, expanded, onExpandedChange, pendingQuestion, onPendingQuestionConsumed }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);

  // Expanded mode has room for the sidebar by default, matching mockup 2c.
  useEffect(() => { if (expanded) setHistoryOpen(true); }, [expanded]);

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

  const selectConversation = (id: string) => setConversationId(id);
  const newConversation = () => setConversationId(crypto.randomUUID());
  const send = (question: string) => {
    sessionStorage.setItem(PREFILL_STORAGE_KEY, question);
    setConversationId(crypto.randomUUID());
  };

  // "Ask a follow-up in chat" (insight detail page) hands off a question
  // this way instead of calling send() directly — the widget may not even
  // be mounted yet at the moment the shell decides to open it.
  useEffect(() => {
    if (!pendingQuestion) return;
    send(pendingQuestion);
    onPendingQuestionConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);
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
            activeConversationId={conversationId}
            onSelect={selectConversation}
            onNew={newConversation}
            refreshKey={refreshKey}
            variant={expanded ? 'expanded' : 'docked'}
            onActiveTitleChange={setActiveTitle}
          />
        )}
        <div className={styles.chatCol}>
          {expanded && started ? (
            <div className={styles.headExpanded}>
              <button className={styles.backBtn} onClick={backToWelcome} aria-label="Back to welcome" title="Back">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 4l-7 8 7 8" /></svg>
              </button>
              <span className={styles.headExpandedTitle}>{activeTitle || 'Data Chat'}</span>
              {/* No sync-info line here (unlike the mockup's isolated
                  illustration): this widget sits under the Aspect
                  Intelligence page's own header, whose breadcrumb row
                  already shows the identical "Last sync / Data through"
                  text — repeating it here would just be the same two dates
                  printed twice on screen at once. .collapseBtn pushes
                  itself to the right instead (margin-left: auto). */}
              <button className={`${styles.iconBtn} ${styles.collapseBtn}`} onClick={() => onExpandedChange(false)} aria-label="Collapse chat" title="Collapse">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7.5 7.5M3 21l7.5-7.5" /></svg>
              </button>
            </div>
          ) : (
            <div className={styles.head}>
              <button className={`${styles.iconBtn} ${historyOpen ? styles.iconBtnActive : ''}`} onClick={() => setHistoryOpen(o => !o)} aria-label="Toggle history" title="History">☰</button>
              <span className={styles.headMark}>✦</span>
              <span className={styles.headTitle}>Data Chat</span>
              <div className={styles.headActions}>
                <button className={styles.iconBtn} onClick={() => onExpandedChange(!expanded)} aria-label={expanded ? 'Collapse chat' : 'Expand chat'} title={expanded ? 'Collapse' : 'Expand'}>
                  {expanded ? '⤡' : '⤢'}
                </button>
                <button className={styles.iconBtn} onClick={onClose} aria-label="Close chat" title="Minimize">−</button>
              </div>
            </div>
          )}
          {started
            ? <iframe className={styles.frame} src={src} title="Data chat" />
            : <ChatWelcome onSend={send} />}
        </div>
      </div>
    </div>
  );
}
