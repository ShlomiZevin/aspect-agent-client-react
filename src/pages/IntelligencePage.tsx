/**
 * Aspect Intelligence — proactive AI-investigation insights product. Separate
 * from Aspect BI (BIPage/BIShell); see IntelligenceShell. Works for any
 * dataset enabled via the admin panel — see insights/datasets/registry.js on
 * the server.
 *
 * Routes: /intelligence (the dataset picker, IntelligenceHomePage — never
 * this component), /intelligence/:datasetId (Home, design turn 10a/10b),
 * /intelligence/:datasetId/insight/:insightId, /intelligence/:datasetId/reports
 * (My Reports, design turn 11a), /intelligence/:datasetId/reports/history
 * (Report history, design turn 12a), and /intelligence/:datasetId/chat — real
 * URLs (not just internal component state) so each view can be
 * linked/bookmarked/shared and back/forward work, and so the nav's active
 * item and the chat widget's open/expanded state always agree with the URL.
 * Nested under :datasetId rather than flat paths since more internal
 * Intelligence pages are expected later.
 */
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { IntelligenceShell } from '../components/intelligence/IntelligenceShell';
import { useDocumentMeta } from '../hooks';

export function IntelligencePage() {
  const { datasetId, insightId } = useParams<{ datasetId: string; insightId?: string }>();
  const location = useLocation();
  const isChatRoute = location.pathname.endsWith('/chat');
  const isHistoryRoute = location.pathname.endsWith('/reports/history');
  const isReportsRoute = !isHistoryRoute && location.pathname.endsWith('/reports');

  useDocumentMeta({
    title: 'Aspect Intelligence',
    description: 'Aspect proactively investigates your data and surfaces findings.',
  });

  // The route is always /intelligence/:datasetId[...] (see App.tsx) — a
  // missing datasetId here isn't a valid state to guess a default for,
  // just send it back to the dataset picker.
  if (!datasetId) return <Navigate to="/intelligence" replace />;

  return (
    <IntelligenceShell
      datasetId={datasetId}
      insightId={insightId}
      chatRoute={isChatRoute}
      reportsRoute={isReportsRoute}
      historyRoute={isHistoryRoute}
    />
  );
}
