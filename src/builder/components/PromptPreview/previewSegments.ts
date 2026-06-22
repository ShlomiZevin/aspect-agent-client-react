/**
 * previewSegments — turn an addon's FULL assembled prompt (its
 * `promptTemplate` with `{{prompt}}` filled by `config.prompt`) into a
 * tree of render nodes for the read-only Prompt Preview.
 *
 * The classes mirror what the runtime does, but render for a human:
 *   - prose        — literal template text.
 *   - static       — a token whose value is known at author time
 *                    (persona, param, enum, extractor schema, …). The
 *                    resolved text is inlined and highlighted so you see
 *                    WHERE it came from. Resolved text is itself
 *                    re-segmented (nested tokens render too).
 *   - snippet      — gated static content: shown as a block with its
 *                    content AND its `if` (filter) — the same treatment
 *                    the snippet-expand pioneered, now applied uniformly.
 *   - dynamic      — a runtime-only token (field / memory / thinking /
 *                    summary / dc). No author-time value, so it renders
 *                    as a chip describing what it resolves to at runtime.
 *                    `dc` carries enough to open an in-place branch viewer.
 *
 * Resolution of the STATIC classes mirrors the server assembler
 * (aspect-agent-server/builder/runtime/promptAssembler.js) so the
 * preview matches what actually runs.
 */

import type {
  AddonFilter,
  AddonInstance,
  EnumTypeDef,
  FieldDef,
  ParameterDef,
  PersonaDef,
  SnippetDef,
} from '../../types';

export type PreviewNode =
  | { kind: 'prose'; text: string }
  | { kind: 'static'; token: string; children: PreviewNode[] }
  | {
      kind: 'snippet';
      name: string;
      filterText: string;
      gated: boolean;
      missing: boolean;
      children: PreviewNode[];
    }
  | {
      kind: 'dynamic';
      token: string;
      dkind: 'field' | 'memory' | 'thinking' | 'summary' | 'dc';
      label: string;
      field?: string;
      section?: string;
    };

export interface PreviewContext {
  instance: AddonInstance;
  /** Live config (the working copy being edited), preferred over instance.config.
   *  Only `prompt` is read here; a plain shape keeps typed plugin configs
   *  assignable without forcing an index signature on each interface. */
  config: { prompt?: string };
  pluginFieldMode: 'none' | 'extractor' | undefined;
  personas: PersonaDef[];
  parameters: ParameterDef[];
  enums: EnumTypeDef[];
  /** Agent + crew fields in scope (for {{dc:…}} lookups + extractor schema). */
  fieldPool: FieldDef[];
  /** The fields THIS extractor instance writes (resolved from extractsFields). */
  extractorFields: FieldDef[];
  snippets: SnippetDef[];
}

const MAX_DEPTH = 4;

// One token: {{prefix}} or {{prefix:rest}} (rest may itself contain ':').
// NOTE: build a FRESH RegExp per `segment` call — a shared /g regex's
// `lastIndex` would be clobbered by recursive calls and loop forever.
const TOKEN_SRC = '\\{\\{([a-z_]+)(?::([^}]+))?\\}\\}';

const STATIC_NO_ARG = new Set([
  'fields_schema', 'fields_current', 'this_field', 'enum_values', 'these_fields',
]);
const DYNAMIC_PREFIXES = new Set(['field', 'memory', 'thinking', 'summary', 'dc']);

// ─── Static resolvers (mirror the server) ──────────────────────────

function applicablePersonas(personas: PersonaDef[], pluginId: string): PersonaDef[] {
  return (personas ?? []).filter(p => {
    const a = Array.isArray(p.appliesTo) ? p.appliesTo : [];
    return a.includes('*') || a.includes(pluginId);
  });
}

function buildPersonaBlock(list: PersonaDef[]): string {
  const items = list
    .map(p => ({ name: p.name, content: (p.content ?? '').trim() }))
    .filter(p => p.content);
  if (items.length === 0) return '';
  if (items.length === 1) return `## Persona\n${items[0].content}`;
  return items.map(p => `## Persona: ${p.name}\n${p.content}`).join('\n\n');
}

