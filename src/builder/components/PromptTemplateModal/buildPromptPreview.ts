/**
 * Build a preview of the assembled prompt from current config values.
 *
 * Mirrors what the server runtime will do: substitute the template
 * placeholders with values pulled from the addon's `config` /
 * `context` and the surrounding agent/crew state. The server uses
 * the exact same template string from `AddonInstance.promptTemplate`,
 * so this client preview should match byte-for-byte (modulo live
 * conversation state like field values).
 *
 * History is NOT in the prompt — it's a separate runtime parameter.
 * The viewer renders history separately.
 */

import type {
  AddonInstance,
  FieldDef,
  ParameterDef,
} from '../../types';
import { getPlugin } from '../../registry/plugins';

interface BuildArgs {
  instance: AddonInstance;
  agentPersona: string;
  /**
   * The field definitions this extractor instance extracts —
   * resolved from `instance.config.extractsFields[]` against
   * `agent.fields ∪ owning crew.fields`. Empty for non-extractor
   * plugins. The caller (the modal) does the lookup; this helper
   * just renders the schema/current blocks.
   */
  extractorFields?: FieldDef[];
  /**
   * Agent.parameters — used to resolve `{{param:NAME}}` tokens at
   * preview time. Parameters are static so the preview can reproduce
   * the server's substitution byte-for-byte. Defaults to empty.
   */
  parameters?: ParameterDef[];
}

/**
 * Substitute flat `{{name}}` placeholders. Empty values collapse the
 * placeholder AND surrounding blank lines so the prompt doesn't end up
 * with awkward gaps. Parameterised tokens like `{{memory:domain}}` are
 * handled separately by `substituteParameterised`.
 */
function substitute(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    if (!result.includes(placeholder)) continue;
    if (value === '') {
      const re = new RegExp(`\\n*${placeholder.replace(/[{}]/g, '\\$&')}\\n*`, 'g');
      result = result.replace(re, '\n\n');
    } else {
      result = result.split(placeholder).join(value);
    }
  }
  return result;
}

/**
 * Substitute parameterised tokens of the form `{{prefix:NAME}}`. The
 * `resolve(name)` callback returns the substitution string (empty
 * string for "value exists but is blank") or null/undefined to leave
 * the token in place.
 *
 * Mirrors the server's substituteParameterised in promptAssembler.js.
 */
function substituteParameterised(
  template: string,
  prefix: string,
  resolve: (name: string) => string | null | undefined,
  inline: boolean,
): string {
  const re = new RegExp(`\\{\\{${prefix}:([^}\\s]+)\\}\\}`, 'g');
  return template.replace(re, (match, name: string) => {
    const v = resolve(name);
    if (v === null || v === undefined) return match;
    if (v === '' && !inline) return '\n\n';
    return v;
  });
}

function buildPersonaBlock(persona: string): string {
  const text = persona.trim();
  if (!text) return '';
  return `## Persona\n${text}`;
}

/**
 * Phase B: `{{memory}}` enumerates all populated domains at runtime.
 * Preview has no live values, so the section renders as empty `## Memory`
 * — same as server when no memory has been written. Matches server's
 * buildMemoryBlock when domainList returns [].
 */
function buildMemoryBlock(): string {
  return '';
}

function buildThinkingBlock(): string {
  return '';
}

/**
 * `## Triggered` block — Triggered Context writes go here. Same shape
 * as Memory / Thinking. Byte-equal to the server's buildTriggeredBlock.
 */
function buildTriggeredBlock(selectedDomains: Array<string | null>): string {
  if (selectedDomains.length === 0) return '';
  const sections: string[] = selectedDomains.map(d => {
    const label = d ?? 'general';
    return `### ${label}\n{}`;
  });
  return `## Triggered\n${sections.join('\n\n')}`;
}

function buildFieldsSchemaBlock(fields: FieldDef[]): string {
  if (fields.length === 0) return '';
  // Format: `- <name> (type=..., [values=[...],] source=...): <how>`
  // Explicit key=value props remove the ambiguity from the old
  // comma-separated form where "explicit" could read as an enum value.
  // MUST stay byte-equal to the server's buildFieldsSchemaBlock in
  // aspect-agent-server/builder/runtime/promptAssembler.js.
  const lines = fields.map(f => {
    const props: string[] = [`type=${f.type}`];
    if (f.type === 'enum' && f.enumValues && f.enumValues.length > 0) {
      props.push(`values=[${f.enumValues.join(', ')}]`);
    }
    props.push(`source=${f.source}`);
    const head = `- ${f.name} (${props.join(', ')})`;
    const how = f.howToExtract.trim();
    return how ? `${head}: ${how}` : head;
  });
  return lines.join('\n');
}

function buildFieldsCurrentBlock(_fields: FieldDef[]): string {
  // Runtime contract: this block holds ONLY fields that have a
  // captured value — never nulls. Including nulls confuses the LLM
  // ("we already collected age = null"). At preview time we have no
  // live values, so the block is empty `{}`.
  return '{}';
}

/**
 * Single-domain block for `{{memory:NAME}}` / `{{thinking:NAME}}`.
 * Preview has no live values, so the block is `### NAME\n{}` — mirrors
 * the empty-domain shape in the whole-section preview helpers above.
 * Mirrors the server's buildSingleDomainBlock byte-for-byte for the
 * empty case.
 */
function buildSingleDomainPreviewBlock(name: string): string {
  return `### ${name}\n{}`;
}

export function buildPromptPreview({
  instance, agentPersona, extractorFields, parameters,
}: BuildArgs): string {
  const plugin = getPlugin(instance.pluginId);
  let template = instance.promptTemplate ?? '';
  const cfg = instance.config as { prompt?: string } | undefined;

  const isExtractor = plugin?.fieldMode === 'extractor';
  // Field defs come from the caller now — they live on agent/crew
  // bodies, not inside the extractor's config. Resolving them
  // requires knowing the agent + crew so the modal does that lookup.
  const fields: FieldDef[] = isExtractor ? (extractorFields ?? []) : [];

  // {{prompt}} first — config.prompt may itself contain placeholders
  // that the resolvers below need to see. Same order as server.
  template = template.split('{{prompt}}').join(cfg?.prompt ?? '');

  // Flat whole-section tokens.
  template = substitute(template, {
    persona: buildPersonaBlock(agentPersona),
    memory: buildMemoryBlock(),
    thinking: buildThinkingBlock(),
    triggered: buildTriggeredBlock(instance.context.triggeredReads ?? []),
    fields_schema: isExtractor ? buildFieldsSchemaBlock(fields) : '',
    fields_current: isExtractor ? buildFieldsCurrentBlock(fields) : '',
  });

  // Parameterised tokens last.
  template = substituteParameterised(template, 'memory',   name => buildSingleDomainPreviewBlock(name), false);
  template = substituteParameterised(template, 'thinking', name => buildSingleDomainPreviewBlock(name), false);
  template = substituteParameterised(template, 'field',    () => '', true);
  template = substituteParameterised(template, 'param',    name => {
    const found = (parameters ?? []).find(p => p.name === name);
    if (!found) return '';
    return typeof found.value === 'string' ? found.value : JSON.stringify(found.value);
  }, true);

  return template.replace(/\n{3,}/g, '\n\n').trim();
}

export function describeHistory(instance: AddonInstance): string {
  const h = instance.context.history;
  switch (h.mode) {
    case 'none':   return 'No history';
    case 'full':   return 'Full conversation';
    case 'last_n': return `Last ${h.n ?? 5} messages`;
  }
}
