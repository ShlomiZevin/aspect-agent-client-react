/**
 * ThinkingPanel — renders the brain's `thinking` section for the
 * preview conversation. Sits below the Cortex (chain canvas) in
 * CrewView, giving long-form strategic text room to breathe (unlike
 * the Memory panel which expects short field=value pairs on the side).
 *
 * Visibility rules (so the panel is discoverable but doesn't add
 * empty chrome to crews that don't use thinking):
 *
 *   - No Thinker in the crew    → render nothing.
 *   - Thinker present, no data  → render empty-state hint so the user
 *                                  can see "the wiring is there, just
 *                                  waiting for a turn".
 *   - Thinker present + data    → render cards.
 *
 * Cards: domains as columns, fields inside each card as label + multi-
 * line value. Lavender tint distinguishes plans from facts.
 *
 * No editing for now. Thoughts are transient — overwritten by the
 * next Thinker run. To override a value, add a Memory field via the
 * FieldsPanel instead.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { THINKER_PLUGIN_ID } from '../../plugins/thinker/addon.thinker';
import type { ID } from '../../types';
import styles from './ThinkingPanel.module.css';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

interface DomainCard {
  /** Display label. `_general` → "general". */
  label: string;
  entries: Array<{ field: string; value: unknown }>;
}

interface Props {
  agentId: ID;
  crewId: ID;
}

export function ThinkingPanel({ agentId, crewId }: Props) {
  const { doc, conversationMemory, previewConversationId } = useBuilder();

  // Detect whether this crew has a Thinker addon. Drives the
  // visibility rule — no Thinker = no panel at all.
  const hasThinker = useMemo(() => {
    const crew = doc.agents.find(a => a.id === agentId)?.crews.find(c => c.id === crewId);
    return !!crew?.addons.some(a => a.pluginId === THINKER_PLUGIN_ID);
  }, [doc, agentId, crewId]);

  const cards = useMemo<DomainCard[]>(() => {
    if (previewConversationId === null) return [];
    const out: DomainCard[] = [];
    for (const [domain, bucket] of Object.entries(conversationMemory.thinking || {})) {
      if (!bucket || typeof bucket !== 'object') continue;
      const entries = Object.entries(bucket)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([field, value]) => ({ field, value }));
      if (entries.length === 0) continue;
      out.push({
        label: domain === '_general' ? 'general' : domain,
        entries,
      });
    }
    // Sort cards by label so the layout doesn't shuffle turn-to-turn.
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [conversationMemory, previewConversationId]);

  // No Thinker → don't clutter the canvas with an empty section.
  if (!hasThinker) return null;

  const isEmpty = cards.length === 0;

  return (
    <section className={styles.panel} aria-label="Thinking">
      <header className={styles.header}>
        <span className={styles.title}>💭 Thinking</span>
        <span className={styles.subtitle}>
          What the brain is planning right now. Overwritten by every Thinker run.
        </span>
      </header>

      {isEmpty ? (
        <div className={styles.empty}>
          {previewConversationId === null
            ? 'Start a chat to see what the Thinker comes up with.'
            : 'Awaiting strategy — send a message to run this turn.'}
        </div>
      ) : (
        <div className={styles.cards}>
          {cards.map(card => (
            <article key={card.label} className={styles.card}>
              <header className={styles.cardHeader}>{card.label}</header>
              <dl className={styles.entries}>
                {card.entries.map(e => (
                  <div key={e.field} className={styles.entry}>
                    <dt className={styles.entryLabel}>{e.field}</dt>
                    <dd className={styles.entryValue}>{formatValue(e.value)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
