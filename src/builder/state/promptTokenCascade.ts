/**
 * Prompt-token rename cascade — keeps `{{...}}` tokens in addon
 * prompts, snippet bodies, persona text, and enum-value bodies in
 * sync when the entity behind a token is renamed.
 *
 * Companion to `fieldRenameCascade.ts`. That file handles renames of
 * *fields* across all surfaces (conditions, filters, AND prompt tokens
 * via the shared `rewriteFieldTokens` helper exported there). This
 * file handles all the *other* entity kinds whose name appears in a
 * prompt token: enum, enum section, persona, snippet, parameter,
 * summarizer, domain.
 *
 * Each `cascadeXRename(agent, oldName, newName, …)` is pure — it
 * takes the agent doc and returns a new one with every token rewritten.
 * Identity-preserving when nothing matched (same agent ref returned).
 *
 * Token forms covered (matches `promptAssembler.js` resolver branches):
 *   - Enum:        {{enum:N}} / {{enum:N:SEC}} / {{enum:N:values}}
 *   - Enum section (scoped to one enum):
 *                  {{enum:E:SEC}} / {{dc:F:SEC}} for every F bound to E
 *   - Persona:     {{persona:N}}
 *   - Snippet:     {{snippet:N}}
 *   - Parameter:   {{param:N}}
 *   - Summarizer:  {{summary:N}}  +  AddonContext.history.summarizerName
 *   - Domain:      {{memory:N}} / {{thinking:N}}
 *                  (FieldDef.domain stays in BuilderContext.renameAgentDomain
 *                   — this file only handles the prompt-text side.)
 *
 * Prompt-text surfaces walked (every place a token can appear):
 *   - AddonInstance.config.prompt         (agent.cortex + every crew.addons)
 *   - AddonInstance.promptTemplate
 *   - SnippetDef.content
 *   - PersonaDef.content
 *   - AgentDoc.persona / CrewDoc.persona  (legacy single-persona strings)
 *   - EnumValueDef.umbrellaText
 *   - EnumValueDef.sectionTexts[*]
 *
 * Identifiers are case-sensitive, matching the server resolver.
 */

import type {
  AddonInstance,
  AgentDoc,
  CrewDoc,
  EnumTypeDef,
  EnumValueDef,
  HistoryMode,
  PersonaDef,
  SnippetDef,
} from '../types';

// ─── Generic prompt-text walker ──────────────────────────────────

/**
 * Apply `fn` to every string the assembler treats as prompt text.
 * Identity-preserving — returns the same agent ref when nothing
 * changed, and the same nested object refs (addon / crew / snippet /
 * persona / enum / value) wherever the rewriter was a no-op. Cheap to
 * call unconditionally.
 */
