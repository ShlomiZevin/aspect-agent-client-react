import { bankingOnboarderConfig } from '../agents/banking-onboarder.config';
import { useDocumentMeta } from '../hooks';
import { ThemeProvider } from '../context/ThemeContext';
import { UserProvider } from '../context/UserContext';
import { AgentProvider } from '../context/AgentContext';
import { ChatProvider } from '../context/ChatContext';
import { AppLayout } from '../components/layout/AppLayout';
import { ChatContainer } from '../components/chat/ChatContainer';

export function BankingOnboarderPage() {
  useDocumentMeta({
    title: bankingOnboarderConfig.pageTitle,
    favicon: bankingOnboarderConfig.favicon,
    description: bankingOnboarderConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={bankingOnboarderConfig.storagePrefix}>
      <UserProvider storagePrefix={bankingOnboarderConfig.storagePrefix} baseURL={bankingOnboarderConfig.baseURL}>
        <AgentProvider config={bankingOnboarderConfig}>
          <ChatProvider>
            <AppLayout>
              <ChatContainer showCrewSelector={true} />
            </AppLayout>
          </ChatProvider>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
