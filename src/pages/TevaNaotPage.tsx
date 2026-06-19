import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { tevanaotConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function TevaNaotPage() {
  useDocumentMeta({
    title: tevanaotConfig.pageTitle,
    favicon: tevanaotConfig.favicon,
    description: tevanaotConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={tevanaotConfig.storagePrefix}>
      <LanguageProvider storagePrefix={tevanaotConfig.storagePrefix}>
        <UserProvider storagePrefix={tevanaotConfig.storagePrefix} baseURL={tevanaotConfig.baseURL}>
          <AgentProvider config={tevanaotConfig}>
            <ChatProvider>
              <AppLayout>
                <ChatContainer crewMode="tabs" crewPosition="right" />
              </AppLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
