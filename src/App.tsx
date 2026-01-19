import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AspectPage, FreedaPage, HomePage, KBPage, NotFoundPage } from './pages';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home page - agent selection */}
        <Route path="/" element={<HomePage />} />

        {/* Main agent routes */}
        <Route path="/aspect" element={<AspectPage />} />
        <Route path="/freeda" element={<FreedaPage />} />

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
