import { Suspense, lazy, useEffect, useState } from 'react';
import { useParams, Navigate, Routes, Route } from 'react-router-dom';

import { ThemeProvider, AgentProvider } from '../context';
import { AccessPage, SignInGate, authApi } from '../auth';

// Lazy for the same reason every other heavy subtree here is: an agent whose
// Task Board module is switched off must not download it.
const AspectTaskBoard = lazy(() =>
  import('../taskboard/components/TaskBoardPage/TaskBoardPage').then(m => ({ default: m.TaskBoardPage })));
// The api module only, NOT the package barrel: the barrel re-exports the board
// component, so importing from it would pull the whole board into the main
// bundle and undo the lazy() below.
import { api as taskboardApi } from '../taskboard/api';
import { DashboardLayout } from '../components/dashboard/DashboardLayout';
import { FeedbackPage } from '../components/dashboard/FeedbackPage';
import { UsersPage } from '../components/dashboard/UsersPage';
import { UserConversationsPage } from '../components/dashboard/UserConversationsPage';
import { CrewPage } from '../components/dashboard/CrewPage';
import { CrewEditorAI } from '../components/dashboard/CrewEditorAI';
import { CrewPlayground } from '../components/dashboard/CrewPlayground';
import { QueryOptimizerPage } from '../components/dashboard/QueryOptimizerPage';
import { DataLoaderPage } from '../components/dashboard/DataLoaderPage';
import { ModulesPage } from '../components/dashboard/ModulesPage';
import { PodcastPage } from '../components/dashboard/PodcastPage';
import { BillingPage } from '../components/dashboard/BillingPage';
import { LLMUsagePage } from '../components/dashboard/LLMUsagePage';
import { SettingsPage } from '../components/dashboard/SettingsPage';
import { KBManager } from '../components/kb';
import { TestRunnerPage } from '../components/dashboard/TestRunnerPage';
import { DynamicKBPage } from '../components/dashboard/DynamicKBPage';
import { ConversationTrendsPage } from '../components/dashboard/ConversationTrendsPage';
import { CloudRunLogsPage } from '../components/dashboard/CloudRunLogsPage';
import { PineconeAdmin } from '../components/pinecone';
import { TaskBoardContent } from '../components/tasks/TaskBoardModal/TaskBoardContent';
import dashStyles from './DashboardPage.module.css';
import { getAgentConfig } from '../agents/agentRegistry';

function TaskBoardPageWithId() {
  const { taskId } = useParams<{ taskId: string }>();
  const id = taskId ? parseInt(taskId, 10) : undefined;
  return (
    <div style={{ height: '100%', overflow: 'hidden' }} dir="ltr">
      <TaskBoardContent isActive={true} initialTaskId={id} />
    </div>
  );
}

