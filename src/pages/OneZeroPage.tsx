import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { oneZeroConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function OneZeroPage() {
  useDocumentMeta({
    title: oneZeroConfig.pageTitle,
    favicon: oneZeroConfig.favicon,
    description: oneZeroConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={oneZeroConfig.storagePrefix}>
      <LanguageProvider storagePrefix={oneZeroConfig.storagePrefix}>
        <UserProvider storagePrefix={oneZeroConfig.storagePrefix} baseURL={oneZeroConfig.baseURL}>
          <AgentProvider config={oneZeroConfig}>
            <ChatProvider>
              <AppLayout>
                <ChatContainer />
              </AppLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
