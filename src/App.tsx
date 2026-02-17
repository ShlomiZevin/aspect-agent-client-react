import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AspectPage, AspectLandingPage, BankingOnboarderPage, BylinePage, FreedaPage, HomePage, LybiLandingPage, KBPage, DashboardPage, NotFoundPage } from './pages';
import { useTaskBoard } from './hooks';
import { TaskBoardModal } from './components/tasks/TaskBoardModal/TaskBoardModal';
import './styles/global.css';

function App() {
  const { isOpen, closeModal } = useTaskBoard();

  return (
    <BrowserRouter>
      {/* Global Task Board Modal - Ctrl+Shift+Space to toggle */}
      <TaskBoardModal isOpen={isOpen} onClose={closeModal} />

      <Routes>
        {/* Home page - agent selection */}
        <Route path="/" element={<HomePage />} />

        {/* Landing Pages - Marketing */}
        <Route path="/aspect/ai" element={<AspectLandingPage />} />
        <Route path="/lybi" element={<LybiLandingPage />} />

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

        {/* Legacy URL redirects */}
        <Route path="/aspect.html" element={<Navigate to="/aspect" replace />} />
        <Route path="/freeda.html" element={<Navigate to="/freeda" replace />} />
        <Route path="/kb.html" element={<Navigate to="/kb/freeda" replace />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
