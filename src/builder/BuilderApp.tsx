/**
 * BuilderApp — the root composition.
 *
 * Mounts a "does this agent exist?" gate BEFORE the BuilderProvider:
 * a typo'd `/foo/builder` URL used to silently bootstrap a phantom
 * project. Now it asks the user before creating anything.
 *
 * Importing './plugins' here triggers plugin registration as a side
 * effect (idempotent in practice — registry is module-scoped).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { BuilderProvider, emptyProject } from './state/BuilderContext';
import { BrainProvider } from './state/BrainContext';
import { BuilderLayout } from './components/BuilderLayout/BuilderLayout';
import { TopBar } from './components/TopBar/TopBar';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Canvas } from './components/Canvas/Canvas';
import { DynamicContextScreen } from './components/DynamicContextScreen/DynamicContextScreen';
import { PersonasScreen } from './components/PersonasScreen/PersonasScreen';
import { AdminDashboard } from './components/AdminDashboard/AdminDashboard';
import { BrainDockSlot, BrainFullscreenLayer } from './components/BrainPanel/BrainPanel';
import { ChatPanel } from './components/ChatPanel/ChatPanel';
import { ConfirmProvider } from './components/Confirm/Confirm';
import { SnippetCreatorProvider } from './components/Snippets/SnippetCreator';
import { useAutoSave } from './hooks/useAutoSave';
import { loadModelsFromServer } from './registry/providerModels';
import { bootstrapProject, fetchProject } from './state/builderApi';
import type { ProjectDoc } from './types';
import gateStyles from './BuilderApp.module.css';

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

type GateState =
  | { kind: 'checking' }
  | { kind: 'loaded'; doc: ProjectDoc }
  | { kind: 'missing' }
  | { kind: 'creating' }
  | { kind: 'error'; message: string };

interface Props {
  agentSlug: string;
}

export function BuilderApp({ agentSlug }: Props) {
  const ownerUserId = useMemo(() => getOrCreateOwnerUserId(), []);
  // Warm the central models registry as early as possible. Hook
  // callers (ModelPicker etc.) will pick it up via subscribeModels.
  useEffect(() => { loadModelsFromServer(); }, []);

  const [gate, setGate] = useState<GateState>({ kind: 'checking' });

  // Load the project once, here — BuilderProvider receives the doc as
  // a prop so its render 1 is consistent (no placeholder swap mid-mount).
  useEffect(() => {
    let cancelled = false;
    setGate({ kind: 'checking' });
    fetchProject({ agentSlug, ownerUserId })
      .then(doc => {
        if (cancelled) return;
        setGate(doc ? { kind: 'loaded', doc } : { kind: 'missing' });
      })
      .catch(err => {
        if (cancelled) return;
        setGate({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => { cancelled = true; };
  }, [agentSlug, ownerUserId]);

  const onCreate = useCallback(async () => {
    setGate({ kind: 'creating' });
    try {
      const proj = emptyProject(agentSlug);
      const agent = proj.agents[0];
      const crew = agent.crews[0];
      const doc = await bootstrapProject({
        ownerUserId,
        projectId:      proj.id,
        projectName:    proj.name,
        agentId:        agent.id,
        agentSlug:      agent.slug,
        agentVersionId: agent.versions[0].id,
        agentBody: {
          name:          agent.name,
          slug:          agent.slug,
          spec:          agent.spec,
          persona:       agent.persona,
          defaultCrewId: agent.defaultCrewId,
          fields:        agent.fields,
          domains:       agent.domains ?? [],
          parameters:    agent.parameters ?? [],
        },
        crewId:        crew.id,
        crewVersionId: crew.versions[0].id,
        crewBody: {
          name:        crew.name,
          description: crew.description,
          spec:        crew.spec,
          persona:     crew.persona,
          addons:      crew.addons,
          fields:      crew.fields,
        },
      });
      // Use the server's canonical response as the seed for the
      // provider — same path the load effect takes, no swap mid-mount.
      setGate({ kind: 'loaded', doc });
    } catch (err) {
      setGate({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }, [agentSlug, ownerUserId]);

  if (gate.kind === 'checking') {
    return (
      <LoadingGate label="Looking up agent" slug={agentSlug} />
    );
  }
  if (gate.kind === 'missing') {
    return (
      <GateScreen>
        <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>This agent doesn’t exist yet</h2>
        <p style={{ margin: '0 0 18px', color: '#6b7280', fontSize: 13 }}>
          Create it now, or head back to your list.
        </p>
        <div className={gateStyles.gateSlug} style={{ marginBottom: 22 }}>
          {agentSlug}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button type="button" onClick={onCreate} style={primaryBtn}>Create</button>
          <Link to="/builder" style={secondaryBtn}>Cancel</Link>
        </div>
      </GateScreen>
    );
  }
  if (gate.kind === 'creating') {
    return (
      <LoadingGate label="Creating agent" slug={agentSlug} accent />
    );
  }
  if (gate.kind === 'error') {
    return (
      <GateScreen>
        <h2 style={{ margin: '0 0 8px', color: '#dc2626', fontSize: 18 }}>Couldn’t load this agent</h2>
        <p style={{ margin: '0 0 18px', color: '#4b5563', fontSize: 13 }}>{gate.message}</p>
        <Link to="/builder" style={secondaryBtn}>Back to your agents</Link>
      </GateScreen>
    );
  }

  // gate.kind === 'loaded' — render the builder with the loaded doc.
  // The admin dashboard is a SIBLING of the builder shell (full
  // viewport, its own left-menu rail) rather than nested inside the
  // three-panel layout — so switching to `/admin` "swaps" the left
  // menu to admin and back. Both live under the same providers so the
  // admin can read the agent via `useBuilder()`.
  return (
    <BuilderProvider agentSlug={agentSlug} ownerUserId={ownerUserId} initialDoc={gate.doc}>
      <BrainProvider>
        <ConfirmProvider>
          <SnippetCreatorProvider>
            <Routes>
              <Route path="admin/*" element={<AdminDashboard />} />
              <Route path="*" element={<BuilderShell />} />
            </Routes>
          </SnippetCreatorProvider>
        </ConfirmProvider>
      </BrainProvider>
    </BuilderProvider>
  );
}

/**
 * Inner shell — exists so hooks that depend on BuilderContext (and
 * ConfirmProvider) can mount alongside the layout. Auto-save lives
 * here because it reads dirty state from the builder doc.
 */