export function mapAllPromptText(
  agent: AgentDoc,
  fn: (text: string) => string,
): AgentDoc {
  let anyChanged = false;

  const rewriteString = (s: string | undefined): { changed: boolean; value: string | undefined } => {
    if (s === undefined) return { changed: false, value: undefined };
    if (s === '') return { changed: false, value: s };
    const next = fn(s);
    return { changed: next !== s, value: next };
  };

  // Addon walker shared between cortex + crew addons. Touches both the
  // user-authored `config.prompt` (if present) and the snapshotted
  // `promptTemplate`. Different addon configs have different shapes —
  // we only touch the field if it's actually a string.
  const rewriteAddon = (addon: AddonInstance): AddonInstance => {
    let changed = false;
    let nextAddon: AddonInstance = addon;

    const cfg = addon.config as { prompt?: unknown } | undefined;
    if (cfg && typeof cfg.prompt === 'string') {
      const r = rewriteString(cfg.prompt);
      if (r.changed) {
        changed = true;
        nextAddon = { ...nextAddon, config: { ...cfg, prompt: r.value } };
      }
    }

    // KB Retriever holds its prompts on nested axes (config.trigger.prompt
    // and config.query.prompt) rather than config.prompt — rewrite those
    // too so token renames cascade into them like any other prompt.
    if (addon.pluginId === 'kb-retriever') {
      const kc = addon.config as {
        trigger?: { prompt?: unknown }; query?: { prompt?: unknown };
      } | undefined;
      const curCfg = nextAddon.config as Record<string, unknown>;
      let kcChanged = false;
      const patch: Record<string, unknown> = {};
      if (kc?.trigger && typeof kc.trigger.prompt === 'string') {
        const r = rewriteString(kc.trigger.prompt);
        if (r.changed) { kcChanged = true; patch.trigger = { ...kc.trigger, prompt: r.value }; }
      }
      if (kc?.query && typeof kc.query.prompt === 'string') {
        const r = rewriteString(kc.query.prompt);
        if (r.changed) { kcChanged = true; patch.query = { ...kc.query, prompt: r.value }; }
      }
      if (kcChanged) {
        changed = true;
        nextAddon = { ...nextAddon, config: { ...curCfg, ...patch } };
      }
    }

    if (typeof addon.promptTemplate === 'string') {
      const r = rewriteString(addon.promptTemplate);
      if (r.changed) {
        changed = true;
        nextAddon = { ...nextAddon, promptTemplate: r.value as string };
      }
    }

    return changed ? nextAddon : addon;
  };

  // ── Agent cortex ──
  const cortexIn = agent.cortex ?? [];
  let cortexChanged = false;
  const cortexOut = cortexIn.map(a => {
    const next = rewriteAddon(a);
    if (next !== a) cortexChanged = true;
    return next;
  });

  // ── Crews (per-crew addons + crew.persona) ──
  let crewsChanged = false;
  const crewsOut: CrewDoc[] = agent.crews.map(crew => {
    let crewChanged = false;

    const addonsOut = crew.addons.map(a => {
      const next = rewriteAddon(a);
      if (next !== a) crewChanged = true;
      return next;
    });

    let nextPersona = crew.persona;
    if (typeof crew.persona === 'string') {
      const r = rewriteString(crew.persona);
      if (r.changed) {
        crewChanged = true;
        nextPersona = r.value;
      }
    }

    if (!crewChanged) return crew;
    crewsChanged = true;
    return { ...crew, addons: addonsOut, persona: nextPersona };
  });

  // ── Snippets ──
  let snippetsChanged = false;
  const snippetsOut: SnippetDef[] | undefined = (agent.snippets ?? []).map(s => {
    const r = rewriteString(s.content);
    if (!r.changed) return s;
    snippetsChanged = true;
    return { ...s, content: r.value as string };
  });

  // ── Personas ──
  let personasChanged = false;
  const personasOut: PersonaDef[] | undefined = (agent.personas ?? []).map(p => {
    const r = rewriteString(p.content);
    if (!r.changed) return p;
    personasChanged = true;
    return { ...p, content: r.value as string };
  });

  // ── Legacy single agent.persona ──
  let agentPersonaChanged = false;
  let nextAgentPersona = agent.persona;
  if (typeof agent.persona === 'string') {
    const r = rewriteString(agent.persona);
    if (r.changed) {
      agentPersonaChanged = true;
      nextAgentPersona = r.value as string;
    }
  }

  // ── Enums (value umbrellaText + sectionTexts bodies) ──
  let enumsChanged = false;
  const enumsOut: EnumTypeDef[] | undefined = (agent.enums ?? []).map(e => {
    let typeChanged = false;
    const valuesOut: EnumValueDef[] = e.values.map(v => {
      let valChanged = false;
      let nextV: EnumValueDef = v;

      if (typeof v.umbrellaText === 'string') {
        const r = rewriteString(v.umbrellaText);
        if (r.changed) {
          valChanged = true;
          nextV = { ...nextV, umbrellaText: r.value };
        }
      }

      if (v.sectionTexts) {
        let sectionsChanged = false;
        const nextSections: Record<string, string> = {};
        for (const [k, body] of Object.entries(v.sectionTexts)) {
          if (typeof body === 'string') {
            const r = rewriteString(body);
            if (r.changed) sectionsChanged = true;
            nextSections[k] = r.value as string;
          } else {
            nextSections[k] = body;
          }
        }
        if (sectionsChanged) {
          valChanged = true;
          nextV = { ...nextV, sectionTexts: nextSections };
        }
      }

      if (!valChanged) return v;
      typeChanged = true;
      return nextV;
    });

    if (!typeChanged) return e;
    enumsChanged = true;
    return { ...e, values: valuesOut };
  });

  anyChanged =
    cortexChanged || crewsChanged || snippetsChanged ||
    personasChanged || agentPersonaChanged || enumsChanged;

  if (!anyChanged) return agent;

  return {
    ...agent,
    ...(cortexChanged ? { cortex: cortexOut } : {}),
    ...(crewsChanged ? { crews: crewsOut } : {}),
    ...(snippetsChanged ? { snippets: snippetsOut } : {}),
    ...(personasChanged ? { personas: personasOut } : {}),
    ...(agentPersonaChanged ? { persona: nextAgentPersona as string } : {}),
    ...(enumsChanged ? { enums: enumsOut } : {}),
  };
}

// ─── Token rewriter helpers ──────────────────────────────────────

