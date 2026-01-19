import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { aspectConfig } from '../agents';
import { LogoUpload } from '../components/agent-specific/aspect/LogoUpload';
import { useDocumentMeta } from '../hooks';

export function AspectPage() {
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
            <AppLayout headerExtra={<LogoUpload />}>
              <ChatContainer />
            </AppLayout>
          </ChatProvider>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
