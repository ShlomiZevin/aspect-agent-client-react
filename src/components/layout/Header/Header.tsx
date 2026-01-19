import { type ReactNode } from 'react';
import { useAgentConfig } from '../../../context';
import { ThemeToggle, StatusIndicator, Button } from '../../common';
import styles from './Header.module.css';

interface HeaderProps {
  onMenuClick: () => void;
  onNewChat: () => void;
  showNewChatButton?: boolean;
  extraContent?: ReactNode;
}

export function Header({
  onMenuClick,
  onNewChat,
  showNewChatButton = false,
  extraContent,
}: HeaderProps) {
  const config = useAgentConfig();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className={styles.logo}>
          <img src={config.logo.src} alt={config.logo.alt} className={styles.logoImg} />
          <div className={styles.logoText}>
            <h1 className={styles.title}>{config.headerTitle}</h1>
            <p className={styles.subtitle}>{config.headerSubtitle}</p>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        {extraContent}

        {showNewChatButton && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onNewChat}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
          >
            New Chat
          </Button>
        )}

        <ThemeToggle />
        <StatusIndicator status="online" label="Online" />
      </div>
    </header>
  );
}
