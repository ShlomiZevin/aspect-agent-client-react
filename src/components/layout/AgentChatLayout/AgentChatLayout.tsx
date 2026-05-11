import { useState, type ReactNode } from 'react';
import { ThemeToggle } from '../../common';
import { HistorySidebar } from '../HistorySidebar';
import { useChatContext } from '../../../context';
import styles from './AgentChatLayout.module.css';

interface AgentChatLayoutProps {
  children: ReactNode;
  userName: string;
  logoSrc: string;
  logoAlt?: string;
  onLogout: () => void;
}

export function AgentChatLayout({
  children,
  userName,
  logoSrc,
  logoAlt,
  onLogout,
}: AgentChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { hasStartedChat, createNewChat } = useChatContext();

  const handleNewChat = () => {
    createNewChat();
    setSidebarOpen(false);
  };

  return (
    <div className={styles.layout}>
      <HistorySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <button
              className={styles.iconBtn}
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label="היסטוריית שיחות"
              title="היסטוריית שיחות"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <img src={logoSrc} alt={logoAlt || ''} className={styles.logo} />
          </div>

          <div className={styles.actions}>
            {hasStartedChat && (
              <button
                className={styles.iconBtn}
                onClick={handleNewChat}
                aria-label="שיחה חדשה"
                title="שיחה חדשה"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            )}
            <span className={styles.userName} title={userName}>{userName}</span>
            <ThemeToggle />
            <button
              className={styles.iconBtn}
              onClick={onLogout}
              aria-label="התנתקות"
              title="התנתקות"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
