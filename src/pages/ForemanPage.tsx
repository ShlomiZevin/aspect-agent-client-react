import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { foremanConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { useSearchParams } from 'react-router-dom';

export function ForemanPage() {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true' ||
    (typeof window !== 'undefined' && window.self !== window.top);

  useDocumentMeta({
    title: foremanConfig.pageTitle,
    favicon: foremanConfig.favicon,
    description: foremanConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={foremanConfig.storagePrefix}>
      <LanguageProvider storagePrefix={foremanConfig.storagePrefix}>
        <UserProvider storagePrefix={foremanConfig.storagePrefix} baseURL={foremanConfig.baseURL}>
          <AgentProvider config={foremanConfig}>
            <ChatProvider>
              <AppLayout>
                <ChatContainer showCrewSelector={!isEmbed} />
              </AppLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
