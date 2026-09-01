/**
 * triggersApi — client calls for Builder V2 Triggers (proactive).
 *
 * See aspect-agent-server/docs/guides/BUILDER_V2_TRIGGERS.md.
 *
 * Every call that needs a trigger definition sends the WORKING COPY of
 * that trigger, not just its id. That is deliberate: an author tuning
 * "nudge after 30 minutes" is by definition looking at a number they
 * haven't saved. Making them save first to find out whether it would
 * fire would turn every experiment into a version.
 */

import type { AgentTrigger } from '../types';

const BASE_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
  'https://aspect-agent-server-1018338671074.europe-west1.run.app';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch { /* keep raw */ }
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types mirroring the server responses ─────────────────────────

/** A trigger type's shared descriptor — what the Add Trigger picker shows. */
export interface TriggerTypeDescriptor {
  typeId: string;
  displayName: string;
  description: string;
  purpose: string;
  icon: string;
  color: string;
  defaultConfig: Record<string, unknown>;
  units?: string[];
  limits?: { minAfterMinutes?: number; maxAttempts?: number };
}

/** One clause's verdict, with the actual numbers in `why`. */
export interface ClauseResult { name: string; ok: boolean; why: string }

export interface TriggerStatusRow {
  triggerId: string;
  agentId: string;
  lastEvaluatedAt: string | null;
  lastResult: 'matched' | 'nothing' | 'error' | null;
  lastMatched: number;
  consecutiveEmpty: number;
  lastFiredAt: string | null;
  lastError: string | null;
  /** Why the last sweep matched nobody, in the author's language — so a
   *  zero distinguishes "nobody is quiet" from "quiet, but at the nudge
   *  limit", which need opposite responses. */
  lastReason: string | null;
}

export type TriggerOutcome = 'filtered' | 'quiet_hours' | 'spoke' | 'silent' | 'error';

export interface TriggerEventRow {
  id: string;
  agentId: string;
  triggerId: string;
  triggerType: string;
  conversationId: number;
  matchedAt: string;
  status: 'running' | 'done';
  outcome: TriggerOutcome | null;
  matchReason: string | null;
  filterResult: ClauseResult[] | null;
  briefUsed: string | null;
  launchedCrewId: string | null;
  messageId: number | null;
  error: string | null;
  durationMs: number | null;
}

export interface ClockHealth {
  enabled: boolean;
  /** Which clock this is. Local and cloud have SEPARATE switches,
   *  cadences and modes — flipping one never touches the other. */
  environment: 'local' | 'cloud';
  /** Seconds. Local development wants 10s; Cloud Scheduler can't go under 60. */
  intervalSeconds: number;
  intervalChoices: number[];
  /** Which agent version the clock reads triggers from. */
  mode: 'published' | 'active';
  precisionNote: string;
  ticking: boolean;
  lastClaimedAt: string | null;
  agentsWithTriggers: string[];
  /** Set when this mode sees no agents but the other one would — the
   *  explanation for an otherwise baffling "watching 0 agents". */
  modeHint: string | null;
}

export interface CheckResult {
  source: 'saved' | 'working-copy';
  at: string;
  wouldFire: boolean;
  reason: string;
  clauses: ClauseResult[];
  quietHours: { suppressed: boolean; why: string };
  note: string;
}

export interface ExplainResult {
  source: 'saved' | 'working-copy';
  at: string;
  wouldHaveFired: boolean;
  reason: string;
  clauses: ClauseResult[];
  configCaveat: string;
}

export interface SweepResult {
  triggerId: string;
  /** How many conversations the clauses matched, before any scoping. */
  matched: number;
  inScope?: number;
  dryRun?: boolean;
  wouldFire?: { conversationId: number; reason: string; clauses: ClauseResult[] }[];
  fired?: { conversationId: number; outcome: TriggerOutcome; why?: string; messageId?: number }[];
  cappedAt?: number | null;
  error?: string;
}

// ─── Calls ────────────────────────────────────────────────────────

export function fetchTriggerTypes(agentSlug: string) {
  return http<{ types: TriggerTypeDescriptor[] }>(`/api/agents/${agentSlug}/triggers/types`);
}

