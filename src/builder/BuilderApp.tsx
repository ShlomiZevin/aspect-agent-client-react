/**
 * BuilderApp — the root composition.
 *
 * Importing './plugins' here triggers plugin registration as a side
 * effect (idempotent in practice — registry is module-scoped).
 */

import { useEffect, useMemo } from 'react';
import { BuilderProvider } from './state/BuilderContext';
import { BuilderLayout } from './components/BuilderLayout/BuilderLayout';
import { TopBar } from './components/TopBar/TopBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { ChatPanel } from './components/ChatPanel/ChatPanel';
import { ConfirmProvider } from './components/Confirm/Confirm';
import { loadModelsFromServer } from './registry/providerModels';

// Side effect: register all built-in plugins.
import './plugins';

const OWNER_KEY = 'builder:ownerUserId';

/**
 * Read or mint the builder's owner user id from localStorage.
 * Matches v1's "default dummy user" pattern — the server treats it
 * as the external id when creating the corresponding `users` row.
 */
function getOrCreateOwnerUserId(): string {
  try {
    const existing = localStorage.getItem(OWNER_KEY);
    if (existing && existing.length > 0) return existing;
    const next = `builder-owner-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
    localStorage.setItem(OWNER_KEY, next);
    return next;
  } catch {
    // Private mode / unavailable storage — generate per-session.
    return `builder-owner-anon-${Date.now()}`;
  }
}

interface Props {
  agentSlug: string;
}

export function BuilderApp({ agentSlug }: Props) {
  const ownerUserId = useMemo(() => getOrCreateOwnerUserId(), []);
  // Warm the central models registry as early as possible. Hook
  // callers (ModelPicker etc.) will pick it up via subscribeModels.
  useEffect(() => { loadModelsFromServer(); }, []);
  return (
    <BuilderProvider agentSlug={agentSlug} ownerUserId={ownerUserId}>
      <ConfirmProvider>
        <BuilderLayout
          topBar={<TopBar />}
          sidebar={<Sidebar />}
          center={<Canvas />}
          chat={<ChatPanel />}
        />
      </ConfirmProvider>
    </BuilderProvider>
  );
}
