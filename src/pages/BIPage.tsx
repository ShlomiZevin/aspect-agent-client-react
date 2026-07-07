/**
 * Aspect BI — standalone business-intelligence tool over a customer data
 * schema. Independent of the agent/crew system. Self-contained visual system
 * (see BIShell). First dataset: hypertoy.
 *
 * Route: /bi (defaults to the hypertoy dataset) and /bi/:datasetId.
 */
import { useParams } from 'react-router-dom';
import { BIShell } from '../components/bi';
import { useDocumentMeta } from '../hooks';

const DEFAULT_DATASET = 'hypertoy';

export function BIPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const dataset = datasetId || DEFAULT_DATASET;

  useDocumentMeta({
    title: 'Aspect BI',
    description: 'Aspect-owned business intelligence over customer data schemas.',
  });

  return <BIShell datasetId={dataset} title="Aspect BI" />;
}
