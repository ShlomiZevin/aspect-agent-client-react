/**
 * useMentionOptions — derive MentionTextarea options from current
 * agent state.
 *
 * Picker layout: one trigger per category so each popup is
 * single-topic. Every group label leads with the category name so it
 * reads top-to-bottom as "this is a Memory popup, here are Memory
 * domains, here are Memory fields" — no decoder ring required.
 *
 *   - `@` → Memory (whole section · domains · fields)
 *   - `!` → Thinking (whole section · domains)
 *   - `#` → Parameters
 *   - `^` → Persona (single option)
 *
 * Dynamic Context entries are surfaced under the `*` trigger so the
 * user can drop `{{dynamic:fieldname}}` switches into any prompt.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import type { AgentDoc, FieldDef, ID } from '../../types';
import type { MentionOption, MentionOptions } from './MentionTextarea';

/**
 * Plugin ids whose addons emit a `## Thinking` block under
 * `config.domain`. Drives `collectThinkingDomains` so the mention
 * picker surfaces domains written by any thinking-style addon, not
 * just plain Thinker. Add to this set when a new addon starts writing
 * to the thinking section.
 */
const THINKING_WRITER_PLUGIN_IDS = new Set<string>([
  'thinker',
  'field-interviewer',
]);

/** Find a FieldDef by id across agent.fields + every crew's fields.
 *  Returns null when the id doesn't exist (e.g. caller passed a
 *  freshly-typed value, or a deleted field id lingered on config). */
function findFieldDefById(agent: AgentDoc, fieldId: ID | undefined): FieldDef | null {
  if (!fieldId) return null;
  for (const f of agent.fields ?? []) {
    if (f.id === fieldId) return f;
  }
  for (const c of agent.crews ?? []) {
    for (const f of c.fields ?? []) {
      if (f.id === fieldId) return f;
    }
  }
  return null;
}

/**
 * Collect the set of memory-domain names known to the agent. We union:
 *   - declared domains (`agent.domains`)
 *   - domains in use by any field (agent + crew)
 * Same merge the FieldsPanel / SchemaPanel use, so the picker shows
 * everything the user has either declared or implicitly created.
 */
function collectMemoryDomains(agentId: ID, doc: ReturnType<typeof useBuilder>['doc']): string[] {
  const agent = doc.agents.find(a => a.id === agentId);
  if (!agent) return [];
  const names = new Set<string>(agent.domains ?? []);
  for (const f of agent.fields ?? []) {
    if (f.domain) names.add(f.domain);
  }
  for (const c of agent.crews ?? []) {
    for (const f of c.fields ?? []) {
      if (f.domain) names.add(f.domain);
    }
  }
  return Array.from(names).sort();
}

/**
 * Collect thinking-domain names — every thinking-writing addon across
 * the agent writes to a configured domain. We harvest those so the
 * picker offers `!thinking:strategy`, `!thinking:tone`, etc. without
 * the user remembering which domain each addon uses.
 *
 * "Thinking-writing addon" = plugin id in `THINKING_WRITER_PLUGIN_IDS`.
 * Today that's plain Thinker plus Field Interviewer (which writes its
 * non-bound-field keys into the thinking section, same shape as
 * Thinker).
 */
function collectThinkingDomains(agentId: ID, doc: ReturnType<typeof useBuilder>['doc']): string[] {
  const agent = doc.agents.find(a => a.id === agentId);
  if (!agent) return [];
  const names = new Set<string>();
  // Agent-level addons run before every crew, so their domains are
  // available system-wide. Walk those first.
  for (const a of agent.cortex ?? []) {
    if (!THINKING_WRITER_PLUGIN_IDS.has(a.pluginId)) continue;
    const cfg = a.config as { domain?: string } | undefined;
    if (cfg?.domain) names.add(cfg.domain);
  }
  for (const c of agent.crews ?? []) {
    for (const a of c.addons ?? []) {
      if (!THINKING_WRITER_PLUGIN_IDS.has(a.pluginId)) continue;
      const cfg = a.config as { domain?: string } | undefined;
      if (cfg?.domain) names.add(cfg.domain);
    }
  }
  return Array.from(names).sort();
}

/**
 * Caller hint for single-field-bound addons (Field Reasoner, Field
 * Interviewer). Presence of the `boundField` key flips on a small
 * "Output field" group inside the `@` trigger that exposes the
 * `{{this_field}}` / `{{enum_values}}` substitution tokens — the
 * caller signals "my addon supports these tokens" by passing the key.
 *
 * `fieldId` is the currently-wired field's id; pass `undefined` when
 * the user hasn't wired one yet. The picker still shows the tokens
 * (so they're discoverable while editing the prompt) but flips the
 * descriptions to reflect the unwired state.
 */
export interface MentionOptionsOpts {
  boundField?: { fieldId: ID | undefined };
}

