import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { realestateConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { AskHandoff } from './realestate/AskHandoff';

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
