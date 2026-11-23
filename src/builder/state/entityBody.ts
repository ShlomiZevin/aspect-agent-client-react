/**
 * entityBody — the ONE definition of an agent / crew version body on the
 * client, and of when two bodies count as "the same".
 *
 * Two functions per entity, deliberately different jobs:
 *
 *   bodyOfAgent / bodyOfCrew
 *     The PROJECTION: working copy → the body that gets saved, sent as a
 *     runtime-preview override, and snapshotted locally. Its "empty ==
 *     absent" rules (no `tags` key when there are none, no `liveBrain`
 *     without panels, no `modelRoute` when Direct, …) decide what a saved
 *     body looks like. Changing it changes what is written to the server.
 *
 *   canonicalAgentBody / canonicalCrewBody
 *     The COMPARISON form: ANY body — a working copy or a saved version
 *     body, whoever wrote it (the Builder, the MCP, a script, an
 *     environment copy, an older client) — is first given the defaults the
 *     server's load applies when it builds the working copy
 *     (`builderProjects.hydrateProject`: missing text → '', missing or
 *     non-array lists → []), then run through the projection above. So the
 *     empty == absent rules exist exactly once, and a saved `tags: []`,
 *     `modelRoute: 'direct'`, `liveBrain: { panels: [] }`, a missing
 *     `spec`, or a key the Builder doesn't know canonicalises the same as
 *     the working copy it loads into.
 *
 * Every "is this unsaved?" check goes through `agentBodiesEqual` /
 * `crewBodiesEqual` (or fingerprints a canonical body), which canonicalise
 * BOTH sides. Never compare a raw saved body. A new body section needs a
 * line in the projection only — the comparison picks it up from there.
 *
 *   applyAgentBody / applyCrewBody
 *     The INVERSE, for Discard: a saved body back onto the working copy —
 *     every section, same load defaults, sections the body lacks cleared.
 *     Its key list is checked against the types at compile time.
 *
 * Pure: no React, no I/O.
 */

import type { AgentBody, CrewBody } from '../types';

/**
 * Stable JSON stringify — sorts object keys so two equal objects produce
 * the same string regardless of key insertion order (Postgres `jsonb`
 * doesn't preserve key order across a round-trip).
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map(k => [k, (v as Record<string, unknown>)[k]]),
      );
    }
    return v;
  });
}

// ─── The projection (what gets saved) ──────────────────────────────

/**
 * The version-body slice of an agent. Takes an `AgentDoc` (the working
 * copy) or an `AgentBody`. Each optional section is snapshotted only when
 * it holds something — empty == absent — so agents that never used a
 * section keep comparing equal to version bodies saved before it existed.
 */
export function bodyOfAgent(agent: AgentBody): AgentBody {
  return {
    name: agent.name,
    slug: agent.slug,
    spec: agent.spec,
    persona: agent.persona,
    personas: agent.personas ?? [],
    defaultCrewId: agent.defaultCrewId,
    fields: agent.fields,
    domains: agent.domains ?? [],
    // Declared tags (the Tags screen's list) — only once there are any.
    ...((agent.tags?.length) ? { tags: agent.tags } : {}),
    parameters: agent.parameters ?? [],
    enums: agent.enums ?? [],
    cortex: agent.cortex ?? [],
    snippets: agent.snippets ?? [],
    // Live Brain / Profiler: only once configured; `enabled: false` also
    // persists so a disabled surface stays disabled.
    ...((agent.liveBrain?.panels?.length || agent.liveBrain?.frame || agent.liveBrain?.enabled === false) ? { liveBrain: agent.liveBrain } : {}),
    ...((agent.profiler?.panels?.length || agent.profiler?.frame || agent.profiler?.ask || agent.profiler?.enabled === false) ? { profiler: agent.profiler } : {}),
    // Triggers (proactive).
    ...((agent.triggers?.triggers?.length || agent.triggers?.enabled === false) ? { triggers: agent.triggers } : {}),
    // CREWS sidebar tree (#855) — display only.
    ...(Object.keys(agent.crewTree?.parents ?? {}).length ? { crewTree: agent.crewTree } : {}),
    // Model route (#984): Direct == absent.
    ...(agent.modelRoute === 'vertex' ? { modelRoute: 'vertex' as const } : {}),
    // Data protection (#986): absent = off.
    ...(agent.dataProtection ? { dataProtection: agent.dataProtection } : {}),
  };
}

/** The version-body slice of a crew. Takes a `CrewDoc` or a `CrewBody`. */
export function bodyOfCrew(crew: CrewBody): CrewBody {
  return {
    name: crew.name,
    description: crew.description,
    spec: crew.spec,
    persona: crew.persona,
    addons: crew.addons,
    fields: crew.fields,
    // Data protection override (#986) — absent = follow the agent.
    ...(crew.dataProtection ? { dataProtection: crew.dataProtection } : {}),
  };
}

