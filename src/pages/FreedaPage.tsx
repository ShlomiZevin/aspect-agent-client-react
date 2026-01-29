import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { freedaConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function FreedaPage() {
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
            <AppLayout>
              <ChatContainer showKBToggle={true} showCrewSelector={true} />
            </AppLayout>
          </ChatProvider>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
