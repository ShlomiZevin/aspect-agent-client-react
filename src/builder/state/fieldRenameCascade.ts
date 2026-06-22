/**
 * Field rename cascade — the single place to keep references in sync
 * when a field is renamed.
 *
 * The builder stores field names (not ids) in several places:
 *
 *   - Transition Router conditions (`cond.field`, `cond.fields[]`).
 *   - Per-addon run filters (same condition shape, different
 *     location: `instance.context.filter.conditions[]`).
 *   - FUTURE: `{{field:NAME}}` / `@NAME` tokens inside addon prompts,
 *     snippets, and persona text. See `RENAMERS` below — the wiring
 *     is in place; the renamer functions just need to be written.
 *
 * Without this cascade, a rename leaves dangling references — the
 * condition silently fails at runtime; the prompt token resolves to
 * nothing. See the docs comment on the bug investigation for the
 * full failure mode.
 *
 * Design:
 *   - One pure function per "place that stores a field name". Each
 *     takes (agent, oldName, newName) and returns the updated agent.
 *   - The functions operate on disjoint slices of the agent doc, so
 *     they compose by sequential application.
 *   - `RENAMERS` is the registry. Add new surfaces here as more code
 *     paths start depending on field names. The caller
 *     (`cascadeFieldRename`) doesn't need to change.
 *
 * IMPORTANT: the cascader does NOT update the FieldDef itself.
 * That's the caller's job (typically `useCrewFields.updateField`).
 * The cascader only fixes references that point AT the field. That
 * separation keeps each function single-purpose and means the caller
 * can decide whether to apply the rename atomically or in two steps.
 */

import { isSystemFieldName } from '../registry/systemFields';
import { mapAllPromptText } from './promptTokenCascade';
import type {
  AddonInstance,
  AgentDoc,
  CrewDoc,
  SnippetDef,
  TransitionCondition,
} from '../types';

// ─── Public entry point ──────────────────────────────────────────

type Renamer = (agent: AgentDoc, oldName: string, newName: string) => AgentDoc;

/**
 * The registry. Each entry handles ONE place that stores a field
 * name. Add to this list when a new surface starts depending on
 * field names; the caller stays unchanged.
 */
const RENAMERS: Renamer[] = [
  renameInTransitionConditions,
  renameInAddonFilters,
  renameInSnippetFilters,
  // Token-bearing free-text surfaces. Covered by ONE walker because
  // every surface gets the same `rewriteFieldTokens` treatment —
  // addon prompts, snippet bodies, persona bodies, enum value
  // umbrella + section texts, and the legacy single agent/crew
  // persona strings. See `promptTokenCascade.ts` for the surface
  // list. The walker is identity-preserving so this is cheap when
  // nothing matches.
  renameInPromptTextSurfaces,
];

/**
 * Apply every registered renamer in order. Returns a new agent doc
 * with all references swapped from `oldName` to `newName`.
 *
 * No-op when the names match. Safe to call unconditionally on every
 * field update — the cost of running the renamers when nothing
 * changes is a single comparison per surface.
 */
export function cascadeFieldRename(
  agent: AgentDoc,
  oldName: string,
  newName: string,
): AgentDoc {
  if (!oldName || !newName) return agent;
  if (oldName === newName) return agent;
  // System field names are reserved — they can't be renamed AND
  // they can't be user-targets of a rename. Defensive short-circuit
  // so a buggy caller can't accidentally rewrite condition rows
  // referencing a system field.
  if (isSystemFieldName(oldName) || isSystemFieldName(newName)) return agent;
  let next = agent;
  for (const renamer of RENAMERS) {
    next = renamer(next, oldName, newName);
  }
  return next;
}

// ─── Shared helpers ──────────────────────────────────────────────