/** Escape regex metacharacters in a literal identifier. */
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build a rewriter for a one-or-many-segment token (`{{prefix:N}}` or
 *  `{{prefix:N:…}}`). Uses `(?=[:}])` to tie the match to a structural
 *  boundary so `foo` doesn't catch `foobar`. */
function makeSegmentedRewrite(prefix: string, oldName: string, newName: string) {
  const re = new RegExp(`\\{\\{${prefix}:${escRe(oldName)}(?=[:}])`, 'g');
  const replacement = `{{${prefix}:${newName}`;
  return (text: string) => text.replace(re, replacement);
}

/** Build a rewriter for a terminal-only token (`{{prefix:N}}` — no
 *  further segments). Uses `(?=})` so a long name like `mainline`
 *  isn't matched when renaming `main`. */
function makeTerminalRewrite(prefix: string, oldName: string, newName: string) {
  const re = new RegExp(`\\{\\{${prefix}:${escRe(oldName)}(?=\\})`, 'g');
  const replacement = `{{${prefix}:${newName}`;
  return (text: string) => text.replace(re, replacement);
}

// ─── Per-entity cascades ─────────────────────────────────────────

export function cascadeEnumNameRename(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  // Rewrite BOTH token prefixes — `{{enum:...}}` (legacy) and
  // `{{targetedkb:...}}` (new) — since both resolve through the
  // same enum lookup at runtime. Authors might be using either or
  // a mix; renaming a KB has to fix every reference regardless of
  // which prefix the author typed.
  const rewriteEnum       = makeSegmentedRewrite('enum',       oldName, newName);
  const rewriteTargetedkb = makeSegmentedRewrite('targetedkb', oldName, newName);
  return mapAllPromptText(agent, t => rewriteTargetedkb(rewriteEnum(t)));
}

/**
 * Section rename within ONE enum. Rewrites:
 *   - `{{enum:EnumName:OLDSEC}}` → `{{enum:EnumName:NEWSEC}}`
 *   - `{{dc:F:OLDSEC}}` → `{{dc:F:NEWSEC}}` for every F bound to
 *     `enumType === enumId` (live FieldDefs across agent + crew scope)
 *
 * Caller passes the enum's id and current display name. The `enumName`
 * is what appears literally in the `{{enum:...}}` token, so we match
 * on that. The `enumId` is needed to find which DC tokens belong to
 * this enum.
 */
export function cascadeEnumSectionRename(
  agent: AgentDoc,
  enumId: string,
  enumName: string,
  oldSection: string,
  newSection: string,
): AgentDoc {
  if (!oldSection || !newSection || oldSection === newSection) return agent;
  if (!enumId || !enumName) return agent;

  // Match both `{{enum:E:OLDSEC}}` AND `{{targetedkb:E:OLDSEC}}`.
  // The capture group preserves whichever prefix the author used so
  // the replacement keeps it (no surprise rewriting of legacy form
  // into the new vocabulary or vice versa).
  const enumRe = new RegExp(
    `\\{\\{(enum|targetedkb):${escRe(enumName)}:${escRe(oldSection)}(?=\\})`,
    'g',
  );
  const enumReplacement = `{{$1:${enumName}:${newSection}`;

  // Collect every field name bound to this enum (agent + crew scope).
  // Names may collide across scopes — Set dedupes.
  const boundFieldNames = new Set<string>();
  for (const f of agent.fields ?? []) {
    if (f.enumType === enumId && f.name) boundFieldNames.add(f.name);
  }
  for (const c of agent.crews) {
    for (const f of c.fields ?? []) {
      if (f.enumType === enumId && f.name) boundFieldNames.add(f.name);
    }
  }

  const dcRewrites = Array.from(boundFieldNames).map(fName => {
    const re = new RegExp(
      `\\{\\{dc:${escRe(fName)}:${escRe(oldSection)}(?=\\})`,
      'g',
    );
    const replacement = `{{dc:${fName}:${newSection}`;
    return { re, replacement };
  });

  return mapAllPromptText(agent, text => {
    let out = text.replace(enumRe, enumReplacement);
    for (const { re, replacement } of dcRewrites) {
      out = out.replace(re, replacement);
    }
    return out;
  });
}

export function cascadePersonaRename(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  return mapAllPromptText(agent, makeTerminalRewrite('persona', oldName, newName));
}

export function cascadeSnippetRename(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  return mapAllPromptText(agent, makeTerminalRewrite('snippet', oldName, newName));
}

export function cascadeParameterRename(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  return mapAllPromptText(agent, makeTerminalRewrite('param', oldName, newName));
}

