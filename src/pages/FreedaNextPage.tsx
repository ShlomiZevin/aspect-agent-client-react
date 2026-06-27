import { AgentProvider, ThemeProvider, UserProvider } from '../context';
import { LanguageProvider } from '../context/LanguageContext';
import { FreedaNextChatProvider } from '../context/FreedaNextChatProvider';
import { AppLayout } from '../components/layout';
import { ChatContainer } from '../components/chat';
import { freedaNextConfig } from '../agents';
import { useDocumentMeta } from '../hooks';

/**
 * FreedaNext — customer-facing web chat for the Freeda 1.0 engine.
 *
 * Uses the exact same standard chat stack as FreedaPage / AspectPage
 * (providers + AppLayout + ChatContainer). The only difference is the
 * transport: FreedaNextChatProvider talks to the Freeda 1.0 `freedaChat`
 * API instead of the v2 server. Runs in restricted (no-debug) mode.
 */
export function FreedaNextPage() {
  useDocumentMeta({
    title: freedaNextConfig.pageTitle,
    favicon: freedaNextConfig.favicon,
    description: freedaNextConfig.metaDescription,
  });

  return (
    <ThemeProvider storagePrefix="freedanext_">
      <LanguageProvider storagePrefix="freedanext_">
        <UserProvider storagePrefix="freedanext_" baseURL={freedaNextConfig.baseURL}>
          <AgentProvider config={freedaNextConfig}>
            <FreedaNextChatProvider>
              <AppLayout>
                <ChatContainer showCrewSelector={false} />
              </AppLayout>
            </FreedaNextChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
