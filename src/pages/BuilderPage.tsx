import { useParams } from 'react-router-dom';
import { BuilderApp } from '../builder';

export function BuilderPage() {
  const { agent } = useParams<{ agent: string }>();
  return <BuilderApp agentSlug={agent ?? 'default'} />;
}
