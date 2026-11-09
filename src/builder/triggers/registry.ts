/**
 * Client trigger-type registry.
 *
 * Mirrors `registry/plugins.ts` in shape so adding a trigger type feels
 * like adding an addon — but a trigger is NOT an addon (see
 * aspect-agent-server/docs/guides/BUILDER_V2_TRIGGERS.md), so it gets
 * its own registry rather than muddying that one.
 *
 * A type contributes exactly two things to the client: the shared
 * descriptor JSON (name, icon, colour, defaults — the same file the
 * server reads, so the two can't disagree) and a React component for its
 * own "when" settings. Everything else on the card — the crew picker,
 * the brief, quiet hours, the filter, the event feed — is shared, so a
 * new type only ever writes the part that is genuinely its own.
 */

import type { ComponentType } from 'react';
import type { QuietHours } from '../types';

/**
 * When a calendar-driven trigger (Schedule) will next act, as computed by
 * the SERVER (`POST /triggers/next-fires`) — the same slot code the clock
 * runs, so the card can never promise a time the clock would not use.
 * `at: null` = nothing left on the schedule.
 */
export interface NextFire {
  at: string | null;
  /** Times stepped over because they fall inside quiet hours. */
  skippedForQuietHours: number;
}

/**
 * Read-only facts a type's form may want from outside its own config:
 * the envelope's quiet hours (Schedule marks a time that falls inside
 * them) and the server's next fire. Optional — Silence uses neither.
 */
export interface TriggerConfigContext {
  quietHours?: QuietHours;
  /** undefined = not loaded yet; null = the server has no answer. */
  nextFire?: NextFire | null;
}

export interface TriggerTypeConfigProps<TConfig = Record<string, unknown>> {
  config: TConfig;
  onChange: (next: TConfig) => void;
  context?: TriggerConfigContext;
}

/**
 * A type's own section in the Triggers guide, in plain language for a
 * non-technical author.
 *
 * It lives on the descriptor rather than in the guide's content file so
 * that adding a trigger type means writing its explanation beside its
 * defaults — the guide can then never be missing a type, or still be
 * describing one that was removed.
 */
export interface TriggerTypeGuide {
  /** One sentence: the situation this type is for. */
  inOneLine: string;
  goodFor: string[];
  notFor: string[];
  /** One per authored setting, named as the form labels it. */
  settings: { label: string; what: string; tip?: string }[];
  /** Behaviour the author never configures but should still know about. */
  alsoDoes?: string[];
  /** A worked example with real numbers. */
  example?: string;
}

export interface TriggerTypeDescriptor<TConfig = Record<string, unknown>> {
  typeId: string;
  displayName: string;
  description: string;
  purpose: string;
  icon: string;
  color: string;
  defaultConfig: TConfig;
  /** Renders the type's own "when" settings. */
  ConfigComponent: ComponentType<TriggerTypeConfigProps<TConfig>>;
  /**
   * One line summarising the current config for the collapsed card —
   * e.g. "after 30 minutes of quiet · up to 3 times". Written by the
   * type because only it knows what its numbers mean.
   */
  summarize: (config: TConfig) => string;
  /** Plain-language explanation for the Triggers guide. */
  guide?: TriggerTypeGuide;
  /**
   * Fires on the calendar, so it has ONE next fire for the whole agent
   * (Schedule). The card then always draws a "next:" line — reserved
   * even while loading, so the chip never grows when the answer lands.
   */
  calendar?: boolean;
  /** The card's "next:" line, from the server's answer. */
  formatNext?: (next: NextFire | null | undefined, config: TConfig) => string;
  /** The "?" text on the editor's "When it fires" header. Absent → Silence's. */
  timingHelp?: string;
  /** Placeholder for the Brief box — what a brief for THIS type looks like. */
  briefPlaceholder?: string;
}

const registry = new Map<string, TriggerTypeDescriptor<never>>();

export function registerTriggerType<TConfig>(type: TriggerTypeDescriptor<TConfig>): void {
  registry.set(type.typeId, type as unknown as TriggerTypeDescriptor<never>);
}

export function getTriggerType(typeId: string): TriggerTypeDescriptor<never> | undefined {
  return registry.get(typeId);
}

export function listTriggerTypes(): TriggerTypeDescriptor<never>[] {
  return Array.from(registry.values());
}