/**
 * Rewrite occurrences of a field name inside a free-text string for
 * every well-known token form the builder supports today. Reused by
 * any renamer that operates on a prompt-like body (addon prompts,
 * snippet content, persona text, enum value bodies).
 *
 * Forms covered:
 *   - `{{field:NAME}}` / `{{field:NAME:…}}`
 *   - `{{fieldname:NAME}}` / `{{fieldname:NAME:…}}` (defensive — tail
 *     segments aren't a real token today but the lookahead is generic)
 *   - `{{dc:NAME}}` / `{{dc:NAME:SECTION}}` / `{{dc:NAME:*}}`
 *   - `@NAME` mention prefix used by the mention textarea picker.
 *     Right-bounded by a non-identifier so renaming `@foo` doesn't
 *     also munge `@foobar`. Left-bounded so `email@foo` doesn't catch.
 *
 * Exported because every token-aware renamer (prompts, snippets,
 * persona, enum bodies) calls this. One regex set, one truth.
 */
export function rewriteFieldTokens(
  text: string,
  oldName: string,
  newName: string,
): string {
  if (!text) return text;
  if (oldName === newName) return text;
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // {{field:OLD}} / {{field:OLD:…}}. The `(?=[:}])` lookahead ties
  // the match to the next structural character so renaming `foo`
  // doesn't sweep `foobar` off the line.
  let out = text;
  out = out.replace(new RegExp(`\\{\\{field:${escaped}(?=[:}])`, 'g'), `{{field:${newName}`);
  out = out.replace(new RegExp(`\\{\\{fieldname:${escaped}(?=[:}])`, 'g'), `{{fieldname:${newName}`);
  out = out.replace(new RegExp(`\\{\\{dc:${escaped}(?=[:}])`, 'g'), `{{dc:${newName}`);

  // @OLD mention. Right-bounded by anything that isn't a normal
  // identifier character so `@foo` doesn't catch `@foobar`. Left-
  // bounded by start-of-string OR a non-identifier so `email@foo`
  // doesn't catch.
  out = out.replace(
    new RegExp(`(^|[^A-Za-z0-9_])@${escaped}(?![A-Za-z0-9_])`, 'g'),
    `$1@${newName}`,
  );

  return out;
}

/**
 * Rewrite a single condition's field-name references. Pure — does
 * not mutate `cond`. Returns the same object reference when nothing
 * changed so equality-keyed reducers upstream can short-circuit.
 */
function rewriteCondition(
  cond: TransitionCondition,
  oldName: string,
  newName: string,
): TransitionCondition {
  if (cond.type === 'fields-collected') {
    if (!cond.fields.includes(oldName)) return cond;
    // De-dupe in case the new name is already present (e.g., a prior
    // stacking-bug session left both names in the array).
    const next = Array.from(new Set(
      cond.fields.map(n => (n === oldName ? newName : n)),
    ));
    return { ...cond, fields: next };
  }
  if (cond.type === 'field') {
    if (cond.field !== oldName) return cond;
    return { ...cond, field: newName };
  }
  return cond;
}

/**
 * Map a function over every addon in the agent (cortex + every crew's
 * addons), returning a new agent if any addon changed. Used by every
 * addon-walking renamer.
 */
function mapAddons(
  agent: AgentDoc,
  fn: (addon: AddonInstance) => AddonInstance,
): AgentDoc {
  let agentChanged = false;

  const cortexIn = agent.cortex ?? [];
  const cortexOut = cortexIn.map(a => {
    const next = fn(a);
    if (next !== a) agentChanged = true;
    return next;
  });

  let crewsChanged = false;
  const crewsOut: CrewDoc[] = agent.crews.map(crew => {
    const addonsIn = crew.addons ?? [];
    let crewChanged = false;
    const addonsOut = addonsIn.map(a => {
      const next = fn(a);
      if (next !== a) crewChanged = true;
      return next;
    });
    if (!crewChanged) return crew;
    crewsChanged = true;
    return { ...crew, addons: addonsOut };
  });

  if (!agentChanged && !crewsChanged) return agent;
  return {
    ...agent,
    ...(agentChanged ? { cortex: cortexOut } : {}),
    ...(crewsChanged ? { crews: crewsOut } : {}),
  };
}

