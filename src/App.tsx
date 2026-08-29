import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AboutShlomiPage, AgentChatPage, AgentLoginPage, AICompliancePage, AspectArchDiagramPage, AspectAgentsHomePage, ArchitecturePage, AspectBattleCardPage, AspectMarketingSalesPage, AspectPage, AspectLandingPage, AspectPlatformLandingPage, AspectPlatformSalesPage, BankingOnboarderPage, BankingOnboarderV2Page, BylinePage, ChainArchitecturePage, CompassPage, CrewBuilderMockupPage, DemoPage, ForemanPage, FreedaPage, FreedaNextPage, FreedaLegacyFlowPage, HomePage, HowWeBuildPage, InfrastructurePage, EnterpriseReadinessPage, LybiArchitecturePage, LybiTechnologyPage, LybiBankingDeckPage, LybiDecisionResearchPage, IPDisclosurePage, KBvsTriggeredPage, KostaHandoffPage, LLMGuidePage, LybiBrainPage, LybiKnowledgePage, LybiCostPage, LybiInstallPage, LybiSupportPage, LybiLandingPage, KBPage, DashboardPage, NotFoundPage, OneZeroPage, OneZeroDashboardPage, OneZeroLandingPage, PitchDeckPage, TeamPlanPage, ZolstockPurchasingSpecPage, ZolstockPurchasingClientPage, SuperAdminUsersPage, TaskBoardPage, TechBacklogPage, TiktokPage, Zer4UPage, NewDeliPage, TheStockPage, HyperToyPage, AgentChatWidgetPage, IntelligenceAdminPage, ZolStockPage, TevaNaotPage } from './pages';

// Builder lives in its own subtree — lazy so end-user routes don't pay for it.
const BuilderPage = lazy(() => import('./pages/BuilderPage').then(m => ({ default: m.BuilderPage })));
const BuilderHomePage = lazy(() => import('./pages/BuilderHomePage').then(m => ({ default: m.BuilderHomePage })));
// Customer-facing Live chat — its own subtree, lazy-loaded.
const LiveChatPage = lazy(() => import('./pages/LiveChatPage').then(m => ({ default: m.LiveChatPage })));
// Live Brain mockup — standalone demo of the configurable brain panel + setup.
const LiveBrainMockPage = lazy(() => import('./pages/LiveBrainMockPage').then(m => ({ default: m.LiveBrainMockPage })));
const CustomerChatPage = lazy(() => import('./pages/CustomerChatPage').then(m => ({ default: m.CustomerChatPage })));
// On-site embed demo (Lybi mock site + agent widget iframe).
const EmbedPage = lazy(() => import('./pages/EmbedPage').then(m => ({ default: m.EmbedPage })));
// Aspect BI — standalone BI tool over customer data schemas. Lazy so agent
// routes don't pay for the charting code.
const BIPage = lazy(() => import('./pages/BIPage').then(m => ({ default: m.BIPage })));

// Aspect Intelligence — proactive AI-investigation insights product, separate
// from Aspect BI. Lazy for the same reason (own chart/rendering code).
const IntelligencePage = lazy(() => import('./pages/IntelligencePage').then(m => ({ default: m.IntelligencePage })));
const IntelligenceHomePage = lazy(() => import('./pages/IntelligenceHomePage').then(m => ({ default: m.IntelligenceHomePage })));

