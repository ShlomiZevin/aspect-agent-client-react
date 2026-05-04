import { AgentProvider, ThemeProvider, UserProvider, ChatProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { zer4uConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

const MAINTENANCE_MODE = false;

export function Zer4UPage() {
  useDocumentMeta({
    title: zer4uConfig.pageTitle,
    favicon: zer4uConfig.favicon,
    description: zer4uConfig.metaDescription,
  });

  if (MAINTENANCE_MODE) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', fontFamily: 'sans-serif', textAlign: 'center',
        gap: 16,
      }}>
        <img src="/img/zer4u-logo.png" alt="Zer4U" style={{ width: 72, opacity: 0.85 }} />
        <h2 style={{ color: '#333', margin: 0, fontSize: 22 }}>המערכת בתחזוקה זמנית</h2>
        <p style={{ color: '#888', margin: 0, fontSize: 15 }}>אנא חזרו מאוחר יותר</p>
      </div>
    );
  }

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
