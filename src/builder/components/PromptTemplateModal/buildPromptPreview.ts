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
} from '../../types';
import { getPlugin } from '../../registry/plugins';

interface BuildArgs {
  instance: AddonInstance;
  agentPersona: string;
}

/**
 * Substitute placeholders. Empty values collapse the placeholder AND
 * any blank lines it was wrapped in so the prompt doesn't end up
 * with awkward gaps.
 */
function substitute(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{{${key}}}`;
    if (!result.includes(placeholder)) continue;
    if (value === '') {
      // Eat blank lines around the placeholder so empty sections vanish cleanly.
      const re = new RegExp(`\\n*${placeholder.replace(/[{}]/g, '\\$&')}\\n*`, 'g');
      result = result.replace(re, '\n\n');
    } else {
      result = result.split(placeholder).join(value);
    }
  }
  // Collapse 3+ newlines into 2.
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

function buildPersonaBlock(persona: string, enabled: boolean): string {
  if (!enabled) return '';
  const text = persona.trim();
  if (!text) return '';
  return `## Persona\n${text}`;
}

function buildMemoryBlock(selectedDomains: Array<string | null>): string {
  if (selectedDomains.length === 0) return '';
  // Runtime contract: each `### <domain>` block holds only the
  // fields that have values. Preview = empty `{}` per domain.
  const sections: string[] = selectedDomains.map(d => {
    const label = d ?? '(ungrouped)';
    return `### ${label}\n{}`;
  });
  return `## Memory\n${sections.join('\n\n')}`;
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

export function buildPromptPreview({ instance, agentPersona }: BuildArgs): string {
  const plugin = getPlugin(instance.pluginId);
  const template = instance.promptTemplate ?? '';
  const cfg = instance.config as { prompt?: string; fields?: FieldDef[] } | undefined;

  const isExtractor = plugin?.fieldMode === 'extractor';
  const extractorFields: FieldDef[] = isExtractor ? cfg?.fields ?? [] : [];

  return substitute(template, {
    prompt: cfg?.prompt ?? '',
    persona: buildPersonaBlock(agentPersona, instance.context.persona),
    memory: buildMemoryBlock(instance.context.memoryReads),
    fields_schema: isExtractor ? buildFieldsSchemaBlock(extractorFields) : '',
    fields_current: isExtractor ? buildFieldsCurrentBlock(extractorFields) : '',
  });
}

export function describeHistory(instance: AddonInstance): string {
  const h = instance.context.history;
  switch (h.mode) {
    case 'none':   return 'No history';
    case 'full':   return 'Full conversation';
    case 'last_n': return `Last ${h.n ?? 5} messages`;
  }
}
