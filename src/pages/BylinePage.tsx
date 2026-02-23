import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { bylineConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function BylinePage() {
  useDocumentMeta({
    title: bylineConfig.pageTitle,
    favicon: bylineConfig.favicon,
    description: bylineConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={bylineConfig.storagePrefix}>
      <LanguageProvider storagePrefix={bylineConfig.storagePrefix}>
        <UserProvider storagePrefix={bylineConfig.storagePrefix} baseURL={bylineConfig.baseURL}>
          <AgentProvider config={bylineConfig}>
            <ChatProvider>
              <AppLayout>
                <ChatContainer showCrewSelector={true} />
              </AppLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
