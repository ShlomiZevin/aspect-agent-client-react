import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { aspectConfig } from '../agents';
import { LogoUpload } from '../components/agent-specific/aspect/LogoUpload';
import { useDocumentMeta } from '../hooks';
import { useSearchParams } from 'react-router-dom';

export function AspectPage() {
  const [searchParams] = useSearchParams();
  // Check both URL param and if we're in an iframe
  const isEmbed = searchParams.get('embed') === 'true' ||
    (typeof window !== 'undefined' && window.self !== window.top);

  useDocumentMeta({
    title: aspectConfig.pageTitle,
    favicon: aspectConfig.favicon,
    description: aspectConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={aspectConfig.storagePrefix}>
      <UserProvider storagePrefix={aspectConfig.storagePrefix} baseURL={aspectConfig.baseURL}>
        <AgentProvider config={aspectConfig}>
          <ChatProvider>
            <AppLayout headerExtra={!isEmbed ? <LogoUpload /> : undefined}>
              <ChatContainer crewMode="tabs" crewPosition="right" />
            </AppLayout>
          </ChatProvider>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
