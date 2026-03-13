import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { zer4uConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { useSearchParams } from 'react-router-dom';

export function Zer4UPage() {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true' ||
    (typeof window !== 'undefined' && window.self !== window.top);

  useDocumentMeta({
    title: zer4uConfig.pageTitle,
    favicon: zer4uConfig.favicon,
    description: zer4uConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={zer4uConfig.storagePrefix}>
      <LanguageProvider storagePrefix={zer4uConfig.storagePrefix}>
        <UserProvider storagePrefix={zer4uConfig.storagePrefix} baseURL={zer4uConfig.baseURL}>
          <AgentProvider config={zer4uConfig}>
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
