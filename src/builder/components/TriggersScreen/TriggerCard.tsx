/**
 * TriggerCard — one trigger, drawn as an addon chip.
 *
 * Matched to the Cortex card deliberately, down to the numbers: same
 * 130×86 footprint, same 3px coloured top bar, same icon / name /
 * subtitle stack, same hover-reveal enable switch pinned top-left.
 *
 * Two things follow from that match rather than from taste:
 *
 *   - **No delete on the card.** Addons put Remove in their config
 *     modal's footer, so triggers do too. A destructive control on a
 *     chip you click to open is a misfire waiting to happen.
 *   - **No status line.** An addon chip carries no runtime state, and a
 *     trigger's heartbeat is not conversation data anyway — it lives on
 *     Admin → Triggers. It stays here only as the card's tooltip, which
 *     costs no space.
 *
 * Enable switch: invisible while ON (the resting case, so the chip
 * reads as just the trigger), fading in on hover. Always visible while
 * OFF — a trigger that isn't watching should say so at a glance.
 */

import { getTriggerType } from '../../triggers';
import type { AgentDoc, AgentTrigger } from '../../types';
import type { TriggerStatusRow } from '../../state/triggersApi';
import styles from './TriggersScreen.module.css';

interface Props {
  agent: AgentDoc;
  trigger: AgentTrigger;
  status: TriggerStatusRow | null;
  masterOn: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

function relative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** The card's tooltip — the heartbeat, without spending card space. */
function tooltip(trigger: AgentTrigger, status: TriggerStatusRow | null, masterOn: boolean): string {
  if (!trigger.enabled) return 'Off — not watching.';
  if (!masterOn) return 'Every trigger on this agent is switched off.';
  if (!status?.lastEvaluatedAt) return 'On — not checked yet.';
  if (status.lastResult === 'error') return `Last check failed: ${status.lastError || 'unknown error'}`;
  if (status.lastResult === 'matched') {
    return `Checked ${relative(status.lastEvaluatedAt)} · ${status.lastMatched} matched · last fired ${relative(status.lastFiredAt)}`;
  }
  const n = status.consecutiveEmpty;
  // Prefer the server's specific reason; the generic line is only a
  // fallback for rows written before it existed.
  const why = status.lastReason || 'nobody was quiet enough';
  return `Checked ${relative(status.lastEvaluatedAt)} · ${why}${n > 1 ? ` (${n} checks in a row)` : ''}`;
}

export function TriggerCard({ agent, trigger, status, masterOn, onEdit, onToggle }: Props) {
  const type = getTriggerType(trigger.typeId);
  const crew = agent.crews.find(c => c.id === trigger.run?.crewId);
  const summary = type?.summarize ? type.summarize(trigger.config as never) : trigger.typeId;
  const on = trigger.enabled;

  return (
    <div
      className={on ? styles.card : `${styles.card} ${styles.cardDisabled}`}
      style={{ ['--card-color' as string]: type?.color ?? '#6366f1' }}
      title={tooltip(trigger, status, masterOn)}
    >
      <button
        type="button"
        className={on ? styles.enableSwitchOn : styles.enableSwitchOff}
        onClick={e => { e.stopPropagation(); onToggle(); }}
        title={on ? 'Stop watching' : 'Start watching from now on'}
      >
        <span className={styles.enableSwitchThumb} />
        <span className={styles.enableSwitchLabel}>{on ? 'ON' : 'OFF'}</span>
      </button>

      <button type="button" className={styles.cardOpen} onClick={onEdit}>
        <span className={styles.cardIcon}>{type?.icon ?? '⏱'}</span>
        <span className={styles.cardName}>{trigger.name || type?.displayName || 'Trigger'}</span>
        <span className={styles.cardSub}>
          {summary}
          {crew
            ? <><span className={styles.cardDot}>·</span>{crew.name}</>
            : <span className={styles.cardWarn}> · no crew</span>}
        </span>
      </button>
    </div>
  );
}
