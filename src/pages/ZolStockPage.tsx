import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { zolstockConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

export function ZolStockPage() {
  useDocumentMeta({
    title: zolstockConfig.pageTitle,
    favicon: zolstockConfig.favicon,
    description: zolstockConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix={zolstockConfig.storagePrefix}>
      <LanguageProvider storagePrefix={zolstockConfig.storagePrefix}>
        <UserProvider storagePrefix={zolstockConfig.storagePrefix} baseURL={zolstockConfig.baseURL}>
          <AgentProvider config={zolstockConfig}>
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
