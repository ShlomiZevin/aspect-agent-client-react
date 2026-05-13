import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { thestockConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function TheStockPage() {
  useDocumentMeta({
    title: thestockConfig.pageTitle,
    favicon: thestockConfig.favicon,
    description: thestockConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={thestockConfig.storagePrefix}>
      <LanguageProvider storagePrefix={thestockConfig.storagePrefix}>
        <UserProvider storagePrefix={thestockConfig.storagePrefix} baseURL={thestockConfig.baseURL}>
          <AgentProvider config={thestockConfig}>
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
