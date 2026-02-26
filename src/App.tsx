import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AspectPage, AspectLandingPage, BankingOnboarderPage, BylinePage, DemoPage, FreedaPage, HomePage, LybiLandingPage, KBPage, DashboardPage, NotFoundPage } from './pages';
import { useTaskBoard, useQuickBug } from './hooks';
import { TaskBoardModal } from './components/tasks/TaskBoardModal/TaskBoardModal';
import { QuickBugModal } from './components/tasks/QuickBugModal/QuickBugModal';
import { createTask } from './services/taskService';
import type { CreateTaskData } from './types/task';
import './styles/global.css';

// Inner component that has access to router context
function AppContent() {
  const location = useLocation();
  const { isOpen: isTaskBoardOpen, closeModal: closeTaskBoard, openInDraftsMode, clearDraftsMode } = useTaskBoard();
  const { isOpen: isQuickBugOpen, closeModal: closeQuickBug } = useQuickBug();

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
      {/* Global Task Board Modal - Ctrl+Shift+Space to toggle */}
      <TaskBoardModal isOpen={isTaskBoardOpen} onClose={closeTaskBoard} openInDraftsMode={openInDraftsMode} onDraftsModeAcknowledged={clearDraftsMode} />

      {/* Quick Bug Modal - Ctrl+Shift+Q to open */}
      <QuickBugModal
        isOpen={isQuickBugOpen}
        onClose={closeQuickBug}
        onSubmit={handleQuickBugSubmit}
        currentDomain={currentDomain}
        conversationUrl={conversationUrl}
      />

      <Routes>
        {/* Home page - agent selection */}
        <Route path="/" element={<HomePage />} />

        {/* Landing Pages - Marketing */}
        <Route path="/aspect/ai" element={<AspectLandingPage />} />
        <Route path="/lybi/*" element={<LybiLandingPage />} />

        {/* Main agent routes with optional conversation ID */}
        <Route path="/aspect" element={<AspectPage />} />
        <Route path="/aspect/conversations/:conversationId" element={<AspectPage />} />
        <Route path="/banking" element={<BankingOnboarderPage />} />
        <Route path="/banking/conversations/:conversationId" element={<BankingOnboarderPage />} />
        <Route path="/byline" element={<BylinePage />} />
        <Route path="/byline/conversations/:conversationId" element={<BylinePage />} />
        <Route path="/freeda" element={<FreedaPage />} />
        <Route path="/freeda/conversations/:conversationId" element={<FreedaPage />} />

        {/* Dashboard routes */}
        <Route path="/:agent/dashboard/*" element={<DashboardPage />} />

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
