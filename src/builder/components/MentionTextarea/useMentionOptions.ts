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
 * user can drop `{{enum:NAME[:SECTION]}}` aggregate or `{{dc:FIELD[:S|*]}}` live-value tokens into any prompt.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { getPlugin } from '../../registry/plugins';
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

/** Plugin id of the Summarizer addon. Used to harvest declared
 *  `{{summary:NAME}}` tokens from the agent's addons. Centralised so
 *  the rename — should it ever happen — is a one-line edit. */
const SUMMARIZER_PLUGIN_ID = 'summarizer';

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
 * Collect declared summarizer names across the agent — cortex first,
 * then every crew. Free-form names are unique per agent (validator
 * concern); we dedupe here so a hand-edit can't surface duplicates in
 * the picker.
 *
 * The crewName is the crew the summarizer lives in (or `null` for
 * agent cortex), surfaced so the picker can show "main (Agent)" vs.
 * "main (Sales Crew)" when the same name is reused at different
 * scopes — the runtime treats them as the same token, but the picker
 * is more useful when it shows the source.
 */
function collectSummarizers(
  agentId: ID,
  doc: ReturnType<typeof useBuilder>['doc'],
): { name: string; scope: string }[] {
  const agent = doc.agents.find(a => a.id === agentId);
  if (!agent) return [];
  const seen = new Set<string>();
  const out: { name: string; scope: string }[] = [];
  const harvest = (addons: AgentDoc['cortex'], scopeLabel: string) => {
    for (const a of addons ?? []) {
      if (a?.pluginId !== SUMMARIZER_PLUGIN_ID) continue;
      const cfg = a.config as { name?: string } | undefined;
      const n = (cfg?.name || '').trim();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push({ name: n, scope: scopeLabel });
    }
  };
  harvest(agent.cortex, 'Agent');
  for (const c of agent.crews ?? []) harvest(c.addons, c.name || 'Crew');
  return out.sort((a, b) => a.name.localeCompare(b.name));
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
 * Collect thinking-domain names grouped by which plugin writes them.
 *
 * Today the same `## Thinking` section is filled by two distinct
 * plugins: plain Thinker and Field Interviewer (which routes its
 * non-bound-field keys there). Lumping every domain into one
 * "Thinking domains" group makes it hard for the author to tell which
 * addon produced which bucket. We split by producer so the picker
 * shows `Thinking · Thinker` and `Thinking · Field Interviewer` as
 * separate groups; the underlying `{{thinking:DOMAIN}}` token is the
 * same in both cases — the split is purely for authoring clarity.
 *
 * Returns a map keyed by `pluginId` so callers can look up the
 * plugin's display name from the registry when labelling groups.
 */
function collectThinkingDomainsByProducer(
  agentId: ID,
  doc: ReturnType<typeof useBuilder>['doc'],
): Map<string, string[]> {
  const agent = doc.agents.find(a => a.id === agentId);
  if (!agent) return new Map();
  const byProducer = new Map<string, Set<string>>();
  const record = (pluginId: string, domain: string) => {
    if (!byProducer.has(pluginId)) byProducer.set(pluginId, new Set());
    byProducer.get(pluginId)!.add(domain);
  };
  // Agent-level addons run before every crew, so their domains are
  // available system-wide. Walk those first.
  for (const a of agent.cortex ?? []) {
    if (!THINKING_WRITER_PLUGIN_IDS.has(a.pluginId)) continue;
    const cfg = a.config as { domain?: string } | undefined;
    if (cfg?.domain) record(a.pluginId, cfg.domain);
  }
  for (const c of agent.crews ?? []) {
    for (const a of c.addons ?? []) {
      if (!THINKING_WRITER_PLUGIN_IDS.has(a.pluginId)) continue;
      const cfg = a.config as { domain?: string } | undefined;
      if (cfg?.domain) record(a.pluginId, cfg.domain);
    }
  }
  const out = new Map<string, string[]>();
  for (const [pluginId, domains] of byProducer) {
    out.set(pluginId, Array.from(domains).sort());
  }
  return out;
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
  /** When provided, the snippets picker surfaces a "+ New snippet"
   *  quick-add entry whose onPick fires this callback. Hosts that
   *  can't open the SnippetModal (read-only views) omit it; the picker
   *  then shows only existing snippets. */
  onCreateSnippet?: () => void;
}

export function useMentionOptions(
  agentId: ID,
  opts?: MentionOptionsOpts,
): MentionOptions {
  const { doc } = useBuilder();
  const boundFieldId = opts?.boundField?.fieldId;
  const hasBoundFieldGroup = opts?.boundField !== undefined;
  const onCreateSnippet = opts?.onCreateSnippet;
  return useMemo<MentionOptions>(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    if (!agent) return {};

    const memoryDomains              = collectMemoryDomains(agentId, doc);
    const thinkingDomainsByProducer  = collectThinkingDomainsByProducer(agentId, doc);
    const summarizers                = collectSummarizers(agentId, doc);
    const boundField                 = hasBoundFieldGroup
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
      const boundEnum = boundField && boundField.type === 'enum' && boundField.enumType
        ? (agent.enums ?? []).find(e => e.id === boundField.enumType) ?? null
        : null;
      const boundEnumValues = boundEnum ? boundEnum.values.map(v => v.value).filter(Boolean) : [];
      if (!boundField) {
        enumDesc = `Inserts the bound field's allowed values — wire an enum field above first.`;
      } else if (boundField.type !== 'enum') {
        enumDesc = `Inserts the bound field's allowed values — only meaningful when the bound field is type=enum (current type: ${boundField.type}).`;
      } else if (!boundField.enumType) {
        enumDesc = `Inserts "${boundField.name}"'s allowed values — wire it to an enum type on the bible first.`;
      } else if (boundEnumValues.length === 0) {
        enumDesc = `Inserts "${boundField.name}"'s allowed values — no values declared on enum "${boundEnum?.name ?? '?'}" yet.`;
      } else {
        enumDesc = `Inserts "${boundField.name}"'s allowed values from enum "${boundEnum!.name}": ${boundEnumValues.join(', ')}.`;
      }
      at.push({
        label:     'enum_values',
        insertion: '{{enum_values}}',
        group:     'Output field',
        description: enumDesc,
      });

      // ── Multi-field counterparts. {{this_field}} / {{enum_values}}
      // resolve to the FIRST wired field; {{fields_schema}} and
      // {{fields_current}} cover ALL of them. Surfacing both pairs in
      // the same group keeps the single- vs multi- author choice
      // discoverable without forcing a separate trigger.
      at.push({
        label:     'these_fields',
        insertion: '{{these_fields}}',
        group:     'Output field',
        description:
          'Multi-field counterpart of {{this_field}} — inline comma-separated list ' +
          'of every wired field\'s NAME. Useful in prose: e.g. "Return JSON with ' +
          'one key per of {{these_fields}}, using those exact names as the keys."',
      });
      at.push({
        label:     'fields_schema',
        insertion: '{{fields_schema}}',
        group:     'Output field',
        description:
          'Multi-field schema block — one line per wired field with type, ' +
          'allowed values (for enum-typed fields), source, and how-to-extract. ' +
          'Use when the addon writes more than one field in a single JSON output.',
      });
      at.push({
        label:     'fields_current',
        insertion: '{{fields_current}}',
        group:     'Output field',
        description:
          'Multi-field current state — JSON of the wired fields\' present ' +
          'memory values. Pair with {{fields_schema}} so the LLM sees both ' +
          'what it must emit AND what it has already committed this turn.',
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
    // Split by producer (Thinker vs Field Interviewer) so authors can
    // tell at a glance which addon emits which thinking bucket. The
    // resolved token `{{thinking:DOMAIN}}` is the same either way —
    // the split is purely a labelling concern in the picker.
    for (const [pluginId, domains] of thinkingDomainsByProducer) {
      const pluginName = getPlugin(pluginId)?.name ?? pluginId;
      const groupLabel = `Thinking · ${pluginName}`;
      for (const d of domains) {
        bang.push({
          label:     d,
          insertion: `{{thinking:${d}}}`,
          group:     groupLabel,
          description: `Just the "${d}" thinking bucket (written by ${pluginName}).`,
        });
      }
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
    // Bare {{persona}} = every persona applicable to the host addon
    // (its appliesTo includes this plugin id or '*'), concatenated in
    // the Personas-page order. {{persona:NAME}} pulls one specifically.
    const caret: MentionOption[] = [{
      label:     'Persona (applicable)',
      insertion: '{{persona}}',
      group:     'Persona',
      description: 'Every persona that applies to this addon, in page order.',
    }];
    for (const p of agent.personas ?? []) {
      const scope = (p.appliesTo ?? []).includes('*')
        ? 'all addons'
        : (p.appliesTo ?? []).length
          ? `applies to: ${(p.appliesTo ?? []).join(', ')}`
          : 'applies to nothing yet';
      caret.push({
        label:     p.name,
        insertion: `{{persona:${p.name}}}`,
        group:     'Personas',
        description: (p.content ? p.content.slice(0, 120) + (p.content.length > 120 ? '…' : '') : '(empty)') + ` · ${scope}`,
      });
    }

    // ── *  Enum bible ─────────────────────────────────────────────
    // Two token families under the same sigil, grouped distinctly so the
    // picker reads as two columns of the same shop:
    //
    //   1. Enum aggregate — one block per declared section, plus the
    //      "umbrella" (no-section) form. Static; no live data needed.
    //      Reads: "all values' how_to_identify content, dumped now".
    //   2. Field DC live-value — one entry per enum-typed field, with
    //      an umbrella entry, an all-sections (`*`) shortcut, and one
    //      entry per declared section on the field's enum.
    //
    // Groups:
    //   • `Enum · <enum_name>`        — aggregate (no specific field).
    //   • `Field DC · <field_name>`   — driven by field.enumType.
    const star: MentionOption[] = [];
    const enumsById = new Map((agent.enums ?? []).map(e => [e.id, e]));

    // 1. Enum aggregate entries — one per enum, with:
    //    • umbrella aggregate
    //    • inline values-list shortcut (the `:values` reserved keyword)
    //    • one entry per declared section
    for (const en of agent.enums ?? []) {
      const groupLabel = `Enum · ${en.name}`;
      const sectionNames = (en.sections ?? [])
        .map(s => s?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      const valueCount = en.values?.length ?? 0;
      star.push({
        label:     `${en.name}  (umbrella)`,
        insertion: `{{enum:${en.name}}}`,
        group:     groupLabel,
        description: `Dumps every value's umbrella for "${en.name}" (${valueCount} value${valueCount === 1 ? '' : 's'}). Wrapped in "## ${en.name}".`,
      });
      star.push({
        label:     `${en.name}: values  (inline list)`,
        insertion: `{{enum:${en.name}:values}}`,
        group:     groupLabel,
        description:
          `Inline comma-separated list of the values of "${en.name}". ` +
          (valueCount > 0
            ? `Resolves to: ${en.values.map(v => v?.value).filter(Boolean).join(', ')}.`
            : 'No values declared yet.'),
      });
      for (const sec of sectionNames) {
        star.push({
          label:     `${en.name}: ${sec}`,
          insertion: `{{enum:${en.name}:${sec}}}`,
          group:     groupLabel,
          description: `Dumps every value's "${sec}" body for "${en.name}". Wrapped in "## ${en.name} — ${sec}".`,
        });
      }
    }

    // 2. Field DC live-value entries — one block per enum-typed field.
    for (const f of agent.fields ?? []) {
      if (f.type !== 'enum' || !f.enumType) continue;
      const en = enumsById.get(f.enumType);
      if (!en) continue;
      const groupLabel = `Field DC · ${f.name}`;
      const sectionNames = (en.sections ?? [])
        .map(s => s?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      star.push({
        label:     `${f.name}  (umbrella)`,
        insertion: `{{dc:${f.name}}}`,
        group:     groupLabel,
        description: `Live umbrella of whatever value "${f.name}" currently holds on enum "${en.name}".`,
      });
      if (sectionNames.length > 0) {
        star.push({
          label:     `${f.name}: *  (all sections)`,
          insertion: `{{dc:${f.name}:*}}`,
          group:     groupLabel,
          description: `Every authored section under "${f.name}"'s current matched value, as headed blocks.`,
        });
        for (const sec of sectionNames) {
          star.push({
            label:     `${f.name}: ${sec}`,
            insertion: `{{dc:${f.name}:${sec}}}`,
            group:     groupLabel,
            description: `The "${sec}" body under "${f.name}"'s current matched value on enum "${en.name}".`,
          });
        }
      }
    }

    // ── %  Summary ───────────────────────────────────────────────
    // One "All summaries" entry + one per declared summarizer name.
    // The token is the same regardless of which scope (agent cortex
    // vs crew) the summarizer lives in — the brain blob is flat by
    // name — so we don't differentiate insertions, only descriptions.
    const percent: MentionOption[] = [];
    percent.push({
      label:     'All summaries',
      insertion: '{{summary}}',
      group:     'Summary',
      description: 'The whole ## Summary section — every declared summarizer with text.',
    });
    for (const s of summarizers) {
      percent.push({
        label:     s.name,
        insertion: `{{summary:${s.name}}}`,
        group:     'Summarizers',
        description: `Current text of the "${s.name}" summarizer (written by an offline-lane Summarizer in ${s.scope}).`,
      });
    }

    // ── +  Snippets ──────────────────────────────────────────────
    // Existing snippets + (optionally) a "+ New snippet" quick-add
    // entry whose onPick opens the SnippetModal in the host. Description
    // surfaces the snippet's filter state so the author knows whether
    // it'll always render or only under certain conditions.
    const plus: MentionOption[] = [];
    for (const s of agent.snippets ?? []) {
      const gated = !!s.filter
        && Array.isArray(s.filter.conditions)
        && s.filter.conditions.length > 0;
      const verb = s.filter?.mode === 'exclude' ? 'Skip when' : 'Render when';
      const gateNote = gated
        ? ` · ${verb} ${s.filter!.conditions.length} condition${s.filter!.conditions.length === 1 ? '' : 's'}`
        : '';
      plus.push({
        label:     s.displayName ? `${s.name} — ${s.displayName}` : s.name,
        insertion: `{{snippet:${s.name}}}`,
        group:     'Snippets',
        description:
          (s.content ? s.content.slice(0, 140) + (s.content.length > 140 ? '…' : '') : '(empty)')
          + gateNote,
      });
    }
    if (onCreateSnippet) {
      plus.push({
        label:     '+ New snippet…',
        insertion: '',
        group:     'Quick add',
        description: 'Open the snippet editor and create a new snippet on this agent.',
        onPick:    onCreateSnippet,
      });
    }

    return { '@': at, '!': bang, '#': hash, '^': caret, '*': star, '%': percent, '+': plus };
  }, [doc, agentId, hasBoundFieldGroup, boundFieldId, onCreateSnippet]);
}
