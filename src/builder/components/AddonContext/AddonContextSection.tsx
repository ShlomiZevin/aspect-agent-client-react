/**
 * AddonContextSection — the universal "Context" block in every
 * addon's config modal.
 *
 * Three knobs:
 *   1. History — none / last N / full
 *   2. Persona — toggle (default off)
 *   3. Memory — checkboxes per crew domain, plus "(no domain)"
 *
 * Collapsible. The data lives on `AddonInstance.context` and is
 * updated through BuilderContext.updateAddonContext.
 */

import { useMemo, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import { getPlugin } from '../../registry/plugins';
import type { AddonContext, AddonInstance, HistoryMode, ID } from '../../types';
import styles from './AddonContextSection.module.css';

interface Props {
  agentId: ID;
  crewId: ID;
  instance: AddonInstance;
}

type HistoryChoice = 'none' | 'last_3' | 'last_5' | 'last_10' | 'full';

function choiceFromMode(mode: HistoryMode): HistoryChoice {
  if (mode.mode === 'none') return 'none';
  if (mode.mode === 'full') return 'full';
  switch (mode.n) {
    case 3:  return 'last_3';
    case 10: return 'last_10';
    default: return 'last_5';
  }
}

function modeFromChoice(choice: HistoryChoice): HistoryMode {
  switch (choice) {
    case 'none':    return { mode: 'none' };
    case 'last_3':  return { mode: 'last_n', n: 3 };
    case 'last_5':  return { mode: 'last_n', n: 5 };
    case 'last_10': return { mode: 'last_n', n: 10 };
    case 'full':    return { mode: 'full' };
  }
}

const HISTORY_OPTIONS: { value: HistoryChoice; label: string }[] = [
  { value: 'none',    label: 'None' },
  { value: 'last_3',  label: 'Last 3 messages' },
  { value: 'last_5',  label: 'Last 5 messages' },
  { value: 'last_10', label: 'Last 10 messages' },
  { value: 'full',    label: 'Full conversation' },
];

export function AddonContextSection({ agentId, crewId, instance }: Props) {
  const { updateAddonContext } = useBuilder();
  const { domains } = useCrewFields(agentId, crewId);
  const [open, setOpen] = useState(false);

  const plugin = getPlugin(instance.pluginId);
  const isExtractor = plugin?.fieldMode === 'extractor';

  const ctx = instance.context;
  const patch = (next: Partial<AddonContext>) =>
    updateAddonContext(agentId, crewId, instance.instanceId, { ...ctx, ...next });

  // Set of selected memory reads. Use a sentinel for null so we can
  // store it in a JS Set without losing the distinction.
  const NO_DOMAIN = '__no_domain__';
  const selected = useMemo(() => {
    const s = new Set<string>();
    for (const d of ctx.memoryReads) s.add(d === null ? NO_DOMAIN : d);
    return s;
  }, [ctx.memoryReads]);

  const toggleDomain = (key: string | null) => {
    const sentinel = key === null ? NO_DOMAIN : key;
    const next = new Set(selected);
    if (next.has(sentinel)) next.delete(sentinel);
    else next.add(sentinel);
    const nextReads: Array<string | null> = [];
    for (const v of next) {
      nextReads.push(v === NO_DOMAIN ? null : v);
    }
    patch({ memoryReads: nextReads });
  };

  const historyChoice = choiceFromMode(ctx.history);

  // Domain options for the picker. Named domains first, "(no domain)"
  // last per the agreed UX. If a domain is selected but not currently
  // present in the crew, still show it so the user can toggle it off.
  const namedSet = new Set<string>(
    domains.filter(d => d.name !== null).map(d => d.name as string),
  );
  for (const v of ctx.memoryReads) {
    if (typeof v === 'string' && !namedSet.has(v)) namedSet.add(v);
  }
  const named = [...namedSet].sort();
  const hasNoDomainInCrew = domains.some(d => d.name === null);
  const showNoDomain = hasNoDomainInCrew || selected.has(NO_DOMAIN);

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
        <span className={styles.title}>Context</span>
        <span className={styles.summary}>
          {summarise(ctx, named.length, hasNoDomainInCrew)}
        </span>
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <label className={styles.knobLabel}>History</label>
            <select
              className={styles.select}
              value={historyChoice}
              onChange={e => patch({ history: modeFromChoice(e.target.value as HistoryChoice) })}
            >
              {HISTORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.row}>
            <label className={styles.knobLabel}>Persona</label>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={ctx.persona}
                onChange={e => patch({ persona: e.target.checked })}
              />
              <span>Inject the agent persona into the prompt</span>
            </label>
          </div>

          <div className={styles.memoryBlock}>
            <label className={styles.knobLabel}>Memory</label>
            {named.length === 0 && !showNoDomain && (
              <p className={styles.hint}>
                No domains in this crew yet. Tag fields with a domain to make
                memory available here.
              </p>
            )}
            <div className={styles.memoryList}>
              {named.map(d => (
                <label key={d} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={selected.has(d)}
                    onChange={() => toggleDomain(d)}
                  />
                  <span className={styles.domainName}>{d}</span>
                </label>
              ))}
              {showNoDomain && (
                <label className={`${styles.checkRow} ${styles.ungroupedToggle}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(NO_DOMAIN)}
                    onChange={() => toggleDomain(null)}
                  />
                  <span className={styles.ungroupedLabel}>Include ungrouped fields</span>
                </label>
              )}
            </div>
          </div>

          {isExtractor && (
            <div className={styles.autoBlock}>
              <label className={styles.knobLabel}>Auto</label>
              <p className={styles.autoNote}>
                Every field defined on this extractor (name, type, allowed enum
                values, description) — together with its current captured value
                — is appended to the prompt automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function summarise(ctx: AddonContext, namedDomainCount: number, hasNoDomain: boolean): string {
  const parts: string[] = [];

  if (ctx.history.mode === 'none') parts.push('no history');
  else if (ctx.history.mode === 'full') parts.push('full history');
  else parts.push(`last ${ctx.history.n ?? 5} msgs`);

  if (ctx.persona) parts.push('persona');

  const reads = ctx.memoryReads.length;
  const total = namedDomainCount + (hasNoDomain ? 1 : 0);
  if (reads > 0) parts.push(`memory: ${reads}${total ? `/${total}` : ''}`);

  return parts.join(' · ');
}
