import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { compassConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function CompassPage() {
  useDocumentMeta({
    title: compassConfig.pageTitle,
    favicon: compassConfig.favicon,
    description: compassConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={compassConfig.storagePrefix}>
      <LanguageProvider storagePrefix={compassConfig.storagePrefix}>
        <UserProvider storagePrefix={compassConfig.storagePrefix} baseURL={compassConfig.baseURL}>
          <AgentProvider config={compassConfig}>
            <ChatProvider>
              <AppLayout>
                <ChatContainer showCrewSelector={false} />
              </AppLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
