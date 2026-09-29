/**
 * Every change the Targeted KB page can make, in one place (task #830).
 *
 * Same behaviour as the old screen's handlers (DynamicContextScreen) —
 * including the rename cascades that rewrite `{{enum:…}}` /
 * `{{targetedkb:…}}` / `{{dc:…}}` tokens across every prompt — but keyed
 * by explicit ids instead of "whatever is active", so the tree, the value
 * row and the whole-KB document can all call them.
 *
 * Everything writes the agent's working copy; "Save all" persists it.
 */

import { useConfirm } from '../Confirm/Confirm';
import { useBuilder } from '../../state/BuilderContext';
import type { EnumTypeDef, EnumValueDef } from '../../types';
import {
  isReservedSectionName, newEnumId, newEnumValueId, sanitiseName, uniqueSectionName,
} from '../DynamicContextScreen/helpers';

export function useTkbActions() {
  const { doc, updateAgent, applyTokenRenameCascade, applyEnumSectionRenameCascade } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const enums: EnumTypeDef[] = agent?.enums ?? [];

  const write = (next: EnumTypeDef[]) => { if (agent) updateAgent(agent.id, { enums: next }); };
  const upsert = (e: EnumTypeDef) => write(enums.map(x => (x.id === e.id ? e : x)));
  const current = (e: EnumTypeDef) => enums.find(x => x.id === e.id) ?? e;
  const uniqueName = (base: string, taken: (n: string) => boolean) => {
    let name = base; let i = 2;
    while (taken(name)) { name = `${base}_${i}`; i += 1; }
    return name;
  };

  return {
    enums,

    /** New Targeted KB, optionally straight into a folder. Returns its name. */
    createKb(folder?: string): string {
      const name = uniqueName('new_kb', n => enums.some(e => e.name === n));
      write([...enums, { id: newEnumId(), name, sections: [], values: [], ...(folder ? { folder } : {}) }]);
      return name;
    },

    async deleteKb(e: EnumTypeDef): Promise<boolean> {
      const owned = !!e.ownedByFieldId;
      const ok = await confirm({
        title: owned ? `Delete the choice list "${e.name}"?` : `Delete Targeted KB "${e.name}"?`,
        message: owned
          ? 'This list belongs to a field — deleting it leaves that field without values. Usually you delete or change the field instead.'
          : 'Every value and section in it is removed. Any field bound to it is left unwired.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return false;
      write(enums.filter(x => x.id !== e.id));
      return true;
    },

    /** Returns the new name, or null when refused (empty / taken / owned). */
    renameKb(e: EnumTypeDef, raw: string): string | null {
      if (e.ownedByFieldId) return null;
      const next = sanitiseName(raw);
      if (!next || next === e.name || enums.some(x => x.name === next)) return null;
      if (agent) applyTokenRenameCascade(agent.id, 'enum', e.name, next);
      upsert({ ...current(e), name: next });
      return next;
    },

    setFolder(e: EnumTypeDef, raw: string) {
      const folder = raw.trim();
      const cur = current(e);
      if ((cur.folder ?? '') === folder) return;
      const { folder: _drop, ...rest } = cur;
      void _drop;
      upsert(folder ? { ...rest, folder } : rest);
    },

    /** Returns the new value's name. */
    addValue(e: EnumTypeDef): string {
      const cur = current(e);
      const value = uniqueName('new_value', n => cur.values.some(v => v.value === n));
      const fresh: EnumValueDef = { id: newEnumValueId(), value, sectionTexts: {} };
      upsert({ ...cur, values: [...cur.values, fresh] });
      return value;
    },

    renameValue(e: EnumTypeDef, v: EnumValueDef, raw: string): string | null {
      const cur = current(e);
      const next = sanitiseName(raw);
      if (!next || next === v.value || cur.values.some(x => x.value === next)) return null;
      upsert({ ...cur, values: cur.values.map(x => (x.id === v.id ? { ...x, value: next } : x)) });
      return next;
    },

    async deleteValue(e: EnumTypeDef, v: EnumValueDef): Promise<boolean> {
      const ok = await confirm({
        title: `Delete value "${v.value}"?`,
        message: e.ownedByFieldId
          ? 'It is removed from this choice list.'
          : 'Its umbrella text and every section text written under it are removed.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return false;
      const cur = current(e);
      upsert({ ...cur, values: cur.values.filter(x => x.id !== v.id) });
      return true;
    },

    /** Switched-off values stay in the KB but never reach a prompt. */
    toggleValue(e: EnumTypeDef, v: EnumValueDef) {
      const cur = current(e);
      upsert({ ...cur, values: cur.values.map(x => (x.id === v.id ? { ...x, enabled: v.enabled === false } : x)) });
    },

    setUmbrella(e: EnumTypeDef, valueId: string, text: string) {
      const cur = current(e);
      upsert({ ...cur, values: cur.values.map(x => (x.id === valueId ? { ...x, umbrellaText: text } : x)) });
    },

    setSectionText(e: EnumTypeDef, valueId: string, section: string, text: string) {
      const cur = current(e);
      upsert({
        ...cur,
        values: cur.values.map(x => (x.id === valueId
          ? { ...x, sectionTexts: { ...(x.sectionTexts ?? {}), [section]: text } }
          : x)),
      });
    },

    /** Returns the new section's name. */
    addSection(e: EnumTypeDef): string {
      const cur = current(e);
      const declared = cur.sections ?? [];
      const name = uniqueSectionName('new_section', declared);
      upsert({ ...cur, sections: [...declared, { name }] });
      return name;
    },

    renameSection(e: EnumTypeDef, oldName: string, raw: string): string | null {
      const cur = current(e);
      const next = sanitiseName(raw);
      const declared = cur.sections ?? [];
      if (!next || next === oldName || isReservedSectionName(next) || declared.some(s => s.name === next)) return null;
      const values = cur.values.map(v => {
        if (!v.sectionTexts || !(oldName in v.sectionTexts)) return v;
        const { [oldName]: body, ...rest } = v.sectionTexts;
        return { ...v, sectionTexts: { ...rest, [next]: body } };
      });
      if (agent) applyEnumSectionRenameCascade(agent.id, cur.id, cur.name, oldName, next);
      upsert({ ...cur, sections: declared.map(s => (s.name === oldName ? { name: next } : s)), values });
      return next;
    },

    async deleteSection(e: EnumTypeDef, name: string): Promise<boolean> {
      const ok = await confirm({
        title: `Delete section "${name}"?`,
        message: `Removed from every value of "${e.name}". Prompts using {{targetedkb:${e.name}:${name}}} or {{dc:<field>:${name}}} will resolve to empty.`,
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return false;
      const cur = current(e);
      upsert({
        ...cur,
        sections: (cur.sections ?? []).filter(s => s.name !== name),
        values: cur.values.map(v => {
          if (!v.sectionTexts || !(name in v.sectionTexts)) return v;
          const { [name]: _gone, ...rest } = v.sectionTexts;
          void _gone;
          return { ...v, sectionTexts: rest };
        }),
      });
      return true;
    },
  };
}
