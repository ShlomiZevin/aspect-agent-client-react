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
  EnumTypeDef,
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
  /**
   * Agent.enums — the enum bible. Used to resolve `{{enum:NAME[:S]}}`
   * (static, no live data needed) and `{{enum_values}}` (for an
   * extractor's first field's allowed-values list). `{{dc:FIELD…}}`
   * is left literal in preview because there's no live memory.
   */
  enums?: EnumTypeDef[];
  /** Agent + crew fields in scope — used to resolve `{{dc:…}}` field
   *  references at preview time. Today we just leave them literal
   *  (no live brain), but the prop is here for future expansion. */
  fieldsForDc?: FieldDef[];
}

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

function buildMemoryBlock(): string { return ''; }
function buildThinkingBlock(): string { return ''; }

function findEnumById(enums: EnumTypeDef[] | undefined, id: string | undefined): EnumTypeDef | null {
  if (!enums || !id) return null;
  return enums.find(e => e.id === id) ?? null;
}
function findEnumByName(enums: EnumTypeDef[] | undefined, name: string): EnumTypeDef | null {
  if (!enums) return null;
  return enums.find(e => e.name === name) ?? null;
}

function buildFieldsSchemaBlock(fields: FieldDef[], enums?: EnumTypeDef[]): string {
  if (fields.length === 0) return '';
  // Format MUST stay byte-equal to the server's buildFieldsSchemaBlock
  // in aspect-agent-server/builder/runtime/promptAssembler.js — drift =
  // silent prompt divergence.
  const lines = fields.map(f => {
    const props: string[] = [`type=${f.type}`];
    if (f.type === 'enum') {
      const enumDef = findEnumById(enums, f.enumType);
      const vals = enumDef ? enumDef.values.map(v => v.value).filter(Boolean) : [];
      if (vals.length > 0) {
        props.push(`values=[${vals.join(', ')}]`);
      }
    }
    props.push(`source=${f.source}`);
    const head = `- ${f.name} (${props.join(', ')})`;
    const how = f.howToExtract.trim();
    return how ? `${head}: ${how}` : head;
  });
  return lines.join('\n');
}

function buildFieldsCurrentBlock(_fields: FieldDef[]): string {
  return '{}';
}

function buildSingleDomainPreviewBlock(name: string): string {
  return `### ${name}\n{}`;
}

/** Reserved second segment of `{{enum:NAME:…}}` — comma-separated
 *  values list. MUST match the server's promptAssembler.js. */
const ENUM_VALUES_KEYWORD = 'values';

/**
 * Aggregate render for `{{enum:NAME[:SECTION|:values]}}` — mirrors the
 * server's resolveEnumAggregate in promptAssembler.js. Returns null
 * for unknown enum (token stays literal); '' when nothing to render;
 * otherwise the rendered text.
 */
function resolveEnumAggregate(rawName: string, enums?: EnumTypeDef[]): string | null {
  const colonIdx = rawName.indexOf(':');
  const enumName    = colonIdx === -1 ? rawName : rawName.slice(0, colonIdx);
  const sectionPart = colonIdx === -1 ? null    : rawName.slice(colonIdx + 1);
  const enumDef = findEnumByName(enums, enumName);
  if (!enumDef) return null;

  // Reserved: `:values` → inline comma-separated values list.
  if (sectionPart === ENUM_VALUES_KEYWORD) {
    return enumDef.values.map(v => v?.value).filter(Boolean).join(', ');
  }

  const blocks: string[] = [];
  for (const v of enumDef.values) {
    if (!v?.value) continue;
    let body = '';
    if (sectionPart === null) {
      body = (v.umbrellaText ?? '').trim();
    } else {
      const raw = (v.sectionTexts ?? {})[sectionPart];
      body = typeof raw === 'string' ? raw.trim() : '';
    }
    if (!body) continue;
    blocks.push(`### ${v.value}\n${body}`);
  }
  if (blocks.length === 0) return '';
  const header = sectionPart === null
    ? `## ${enumDef.name}`
    : `## ${enumDef.name} — ${sectionPart}`;
  return `${header}\n\n${blocks.join('\n\n')}`;
}

