import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { freedaConfig } from '../agents';

export function FreedaPage() {
  return (
    <ThemeProvider storagePrefix={freedaConfig.storagePrefix}>
      <UserProvider storagePrefix={freedaConfig.storagePrefix} baseURL={freedaConfig.baseURL}>
        <AgentProvider config={freedaConfig}>
          <ChatProvider>
            <AppLayout>
              <ChatContainer showKBToggle={true} />
            </AppLayout>
          </ChatProvider>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
