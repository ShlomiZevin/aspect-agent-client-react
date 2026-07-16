/**
 * choiceList — helpers for the "Choice" field type.
 *
 * A Choice field is a quick one-field value list: the user types the
 * allowed values inline on the field instead of authoring an enum on
 * the Targeted KB page. Behind the scenes it IS a real enum on
 * `agent.enums`, auto-named after the field and marked with
 * `ownedByFieldId` — so every downstream capability works unchanged:
 * `{{enum:NAME}}` in prompts, `{{enum_values}}` in bound extractors,
 * runtime schema injection, and a later upgrade to sections/`{{dc:}}`
 * straight from the Targeted KB page.
 *
 * Lifecycle rules (locked with Shlomi):
 *  - The enum is NOT renamed when the field renames — rename it on the
 *    Targeted KB page anytime (tokens cascade there).
 *  - Deleting the field deletes its owned enum unless another field
 *    has since bound to it.
 *  - Switching the field's type away from Choice deletes the owned
 *    enum under the same sharing rule.
 */

import { newEnumId, newEnumValueId, sanitiseName } from '../components/DynamicContextScreen/helpers';
import type { AgentDoc, EnumTypeDef, EnumValueDef, FieldDef, ID } from '../types';

/** The enum this field owns (bound via enumType + ownedByFieldId), if any. */
export function ownedChoiceEnum(agent: AgentDoc | undefined, field: Pick<FieldDef, 'id' | 'enumType'>): EnumTypeDef | null {
  if (!agent || !field.enumType) return null;
  const en = (agent.enums ?? []).find(e => e.id === field.enumType);
  return en && en.ownedByFieldId === field.id ? en : null;
}

/** Auto-name for a field's owned list: `<field>_choices` (clear to
 *  everyone that it's a value list, not a knowledge base), suffixed
 *  `2`, `3`, … on collision. `excludeEnumId` skips the owned enum
 *  itself so re-deriving the name during a field rename doesn't
 *  collide with the enum's current name. */
export function autoChoiceName(agent: AgentDoc | undefined, fieldName: string, excludeEnumId?: ID): string {
  const base = `${sanitiseName(fieldName) || 'field'}_choices`;
  const taken = new Set(
    (agent?.enums ?? []).filter(e => e.id !== excludeEnumId).map(e => e.name),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    if (!taken.has(`${base}${i}`)) return `${base}${i}`;
  }
}

export function toEnumValues(values: string[]): EnumValueDef[] {
  return values.map(v => ({ id: newEnumValueId(), value: v }));
}

export function buildChoiceEnum(name: string, ownedByFieldId: ID, values: string[]): EnumTypeDef {
  return { id: newEnumId(), name, ownedByFieldId, sections: [], values: toEnumValues(values) };
}

export function choiceValuesOf(en: EnumTypeDef): string[] {
  return en.values.map(v => v.value);
}

/** Replace an owned enum's values, preserving existing value ids (and
 *  any umbrella/section texts authored on the KB page) for values that
 *  survive by string equality. */
export function withChoiceValues(en: EnumTypeDef, values: string[]): EnumTypeDef {
  const prevByValue = new Map(en.values.map(v => [v.value, v]));
  return {
    ...en,
    values: values.map(v => prevByValue.get(v) ?? { id: newEnumValueId(), value: v }),
  };
}

/** True when another field (anywhere on the agent) also binds this enum. */
export function isEnumSharedBeyond(agent: AgentDoc | undefined, enumId: ID, exceptFieldId: ID): boolean {
  if (!agent) return false;
  const boundElsewhere = (fields: FieldDef[] | undefined) =>
    (fields ?? []).some(f => f.id !== exceptFieldId && f.enumType === enumId);
  if (boundElsewhere(agent.fields)) return true;
  return agent.crews.some(c => boundElsewhere(c.fields));
}

/** Normalize a raw typed value into a canonical list entry. */
export function normalizeChoiceValue(raw: string): string {
  return raw.trim();
}
