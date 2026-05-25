import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AboutShlomiPage, AgentChatPage, AgentLoginPage, AICompliancePage, AspectArchDiagramPage, ArchitecturePage, AspectPage, AspectLandingPage, BankingOnboarderPage, BankingOnboarderV2Page, BylinePage, ChainArchitecturePage, CompassPage, CrewBuilderMockupPage, DemoPage, ForemanPage, FreedaPage, FreedaLegacyFlowPage, HomePage, HowWeBuildPage, InfrastructurePage, IPDisclosurePage, KBvsTriggeredPage, KostaHandoffPage, LLMGuidePage, LybiKnowledgePage, LybiLandingPage, KBPage, DashboardPage, NotFoundPage, OneZeroPage, OneZeroDashboardPage, OneZeroLandingPage, PitchDeckPage, SuperAdminUsersPage, TaskBoardPage, TechBacklogPage, TiktokPage, Zer4UPage, NewDeliPage, TheStockPage, HyperToyPage } from './pages';

// Builder lives in its own subtree — lazy so end-user routes don't pay for it.
const BuilderPage = lazy(() => import('./pages/BuilderPage').then(m => ({ default: m.BuilderPage })));
const BuilderHomePage = lazy(() => import('./pages/BuilderHomePage').then(m => ({ default: m.BuilderHomePage })));

const ZER4U_MAINTENANCE = false;

function Zer4UMaintenancePage() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fafafa', fontFamily: 'sans-serif', textAlign: 'center', gap: 16,
    }}>
      <img src="/img/zer4u-logo.png" alt="Zer4U" style={{ width: 72, opacity: 0.85 }} />
      <h2 style={{ color: '#333', margin: 0, fontSize: 22 }}>המערכת בתחזוקה זמנית</h2>
      <p style={{ color: '#888', margin: 0, fontSize: 15 }}>אנא חזרו מאוחר יותר</p>
    </div>
  );
}

function MaybeDashboard() {
  const { agent } = useParams<{ agent: string }>();
  if (ZER4U_MAINTENANCE && agent === 'zer4u') return <Zer4UMaintenancePage />;
  return <DashboardPage />;
}
import { useTaskBoard, useQuickBug } from './hooks';
import { TaskBoardModal } from './components/tasks/TaskBoardModal/TaskBoardModal';
import { QuickBugModal } from './components/tasks/QuickBugModal/QuickBugModal';
import { createTask } from './services/taskService';
import type { CreateTaskData } from './types/task';
import './styles/global.css';

// Routes restricted to authenticated end users — admin/dev tooling
// (task board, quick bug, debug shortcut) must not be accessible.
function isRestrictedRoute(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  return parts.length >= 2 && (parts[1] === 'login' || parts[1] === 'chat');
}

