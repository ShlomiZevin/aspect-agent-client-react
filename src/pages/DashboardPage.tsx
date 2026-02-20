import { useParams, Navigate, Routes, Route } from 'react-router-dom';
import { ThemeProvider, AgentProvider } from '../context';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { FeedbackPage } from '../components/dashboard/FeedbackPage';
import { UsersPage } from '../components/dashboard/UsersPage';
import { CrewPage } from '../components/dashboard/CrewPage';
import { QueryOptimizerPage } from '../components/dashboard/QueryOptimizerPage';
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

  const showQueryOptimizer = !!config.database?.schema;

  return (
    <ThemeProvider storagePrefix={config.storagePrefix}>
      <AgentProvider config={config}>
        <DashboardLayout
          agentName={config.agentName}
          agentDisplayName={config.displayName}
          agentLogo={config.logo.src}
          basePath={basePath}
          showQueryOptimizer={showQueryOptimizer}
        >
          <Routes>
            <Route index element={<Navigate to="feedback" replace />} />
            <Route
              path="feedback"
              element={<FeedbackPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="users"
              element={<UsersPage baseURL={config.baseURL} />}
            />
            <Route
              path="crew"
              element={<CrewPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
            {showQueryOptimizer && (
              <Route
                path="query-optimizer"
                element={<QueryOptimizerPage agentName={config.agentName} baseURL={config.baseURL} />}
              />
            )}
          </Routes>
        </DashboardLayout>
      </AgentProvider>
    </ThemeProvider>
  );
}