export function fetchTriggerStatus(agentSlug: string) {
  return http<{ agentId: string; status: Record<string, TriggerStatusRow> }>(
    `/api/agents/${agentSlug}/triggers/status`);
}

/**
 * Every trigger every event for this agent, newest first — the admin
 * feed. The per-trigger feed answers "what did THIS rule do"; this one
 * answers "what has this agent been saying to people on its own", which
 * is the only view where one rule firing far more than expected stands
 * out.
 */
export function fetchAgentTriggerEvents(agentSlug: string, limit = 100) {
  return http<{ agentId: string; events: TriggerEventRow[] }>(
    `/api/agents/${agentSlug}/triggers/events?limit=${limit}`);
}

export function fetchTriggerEvents(agentSlug: string, triggerId: string, limit = 50) {
  return http<{ events: TriggerEventRow[] }>(
    `/api/agents/${agentSlug}/triggers/${triggerId}/events?limit=${limit}`);
}

/** Every trigger event on one conversation — feeds the slim cards in the chat. */
export function fetchConversationTriggerEvents(agentSlug: string, conversationId: number) {
  return http<{ events: TriggerEventRow[] }>(
    `/api/agents/${agentSlug}/conversations/${conversationId}/trigger-events`);
}

/** "Would this fire on this conversation right now, and if not, why not?" */
export function checkTrigger(args: {
  agentSlug: string; trigger: AgentTrigger; conversationId: number;
}) {
  return http<CheckResult>(`/api/agents/${args.agentSlug}/triggers/${args.trigger.id}/check`, {
    method: 'POST',
    body: JSON.stringify({ conversationId: args.conversationId, trigger: args.trigger }),
  });
}

/** "Why did this conversation get nothing at <moment>?" */
export function explainTrigger(args: {
  agentSlug: string; trigger: AgentTrigger; conversationId: number; at: string;
}) {
  return http<ExplainResult>(`/api/agents/${args.agentSlug}/triggers/${args.trigger.id}/explain`, {
    method: 'POST',
    body: JSON.stringify({ conversationId: args.conversationId, at: args.at, trigger: args.trigger }),
  });
}

/**
 * Run one trigger's sweep on demand.
 *
 * `dryRun` reports who WOULD be nudged and launches nothing — the safe
 * way to point a new trigger at a live agent and see the blast radius
 * before arming it. Always offer the dry run first.
 */
export function sweepTrigger(args: {
  agentSlug: string; trigger: AgentTrigger; dryRun?: boolean; mode?: 'viewing' | 'published';
}) {
  return http<SweepResult>(`/api/agents/${args.agentSlug}/triggers/${args.trigger.id}/sweep`, {
    method: 'POST',
    body: JSON.stringify({ dryRun: !!args.dryRun, mode: args.mode || 'viewing', trigger: args.trigger }),
  });
}

// ─── The clock (system level — the slug in the path is ignored) ────

export function fetchClockHealth(agentSlug: string) {
  return http<ClockHealth>(`/api/agents/${agentSlug}/triggers/clock`);
}