// Inner component that has access to router context
function AppContent() {
  const location = useLocation();
  const restricted = isRestrictedRoute(location.pathname);
  const { isOpen: isTaskBoardOpen, closeModal: closeTaskBoard, openInDraftsMode, clearDraftsMode } = useTaskBoard({ disabled: restricted });
  const { isOpen: isQuickBugOpen, closeModal: closeQuickBug } = useQuickBug({ disabled: restricted });

  // Extract domain from URL path (e.g., /freeda -> freeda, /aspect -> aspect)
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentDomain = pathParts[0] || 'general';

  // Get current conversation URL
  const conversationUrl = window.location.href;

  const handleQuickBugSubmit = async (data: CreateTaskData) => {
    await createTask(data);
  };

  return (
    <>
      {/* Global Task Board Modal - hidden on restricted (logged-in user) routes */}
      {!restricted && (
        <TaskBoardModal isOpen={isTaskBoardOpen} onClose={closeTaskBoard} openInDraftsMode={openInDraftsMode} onDraftsModeAcknowledged={clearDraftsMode} />
      )}

      {/* Quick Bug Modal - hidden on restricted routes */}
      {!restricted && (
        <QuickBugModal
          isOpen={isQuickBugOpen}
          onClose={closeQuickBug}
          onSubmit={handleQuickBugSubmit}
          currentDomain={currentDomain}
          conversationUrl={conversationUrl}
        />
      )}

      <Routes>
        {/* Home page - redirect to /lybi on lybi.ai domain, otherwise show agent selection */}
        <Route path="/" element={
          window.location.hostname === 'lybi.ai' || window.location.hostname === 'www.lybi.ai'
            ? <Navigate to="/lybi" replace />
            : <HomePage />
        } />

        {/* Landing Pages - Marketing */}
        <Route path="/aspect/ai" element={<AspectLandingPage />} />
        <Route path="/aspect/architecture" element={<ArchitecturePage />} />
        <Route path="/aspect/system" element={<AspectArchDiagramPage />} />
        <Route path="/aspect/ai-compliance" element={<AICompliancePage />} />
        <Route path="/aspect/ip-disclosure" element={<IPDisclosurePage />} />
        <Route path="/aspect/handoff" element={<KostaHandoffPage />} />
        <Route path="/aspect/pitch" element={<PitchDeckPage />} />
        <Route path="/lybi/llm-guide" element={<LLMGuidePage />} />
        <Route path="/lybi/how-we-build" element={<HowWeBuildPage />} />
        <Route path="/lybi/chain" element={<ChainArchitecturePage />} />
        <Route path="/lybi/crew-builder" element={<CrewBuilderMockupPage />} />
        <Route path="/lybi/kb-vs-triggered" element={<KBvsTriggeredPage />} />
        <Route path="/lybi/infrastructure" element={<InfrastructurePage />} />
        <Route path="/lybi/knowledge" element={<LybiKnowledgePage />} />
        <Route path="/lybi/backlog" element={<TechBacklogPage />} />
        <Route path="/lybi/about/shlomi" element={<AboutShlomiPage />} />
        <Route path="/lybi/freeda-legacy" element={<FreedaLegacyFlowPage />} />
        {/* Generic agent-aware authenticated chat (e.g. /lybi/login, /lybi/chat).
            Supported agents are defined in src/agents/agentRegistry.ts. */}
        <Route path="/:agent/login" element={<AgentLoginPage />} />
        <Route path="/:agent/chat" element={<AgentChatPage />} />
        <Route path="/:agent/chat/conversations/:conversationId" element={<AgentChatPage />} />
        <Route
          path="/builder"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading builder…</div>}>
              <BuilderHomePage />
            </Suspense>
          }
        />
        <Route
          path="/:agent/builder"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading builder…</div>}>
              <BuilderPage />
            </Suspense>
          }
        />
        <Route path="/lybi/*" element={<LybiLandingPage />} />

        {/* Main agent routes with optional conversation ID */}
        <Route path="/aspect" element={<AspectPage />} />
        <Route path="/aspect/conversations/:conversationId" element={<AspectPage />} />
        <Route path="/banking" element={<BankingOnboarderPage />} />
        <Route path="/banking/conversations/:conversationId" element={<BankingOnboarderPage />} />
        <Route path="/banking-v2" element={<BankingOnboarderV2Page />} />
        <Route path="/banking-v2/conversations/:conversationId" element={<BankingOnboarderV2Page />} />
        <Route path="/byline" element={<BylinePage />} />
        <Route path="/byline/conversations/:conversationId" element={<BylinePage />} />
        <Route path="/foreman" element={<ForemanPage />} />
        <Route path="/foreman/conversations/:conversationId" element={<ForemanPage />} />
        <Route path="/freeda" element={<FreedaPage />} />
        <Route path="/freeda/conversations/:conversationId" element={<FreedaPage />} />
        <Route path="/compass" element={<CompassPage />} />
        <Route path="/compass/conversations/:conversationId" element={<CompassPage />} />
        <Route path="/tiktok" element={<TiktokPage />} />
        <Route path="/tiktok/conversations/:conversationId" element={<TiktokPage />} />
        <Route path="/zer4u" element={ZER4U_MAINTENANCE ? <Zer4UMaintenancePage /> : <Zer4UPage />} />
        <Route path="/zer4u/conversations/:conversationId" element={ZER4U_MAINTENANCE ? <Zer4UMaintenancePage /> : <Zer4UPage />} />
        <Route path="/newdeli" element={<NewDeliPage />} />
        <Route path="/newdeli/conversations/:conversationId" element={<NewDeliPage />} />
        <Route path="/thestock" element={<TheStockPage />} />
        <Route path="/thestock/conversations/:conversationId" element={<TheStockPage />} />
        <Route path="/hypertoy" element={<HyperToyPage />} />
        <Route path="/hypertoy/conversations/:conversationId" element={<HyperToyPage />} />

        {/* ONE ZERO - Aspect demo for digital bank churn */}
        <Route path="/aspect/onezero" element={<OneZeroLandingPage />} />
        <Route path="/aspect/onezero/dashboard" element={<OneZeroDashboardPage />} />
        <Route path="/aspect/onezero/chat" element={<OneZeroPage />} />
        <Route path="/aspect/onezero/chat/conversations/:conversationId" element={<OneZeroPage />} />

        {/* Task Board - standalone full page */}
        <Route path="/tasks" element={<TaskBoardPage />} />
        <Route path="/tasks/:taskId" element={<TaskBoardPage />} />

        {/* Hidden super-admin users page (code-gated; sees all tenants) */}
        <Route path="/users/*" element={<SuperAdminUsersPage />} />

        {/* Dashboard routes */}
        <Route path="/:agent/dashboard/*" element={<MaybeDashboard />} />
        <Route path="/:agent/admin/*" element={<MaybeDashboard />} />

        {/* Knowledge Base routes */}
        <Route path="/kb/:agent" element={<KBPage />} />

        {/* Demo Mockup routes */}
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/demo/:id" element={<DemoPage />} />
        <Route path="/demo/:id/edit" element={<DemoPage />} />
        <Route path="/demo/:id/embed" element={<DemoPage />} />

        {/* Legacy URL redirects */}
        <Route path="/aspect.html" element={<Navigate to="/aspect" replace />} />
        <Route path="/freeda.html" element={<Navigate to="/freeda" replace />} />
        <Route path="/kb.html" element={<Navigate to="/kb/freeda" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