/**
 * Summarizer rename — rewrites tokens AND updates every addon's
 * `context.history` where mode === 'since_summarizer' and
 * summarizerName matches. The history-mode pointer is the non-token
 * reference noted in the rename research.
 */
export function cascadeSummarizerRename(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;

  // Step 1: rewrite {{summary:OLDNAME}} tokens in all prompt text.
  const withTokens = mapAllPromptText(
    agent,
    makeTerminalRewrite('summary', oldName, newName),
  );

  // Step 2: rewrite history pointers on every addon (cortex + crews).
  // `AddonContext.history` is required by the type, so we never need to
  // handle an absent value here. The mode discriminant tells us whether
  // this addon is reading a summarizer slice — only then do we rewrite.
  const patchHistory = (h: HistoryMode): HistoryMode => {
    if (h.mode !== 'since_summarizer') return h;
    if (h.summarizerName !== oldName) return h;
    return { ...h, summarizerName: newName };
  };

  const patchAddon = (addon: AddonInstance): AddonInstance => {
    const ctx = addon.context;
    if (!ctx) return addon;
    const nextHistory = patchHistory(ctx.history);
    if (nextHistory === ctx.history) return addon;
    return { ...addon, context: { ...ctx, history: nextHistory } };
  };

  let cortexChanged = false;
  const cortexOut = (withTokens.cortex ?? []).map(a => {
    const next = patchAddon(a);
    if (next !== a) cortexChanged = true;
    return next;
  });

  let crewsChanged = false;
  const crewsOut = withTokens.crews.map(crew => {
    let changed = false;
    const addonsOut = crew.addons.map(a => {
      const next = patchAddon(a);
      if (next !== a) changed = true;
      return next;
    });
    if (!changed) return crew;
    crewsChanged = true;
    return { ...crew, addons: addonsOut };
  });

  if (!cortexChanged && !crewsChanged) return withTokens;
  return {
    ...withTokens,
    ...(cortexChanged ? { cortex: cortexOut } : {}),
    ...(crewsChanged ? { crews: crewsOut } : {}),
  };
}

/**
 * Domain rename — token-side only. Rewrites `{{memory:OLD}}` and
 * `{{thinking:OLD}}` to the new name across every prompt-text surface.
 *
 * The data-side cascade (FieldDef.domain on every field, agent.domains
 * declaration list) lives in `BuilderContext.renameAgentDomain` —
 * that's where it was already; this function only fills in the
 * prompt-token half of the rename.
 */
export function cascadeDomainTokens(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  const rewriteMemory   = makeTerminalRewrite('memory',   oldName, newName);
  const rewriteThinking = makeTerminalRewrite('thinking', oldName, newName);
  return mapAllPromptText(agent, t => rewriteThinking(rewriteMemory(t)));
}

/**
 * KB-domain rename — token-side cascade for the KB Retriever's "Writes
 * to" slot. Rewrites `{{kb:OLD}}` → `{{kb:NEW}}` across every prompt-text
 * surface so a prompt that injects the retrieved knowledge keeps working
 * after the slot is renamed.
 *
 * Terminal token (`{{kb:NAME}}` — no further segments), so a long name
 * like `knowledge_base` isn't clipped when renaming `knowledge`. The
 * data side (the addon's own `config.domain`) is updated by the config
 * editor that triggers this — this function only fixes the references.
 */
export function cascadeKbDomainTokens(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  return mapAllPromptText(agent, makeTerminalRewrite('kb', oldName, newName));
}

/**
 * Thinking-domain rename — token-side cascade for the free-text "Domain"
 * slot on the Thinker and Field Interviewer (both write non-field keys
 * into `brain.thinking[domain]`, read downstream via `{{thinking:DOMAIN}}`).
 * Rewrites `{{thinking:OLD}}` → `{{thinking:NEW}}` across every prompt
 * surface. Leaves the bare `{{thinking}}` (all-domains) token untouched.
 *
 * Distinct from `cascadeDomainTokens` (which also rewrites `{{memory:}}`
 * and is driven by the declared-domain rename UI) — renaming where ONE
 * Thinker writes shouldn't disturb a same-named memory domain.
 */
export function cascadeThinkingDomainTokens(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;
  return mapAllPromptText(agent, makeTerminalRewrite('thinking', oldName, newName));
}