// Lybi HQ — our internal company brain. Its own subtree under src/hq/, lazy so
// no customer-facing route ever downloads it. Never a product surface.
const HQApp = lazy(() => import('./hq/HQApp').then(m => ({ default: m.HQApp })));

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

        {/* Aspect data agents hub — dedicated link for Itzik, lists only the BI agents */}
        <Route path="/aspect/agents" element={<AspectAgentsHomePage />} />

        {/* Landing Pages - Marketing */}
        <Route path="/aspect-platform" element={<AspectPlatformLandingPage />} />
        <Route path="/aspect-platform/sales" element={<AspectPlatformSalesPage />} />
        <Route path="/aspect-marketing" element={<AspectBattleCardPage />} />
        <Route path="/aspect-marketing-sales" element={<AspectMarketingSalesPage />} />
        <Route path="/aspect/ai" element={<AspectLandingPage />} />
        <Route path="/aspect/architecture" element={<ArchitecturePage />} />
        <Route path="/aspect/system" element={<AspectArchDiagramPage />} />
        <Route path="/aspect/ai-compliance" element={<AICompliancePage />} />
        <Route path="/aspect/ip-disclosure" element={<IPDisclosurePage />} />
        <Route path="/aspect/handoff" element={<KostaHandoffPage />} />
        <Route path="/aspect/pitch" element={<PitchDeckPage />} />
        <Route path="/aspect/plan" element={<TeamPlanPage />} />
        {/* Zol Stock smart-replenishment spec — English engineering brief + its Hebrew customer companion. */}
        <Route path="/aspect/zolstock-purchasing" element={<ZolstockPurchasingSpecPage />} />
        <Route path="/aspect/zolstock-purchasing-he" element={<ZolstockPurchasingClientPage />} />
        <Route path="/lybi/llm-guide" element={<LLMGuidePage />} />
        <Route path="/lybi/how-we-build" element={<HowWeBuildPage />} />
        <Route path="/lybi/brain" element={<LybiBrainPage />} />
        <Route path="/lybi/chain" element={<ChainArchitecturePage />} />
        <Route path="/lybi/crew-builder" element={<CrewBuilderMockupPage />} />
        <Route path="/lybi/kb-vs-triggered" element={<KBvsTriggeredPage />} />
        <Route path="/lybi/infrastructure" element={<InfrastructurePage />} />
        <Route path="/lybi/readiness" element={<EnterpriseReadinessPage />} />
        <Route path="/lybi/architecture" element={<LybiArchitecturePage />} />
        <Route path="/lybi/technology" element={<LybiTechnologyPage />} />
        <Route path="/lybi/knowledge" element={<LybiKnowledgePage />} />
        <Route path="/lybi/banking-deck" element={<LybiBankingDeckPage />} />
        <Route path="/lybi/decision-research" element={<LybiDecisionResearchPage />} />
        <Route path="/lybi/cost" element={<LybiCostPage />} />
        <Route path="/lybi/installation" element={<LybiInstallPage />} />
        <Route path="/lybi/support" element={<LybiSupportPage />} />
        <Route path="/lybi/backlog" element={<TechBacklogPage />} />

        {/* Lybi HQ — internal only. Must sit above the /lybi/* splat below,
            which would otherwise swallow it into the landing page. */}
        <Route path="/lybi/hq/*" element={<HQApp />} />
        {/* The old top-level path, so existing links and bookmarks still land. */}
        <Route path="/hq/*" element={<Navigate to="/lybi/hq" replace />} />
        <Route path="/lybi/about/shlomi" element={<AboutShlomiPage />} />
        <Route path="/lybi/freeda-legacy" element={<FreedaLegacyFlowPage />} />
        {/* Explicit so the `/lybi/*` splat below doesn't shadow the Live chat. */}
        <Route
          path="/lybi/live"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <LiveChatPage />
            </Suspense>
          }
        />
        <Route
          path="/lybi/live/c/:convId"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <LiveChatPage />
            </Suspense>
          }
        />
        <Route
          path="/lybi/embed"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <EmbedPage />
            </Suspense>
          }
        />
        {/* Live Brain mockup (standalone demo — not wired to a live agent). */}
        <Route
          path="/lybi/brain-mock"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <LiveBrainMockPage />
            </Suspense>
          }
        />
        {/* Generic agent-aware authenticated chat (e.g. /lybi/login, /lybi/chat).
            Supported agents are defined in src/agents/agentRegistry.ts. */}
        <Route path="/:agent/login" element={<AgentLoginPage />} />
        <Route path="/:agent/chat" element={<AgentChatPage />} />
        <Route path="/:agent/chat/conversations/:conversationId" element={<AgentChatPage />} />
        {/* Customer-facing Live chat (V2 active runtime). */}
        <Route
          path="/:agent/live"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <LiveChatPage />
            </Suspense>
          }
        />
        {/* Login-gated restricted customer chat (V2) — the link sent to
            business/test users. NOT /:agent/chat: that's the V1 flow. */}
        <Route
          path="/:agent/go"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <CustomerChatPage />
            </Suspense>
          }
        />
        <Route
          path="/:agent/go/c/:convId"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <CustomerChatPage />
            </Suspense>
          }
        />
        <Route
          path="/:agent/live/c/:convId"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <LiveChatPage />
            </Suspense>
          }
        />
        <Route
          path="/:agent/embed"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <EmbedPage />
            </Suspense>
          }
        />
        <Route
          path="/:agent/brain-mock"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <LiveBrainMockPage />
            </Suspense>
          }
        />
        <Route
          path="/builder"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading builder…</div>}>
              <BuilderHomePage />
            </Suspense>
          }
        />
        <Route
          path="/:agent/builder/*"
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
        <Route path="/freedanext" element={<FreedaNextPage />} />
        <Route path="/freedanext/conversations/:conversationId" element={<FreedaNextPage />} />
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
        {/* Compact chat for the Aspect Intelligence floating widget iframe — same
            conversation/history as the agent's own full page, no header/sidebar
            chrome. Generic over :agent so any dataset's Intelligence chat can use it. */}
        <Route path="/:agent/chat-widget" element={<AgentChatWidgetPage />} />
        <Route path="/:agent/chat-widget/conversations/:conversationId" element={<AgentChatWidgetPage />} />
        <Route path="/zolstock" element={<ZolStockPage />} />
        <Route path="/zolstock/conversations/:conversationId" element={<ZolStockPage />} />
        <Route path="/tevanaot" element={<TevaNaotPage />} />
        <Route path="/tevanaot/conversations/:conversationId" element={<TevaNaotPage />} />

        {/* ONE ZERO - Aspect demo for digital bank churn */}
        <Route path="/aspect/onezero" element={<OneZeroLandingPage />} />
        <Route path="/aspect/onezero/dashboard" element={<OneZeroDashboardPage />} />
        <Route path="/aspect/onezero/chat" element={<OneZeroPage />} />
        <Route path="/aspect/onezero/chat/conversations/:conversationId" element={<OneZeroPage />} />

        {/* Aspect BI - standalone BI tool (independent of the agent system) */}
        <Route
          path="/bi"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading BI…</div>}>
              <BIPage />
            </Suspense>
          }
        />
        <Route
          path="/bi/:datasetId"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading BI…</div>}>
              <BIPage />
            </Suspense>
          }
        />

        {/* Aspect Intelligence - proactive AI-investigation insights (separate from Aspect BI) */}
        <Route
          path="/intelligence"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <IntelligenceHomePage />
            </Suspense>
          }
        />
        <Route
          path="/intelligence/:datasetId"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <IntelligencePage />
            </Suspense>
          }
        />
        <Route
          path="/intelligence/:datasetId/insight/:insightId"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <IntelligencePage />
            </Suspense>
          }
        />
        <Route
          path="/intelligence/:datasetId/reports"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <IntelligencePage />
            </Suspense>
          }
        />
        <Route
          path="/intelligence/:datasetId/reports/history"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <IntelligencePage />
            </Suspense>
          }
        />
        <Route
          path="/intelligence/:datasetId/chat"
          element={
            <Suspense fallback={<div style={{ padding: 40 }}>Loading…</div>}>
              <IntelligencePage />
            </Suspense>
          }
        />

        {/* Task Board - standalone full page */}
        <Route path="/tasks" element={<TaskBoardPage />} />
        <Route path="/tasks/:taskId" element={<TaskBoardPage />} />

        {/* Hidden super-admin users page (code-gated; sees all tenants) */}
        <Route path="/users/*" element={<SuperAdminUsersPage />} />

        {/* Hidden Aspect Intelligence admin (login-gated; cross-dataset enable/config/monitor) */}
        <Route path="/intelligence/admin/*" element={<IntelligenceAdminPage />} />

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
