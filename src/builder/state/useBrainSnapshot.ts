/**
 * useBrainSnapshot — derive the brain-panel view model from data
 * BuilderContext already holds.
 *
 * Pure (no SSE accumulators, no per-turn history): the brain panel
 * is a *window onto current state*, not a journal. Inputs are
 * `doc.agents[0]` (schema, dynamic contexts) and the per-conversation
 * `conversationMemory` blob. Outputs:
 *
 *   • memoryGroups — declared fields grouped by domain (ungrouped
 *     fields land in their own bucket with `domain: null` and render
 *     header-less at the top).
 *   • staleRows — memory keys that exist on disk but no longer have a
 *     matching declared field (shown at the bottom with a "removed
 *     from schema" treatment so authored data never silently
 *     disappears).
 *   • dcHits — Dynamic Contexts that currently resolve to non-empty
 *     text. A DC is a "hit" when its field has a value AND either a
 *     matching case (with umbrella or any section body) or a non-empty
 *     fallback. DCs whose field has no value are filtered out — the
 *     point of the panel is to show what's actually loaded into the
 *     model's prompt right now.
 *
 * Mirrors the server-side resolver (`promptAssembler.resolveDynamicInline`)
 * so the panel matches what the runtime sees — keep them in lockstep
 * when one changes.
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import type {
  EnumTypeDef,
  EnumValueDef,
  FieldDef,
} from '../types';

export interface BrainMemoryRow {
  name: string;
  value: unknown;            // null/undefined = not set
  fieldDef: FieldDef | null; // null = orphan (in memory, not in schema)
}

export interface BrainMemoryGroup {
  /** `null` = the no-domain bucket. Rendered header-less at the top. */
  domain: string | null;
  rows: BrainMemoryRow[];
}

export interface BrainStaleRow {
  name: string;
  value: unknown;
  domain: string | null;
}

export interface BrainDcSectionResolution {
  name: string;
  /** Empty string = no body authored for this section under the matched value. */
  body: string;
}

/**
 * One DC hit — a field of `type === 'enum'` with a live value that
 * matched a declared value on its enum bible. Surfaced in the brain
 * panel so the author can see "this field resolved to value X and
 * here's the umbrella + sections that {{dc:field…}} would inject."
 */
export interface BrainDcHit {
  /** The enum the matched value lives on. */
  enumDef: EnumTypeDef;
  fieldName: string;
  /** The field's live memory value at the time of the snapshot. */
  liveValue: string;
  /** Resolved when the live value matches a declared value on the enum;
   *  `null` when there's no match (the {{dc:…}} token would resolve to
   *  empty for this field at this moment). */
  matched: {
    /** The matched EnumValueDef. */
    value: EnumValueDef;
    /** Value's umbrella — '' when not authored. */
    umbrella: string;
    /** Every section declared on the enum, with this value's body. */
    sections: BrainDcSectionResolution[];
  } | null;
}

/**
 * One bucket of thinking — long-form strategic text the Thinker
 * addon writes per turn. Cards are keyed by domain (the no-domain
 * bucket surfaces as `general`). Order is stable (alphabetical) so
 * the layout doesn't reshuffle turn-to-turn.
 */
export interface BrainThinkingCard {
  /** Display label; the `_general` bucket renders as `general`. */
  domain: string;
  entries: Array<{ field: string; value: unknown }>;
}

/**
 * One Summarizer slot — the current checkpoint plus the watermark
 * (highest message id consumed) and the last-fired timestamp. Read
 * directly from `conversationMemory.summary`. Cards render in
 * alphabetical order by `name` so layout stays stable.
 */
export interface BrainSummarizerCard {
  /** Summarizer's `config.name` — the same key used in
   *  `{{summary:NAME}}` and `since_summarizer: NAME`. */
  name: string;
  /** The current synthesis text. Empty when the addon ran but had
   *  nothing to write. */
  text: string;
  /** Highest message DB id this summarizer consumed in its last run. */
  watermark: number;
  /** Epoch ms when the last run completed. */
  ranAt: number;
}

export interface BrainSnapshot {
  memoryGroups: BrainMemoryGroup[];
  staleRows: BrainStaleRow[];
  dcHits: BrainDcHit[];
  thinkingCards: BrainThinkingCard[];
  summarizerCards: BrainSummarizerCard[];
}

const EMPTY_SNAPSHOT: BrainSnapshot = {
  memoryGroups: [], staleRows: [], dcHits: [], thinkingCards: [], summarizerCards: [],
};

const GENERAL_KEY = '_general';

