import { useState, type ReactNode } from 'react';
import { Header } from '../Header';
import { HistorySidebar } from '../HistorySidebar';
import { useChatContext } from '../../../context';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  children: ReactNode;
  headerExtra?: ReactNode;
}

export function AppLayout({ children, headerExtra }: AppLayoutProps) {
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
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onNewChat={handleNewChat}
          showNewChatButton={hasStartedChat}
          extraContent={headerExtra}
        />

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
