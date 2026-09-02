import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { superhistConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function SuperHistPage() {
  useDocumentMeta({
    title: superhistConfig.pageTitle,
    favicon: superhistConfig.favicon,
    description: superhistConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={superhistConfig.storagePrefix}>
      <LanguageProvider storagePrefix={superhistConfig.storagePrefix}>
        <UserProvider storagePrefix={superhistConfig.storagePrefix} baseURL={superhistConfig.baseURL}>
          <AgentProvider config={superhistConfig}>
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
