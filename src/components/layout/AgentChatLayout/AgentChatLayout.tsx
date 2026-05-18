import { type ReactNode } from 'react';
import { ThemeToggle } from '../../common';
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
  const { hasStartedChat, createNewChat } = useChatContext();

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img src={logoSrc} alt={logoAlt || ''} className={styles.logo} />
          </div>

          <div className={styles.actions}>
            {hasStartedChat && (
              <button
                className={styles.newChatBtn}
                onClick={createNewChat}
                type="button"
              >
                שיחה חדשה
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
