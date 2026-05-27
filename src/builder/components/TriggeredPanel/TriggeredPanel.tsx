/**
 * TriggeredPanel — renders the brain's `triggered` section for the
 * preview conversation. Sibling of `ThinkingPanel`; sits below the
 * Cortex in CrewView so users see the pre-scripted guidance loaded
 * this turn in real time.
 *
 * Visibility rules (so the panel is discoverable but doesn't add
 * empty chrome to crews that don't use Triggered Context):
 *
 *   - No Triggered Context addon in the crew → render nothing.
 *   - Addon present, no rules matched yet      → empty-state hint.
 *   - Addon present + matches landed           → render cards.
 *
 * Cyan tint matches the addon color, distinguishing this from Memory
 * (neutral) and Thinking (teal).
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { TRIGGERED_CONTEXT_PLUGIN_ID } from '../../plugins/triggeredContext/addon.triggeredContext';
import type { ID } from '../../types';
import styles from './TriggeredPanel.module.css';

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  return JSON.stringify(v, null, 2);
}

interface DomainCard {
  label: string;
  entries: Array<{ field: string; value: unknown }>;
}

interface Props {
  agentId: ID;
  crewId: ID;
}

export function TriggeredPanel({ agentId, crewId }: Props) {
  const { doc, conversationMemory, previewConversationId } = useBuilder();

  const hasLoader = useMemo(() => {
    const crew = doc.agents.find(a => a.id === agentId)?.crews.find(c => c.id === crewId);
    return !!crew?.addons.some(a => a.pluginId === TRIGGERED_CONTEXT_PLUGIN_ID);
  }, [doc, agentId, crewId]);

  const cards = useMemo<DomainCard[]>(() => {
    if (previewConversationId === null) return [];
    const out: DomainCard[] = [];
    for (const [domain, bucket] of Object.entries(conversationMemory.triggered || {})) {
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
    out.sort((a, b) => a.label.localeCompare(b.label));
    return out;
  }, [conversationMemory, previewConversationId]);

  if (!hasLoader) return null;

  const isEmpty = cards.length === 0;

  return (
    <section className={styles.panel} aria-label="Triggered">
      <header className={styles.header}>
        <span className={styles.title}>🎯 Triggered</span>
        <span className={styles.subtitle}>
          Pre-scripted guidance loaded by rules this turn. Overwritten every run.
        </span>
      </header>

      {isEmpty ? (
        <div className={styles.empty}>
          {previewConversationId === null
            ? 'Start a chat to see which rules fire.'
            : 'No rules matched yet — send a message or check your conditions.'}
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