/**
 * Tag rename — both sides of the cascade in one atomic transform:
 *
 *   1. Token side: rewrite `{{tag:OLD}}`, `{{tag:OLD:values}}`,
 *      `{{tag:OLD:names}}` across every prompt-text surface.
 *   2. Data side: rewrite every `FieldDef.tags[]` entry that contained
 *      OLD on the agent + every crew, and rewrite the matching entry
 *      in `agent.tags[]` (dedup-preserving — if NEW was already
 *      declared, OLD is just stripped without a duplicate).
 *
 * Same case-sensitive contract as every other cascader.
 */
export function cascadeTagRename(
  agent: AgentDoc, oldName: string, newName: string,
): AgentDoc {
  if (!oldName || !newName || oldName === newName) return agent;

  // 1. Token side. {{tag:OLD}} / {{tag:OLD:values}} / {{tag:OLD:names}}
  //    all share the segmented prefix form — one rewriter covers them.
  const tokenRewrite = makeSegmentedRewrite('tag', oldName, newName);
  const withTokens = mapAllPromptText(agent, tokenRewrite);

  // 2. Data side. Rewrite `agent.tags`, every `FieldDef.tags` on
  //    `agent.fields`, and every `FieldDef.tags` on each crew's fields.
  //    Map → swap → filter dedupe so dropping into an already-present
  //    new name doesn't leave a duplicate behind.
  const rewriteTagList = (list: string[] | undefined): string[] | undefined => {
    if (!Array.isArray(list)) return list;
    if (!list.includes(oldName)) return list;
    const next = list
      .map(t => (t === oldName ? newName : t))
      .filter((t, i, arr) => arr.indexOf(t) === i);
    return next;
  };

  let agentChanged = false;

  const nextAgentTags = rewriteTagList(withTokens.tags);
  if (nextAgentTags !== withTokens.tags) agentChanged = true;

  let fieldsChanged = false;
  const nextAgentFields = withTokens.fields.map(f => {
    const next = rewriteTagList(f.tags);
    if (next === f.tags) return f;
    fieldsChanged = true;
    return { ...f, tags: next };
  });

  let crewsChanged = false;
  const nextCrews = withTokens.crews.map(crew => {
    let crewFieldsChanged = false;
    const nextFields = (crew.fields ?? []).map(f => {
      const next = rewriteTagList(f.tags);
      if (next === f.tags) return f;
      crewFieldsChanged = true;
      return { ...f, tags: next };
    });
    if (!crewFieldsChanged) return crew;
    crewsChanged = true;
    return { ...crew, fields: nextFields };
  });

  if (!agentChanged && !fieldsChanged && !crewsChanged) return withTokens;
  return {
    ...withTokens,
    ...(agentChanged ? { tags: nextAgentTags } : {}),
    ...(fieldsChanged ? { fields: nextAgentFields } : {}),
    ...(crewsChanged ? { crews: nextCrews } : {}),
  };
}

/**
 * Tag delete — data side only. Strips the tag from `agent.tags` and
 * from every `FieldDef.tags[]` across agent + crews. Leaves
 * `{{tag:NAME}}` tokens in prompts AS-IS so the broken reference
 * surfaces visibly (matches the resolver's unknown-tag behavior —
 * empty render — and the `{{field:X}}` typo-surfacing contract).
 */
export function deleteAgentTag(agent: AgentDoc, tagName: string): AgentDoc {
  if (!tagName) return agent;

  const stripFromList = (list: string[] | undefined): string[] | undefined => {
    if (!Array.isArray(list)) return list;
    if (!list.includes(tagName)) return list;
    return list.filter(t => t !== tagName);
  };

  let agentChanged = false;
  const nextAgentTags = stripFromList(agent.tags);
  if (nextAgentTags !== agent.tags) agentChanged = true;

  let fieldsChanged = false;
  const nextAgentFields = agent.fields.map(f => {
    const next = stripFromList(f.tags);
    if (next === f.tags) return f;
    fieldsChanged = true;
    return { ...f, tags: next };
  });

  let crewsChanged = false;
  const nextCrews = agent.crews.map(crew => {
    let crewFieldsChanged = false;
    const nextFields = (crew.fields ?? []).map(f => {
      const next = stripFromList(f.tags);
      if (next === f.tags) return f;
      crewFieldsChanged = true;
      return { ...f, tags: next };
    });
    if (!crewFieldsChanged) return crew;
    crewsChanged = true;
    return { ...crew, fields: nextFields };
  });

  if (!agentChanged && !fieldsChanged && !crewsChanged) return agent;
  return {
    ...agent,
    ...(agentChanged ? { tags: nextAgentTags } : {}),
    ...(fieldsChanged ? { fields: nextAgentFields } : {}),
    ...(crewsChanged ? { crews: nextCrews } : {}),
  };
}
