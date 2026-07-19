/** Landing page for Aspect Intelligence — dataset picker. Route: /intelligence. */
import { IntelligenceHome } from '../components/intelligence/IntelligenceHome';
import { useDocumentMeta } from '../hooks';

export function IntelligenceHomePage() {
  useDocumentMeta({
    title: 'Aspect Intelligence',
    description: 'Choose a data source to explore with Aspect Intelligence.',
  });

  return <IntelligenceHome />;
}