function resolveParam(name: string, parameters: ParameterDef[]): string {
  const found = (parameters ?? []).find(p => p.name === name);
  if (!found) return '';
  return typeof found.value === 'string' ? found.value : JSON.stringify(found.value);
}

function findEnumById(enums: EnumTypeDef[], id: string | undefined): EnumTypeDef | null {
  if (!id) return null;
  return (enums ?? []).find(e => e.id === id) ?? null;
}
function findEnumByName(enums: EnumTypeDef[], name: string): EnumTypeDef | null {
  return (enums ?? []).find(e => e.name === name) ?? null;
}

/** `{{enum:NAME[:SECTION|:values]}}` aggregate — mirrors the server. */
function resolveEnumAggregate(rawArg: string, enums: EnumTypeDef[]): string | null {
  const colon = rawArg.indexOf(':');
  const enumName = colon === -1 ? rawArg : rawArg.slice(0, colon);
  const section  = colon === -1 ? null   : rawArg.slice(colon + 1);
  const def = findEnumByName(enums, enumName);
  if (!def) return null;
  if (section === 'values') {
    return def.values.map(v => v?.value).filter(Boolean).join(', ');
  }
  const blocks: string[] = [];
  for (const v of def.values) {
    if (!v?.value) continue;
    const body = section === null
      ? (v.umbrellaText ?? '').trim()
      : (typeof (v.sectionTexts ?? {})[section] === 'string' ? (v.sectionTexts ?? {})[section].trim() : '');
    if (!body) continue;
    blocks.push(`### ${v.value}\n${body}`);
  }
  if (blocks.length === 0) return '';
  const header = section === null ? `## ${def.name}` : `## ${def.name} — ${section}`;
  return `${header}\n\n${blocks.join('\n\n')}`;
}

function buildFieldsSchema(fields: FieldDef[], enums: EnumTypeDef[]): string {
  if (fields.length === 0) return '';
  return fields.map(f => {
    const props: string[] = [`type=${f.type}`];
    if (f.type === 'enum') {
      const def = findEnumById(enums, f.enumType);
      const vals = def ? def.values.map(v => v.value).filter(Boolean) : [];
      if (vals.length > 0) props.push(`values=[${vals.join(', ')}]`);
    }
    props.push(`source=${f.source}`);
    const head = `- ${f.name} (${props.join(', ')})`;
    const how = (f.howToExtract ?? '').trim();
    return how ? `${head}: ${how}` : head;
  }).join('\n');
}

function snippetFilterText(filter: AddonFilter | undefined, summary: (f: AddonFilter | undefined) => string): string {
  return summary(filter);
}

// ─── Segmenter ──────────────────────────────────────────────────────

interface ResolveDeps {
  filterSummary: (f: AddonFilter | undefined) => string;
}

function segment(text: string, ctx: PreviewContext, deps: ResolveDeps, depth: number): PreviewNode[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  if (depth > MAX_DEPTH) return [{ kind: 'prose', text }];

  const out: PreviewNode[] = [];
  let last = 0;
  // Fresh regex per call so recursion can't corrupt our lastIndex.
  const re = new RegExp(TOKEN_SRC, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ kind: 'prose', text: text.slice(last, m.index) });
    last = m.index + m[0].length;
    const token = m[0];
    const prefix = m[1];
    const arg = m[2];
    out.push(classify(token, prefix, arg, ctx, deps, depth));
  }
  if (last < text.length) out.push({ kind: 'prose', text: text.slice(last) });
  return out;
}

function staticNode(token: string, resolved: string, ctx: PreviewContext, deps: ResolveDeps, depth: number): PreviewNode {
  return { kind: 'static', token, children: segment(resolved, ctx, deps, depth + 1) };
}

