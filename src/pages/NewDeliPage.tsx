import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { newdeliConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function NewDeliPage() {
  useDocumentMeta({
    title: newdeliConfig.pageTitle,
    favicon: newdeliConfig.favicon,
    description: newdeliConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={newdeliConfig.storagePrefix}>
      <LanguageProvider storagePrefix={newdeliConfig.storagePrefix}>
        <UserProvider storagePrefix={newdeliConfig.storagePrefix} baseURL={newdeliConfig.baseURL}>
          <AgentProvider config={newdeliConfig}>
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