// ─── The load defaults ─────────────────────────────────────────────

function list<T>(v: T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : [];
}

/**
 * A saved agent body as the working copy holds it after a load. Mirrors the
 * server's working-copy hydration (`hydrateProject` in
 * aspect-agent-server/builder/services/builderProjects.js) — keep them in
 * step if that changes. Every other key passes through untouched.
 */
function withAgentLoadDefaults(body: AgentBody): AgentBody {
  return {
    ...body,
    name:       body.name || body.slug,
    spec:       body.spec || '',
    persona:    body.persona || '',
    personas:   list(body.personas),
    fields:     list(body.fields),
    domains:    list(body.domains),
    tags:       list(body.tags),
    parameters: list(body.parameters),
    enums:      list(body.enums),
    cortex:     list(body.cortex),
    snippets:   list(body.snippets),
  };
}

/** The crew counterpart of `withAgentLoadDefaults` (same hydration mirror). */
function withCrewLoadDefaults(body: CrewBody): CrewBody {
  return {
    ...body,
    name:        body.name || '',
    description: body.description || '',
    spec:        body.spec || '',
    addons:      list(body.addons),
    fields:      list(body.fields),
  };
}

// ─── The comparison form ───────────────────────────────────────────

/** Comparison form of any agent body: load defaults, then the projection. Idempotent. */
export function canonicalAgentBody(body: AgentBody): AgentBody {
  return bodyOfAgent(withAgentLoadDefaults(body));
}

/** Comparison form of any crew body: load defaults, then the projection. Idempotent. */
export function canonicalCrewBody(body: CrewBody): CrewBody {
  return bodyOfCrew(withCrewLoadDefaults(body));
}

// ─── The inverse: a saved body back onto the working copy ──────────

/**
 * Every key of a version body. TypeScript refuses to compile if `AgentBody`
 * / `CrewBody` (builder/types) gains a key that is not listed here — so a
 * new section can't be left out of Discard.
 */
const AGENT_BODY_KEYS = [
  'name', 'slug', 'spec', 'persona', 'defaultCrewId', 'fields', 'domains', 'tags',
  'parameters', 'enums', 'cortex', 'snippets', 'personas', 'liveBrain', 'profiler',
  'triggers', 'crewTree', 'modelRoute', 'dataProtection',
] as const satisfies readonly (keyof AgentBody)[];
const CREW_BODY_KEYS = [
  'name', 'description', 'spec', 'persona', 'addons', 'fields', 'dataProtection',
] as const satisfies readonly (keyof CrewBody)[];
type AssertNone<T extends never> = T;
/** Compile-time completeness checks for the two key lists above. */
export type AgentBodyKeysComplete = AssertNone<Exclude<keyof AgentBody, (typeof AGENT_BODY_KEYS)[number]>>;
export type CrewBodyKeysComplete = AssertNone<Exclude<keyof CrewBody, (typeof CREW_BODY_KEYS)[number]>>;

function applyKeys<T extends object>(doc: T, loaded: object, keys: readonly string[]): T {
  const next = { ...doc } as Record<string, unknown>;
  const from = loaded as Record<string, unknown>;
  for (const k of keys) {
    // A section the saved body doesn't have is cleared, not kept.
    if (from[k] === undefined) delete next[k];
    else next[k] = from[k];
  }
  return next as T;
}

/**
 * The inverse of `bodyOfAgent`: put a saved body back onto a working-copy
 * agent — every body section, with the load defaults, exactly as a fresh
 * load would. Everything that isn't body (id, crews, versions, pointers)
 * is kept. Used by Discard. Afterwards `agentBodiesEqual(result, body)`.
 */
export function applyAgentBody<T extends AgentBody>(doc: T, body: AgentBody): T {
  // The load takes the slug from the agent row; the row and body agree, but
  // an old body without one keeps the doc's.
  const slug = body.slug || doc.slug;
  return applyKeys(doc, withAgentLoadDefaults({ ...body, slug }), AGENT_BODY_KEYS);
}

/** The inverse of `bodyOfCrew` (see `applyAgentBody`). */
export function applyCrewBody<T extends CrewBody>(doc: T, body: CrewBody): T {
  return applyKeys(doc, withCrewLoadDefaults(body), CREW_BODY_KEYS);
}

/** Same agent content? Both sides canonicalised; key order ignored. */
export function agentBodiesEqual(a: AgentBody, b: AgentBody): boolean {
  return stableStringify(canonicalAgentBody(a)) === stableStringify(canonicalAgentBody(b));
}

/** Same crew content? Both sides canonicalised; key order ignored. */
export function crewBodiesEqual(a: CrewBody, b: CrewBody): boolean {
  return stableStringify(canonicalCrewBody(a)) === stableStringify(canonicalCrewBody(b));
}
