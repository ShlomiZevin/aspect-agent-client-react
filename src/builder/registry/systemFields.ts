/**
 * System fields — client registry.
 *
 * MIRROR of the server registry at
 * `aspect-agent-server/builder/runtime/systemFields.js`. The list is
 * short and stable; duplication beats a build-time dependency between
 * client and server. Edit both files when adding a system field.
 *
 * A "system field" is a platform-defined memory field that:
 *   - Has a reserved name (users can't declare a custom field
 *     with the same name).
 *   - Is auto-extracted server-side from any addon's parsed output
 *     that includes its key — no `extractsFields` wiring needed.
 *   - Has a declared lifetime the runtime enforces (e.g., `moveOn`
 *     resets the moment a Transition Router fires).
 *   - Behaves like a normal field everywhere else: shows in
 *     autocomplete, condition pickers, `{{field:NAME}}` tokens.
 *
 * The WYSIWYG guarantee: the runtime never injects prompt text. The
 * user writes their own instruction telling the LLM to emit
 * `moveOn: true`. The runtime just harvests the key.
 */

import type { FieldType } from '../types';

export type SystemFieldLifetime =
  | 'crew-transition'   // cleared whenever a Transition Router fires
  | 'per-turn'          // cleared at the start of every turn
  | 'never';            // persisted for the conversation lifetime

export interface SystemFieldDef {
  /** Reserved field name — also the memory key. */
  name: string;
  /** Same `FieldType` union as user-declared fields. */
  type: FieldType;
  /** Runtime-controlled reset trigger. */
  lifetime: SystemFieldLifetime;
  /** Author-facing description shown in the Fields panel + tooltips. */
  description: string;
  /** Optional memory domain. Defaults to `_system` so all system
   *  fields group together visually. */
  domain?: string;
}

/**
 * The registry. Add an entry to surface a new system field
 * everywhere — Fields panel, autocomplete, condition pickers,
 * reserved-name validation. The server harvest pass picks it up
 * automatically once the server-side mirror gains the same entry.
 */
export const SYSTEM_FIELDS: SystemFieldDef[] = [
  {
    name:        'move_on',
    type:        'boolean',
    lifetime:    'crew-transition',
    description:
      'Set to true when the current crew has done its job and the user is ready to ' +
      'hand off. Reset automatically the moment a Transition Router fires, so the ' +
      'next crew starts with a clean slate.',
    domain:      '_system',
  },
];

const SYSTEM_FIELD_NAMES: Set<string> = new Set(SYSTEM_FIELDS.map(f => f.name));
const SYSTEM_FIELD_BY_NAME: Map<string, SystemFieldDef> =
  new Map(SYSTEM_FIELDS.map(f => [f.name, f]));

/** True when `name` is reserved by the system-fields registry. */
export function isSystemFieldName(name: string): boolean {
  return SYSTEM_FIELD_NAMES.has(name);
}

/** Returns the registry entry for `name`, or undefined. */
export function findSystemField(name: string): SystemFieldDef | undefined {
  return SYSTEM_FIELD_BY_NAME.get(name);
}