function classify(
  token: string, prefix: string, arg: string | undefined,
  ctx: PreviewContext, deps: ResolveDeps, depth: number,
): PreviewNode {
  const isExtractor = ctx.pluginFieldMode === 'extractor';

  // ── Dynamic (runtime-only) ──
  if (DYNAMIC_PREFIXES.has(prefix)) {
    if (prefix === 'dc') {
      const colon = (arg ?? '').indexOf(':');
      const field = colon === -1 ? (arg ?? '') : (arg ?? '').slice(0, colon);
      const section = colon === -1 ? undefined : (arg ?? '').slice(colon + 1);
      return { kind: 'dynamic', token, dkind: 'dc', label: arg ?? '', field, section };
    }
    return { kind: 'dynamic', token, dkind: prefix as 'field' | 'memory' | 'thinking' | 'summary', label: arg ?? '' };
  }

  // ── Snippet (gated static) ──
  if (prefix === 'snippet') {
    const name = arg ?? '';
    const snip = ctx.snippets.find(s => s.name === name);
    if (!snip) {
      return { kind: 'snippet', name, filterText: 'missing — resolves to empty', gated: false, missing: true, children: [] };
    }
    const gated = !!snip.filter && Array.isArray(snip.filter.conditions) && snip.filter.conditions.length > 0;
    return {
      kind: 'snippet',
      name,
      filterText: snippetFilterText(snip.filter, deps.filterSummary),
      gated,
      missing: false,
      children: segment(snip.content ?? '', ctx, deps, depth + 1),
    };
  }

  // ── Static, no-arg ──
  if (STATIC_NO_ARG.has(prefix)) {
    if (prefix === 'fields_schema') return staticNode(token, isExtractor ? buildFieldsSchema(ctx.extractorFields, ctx.enums) : '', ctx, deps, depth);
    if (prefix === 'fields_current') return staticNode(token, isExtractor ? '{}' : '', ctx, deps, depth);
    if (prefix === 'this_field') return staticNode(token, isExtractor && ctx.extractorFields[0] ? ctx.extractorFields[0].name : '', ctx, deps, depth);
    if (prefix === 'these_fields') return staticNode(token, isExtractor ? ctx.extractorFields.map(f => f?.name).filter(Boolean).join(', ') : '', ctx, deps, depth);
    if (prefix === 'enum_values') {
      const f0 = ctx.extractorFields[0];
      let vals = '';
      if (isExtractor && f0 && f0.type === 'enum') {
        const def = findEnumById(ctx.enums, f0.enumType);
        vals = def ? def.values.map(v => v.value).filter(Boolean).join(', ') : '';
      }
      return staticNode(token, vals, ctx, deps, depth);
    }
  }

  // ── Static with arg ──
  if (prefix === 'persona') {
    if (arg) {
      const p = ctx.personas.find(x => x.name === arg);
      return staticNode(token, p ? (p.content ?? '').trim() : '', ctx, deps, depth);
    }
    return staticNode(token, buildPersonaBlock(applicablePersonas(ctx.personas, ctx.instance.pluginId)), ctx, deps, depth);
  }
  if (prefix === 'param') {
    return staticNode(token, resolveParam(arg ?? '', ctx.parameters), ctx, deps, depth);
  }
  if (prefix === 'fieldname') {
    // Resolves to the LITERAL field name (not its memory value).
    // Used when authors want to mention a field's name in prose
    // without misusing {{field:NAME}} (which substitutes the value).
    // Unknown names stay literal so typos surface in the preview.
    const f = (ctx.fieldPool ?? []).find(x => x && x.name === (arg ?? ''));
    if (!f) return { kind: 'prose', text: token };
    return staticNode(token, f.name, ctx, deps, depth);
  }
  if (prefix === 'enum') {
    const resolved = resolveEnumAggregate(arg ?? '', ctx.enums);
    // Unknown enum → leave the token literal as prose so the typo shows.
    if (resolved === null) return { kind: 'prose', text: token };
    return staticNode(token, resolved, ctx, deps, depth);
  }

  // Unknown token — leave literal.
  return { kind: 'prose', text: token };
}

/**
 * Build the full preview node tree. `{{prompt}}` is filled with the
 * live `config.prompt` first (so the user's own tokens get segmented),
 * then the whole assembled template is segmented.
 */
export function buildPreviewNodes(ctx: PreviewContext, filterSummary: (f: AddonFilter | undefined) => string): PreviewNode[] {
  const template = (ctx.instance.promptTemplate ?? '').split('{{prompt}}').join(String(ctx.config.prompt ?? ''));
  return segment(template, ctx, { filterSummary }, 0);
}
