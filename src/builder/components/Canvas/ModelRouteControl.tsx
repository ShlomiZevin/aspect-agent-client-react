/**
 * ModelRouteControl — the agent's "Model route: Direct / Vertex" switch
 * (task #984) — a settings row of its own at the top of the agent page's
 * Setup card, under the "Setup" title.
 *
 *   Direct — our own provider keys (the default; stored as absent).
 *   Vertex — every model call of this agent goes through Google Vertex AI.
 *
 * No new screen: one segmented toggle + a warning pill. The pill lists
 * everything that would FAIL on Vertex (a model not on Vertex, or an
 * OpenAI add-on with Web search on — there is no fallback to the direct
 * API). It is always rendered and only hidden with `visibility`, so
 * flipping the toggle never moves or resizes anything. On Direct the same
 * list sits in the Vertex button's tooltip ("before switching").
 *
 * BETA (Shlomi, 2026-11-17): Vertex isn't active yet (quota / Google
 * approval pending), so the label carries a "Beta" badge and switching TO
 * Vertex asks first, in the Builder's own confirm modal.
 *
 * The scan mirrors the server's `vertexProblems` (services/modelRoute.js):
 * every `{ providerId, modelId }` anywhere in the agent body or a crew
 * body, so nested models (KB Retriever steps, Live Brain / Profiler
 * panels, Ask Profiler) count too.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { useModels } from '../../registry/useModels';
import type { ModelInfo, ProviderInfo } from '../../registry/providerModels';
import type { AgentDoc } from '../../types';
import styles from './AgentSetupArea.module.css';

interface VertexProblem {
  reason: 'model' | 'web_search';
  where: string;
  modelName: string;
}

const SECTION_LABELS: Record<string, string> = {
  cortex: 'Agent level', liveBrain: 'Live Brain', profiler: 'Profiler', ask: 'Ask Profiler', trigger: 'KB trigger', query: 'KB query',
};

type Node = Record<string, unknown>;
const isObj = (v: unknown): v is Node => !!v && typeof v === 'object';

/** 'field-extractor' → 'Field Extractor' — for an add-on with no name. */
function pluginLabel(id: string): string {
  return id.split('-').map(w => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

function vertexProblems(agent: AgentDoc, providers: ProviderInfo[]): VertexProblem[] {
  if (providers.length === 0) return []; // registry not loaded yet — don't guess
  const byId = new Map<string, ModelInfo>();
  for (const p of providers) for (const m of p.models) byId.set(m.id, m);
  const out: VertexProblem[] = [];
  const seen = new Set<string>();
  const add = (reason: VertexProblem['reason'], where: string, modelId: string) => {
    const key = `${reason}|${where}|${modelId}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ reason, where, modelName: byId.get(modelId)?.name ?? modelId });
  };
  const walk = (node: unknown, trail: string[]) => {
    if (Array.isArray(node)) { node.forEach(n => walk(n, trail)); return; }
    if (!isObj(node)) return;
    let t = trail;
    if (typeof node.pluginId === 'string') {
      const cfg = isObj(node.config) ? node.config : {};
      const named = (typeof cfg.name === 'string' && cfg.name.trim()) || (typeof node.name === 'string' && node.name.trim());
      const label = named || pluginLabel(node.pluginId);
      t = [...trail, label];
      const model = isObj(cfg.model) ? cfg.model : null;
      const ws = isObj(cfg.webSearch) ? cfg.webSearch : null;
      if (ws?.enabled && model && model.providerId === 'openai' && typeof model.modelId === 'string') {
        add('web_search', t.join(' · '), model.modelId);
      }
    } else if (typeof node.title === 'string' && node.title.trim()) {
      t = [...trail, node.title.trim()];
    }
    if (typeof node.modelId === 'string' && node.modelId && !byId.get(node.modelId)?.vertex) {
      add('model', t.join(' · ') || 'Agent', node.modelId);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'versions' || k === 'crews' || !isObj(v)) continue;
      walk(v, SECTION_LABELS[k] && typeof (v as Node).pluginId !== 'string' ? [...t, SECTION_LABELS[k]] : t);
    }
  };
  walk({ ...agent, crews: undefined, versions: undefined }, []);
  for (const crew of agent.crews ?? []) {
    walk({ ...crew, versions: undefined }, [`Crew "${(crew.name || '').trim() || 'crew'}"`]);
  }
  return out;
}

function problemLine(p: VertexProblem): string {
  return p.reason === 'web_search'
    ? `${p.where} — Web search on ${p.modelName} (OpenAI web search is not on Vertex)`
    : `${p.where} — ${p.modelName}`;
}

const BETA_TIP = "Beta — Vertex isn't active yet (waiting for Google approval). Agents on Vertex won't answer.";

export function ModelRouteControl({ agent }: { agent: AgentDoc }) {
  const { updateAgent } = useBuilder();
  const confirm = useConfirm();
  const { providers } = useModels();
  const vertex = agent.modelRoute === 'vertex';
  const problems = useMemo(() => vertexProblems(agent, providers), [agent, providers]);
  const list = problems.map(problemLine).join('\n');
  const n = problems.length;
  const showWarn = vertex && n > 0;

  // Beta: switching TO Vertex asks first (the Builder's own confirm modal,
  // never window.confirm). Back to Direct needs no confirm.
  const switchToVertex = async () => {
    if (vertex) return;
    const ok = await confirm({
      title: 'Switch to Vertex? (beta)',
      message: 'Vertex is beta and not active yet — this agent will stop answering until Vertex is active.',
      confirmLabel: 'Switch to Vertex',
      cancelLabel: 'Cancel',
    });
    if (ok) updateAgent(agent.id, { modelRoute: 'vertex' });
  };

  return (
    <div className={styles.route}>
      <span className={styles.routeLabel} title={BETA_TIP}>
        Model route
        <span className={styles.routeBeta}>Beta</span>
      </span>
      <div className={styles.routeSeg} role="radiogroup" aria-label="Model route">
        <button
          type="button"
          role="radio"
          aria-checked={!vertex}
          className={`${styles.routeOpt} ${!vertex ? styles.routeOptOn : ''}`}
          onClick={() => { if (vertex) updateAgent(agent.id, { modelRoute: undefined }); }}
          title="Our own provider keys (default)"
        >
          Direct
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={vertex}
          className={`${styles.routeOpt} ${vertex ? styles.routeOptOn : ''}`}
          onClick={() => { void switchToVertex(); }}
          title={n > 0
            ? `Every call through Google Vertex AI.\nWould fail on Vertex (${n}):\n${list}`
            : 'Every call through Google Vertex AI. All models of this agent are on Vertex.'}
        >
          Vertex
        </button>
      </div>
      {/* Last in the row, so its reserved (hidden) space sits at the end. */}
      <span
        className={`${styles.routeWarn} ${showWarn ? '' : styles.routeWarnHidden}`}
        title={`These fail on Vertex — no fallback to the direct API:\n${list}`}
        aria-hidden={!showWarn}
      >
        ⚠ {n} not on Vertex
      </span>
    </div>
  );
}
