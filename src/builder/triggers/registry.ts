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

export interface TriggerTypeConfigProps<TConfig = Record<string, unknown>> {
  config: TConfig;
  onChange: (next: TConfig) => void;
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