export function useMentionOptions(
  agentId: ID,
  opts?: MentionOptionsOpts,
): MentionOptions {
  const { doc } = useBuilder();
  const boundFieldId = opts?.boundField?.fieldId;
  const hasBoundFieldGroup = opts?.boundField !== undefined;
  return useMemo<MentionOptions>(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    if (!agent) return {};

    const memoryDomains   = collectMemoryDomains(agentId, doc);
    const thinkingDomains = collectThinkingDomains(agentId, doc);
    const boundField      = hasBoundFieldGroup
      ? findFieldDefById(agent, boundFieldId)
      : null;

    // ── @  Memory ─────────────────────────────────────────────────
    const at: MentionOption[] = [];
    at.push({
      label:     'All memory',
      insertion: '{{memory}}',
      group:     'Memory',
      description: 'The whole ## Memory section — every domain that has values.',
    });
    for (const d of memoryDomains) {
      at.push({
        label:     d,
        insertion: `{{memory:${d}}}`,
        group:     'Memory domains',
        description: `Just the "${d}" memory bucket.`,
      });
    }
    for (const f of agent.fields ?? []) {
      at.push({
        label:     f.name,
        insertion: `{{field:${f.name}}}`,
        group:     'Memory fields',
        description: f.howToExtract || `The current value of ${f.name}.`,
      });
    }
    for (const c of agent.crews ?? []) {
      for (const f of c.fields ?? []) {
        at.push({
          label:     f.name,
          insertion: `{{field:${f.name}}}`,
          group:     `Memory fields · ${c.name}`,
          description: f.howToExtract || `The current value of ${f.name} (crew-scoped).`,
        });
      }
    }

    // ── Output field tokens — only when the host addon is single-
    // ── field-bound (Field Reasoner, Field Interviewer). The caller
    // ── opts in by passing `boundField` and the picker exposes the
    // ── two self-referential template tokens; we still show them
    // ── when nothing is wired so the user discovers them while
    // ── authoring the prompt — the descriptions reflect the state.
    if (hasBoundFieldGroup) {
      const thisFieldDesc = boundField
        ? `Inserts the bound field's name at runtime (currently "${boundField.name}").`
        : `Inserts the bound field's name at runtime — wire a field above first.`;
      at.push({
        label:     'this_field',
        insertion: '{{this_field}}',
        group:     'Output field',
        description: thisFieldDesc,
      });

      let enumDesc: string;
      if (!boundField) {
        enumDesc = `Inserts the bound field's allowed values — wire an enum field above first.`;
      } else if (boundField.type !== 'enum') {
        enumDesc = `Inserts the bound field's allowed values — only meaningful when the bound field is type=enum (current type: ${boundField.type}).`;
      } else if (!boundField.enumValues?.length) {
        enumDesc = `Inserts "${boundField.name}"'s allowed values — none declared yet.`;
      } else {
        enumDesc = `Inserts "${boundField.name}"'s allowed values: ${boundField.enumValues.join(', ')}.`;
      }
      at.push({
        label:     'enum_values',
        insertion: '{{enum_values}}',
        group:     'Output field',
        description: enumDesc,
      });
    }

    // ── !  Thinking ───────────────────────────────────────────────
    const bang: MentionOption[] = [];
    bang.push({
      label:     'All thinking',
      insertion: '{{thinking}}',
      group:     'Thinking',
      description: 'The whole ## Thinking section — every domain a Thinker has written.',
    });
    for (const d of thinkingDomains) {
      bang.push({
        label:     d,
        insertion: `{{thinking:${d}}}`,
        group:     'Thinking domains',
        description: `Just the "${d}" thinking bucket.`,
      });
    }

    // ── #  Parameters ─────────────────────────────────────────────
    const hash: MentionOption[] = [];
    for (const p of agent.parameters ?? []) {
      hash.push({
        label:     p.name,
        insertion: `{{param:${p.name}}}`,
        group:     'Parameters',
        description: p.description || p.value || `Static parameter ${p.name}.`,
      });
    }

    // ── ^  Persona ────────────────────────────────────────────────
    const caret: MentionOption[] = [{
      label:     'Persona',
      insertion: '{{persona}}',
      group:     'Persona',
      description: 'The agent persona text — voice and tone shared across crews.',
    }];

    // ── *  Dynamic context ───────────────────────────────────────
    // One entry per declared DC field switches on the field's current
    // value at runtime; selecting it inserts `{{dynamic:<fieldname>}}`.
    // Per the v2 sections design (sections are declared on the DC and
    // shared across every case), we also emit:
    //   • one entry per section name declared on the DC —
    //     `{{dynamic:<fieldname>:<section>}}`. Same address space for
    //     every case; the runtime resolves the body from the matched
    //     case's `sectionTexts`.
    //   • an "all sections" entry — `{{dynamic:<fieldname>:*}}` — the
    //     convenience "give me every section under the matching case
    //     as headed blocks" form.
    const star: MentionOption[] = [];
    const fieldsById = new Map<string, { name: string; enumValues?: string[] }>();
    for (const f of agent.fields ?? []) {
      fieldsById.set(f.id, { name: f.name, enumValues: f.enumValues });
    }
    for (const dc of agent.dynamicContexts ?? []) {
      const field = fieldsById.get(dc.fieldId);
      if (!field) continue; // orphan DC (field deleted) — skip silently
      const caseCount = Array.isArray(dc.cases) ? dc.cases.length : 0;
      const groupLabel = `Dynamic context · ${field.name}`;
      star.push({
        label:     field.name,
        insertion: `{{dynamic:${field.name}}}`,
        group:     groupLabel,
        description: `Switches on "${field.name}" — ${caseCount} case${caseCount === 1 ? '' : 's'}. Inserts the matching case's umbrella prompt.`,
      });
      const declaredSections = (dc.sections ?? [])
        .map(s => s?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      if (declaredSections.length > 0) {
        star.push({
          label:     `${field.name}: *  (all sections)`,
          insertion: `{{dynamic:${field.name}:*}}`,
          group:     groupLabel,
          description: `Joins every section declared on "${field.name}" as headed blocks (only sections with a body under the matched case render).`,
        });
        for (const sec of declaredSections) {
          star.push({
            label:     `${field.name}: ${sec}`,
            insertion: `{{dynamic:${field.name}:${sec}}}`,
            group:     groupLabel,
            description: `The "${sec}" section under whichever case "${field.name}" matches.`,
          });
        }
      }
    }

    return { '@': at, '!': bang, '#': hash, '^': caret, '*': star };
  }, [doc, agentId, hasBoundFieldGroup, boundFieldId]);
}
