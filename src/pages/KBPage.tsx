import { useParams, Navigate, Link } from 'react-router-dom';
import { AgentProvider, ThemeProvider, UserProvider } from '../context';
import { aspectConfig, freedaConfig } from '../agents';
import { KBManager } from '../components/kb/KBManager';
import type { AgentConfig } from '../types';

const agentConfigs: Record<string, AgentConfig> = {
  aspect: aspectConfig,
  freeda: freedaConfig,
};

export function KBPage() {
  const { agent } = useParams<{ agent: string }>();
  const config = agent ? agentConfigs[agent.toLowerCase()] : null;

  if (!config) {
    return <Navigate to="/aspect" replace />;
  }

  return (
    <ThemeProvider storagePrefix={config.storagePrefix}>
      <UserProvider storagePrefix={config.storagePrefix} baseURL={config.baseURL}>
        <AgentProvider config={config}>
          <div style={{ minHeight: '100vh', backgroundColor: 'var(--background)' }}>
            <header style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              backgroundColor: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <Link
                  to={`/${agent}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Back to Chat
                </Link>
              </div>
              <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Knowledge Base - {config.displayName}
              </h1>
              <div style={{ width: 100 }} />
            </header>
            <KBManager />
          </div>
        </AgentProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
