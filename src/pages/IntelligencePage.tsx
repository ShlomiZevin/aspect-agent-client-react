/**
 * Aspect Intelligence — proactive AI-investigation insights product. Separate
 * from Aspect BI (BIPage/BIShell); see IntelligenceShell. First dataset: hypertoy.
 *
 * Routes: /intelligence (defaults to hypertoy), /intelligence/:datasetId,
 * /intelligence/:datasetId/insight/:insightId, and /intelligence/:datasetId/chat
 * — real URLs (not just internal component state) so each view can be
 * linked/bookmarked/shared and back/forward work, and so the nav's active
 * item and the chat widget's open/expanded state always agree with the URL.
 * Nested under :datasetId rather than flat paths since more internal
 * Intelligence pages are expected later.
 */
import { useParams, useLocation } from 'react-router-dom';
import { IntelligenceShell } from '../components/intelligence/IntelligenceShell';
import { useDocumentMeta } from '../hooks';

const DEFAULT_DATASET = 'hypertoy';

export function IntelligencePage() {
  const { datasetId, insightId } = useParams<{ datasetId: string; insightId?: string }>();
  const location = useLocation();
  const dataset = datasetId || DEFAULT_DATASET;
  const isChatRoute = location.pathname.endsWith('/chat');

  useDocumentMeta({
    title: 'Aspect Intelligence',
    description: 'Aspect proactively investigates your data and surfaces findings.',
  });

  return <IntelligenceShell datasetId={dataset} title="Hyper Toy" insightId={insightId} chatRoute={isChatRoute} />;
}
