/**
 * /aspect/realestate — the real-estate demo's shell: the agent's providers,
 * the pages (brief, board) through <Outlet>, and the chat as a modal over
 * them, opened from a floating button on every page. One ChatProvider for the
 * whole shell, so the conversation survives moving between pages; urlSync off,
 * so the chat never navigates away from the page underneath it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AgentProvider, ThemeProvider, UserProvider, ChatProvider, useChatContext } from '../../context';
import { useUserContext } from '../../context/UserContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { ChatContainer } from '../../components/chat';
import { realestateConfig } from '../../agents';
import { RealEstateChatContext } from './chatContext';
import { Icon } from './ui';
import styles from './RealEstateLayout.module.css';

interface Pending { text: string; nonce: number }

/** Sends a question handed to openChat once the anonymous user exists. The
 *  callbacks go through refs so ChatProvider re-renders don't restart the timer
 *  (same reasoning as AgentChatWidgetPage's PrefillSender). */
function PendingSender({ pending, onSent }: { pending: Pending | null; onSent: () => void }) {
  const { sendMessage } = useChatContext();
  const { userId } = useUserContext();
  const sendRef = useRef(sendMessage);
  const onSentRef = useRef(onSent);
  useEffect(() => { sendRef.current = sendMessage; onSentRef.current = onSent; });

  useEffect(() => {
    if (!pending || !userId) return;
    const timer = setTimeout(() => { sendRef.current(pending.text); onSentRef.current(); }, 300);
    return () => clearTimeout(timer);
  }, [pending, userId]);

  return null;
}

function ChatModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { hasStartedChat, createNewChat } = useChatContext();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    // Kept mounted while closed, so an answer still streaming keeps going and is there on reopen.
    <section className={`${styles.panel} ${open ? styles.panelOpen : ''}`} dir="rtl" aria-hidden={!open} aria-label="שאל את ה-AI">
      <header className={styles.head}>
        <span className={styles.headIcon}><Icon name="sparkle" size={18} /></span>
        <div className={styles.headText}><strong>שאל את ה-AI</strong><small>אופק יזמות · על הלידים, הדירות והעסקאות</small></div>
        {hasStartedChat && (
          <button type="button" className={styles.headBtn} onClick={() => createNewChat()}><Icon name="plus" size={15} /> שיחה חדשה</button>
        )}
        <button type="button" className={styles.close} onClick={onClose} aria-label="סגור"><Icon name="close" size={18} /></button>
      </header>
      <div className={styles.body}>
        <ChatContainer crewMode="tabs" crewPosition="right" />
      </div>
    </section>
  );
}

export function RealEstateLayout() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const chat = useMemo(() => ({
    openChat: (question?: string) => {
      setOpen(true);
      if (question?.trim()) setPending({ text: question.trim(), nonce: Date.now() });
    },
  }), []);

  return (
    <ThemeProvider storagePrefix={realestateConfig.storagePrefix}>
      <LanguageProvider storagePrefix={realestateConfig.storagePrefix}>
        <UserProvider storagePrefix={realestateConfig.storagePrefix} baseURL={realestateConfig.baseURL}>
          <AgentProvider config={realestateConfig}>
            <ChatProvider urlSync={false}>
              <RealEstateChatContext.Provider value={chat}>
                <PendingSender pending={pending} onSent={() => setPending(null)} />
                <div className={styles.shell}>
                  <Outlet />
                </div>
                <ChatModal open={open} onClose={() => setOpen(false)} />
                {!open && (
                  <button type="button" className={styles.launcher} onClick={() => setOpen(true)}>
                    <Icon name="sparkle" size={20} /> שאל את ה-AI
                  </button>
                )}
              </RealEstateChatContext.Provider>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
