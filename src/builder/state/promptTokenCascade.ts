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
  // {{enum:OLD}}, {{enum:OLD:SECTION}}, {{enum:OLD:values}} — all
  // share the segmented form.
  const rewrite = makeSegmentedRewrite('enum', oldName, newName);
  return mapAllPromptText(agent, rewrite);
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

  const enumRe = new RegExp(
    `\\{\\{enum:${escRe(enumName)}:${escRe(oldSection)}(?=\\})`,
    'g',
  );
  const enumReplacement = `{{enum:${enumName}:${newSection}`;

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
