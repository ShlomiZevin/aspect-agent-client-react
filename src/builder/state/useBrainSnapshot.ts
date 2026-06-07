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
  DynamicContextDef,
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
  /** Empty string = no body authored for the matched case. */
  body: string;
}

export interface BrainDcHit {
  dc: DynamicContextDef;
  fieldName: string;
  /** The DC's field value at the time of the snapshot. */
  liveValue: string;
  matched: {
    /** `case.value` that fired. */
    caseValue: string;
    /** `case.text` — '' if the case has no umbrella authored. */
    umbrella: string;
    /** Every declared section under the DC, with the matched case's body. */
    sections: BrainDcSectionResolution[];
  } | null;
  /** Non-empty only when `matched === null` and the DC has a fallback. */
  fallback: string;
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

export interface BrainSnapshot {
  memoryGroups: BrainMemoryGroup[];
  staleRows: BrainStaleRow[];
  dcHits: BrainDcHit[];
  thinkingCards: BrainThinkingCard[];
}

const EMPTY_SNAPSHOT: BrainSnapshot = {
  memoryGroups: [], staleRows: [], dcHits: [], thinkingCards: [],
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

    // ── Dynamic Context hits ──
    const fieldsById = new Map(fields.map(f => [f.id, f]));
    const dcHits: BrainDcHit[] = [];
    for (const dc of agent.dynamicContexts ?? []) {
      const field = fieldsById.get(dc.fieldId);
      if (!field) continue; // orphan DC — no field to look up

      const live = valueOf(field);
      if (live === undefined || live === null) continue; // no value, no hit
      const liveStr = String(live);

      const matchedCase = (dc.cases ?? []).find(c => String(c.value) === liveStr);

      if (matchedCase) {
        const umbrella = matchedCase.text ?? '';
        const sections: BrainDcSectionResolution[] = (dc.sections ?? []).map(s => ({
          name: s.name,
          body: matchedCase.sectionTexts?.[s.name] ?? '',
        }));
        const anyContent = umbrella.trim().length > 0 || sections.some(s => s.body.trim().length > 0);
        if (!anyContent) continue; // matched but every body is empty → not a hit
        dcHits.push({
          dc,
          fieldName: field.name,
          liveValue: liveStr,
          matched: { caseValue: liveStr, umbrella, sections },
          fallback: '',
        });
      } else {
        const fb = (dc.fallback ?? '').trim();
        if (!fb) continue; // no match + no fallback → not a hit
        dcHits.push({
          dc,
          fieldName: field.name,
          liveValue: liveStr,
          matched: null,
          fallback: dc.fallback!,
        });
      }
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
      const entries = Object.entries(bucket)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([field, value]) => ({ field, value }));
      if (entries.length === 0) continue;
      thinkingCards.push({
        domain: domain === '_general' ? 'general' : domain,
        entries,
      });
    }
    thinkingCards.sort((a, b) => a.domain.localeCompare(b.domain));

    return { memoryGroups, staleRows, dcHits, thinkingCards };
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
