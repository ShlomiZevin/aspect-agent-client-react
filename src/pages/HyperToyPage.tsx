import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { hypertoyConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function HyperToyPage() {
  useDocumentMeta({
    title: hypertoyConfig.pageTitle,
    favicon: hypertoyConfig.favicon,
    description: hypertoyConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={hypertoyConfig.storagePrefix}>
      <LanguageProvider storagePrefix={hypertoyConfig.storagePrefix}>
        <UserProvider storagePrefix={hypertoyConfig.storagePrefix} baseURL={hypertoyConfig.baseURL}>
          <AgentProvider config={hypertoyConfig}>
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
