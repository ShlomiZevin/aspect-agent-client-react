import { AgentProvider, ThemeProvider, UserProvider, ChatProvider, useChatContext } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { ChatContainer } from '../components/chat';
import { realestateConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { AskHandoff } from './realestate/AskHandoff';
import { RealEstateTopbar } from './realestate/RealEstateTopbar';
import { Icon } from './realestate/ui';
import styles from './realestate/RealEstateChat.module.css';

/** The demo's chat under the demo's own top bar — not AppLayout, whose header
 * and history rail would put a second, different menu on this one screen. */
function RealEstateChat() {
  const { hasStartedChat, createNewChat } = useChatContext();
  return (
    <div className={styles.frame}>
      <RealEstateTopbar
        active="chat"
        extra={hasStartedChat && (
          <button type="button" className={styles.newChat} onClick={() => createNewChat()}>
            <Icon name="plus" size={16} /> שיחה חדשה
          </button>
        )}
      />
      <main className={styles.body}>
        <ChatContainer crewMode="tabs" crewPosition="right" />
      </main>
    </div>
  );
}

export function RealEstatePage() {
  useDocumentMeta({
    title: realestateConfig.pageTitle,
    favicon: realestateConfig.favicon,
    description: realestateConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={realestateConfig.storagePrefix}>
      <LanguageProvider storagePrefix={realestateConfig.storagePrefix}>
        <UserProvider storagePrefix={realestateConfig.storagePrefix} baseURL={realestateConfig.baseURL}>
          <AgentProvider config={realestateConfig}>
            <ChatProvider>
              <AskHandoff />
              <RealEstateChat />
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
