import { useParams, Navigate, Routes, Route } from 'react-router-dom';
import { ThemeProvider, AgentProvider } from '../context';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { FeedbackPage } from '../components/dashboard/FeedbackPage';
import { aspectConfig, freedaConfig } from '../agents';
import type { AgentConfig } from '../types';

const agentConfigs: Record<string, AgentConfig> = {
  aspect: aspectConfig,
  freeda: freedaConfig,
};

export function DashboardPage() {
  const { agent } = useParams<{ agent: string }>();
  const config = agent ? agentConfigs[agent.toLowerCase()] : null;

  if (!config) {
    return <Navigate to="/" replace />;
  }

  const basePath = `/${agent}/dashboard`;

  return (
    <ThemeProvider storagePrefix={config.storagePrefix}>
      <AgentProvider config={config}>
        <DashboardLayout
          agentName={config.agentName}
          agentDisplayName={config.displayName}
          agentLogo={config.logo.src}
          basePath={basePath}
        >
          <Routes>
            <Route index element={<Navigate to="feedback" replace />} />
            <Route
              path="feedback"
              element={<FeedbackPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
          </Routes>
        </DashboardLayout>
      </AgentProvider>
    </ThemeProvider>
  );
}