export function setClockEnabled(agentSlug: string, enabled: boolean) {
  return http<ClockHealth>(`/api/agents/${agentSlug}/triggers/clock`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

/** Change the cadence, and/or which agent version the clock reads. */
export function updateClockSettings(
  agentSlug: string,
  patch: { intervalSeconds?: number; mode?: 'published' | 'active' },
) {
  return http<ClockHealth>(`/api/agents/${agentSlug}/triggers/clock`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Run one tick by hand, even while the clock is paused. */
export function stepClock(agentSlug: string, dryRun = false) {
  return http<{ agents: number; fired: number; errors: number; durationMs: number; skipped?: string }>(
    `/api/agents/${agentSlug}/triggers/clock/step`, {
      method: 'POST',
      body: JSON.stringify({ dryRun, mode: 'viewing' }),
    });
}

// ─── Test fire (the proactive turn, on your unsaved working copy) ──

/**
 * Run a crew's chain on one conversation right now, with no user
 * message and ignoring the trigger's schedule entirely.
 *
 * This is what makes a rule like "nudge after 3 days" authorable without
 * waiting three days. It streams SSE; `onEvent` receives each event.
 */
export async function testFire(args: {
  agentSlug: string;
  conversationId: number;
  ownerUserId: string;
  crewId: string;
  brief?: string;
  reason?: string;
  overrideAgentBody?: unknown;
  overrideCrewBody?: unknown;
  onEvent: (ev: { type: string; [k: string]: unknown }) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/api/agents/${args.agentSlug}/conversations/${args.conversationId}/proactive`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: args.signal,
      body: JSON.stringify({
        ownerUserId: args.ownerUserId,
        crewId: args.crewId,
        brief: args.brief || '',
        reason: args.reason || 'Test fire',
        version: 'viewing',
        overrideAgentBody: args.overrideAgentBody ?? null,
        overrideCrewBody: args.overrideCrewBody ?? null,
      }),
    });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.split('\n').find(l => l.startsWith('data: '));
      if (!line) continue;
      try { args.onEvent(JSON.parse(line.slice(6))); } catch { /* skip malformed frame */ }
    }
  }
}

/** What one manual run reports back. */
export interface FireResult {
  outcome: 'spoke' | 'silent' | 'filtered' | 'quiet_hours' | 'error';
  why?: string;
  eventId?: number | null;
  messageId?: number | null;
  conversationId: number;
  /** Would the clock have picked this conversation on its own? */
  wouldFire: boolean | null;
  clauses?: { name: string; ok: boolean; why: string }[];
}

/**
 * Run one trigger against ONE conversation, now.
 *
 * The same `fireOne` the clock's sweep calls per matched conversation —
 * same gates, same proactive turn, same event row — so what you see here
 * is what the clock will do. The timing clauses are the only thing not
 * required to pass; pressing the button means "pretend this one is due".
 */
export function fireTrigger(args: {
  agentSlug: string;
  trigger: AgentTrigger;
  conversationId: number;
  /** Working copies — the same ones the builder chat sends on a user
   *  turn, so both paths run identical bodies. */
  overrideAgentBody?: unknown;
  overrideCrewBody?: unknown;
}) {
  return http<FireResult>(`/api/agents/${args.agentSlug}/triggers/${args.trigger.id}/fire`, {
    method: 'POST',
    body: JSON.stringify({
      conversationId: args.conversationId,
      trigger: args.trigger,
      overrideAgentBody: args.overrideAgentBody ?? null,
      overrideCrewBody: args.overrideCrewBody ?? null,
    }),
  });
}

/** One trigger's slot in a one-conversation round. */
export interface RoundEntry {
  triggerId: string;
  name?: string;
  /**
   * `would_run` / `not_due` come back from a simulation; the rest are
   * real outcomes. `silent` means the chain RAN and produced no
   * message — a normal result, not a failure.
   */
  outcome: 'spoke' | 'silent' | 'filtered' | 'quiet_hours' | 'error' | 'not_due' | 'would_run' | 'skipped';
  why?: string;
  messageId?: number | null;
  /** Force mode only: would the clock have chosen this on its own? */
  wouldRun?: boolean;
  notDueWhy?: string | null;
  clauses?: { name: string; ok: boolean; why: string }[];
}

export interface RoundResult {
  conversationId: number;
  mode: 'simulate' | 'force';
  /** The agent's master switch is off — reported, not enforced. */
  masterOff: boolean;
  considered: number;
  skipped: number;
  /** Chains that produced a message. */
  fired: number;
  /** Chains that ran at all, message or not. */
  ran: number;
  results: RoundEntry[];
}

/**
 * Every trigger on this agent, against ONE conversation.
 *
 * `simulate` asks each trigger the question the clock asks and runs
 * nothing — the tick simulation. `force` runs them all whether or not
 * they are due. Neither is ever agent-wide or system-wide: the
 * conversation is always named.
 */
export function fireRound(args: {
  agentSlug: string;
  conversationId: number;
  mode: 'simulate' | 'force';
  triggers?: AgentTrigger[];
  overrideAgentBody?: unknown;
  overrideCrewBodies?: Record<string, unknown>;
}) {
  return http<RoundResult>(`/api/agents/${args.agentSlug}/triggers/round`, {
    method: 'POST',
    body: JSON.stringify({
      conversationId: args.conversationId,
      mode: args.mode,
      triggers: args.triggers,
      overrideAgentBody: args.overrideAgentBody ?? null,
      overrideCrewBodies: args.overrideCrewBodies ?? null,
    }),
  });
}