export function buildPromptPreview({
  instance, agentPersona, extractorFields, parameters, enums, fieldsForDc: _fieldsForDc,
}: BuildArgs): string {
  const plugin = getPlugin(instance.pluginId);
  let template = instance.promptTemplate ?? '';
  const cfg = instance.config as { prompt?: string } | undefined;

  const isExtractor = plugin?.fieldMode === 'extractor';
  const fields: FieldDef[] = isExtractor ? (extractorFields ?? []) : [];

  template = template.split('{{prompt}}').join(cfg?.prompt ?? '');

  template = substitute(template, {
    persona: buildPersonaBlock(agentPersona),
    memory: buildMemoryBlock(),
    thinking: buildThinkingBlock(),
    fields_schema: isExtractor ? buildFieldsSchemaBlock(fields, enums) : '',
    fields_current: isExtractor ? buildFieldsCurrentBlock(fields) : '',
  });

  // Single-field inline tokens for extractor prompts.
  const thisField = isExtractor && fields.length > 0 ? fields[0] : null;
  const thisFieldName = thisField ? thisField.name : '';
  let enumValuesText = '';
  if (thisField && thisField.type === 'enum') {
    const enumDef = findEnumById(enums, thisField.enumType);
    if (enumDef) {
      enumValuesText = enumDef.values.map(v => v.value).filter(Boolean).join(', ');
    }
  }
  template = template.split('{{this_field}}').join(thisFieldName);
  template = template.split('{{enum_values}}').join(enumValuesText);

  // Multi-field counterpart of {{this_field}} — comma-separated list
  // of wired field names. Mirrors the server's substitution so the
  // preview matches runtime output byte-for-byte.
  const theseFieldsText = isExtractor
    ? fields.map(f => f && f.name).filter(Boolean).join(', ')
    : '';
  template = template.split('{{these_fields}}').join(theseFieldsText);

  // Parameterised tokens.
  template = substituteParameterised(template, 'memory',   name => buildSingleDomainPreviewBlock(name), false);
  template = substituteParameterised(template, 'thinking', name => buildSingleDomainPreviewBlock(name), false);
  template = substituteParameterised(template, 'field',    () => '', true);
  template = substituteParameterised(template, 'param',    name => {
    const found = (parameters ?? []).find(p => p.name === name);
    if (!found) return '';
    return typeof found.value === 'string' ? found.value : JSON.stringify(found.value);
  }, true);

  // Enum tokens — see resolveEnumAggregate. `:values` runs inline
  // FIRST so the block pass can treat the remainder as block-mode.
  template = template.replace(/\{\{enum:([^:}\s]+):values\}\}/g, (match, name: string) => {
    const out = resolveEnumAggregate(`${name}:values`, enums);
    return out === null || out === undefined ? match : out;
  });
  template = substituteParameterised(
    template,
    'enum',
    name => resolveEnumAggregate(name, enums),
    false,
  );

  // DC live-value lookup — preview has no live brain. We render empty
  // string for matching token shapes (FIELD[:S|*]) so the preview shows
  // "this would resolve at runtime" without leaving stale tokens. Use
  // an empty string return so the assembler's block-collapse trims
  // whitespace around them.
  template = substituteParameterised(template, 'dc', () => '', false);

  return template.replace(/\n{3,}/g, '\n\n').trim();
}

export function describeHistory(instance: AddonInstance): string {
  const h = instance.context.history;
  switch (h.mode) {
    case 'none':              return 'No history';
    case 'full':              return 'Full conversation';
    case 'all':               return 'Full conversation';
    case 'last_n':            return `Last ${h.n ?? 5} messages`;
    case 'since_transition':  return 'Since last crew transition';
    case 'since_summarizer':  return `Since "${h.summarizerName}" last run`;
  }
}
