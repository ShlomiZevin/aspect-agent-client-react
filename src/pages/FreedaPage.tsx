import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { PhoneLink } from '../components/chat/PhoneLink';
import { freedaConfig } from '../agents';
import { useDocumentMeta } from '../hooks';
import { useSearchParams } from 'react-router-dom';

export function FreedaPage() {
  const [searchParams] = useSearchParams();
  // Check both URL param and if we're in an iframe
  const isEmbed = searchParams.get('embed') === 'true' ||
    (typeof window !== 'undefined' && window.self !== window.top);

  useDocumentMeta({
    title: freedaConfig.pageTitle,
    favicon: freedaConfig.favicon,
    description: freedaConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={freedaConfig.storagePrefix}>
      <UserProvider storagePrefix={freedaConfig.storagePrefix} baseURL={freedaConfig.baseURL}>
        <AgentProvider config={freedaConfig}>
          <ChatProvider>
            <AppLayout headerExtra={!isEmbed ? <PhoneLink /> : undefined}>
              <ChatContainer showCrewSelector={!isEmbed} />
            </AppLayout>
          </ChatProvider>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
