import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { tiktokConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { useSearchParams } from 'react-router-dom';

export function TiktokPage() {
  const [searchParams] = useSearchParams();
  const isEmbed = searchParams.get('embed') === 'true' ||
    (typeof window !== 'undefined' && window.self !== window.top);

  useDocumentMeta({
    title: tiktokConfig.pageTitle,
    favicon: tiktokConfig.favicon,
    description: tiktokConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={tiktokConfig.storagePrefix}>
      <LanguageProvider storagePrefix={tiktokConfig.storagePrefix}>
        <UserProvider storagePrefix={tiktokConfig.storagePrefix} baseURL={tiktokConfig.baseURL}>
          <AgentProvider config={tiktokConfig}>
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
