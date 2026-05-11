import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useDocumentMeta, useAgentAuth } from '../hooks';
import { ThemeProvider } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import { UserProvider } from '../context/UserContext';
import { AgentProvider } from '../context/AgentContext';
import { ChatProvider } from '../context/ChatContext';
import { ChatContainer } from '../components/chat/ChatContainer';
import { AgentChatLayout } from '../components/layout/AgentChatLayout';
import { authStoragePrefix } from '../services/agentAuthService';
import { getAgentConfig } from '../agents/agentRegistry';
import { NotFoundPage } from './NotFoundPage';

export function AgentChatPage() {
  const { agent } = useParams<{ agent: string }>();
  const config = getAgentConfig(agent);

  useDocumentMeta({
    title: config?.pageTitle ?? '',
    favicon: config?.favicon,
    description: config?.metaDescription,
  });

  // Note: useAgentAuth is called regardless of config to keep hook order stable.
  const { session, logout } = useAgentAuth(agent || '');
  const navigate = useNavigate();

  if (!agent || !config) return <NotFoundPage />;
  if (!session) return <Navigate to={`/${agent}/login`} replace />;

  const handleLogout = () => {
    logout();
    navigate(`/${agent}/login`, { replace: true });
  };

  const prefix = authStoragePrefix(agent);

  return (
    <ThemeProvider storagePrefix={prefix}>
      <LanguageProvider storagePrefix={prefix}>
        <UserProvider storagePrefix={prefix} baseURL={config.baseURL}>
          <AgentProvider config={config}>
            {/* Pass the auth-namespaced prefix so chat state (conversation id,
                linked phone) is fully isolated from the public anon /<agent> path. */}
            <ChatProvider restrictedMode storagePrefix={prefix}>
              <AgentChatLayout
                logoSrc={config.logo.src}
                logoAlt={config.logo.alt}
                userName={session.name}
                onLogout={handleLogout}
              >
                <ChatContainer showCrewSelector={false} />
              </AgentChatLayout>
            </ChatProvider>
          </AgentProvider>
        </UserProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