// ─── Concrete renamers ───────────────────────────────────────────

/**
 * Transition Router addons store conditions on
 * `instance.config.conditions[]`. Walk every transition-router and
 * rewrite each condition's field references in place.
 */
function renameInTransitionConditions(
  agent: AgentDoc,
  oldName: string,
  newName: string,
): AgentDoc {
  return mapAddons(agent, addon => {
    if (addon.pluginId !== 'transition-router') return addon;
    const cfg = addon.config as { conditions?: TransitionCondition[] } | undefined;
    const list = cfg?.conditions;
    if (!Array.isArray(list) || list.length === 0) return addon;
    let changed = false;
    const next = list.map(c => {
      const updated = rewriteCondition(c, oldName, newName);
      if (updated !== c) changed = true;
      return updated;
    });
    if (!changed) return addon;
    return { ...addon, config: { ...cfg, conditions: next } };
  });
}

/**
 * Any addon can carry a run filter at
 * `instance.context.filter.conditions[]`. Same `TransitionCondition`
 * shape, different storage location, same fix. Single walk covers
 * every plugin id — we don't filter by plugin here because filters
 * are universal.
 */
function renameInAddonFilters(
  agent: AgentDoc,
  oldName: string,
  newName: string,
): AgentDoc {
  return mapAddons(agent, addon => {
    const filter = addon.context?.filter;
    if (!filter) return addon;
    const list = filter.conditions;
    if (!Array.isArray(list) || list.length === 0) return addon;
    let changed = false;
    const next = list.map(c => {
      const updated = rewriteCondition(c, oldName, newName);
      if (updated !== c) changed = true;
      return updated;
    });
    if (!changed) return addon;
    return {
      ...addon,
      context: {
        ...addon.context,
        filter: { mode: filter.mode, conditions: next },
      },
    };
  });
}

/**
 * Walk every prompt-text surface (addon prompts + promptTemplates,
 * snippet bodies, persona bodies, enum value umbrellas + section
 * bodies) and rewrite any token form that references the field name —
 * `{{field:N}}`, `{{fieldname:N}}`, `{{dc:N}}` (+ tail segments), plus
 * the `@N` mention shortcut. All handled by `rewriteFieldTokens`.
 */
function renameInPromptTextSurfaces(
  agent: AgentDoc,
  oldName: string,
  newName: string,
): AgentDoc {
  return mapAllPromptText(agent, t => rewriteFieldTokens(t, oldName, newName));
}

/**
 * Snippets can carry the same gate shape as a per-addon run filter
 * (`SnippetDef.filter?: AddonFilter`). Walk `agent.snippets[]` and
 * rewrite each snippet's conditions in place. Same `rewriteCondition`
 * helper as the two renamers above; the only thing that differs is
 * the storage location.
 *
 * Distinct from a future `renameInSnippetTokens` — that would walk
 * `snippet.content` (a free-text prompt body) and rewrite token
 * references like `{{field:NAME}}` / `@NAME`. Filters and content
 * are separate surfaces on the same SnippetDef.
 */
function renameInSnippetFilters(
  agent: AgentDoc,
  oldName: string,
  newName: string,
): AgentDoc {
  const snippets = agent.snippets;
  if (!Array.isArray(snippets) || snippets.length === 0) return agent;

  let anyChanged = false;
  const nextSnippets: SnippetDef[] = snippets.map(snip => {
    const filter = snip.filter;
    if (!filter) return snip;
    const list = filter.conditions;
    if (!Array.isArray(list) || list.length === 0) return snip;

    let condsChanged = false;
    const nextConds = list.map(c => {
      const updated = rewriteCondition(c, oldName, newName);
      if (updated !== c) condsChanged = true;
      return updated;
    });
    if (!condsChanged) return snip;

    anyChanged = true;
    return {
      ...snip,
      filter: { mode: filter.mode, conditions: nextConds },
    };
  });

  if (!anyChanged) return agent;
  return { ...agent, snippets: nextSnippets };
}