export function DashboardPage() {
  const { agent } = useParams<{ agent: string }>();
  const config = getAgentConfig(agent);

  // Declared BEFORE the early returns below. This component returns early for an
  // unknown agent, and a hook placed after that changes the hook count between
  // renders, which React treats as fatal.
  //
  // Whether our own task board is switched on for this client — asked of the
  // server rather than hardcoded, since that switch is the point of the module.
  const [showTaskboard, setShowTaskboard] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  useEffect(() => {
    if (!agent) return;
    let cancelled = false;
    taskboardApi.isEnabledFor(agent)
      .then(on => { if (!cancelled) setShowTaskboard(on); })
      .catch(() => { /* not enabled, or unreachable — either way, no nav item */ });
    return () => { cancelled = true; };
  }, [agent]);

  // The Access screen only makes sense where sign-in is switched on: without it
  // an invitation grants entry to a door that is already open.
  useEffect(() => {
    if (!agent) return;
    let cancelled = false;
    authApi.config(agent)
      .then(c => { if (!cancelled) setShowAccess(c.enabled); })
      .catch(() => { /* not enabled, or unreachable */ });
    return () => { cancelled = true; };
  }, [agent]);

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
  // Modules used to bind to a dataset, so this was gated on having one. Since
  // the framework gained client-scoped modules (the task board is the first),
  // an agent with no customer schema can have modules too — and Aspect and LYBI
  // are exactly that. The server decides what is attachable and returns only
  // those, so showing the tab cannot offer a switch that will not work.
  const showModules = true;

  /**
   * Agents whose people use the original board in the platform DB: LYBI, and
   * Freeda alongside it. Hila and Noa work there; on every other agent that
   * link opened someone else's board.
   *
   * A list rather than a flag on the agent config, because it describes who
   * uses a tool rather than anything about the agent itself.
   */
  const LEGACY_BOARD_AGENTS = ['banking', 'banking-v2', 'freeda'];
  const showLegacyTaskBoard = LEGACY_BOARD_AGENTS.includes((agent ?? '').toLowerCase());

  const showPodcast = agent?.toLowerCase() === 'freeda';
  const showConversationTrends = agent?.toLowerCase() === 'banking-v2';

  return (
    <ThemeProvider storagePrefix={config.storagePrefix}>
      <AgentProvider config={config}>
        <DashboardLayout
          agentName={config.agentName}
          agentDisplayName={config.displayName}
          agentLogo={config.logo.src}
          basePath={basePath}
          showQueryOptimizer={showQueryOptimizer}
          showModules={showModules}
          showTaskboard={showTaskboard}
          showAccess={showAccess}
          showLegacyTaskBoard={showLegacyTaskBoard}
          showPodcast={showPodcast}
          showConversationTrends={showConversationTrends}
        >
          <Routes>
            <Route index element={<Navigate to="feedback" replace />} />
            <Route
              path="task-board"
              element={
                <div className={dashStyles.taskBoardWrapper} dir="ltr">
                  <TaskBoardContent isActive={true} />
                </div>
              }
            />
            <Route
              path="task-board/:taskId"
              element={
                <TaskBoardPageWithId />
              }
            />
            <Route
              path="feedback"
              element={<FeedbackPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="users"
              element={<UsersPage baseURL={config.baseURL} defaultTenant={agent} basePath={basePath} />}
            />
            <Route
              path="users/:userId"
              element={<UserConversationsPage baseURL={config.baseURL} basePath={basePath} />}
            />
            <Route
              path="users/:userId/conversations/:conversationId"
              element={<UserConversationsPage baseURL={config.baseURL} basePath={basePath} />}
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
            <Route
              path="dynamic-kb"
              element={<DynamicKBPage agentName={config.agentName} />}
            />
            <Route
              path="library"
              element={<PineconeAdmin agentName={config.agentName} baseURL={config.baseURL} />}
            />
            {showQueryOptimizer && (
              <Route
                path="query-optimizer"
                element={<QueryOptimizerPage agentName={config.agentName} baseURL={config.baseURL} />}
              />
            )}
            {showQueryOptimizer && (
              <Route
                path="data-loader"
                element={<DataLoaderPage agentName={config.agentName} baseURL={config.baseURL} schemaName={config.database!.schema} />}
              />
            )}
            {showTaskboard && (
              <Route
                path="taskboard"
                element={
                  <div className={dashStyles.taskBoardWrapper} dir="ltr">
                    <SignInGate tenant={agent ?? ''} agentName={config.displayName}>
                      {() => (
                        <Suspense fallback={null}>
                          <AspectTaskBoard />
                        </Suspense>
                      )}
                    </SignInGate>
                  </div>
                }
              />
            )}
            {showAccess && (
              <Route path="access" element={<AccessPage tenant={agent ?? ''} />} />
            )}
            {showModules && (
              <Route
                path="modules"
                // The schema where the agent has one, else the slug. The `!` here
                // was safe only while showModules implied a dataset; making the
                // tab available everywhere turned it into a crash that unmounted
                // the whole dashboard for freeda and every other agent with no
                // customer schema.
                //
                // Not simply the slug: the `aspect` agent runs on zer4u's
                // schema, so switching it would silently move which dataset its
                // Modules tab configures.
                element={<ModulesPage datasetId={config.database?.schema ?? agent ?? ''} baseURL={config.baseURL} />}
              />
            )}
            {showPodcast && (
              <Route
                path="podcast"
                element={<PodcastPage baseURL={config.baseURL} agentName={config.agentName} />}
              />
            )}
            {showConversationTrends && (
              <Route
                path="conversation-trends"
                element={<ConversationTrendsPage />}
              />
            )}
            <Route
              path="test-runner"
              element={<TestRunnerPage agentName={config.agentName} baseURL={config.baseURL} />}
            />
            <Route
              path="billing"
              element={<BillingPage baseURL={config.baseURL} />}
            />
            <Route
              path="llm-usage"
              element={<LLMUsagePage baseURL={config.baseURL} agentName={config.agentName} agentSlug={agent} />}
            />
            <Route
              path="settings"
              element={<SettingsPage baseURL={config.baseURL} agentName={config.agentName} />}
            />
            <Route
              path="cloud-run-logs"
              element={<CloudRunLogsPage baseURL={config.baseURL} />}
            />
          </Routes>
        </DashboardLayout>
      </AgentProvider>
    </ThemeProvider>
  );
}
