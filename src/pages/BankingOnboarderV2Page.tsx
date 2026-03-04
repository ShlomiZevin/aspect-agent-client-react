import { bankingOnboarderV2Config } from '../agents/banking-onboarder-v2.config';
import { useDocumentMeta } from '../hooks';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { UserProvider } from '../context/UserContext';
import { AgentProvider } from '../context/AgentContext';
import { ChatProvider } from '../context/ChatContext';
import { AppLayout } from '../components/layout/AppLayout';
import { ChatContainer } from '../components/chat/ChatContainer';

export function BankingOnboarderV2Page() {
  useDocumentMeta({
    title: bankingOnboarderV2Config.pageTitle,
    favicon: bankingOnboarderV2Config.favicon,
    description: bankingOnboarderV2Config.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={bankingOnboarderV2Config.storagePrefix}>
      <LanguageProvider storagePrefix={bankingOnboarderV2Config.storagePrefix}>
        <UserProvider storagePrefix={bankingOnboarderV2Config.storagePrefix} baseURL={bankingOnboarderV2Config.baseURL}>
          <AgentProvider config={bankingOnboarderV2Config}>
            <ChatProvider>
              <AppLayout>
                <ChatContainer showCrewSelector={true} />
              </AppLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