export function useBrainSnapshot(): BrainSnapshot {
  const { doc, conversationMemory } = useBuilder();
  // Implicit current agent — same convention BuilderContext uses for
  // initial selection.
  const agent = doc.agents[0];

  return useMemo(() => {
    if (!agent) return EMPTY_SNAPSHOT;

    const fields = agent.fields ?? [];
    const mem = conversationMemory?.memory ?? {};

    /** Resolve a field's current memory value using its declared
     *  domain. Mirrors `builderMemory.findFieldValue(name, 'memory')`. */
    const valueOf = (f: FieldDef): unknown => {
      const bucket = mem[f.domain || GENERAL_KEY];
      if (!bucket) return undefined;
      return bucket[f.name];
    };

    // ── Memory groups — declared fields grouped by their domain ──
    const ungroupedRows: BrainMemoryRow[] = [];
    const byDomain = new Map<string, BrainMemoryRow[]>();
    for (const f of fields) {
      const row: BrainMemoryRow = { name: f.name, value: valueOf(f), fieldDef: f };
      const d = f.domain?.trim();
      if (d) {
        if (!byDomain.has(d)) byDomain.set(d, []);
        byDomain.get(d)!.push(row);
      } else {
        ungroupedRows.push(row);
      }
    }
    const memoryGroups: BrainMemoryGroup[] = [];
    if (ungroupedRows.length > 0) {
      memoryGroups.push({ domain: null, rows: ungroupedRows });
    }
    for (const [d, rows] of Array.from(byDomain.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      memoryGroups.push({ domain: d, rows });
    }

    // ── Stale rows — memory keys not backed by a declared field ──
    const declaredByDomain = new Map<string, Set<string>>();
    for (const f of fields) {
      const d = f.domain || GENERAL_KEY;
      if (!declaredByDomain.has(d)) declaredByDomain.set(d, new Set());
      declaredByDomain.get(d)!.add(f.name);
    }
    const staleRows: BrainStaleRow[] = [];
    for (const [domainKey, bucket] of Object.entries(mem)) {
      if (!bucket || typeof bucket !== 'object') continue;
      const declared = declaredByDomain.get(domainKey) ?? new Set<string>();
      for (const [name, value] of Object.entries(bucket)) {
        if (declared.has(name)) continue;
        if (value === undefined || value === null) continue;
        staleRows.push({
          name,
          value,
          domain: domainKey === GENERAL_KEY ? null : domainKey,
        });
      }
    }

    // ── DC hits — enum-typed fields whose live value resolves to a
    // declared value on the agent's enum bible. The runtime's
    // {{dc:FIELD…}} token does the same lookup; this view mirrors
    // what that injection would produce so the author can inspect it.
    const enumsById = new Map((agent.enums ?? []).map(e => [e.id, e]));
    const dcHits: BrainDcHit[] = [];
    for (const field of fields) {
      if (field.type !== 'enum' || !field.enumType) continue;
      const enumDef = enumsById.get(field.enumType);
      if (!enumDef) continue;                   // orphan enumType — skip
      const live = valueOf(field);
      if (live === undefined || live === null) continue;
      const liveStr = String(live);
      const matchedValue = enumDef.values.find(v => String(v.value) === liveStr) || null;
      if (!matchedValue) {
        // Live value doesn't match any declared value — no hit (we
        // surface only positive lookups in the panel, matching the
        // runtime's silent-empty semantics for unmatched dc tokens).
        continue;
      }
      const umbrella = matchedValue.umbrellaText ?? '';
      const sections: BrainDcSectionResolution[] = (enumDef.sections ?? []).map(s => ({
        name: s.name,
        body: matchedValue.sectionTexts?.[s.name] ?? '',
      }));
      const anyContent = umbrella.trim().length > 0
        || sections.some(s => s.body.trim().length > 0);
      if (!anyContent) continue;                // matched but bodies empty → not a hit
      dcHits.push({
        enumDef,
        fieldName: field.name,
        liveValue: liveStr,
        matched: { value: matchedValue, umbrella, sections },
      });
    }

    // ── Thinking cards — long-form plans the Thinker writes per turn.
    // One card per non-empty bucket in `conversationMemory.thinking`;
    // entries are field→value (non-null), alphabetical for stable
    // layout. The brain panel renders nothing when this list is empty
    // (no need to check whether the agent has a Thinker addon —
    // runtime view).
    const thinkingBuckets = conversationMemory?.thinking ?? {};
    const thinkingCards: BrainThinkingCard[] = [];
    for (const [domain, bucket] of Object.entries(thinkingBuckets)) {
      if (!bucket || typeof bucket !== 'object') continue;
      // Alphabetical sort by field name — stable across turns. The
      // LLM emits keys in non-deterministic order; we don't propagate
      // that volatility to the brain panel.
      const entries = Object.entries(bucket)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([field, value]) => ({ field, value }))
        .sort((a, b) => a.field.localeCompare(b.field));
      if (entries.length === 0) continue;
      thinkingCards.push({
        domain: domain === '_general' ? 'general' : domain,
        entries,
      });
    }
    thinkingCards.sort((a, b) => a.domain.localeCompare(b.domain));

    // ── Summarizer cards — one per slot in `conversationMemory.summary`.
    // Slots are written by offline-lane Summarizer addons; the panel
    // shows what's currently in each, plus the watermark + last-fired
    // timestamp so the author can see "this checkpoint covers up to
    // message N, last refreshed Z seconds ago." Empty list when no
    // summarizer has fired yet (no card at all rather than empty
    // placeholders — the brain panel is a runtime view, not a
    // schema).
    const summaryBlob = (conversationMemory as { summary?: Record<string, unknown> } | undefined)?.summary ?? {};
    const summarizerCards: BrainSummarizerCard[] = [];
    for (const [name, slotRaw] of Object.entries(summaryBlob)) {
      if (!slotRaw || typeof slotRaw !== 'object') continue;
      const slot = slotRaw as { text?: unknown; watermark?: unknown; ranAt?: unknown };
      const text = typeof slot.text === 'string' ? slot.text : '';
      const watermark = Number.isFinite(slot.watermark) ? Number(slot.watermark) : 0;
      const ranAt = Number.isFinite(slot.ranAt) ? Number(slot.ranAt) : 0;
      summarizerCards.push({ name, text, watermark, ranAt });
    }
    summarizerCards.sort((a, b) => a.name.localeCompare(b.name));

    return { memoryGroups, staleRows, dcHits, thinkingCards, summarizerCards };
  }, [agent, conversationMemory]);
}

/**
 * Render a memory value for display in the brain panel.
 *   - strings render as bare text (no quotes — the brain isn't a JSON viewer)
 *   - numbers / booleans render bare
 *   - objects / arrays JSON-stringify so nested shapes don't crash the row
 *   - null / undefined caller decides (we return '' here)
 */
export function formatBrainValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}