function BuilderShell() {
  useAutoSave();
  return (
    <BuilderLayout
      topBar={<TopBar />}
      sidebar={<Sidebar />}
      center={
        <>
          <Routes>
            {/* Default: project / agent / crew views driven by selection. */}
            <Route index element={<Canvas />} />
            {/* Enum bible: bookmarkable at every level. The screen
                reads its own params (enumName / value / section) so a
                single route component covers the four nesting depths. */}
            <Route path="enums" element={<DynamicContextScreen />} />
            <Route path="enums/:enumName" element={<DynamicContextScreen />} />
            <Route path="enums/:enumName/:value" element={<DynamicContextScreen />} />
            <Route path="enums/:enumName/:value/:section" element={<DynamicContextScreen />} />
            {/* Personas: agent-level multi-persona editor. The screen
                reads its own `personaName` param. */}
            <Route path="personas" element={<PersonasScreen />} />
            <Route path="personas/:personaName" element={<PersonasScreen />} />
          </Routes>
          {/* Brain dock floats at the bottom-right of the canvas (just
              left of the chat column) so the chat column never
              shrinks. Collapsed → thin bar; docked → expands upward
              into the canvas without pushing layout. */}
          <BrainDockSlot />
          {/* Fullscreen posture overlays the whole center cell only —
              sidebar / topbar / chat stay clickable around it. */}
          <BrainFullscreenLayer />
        </>
      }
      chat={<ChatPanel />}
    />
  );
}

/** Card wrapper used by missing / error gates — the ones where the
 *  user has something to do. The loading gates use LoadingGate. */
function GateScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className={gateStyles.gateScreen}>
      <div className={gateStyles.gateCard}>
        {children}
      </div>
    </div>
  );
}

/**
 * Lightweight gate shown while the existence probe runs or while we
 * bootstrap a new agent. Spinner + small label + slug chip — a few
 * pieces of UI feedback instead of a single line of bare text.
 *
 * `accent` flips the slug chip to the indigo "working on this"
 * variant so the "Creating" state visually distinguishes itself from
 * the passive "Looking up" state.
 */
function LoadingGate({ label, slug, accent }: { label: string; slug: string; accent?: boolean }) {
  return (
    <div className={gateStyles.gateScreen}>
      <div className={`${gateStyles.gateCard} ${gateStyles.gateCardLoading}`}>
        <div className={gateStyles.spinner} aria-hidden />
        <div className={gateStyles.gateLabel}>{label}</div>
        <div className={`${gateStyles.gateSlug} ${accent ? gateStyles.gateSlugAccent : ''}`}>
          {slug}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  background: '#6366f1',
  color: '#fff',
  border: '1px solid #6366f1',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtn: React.CSSProperties = {
  padding: '8px 18px',
  fontSize: 13,
  fontWeight: 600,
  background: '#fff',
  color: '#4b5563',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  display: 'inline-block',
};
