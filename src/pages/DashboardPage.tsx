import { useParams, Navigate, Routes, Route } from 'react-router-dom';
import { ThemeProvider, AgentProvider } from '../context';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { FeedbackPage } from '../components/dashboard/FeedbackPage';
import { UsersPage } from '../components/dashboard/UsersPage';
import { CrewPage } from '../components/dashboard/CrewPage';
import { CrewEditorAI } from '../components/dashboard/CrewEditorAI';
import { CrewPlayground } from '../components/dashboard/CrewPlayground';
import { QueryOptimizerPage } from '../components/dashboard/QueryOptimizerPage';
import { PodcastPage } from '../components/dashboard/PodcastPage';
import { BillingPage } from '../components/dashboard/BillingPage';
import { ApiKeysPage } from '../components/dashboard/ApiKeysPage';
import { KBManager } from '../components/kb';
import { aspectConfig, bankingOnboarderConfig, bankingOnboarderV2Config, compassConfig, freedaConfig, zer4uConfig } from '../agents';
import type { AgentConfig } from '../types';

const agentConfigs: Record<string, AgentConfig> = {
  aspect: aspectConfig,
  banking: bankingOnboarderConfig,
  'banking-v2': bankingOnboarderV2Config,
  compass: compassConfig,
  freeda: freedaConfig,
  zer4u: zer4uConfig,
};

export function DashboardPage() {
  const { agent } = useParams<{ agent: string }>();
  const config = agent ? agentConfigs[agent.toLowerCase()] : null;

  if (!config) {
    // Browser may have cached old JS bundle that doesn't know this agent.
    // Try one hard reload to fetch the latest bundle before giving up.
    const reloadKey = `dashboard_reload_${agent}`;
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      const url = new URL(window.location.href);
      url.searchParams.set('_r', Date.now().toString());
      window.location.replace(url.toString());
      return null;
    }
    sessionStorage.removeItem(reloadKey);
    return <Navigate to="/" replace />;
  }

  // Support both /:agent/dashboard/* and /:agent/admin/* URL patterns
  const pathSegments = window.location.pathname.split('/');
  const routePrefix = pathSegments[2] === 'admin' ? 'admin' : 'dashboard';
  const basePath = `/${agent}/${routePrefix}`;

  const showQueryOptimizer = !!config.database?.schema;
  const showPodcast = agent?.toLowerCase() === 'freeda';

  return (
    <ThemeProvider storagePrefix={config.storagePrefix}>
      <AgentProvider config={config}>
        <DashboardLayout
          agentName={config.agentName}
          agentDisplayName={config.displayName}
          agentLogo={config.logo.src}
          basePath={basePath}
          showQueryOptimizer={showQueryOptimizer}
          showPodcast={showPodcast}
        >
          <Routes>
            <Route index element={<Navigate to="feedback" replace />} />
            <Route
              path="feedback"
              element={<FeedbackPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="users"
              element={<UsersPage baseURL={config.baseURL} agentName={config.agentName} />}
            />
            <Route
              path="crew"
              element={<CrewPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="crew-editor"
              element={<CrewEditorAI agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="playground"
              element={<CrewPlayground agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="knowledge-base"
              element={<KBManager />}
            />
            {showQueryOptimizer && (
              <Route
                path="query-optimizer"
                element={<QueryOptimizerPage agentName={config.agentName} baseURL={config.baseURL} />}
              />
            )}
            {showPodcast && (
              <Route
                path="podcast"
                element={<PodcastPage baseURL={config.baseURL} agentName={config.agentName} />}
              />
            )}
            <Route
              path="billing"
              element={<BillingPage baseURL={config.baseURL} />}
            />
            <Route
              path="api-keys"
              element={<ApiKeysPage baseURL={config.baseURL} />}
            />
          </Routes>
        </DashboardLayout>
      </AgentProvider>
    </ThemeProvider>
  );
}
