/**
 * EnumBibleScreen — agent-level enum type editor (the "bible").
 *
 * Replaces the old DynamicContextScreen. The DC concept (per-field
 * `dynamicContexts[]`) was retired in favour of agent-level
 * `enums[]`: every value vocabulary is declared ONCE, multiple fields
 * can share an enum (`primary_motive: motive`, `secondary_motive: motive`),
 * and per-value knowledge (umbrella + sections) lives on the enum so it
 * isn't duplicated per field.
 *
 *   URL routing
 *     /<agent>/builder/enums
 *     /<agent>/builder/enums/<enumName>
 *     /<agent>/builder/enums/<enumName>/<value>
 *     /<agent>/builder/enums/<enumName>/<value>/<section>
 *     /<agent>/builder/enums/<enumName>/-/<section>     ← section without value
 *
 *   `-` in the value slot means "no value picked, but a section is".
 *   Lets the author author the section schema (name + delete) and hop
 *   between values while staying on the same section — comparing
 *   `how_to_identify` across every value with one click each.
 *
 *   Tokens consumed by other prompts
 *     {{enum:NAME}}                       — aggregate, every value's umbrella
 *     {{enum:NAME:SECTION}}               — aggregate, every value's section body
 *     {{dc:FIELD}}                        — live value's umbrella (FIELD is enum-typed)
 *     {{dc:FIELD:SECTION}}                — live value's section body
 *     {{dc:FIELD:*}}                      — every section under the live value
 *
 * Layout: three columns. Left = enums list; middle = active enum's
 * values + declared sections; right = editor for whatever's active.
 * Edits write straight through to BuilderContext via `updateAgent`;
 * AutoSave persists the result. No local draft buffer.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import {
  sanitiseName,
  newEnumId,
  newEnumValueId,
  uniqueSectionName,
  isReservedSectionName,
} from './helpers';
import type {
  EnumSectionDecl,
  EnumTypeDef,
  EnumValueDef,
} from '../../types';
import styles from './DynamicContextScreen.module.css';

/** Sentinel for "no value picked, but a section is" inside URLs. */
const NO_VALUE = '-';

export function DynamicContextScreen() {
  const navigate = useNavigate();
  const {
    doc,
    updateAgent,
    applyTokenRenameCascade,
    applyEnumSectionRenameCascade,
  } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const agentSlug = agent?.slug ?? '';
  const mentionOptions = useMentionOptions(agent?.id ?? '');

  const {
    enumName: paramEnum,
    value:    paramValueRaw,
    section:  paramSection,
  } = useParams<{ enumName?: string; value?: string; section?: string }>();
  const paramValue = paramValueRaw === NO_VALUE ? undefined : paramValueRaw;

  const enums = useMemo(() => agent?.enums ?? [], [agent?.enums]);

  const activeEnum = useMemo<EnumTypeDef | null>(() => {
    if (!paramEnum) return null;
    return enums.find(e => e.name === paramEnum) ?? null;
  }, [enums, paramEnum]);

  const activeValue = useMemo<EnumValueDef | null>(() => {
    if (!activeEnum || !paramValue) return null;
    return activeEnum.values.find(v => v.value === paramValue) ?? null;
  }, [activeEnum, paramValue]);

  const activeSection = useMemo<EnumSectionDecl | null>(() => {
    if (!activeEnum || !paramSection) return null;
    return (activeEnum.sections ?? []).find(s => s.name === paramSection) ?? null;
  }, [activeEnum, paramSection]);

  // ── Persistence helpers ──────────────────────────────────────────
  const writeEnums = useCallback((nextEnums: EnumTypeDef[]) => {
    if (!agent) return;
    updateAgent(agent.id, { enums: nextEnums });
  }, [agent, updateAgent]);

  const upsertEnum = useCallback((next: EnumTypeDef) => {
    if (!agent) return;
    const current = agent.enums ?? [];
    const i = current.findIndex(e => e.id === next.id);
    writeEnums(i === -1 ? [...current, next] : current.map(e => (e.id === next.id ? next : e)));
  }, [agent, writeEnums]);

  // ── URL builders ─────────────────────────────────────────────────
  /** Always preserves the section if one is active so switching value
   *  while comparing sections is one click away. */
  const urlEnum = (enumName: string) =>
    `/${agentSlug}/builder/enums/${encodeURIComponent(enumName)}`;
  const urlValue = (enumName: string, value: string, section?: string) =>
    `${urlEnum(enumName)}/${encodeURIComponent(value)}` +
    (section ? `/${encodeURIComponent(section)}` : '');
  const urlSection = (enumName: string, value: string | null, section: string) =>
    `${urlEnum(enumName)}/${encodeURIComponent(value ?? NO_VALUE)}/${encodeURIComponent(section)}`;

  // ── Create / delete enums ────────────────────────────────────────
  const handleCreateEnum = useCallback(() => {
    if (!agent) return;
    const base = 'new_enum';
    let name = base;
    let i = 2;
    while ((agent.enums ?? []).some(e => e.name === name)) {
      name = `${base}_${i}`;
      i += 1;
    }
    const fresh: EnumTypeDef = { id: newEnumId(), name, sections: [], values: [] };
    writeEnums([...(agent.enums ?? []), fresh]);
    navigate(urlEnum(name));
  }, [agent, agentSlug, navigate, writeEnums]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteEnum = useCallback(async (e: EnumTypeDef) => {
    const ok = await confirm({
      title:        `Delete enum "${e.name}"?`,
      message:      `Every value and section authored under this enum is removed. Any field with enumType pointing at this enum will be left unwired.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    writeEnums((agent?.enums ?? []).filter(x => x.id !== e.id));
    navigate(`/${agentSlug}/builder/enums`);
  }, [agent, agentSlug, confirm, navigate, writeEnums]);

  const handleRenameEnum = useCallback((e: EnumTypeDef, rawNext: string): boolean => {
    const next = sanitiseName(rawNext);
    if (!next || next === e.name) return false;
    if ((agent?.enums ?? []).some(x => x.name === next)) return false;
    // Rewrite {{enum:OLD}}, {{enum:OLD:SEC}}, {{enum:OLD:values}}
    // tokens across every prompt-text surface BEFORE swapping the
    // enum's own name so the cascade sees the doc with the old name
    // still in place.
    if (agent) applyTokenRenameCascade(agent.id, 'enum', e.name, next);
    upsertEnum({ ...e, name: next });
    navigate(urlEnum(next));
    return true;
  }, [agent, agentSlug, navigate, upsertEnum, applyTokenRenameCascade]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Values within active enum ────────────────────────────────────
  const handleAddValue = useCallback(() => {
    if (!activeEnum) return;
    const base = 'new_value';
    let value = base;
    let i = 2;
    while (activeEnum.values.some(v => v.value === value)) {
      value = `${base}_${i}`;
      i += 1;
    }
    const fresh: EnumValueDef = { id: newEnumValueId(), value, sectionTexts: {} };
    upsertEnum({ ...activeEnum, values: [...activeEnum.values, fresh] });
    navigate(urlValue(activeEnum.name, value, paramSection));
  }, [activeEnum, agentSlug, navigate, paramSection, upsertEnum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRenameValue = useCallback((v: EnumValueDef, rawNext: string): boolean => {
    if (!activeEnum) return false;
    const next = sanitiseName(rawNext);
    if (!next || next === v.value) return false;
    if (activeEnum.values.some(x => x.value === next)) return false;
    upsertEnum({
      ...activeEnum,
      values: activeEnum.values.map(x => (x.id === v.id ? { ...x, value: next } : x)),
    });
    navigate(urlValue(activeEnum.name, next, paramSection));
    return true;
  }, [activeEnum, agentSlug, navigate, paramSection, upsertEnum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteValue = useCallback(async (v: EnumValueDef) => {
    if (!activeEnum) return;
    const ok = await confirm({
      title:        `Delete value "${v.value}"?`,
      message:      `The umbrella prompt and every section body authored under this value are removed.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    upsertEnum({ ...activeEnum, values: activeEnum.values.filter(x => x.id !== v.id) });
    // If a section is active, stay on it in no-value mode so the
    // author can pivot to another value with the same section showing.
    if (paramSection) {
      navigate(urlSection(activeEnum.name, null, paramSection));
    } else {
      navigate(urlEnum(activeEnum.name));
    }
  }, [activeEnum, agentSlug, confirm, navigate, paramSection, upsertEnum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleValueUmbrellaChange = useCallback((text: string) => {
    if (!activeEnum || !activeValue) return;
    upsertEnum({
      ...activeEnum,
      values: activeEnum.values.map(x =>
        x.id === activeValue.id ? { ...x, umbrellaText: text } : x,
      ),
    });
  }, [activeEnum, activeValue, upsertEnum]);

  // ── Sections (declared on the enum, body per value) ──────────────
  const handleAddSection = useCallback(() => {
    if (!activeEnum) return;
    const declared = activeEnum.sections ?? [];
    const name = uniqueSectionName('new_section', declared);
    upsertEnum({ ...activeEnum, sections: [...declared, { name }] });
    // Land on the new section with NO value picked so the author can
    // immediately rename it via the inline rename in the editor pane.
    navigate(urlSection(activeEnum.name, null, name));
  }, [activeEnum, agentSlug, navigate, upsertEnum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRenameSection = useCallback((oldName: string, rawNext: string): boolean => {
    if (!activeEnum) return false;
    const next = sanitiseName(rawNext);
    if (!next || next === oldName) return false;
    // `values` would collide with the {{enum:NAME:values}} token —
    // forbid it so authors don't accidentally shadow it.
    if (isReservedSectionName(next)) return false;
    const declared = activeEnum.sections ?? [];
    if (declared.some(s => s.name === next)) return false;
    // Cascade body rename through every value's sectionTexts so authored
    // bodies follow their section name.
    const renamedValues = activeEnum.values.map(v => {
      if (!v.sectionTexts) return v;
      if (!(oldName in v.sectionTexts)) return v;
      const { [oldName]: body, ...rest } = v.sectionTexts;
      return { ...v, sectionTexts: { ...rest, [next]: body } };
    });
    // Rewrite {{enum:EnumName:OLDSEC}} and {{dc:F:OLDSEC}} tokens
    // BEFORE we mutate the enum so the cascade still sees the old
    // section name as the authoritative literal. Scoped to this enum
    // via id (for DC tokens) + name (for enum tokens).
    if (agent) {
      applyEnumSectionRenameCascade(agent.id, activeEnum.id, activeEnum.name, oldName, next);
    }
    upsertEnum({
      ...activeEnum,
      sections: declared.map(s => (s.name === oldName ? { name: next } : s)),
      values:   renamedValues,
    });
    if (paramSection === oldName) {
      navigate(urlSection(activeEnum.name, paramValue ?? null, next));
    }
    return true;
  }, [activeEnum, agent, agentSlug, navigate, paramSection, paramValue, upsertEnum, applyEnumSectionRenameCascade]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteSection = useCallback(async (name: string) => {
    if (!activeEnum) return;
    const ok = await confirm({
      title:        `Delete section "${name}"?`,
      message:      `Removed from every value of "${activeEnum.name}". Any prompts referencing {{enum:${activeEnum.name}:${name}}} or {{dc:<field>:${name}}} will resolve to empty.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    const declared = (activeEnum.sections ?? []).filter(s => s.name !== name);
    const strippedValues = activeEnum.values.map(v => {
      if (!v.sectionTexts || !(name in v.sectionTexts)) return v;
      const { [name]: _, ...rest } = v.sectionTexts;
      return { ...v, sectionTexts: rest };
    });
    upsertEnum({ ...activeEnum, sections: declared, values: strippedValues });
    if (paramSection === name) {
      // Drop the section from the URL but keep the value if one was
      // picked — falls back to enum view otherwise.
      if (paramValue) navigate(urlValue(activeEnum.name, paramValue));
      else            navigate(urlEnum(activeEnum.name));
    }
  }, [activeEnum, agentSlug, confirm, navigate, paramSection, paramValue, upsertEnum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSectionBodyChange = useCallback((text: string) => {
    if (!activeEnum || !activeValue || !activeSection) return;
    upsertEnum({
      ...activeEnum,
      values: activeEnum.values.map(x => {
        if (x.id !== activeValue.id) return x;
        const next = { ...(x.sectionTexts ?? {}), [activeSection.name]: text };
        return { ...x, sectionTexts: next };
      }),
    });
  }, [activeEnum, activeValue, activeSection, upsertEnum]);

  // ── Navigation handlers for the list rows ────────────────────────
  const pickValue = (v: EnumValueDef) => {
    if (!activeEnum) return;
    // Toggle off when clicking the already-active value — same affordance
    // as the section list. If a section is active, stay on it (no-value
    // mode) so the author can pick another value with the same section
    // showing.
    if (activeValue?.id === v.id) {
      if (activeSection) navigate(urlSection(activeEnum.name, null, activeSection.name));
      else               navigate(urlEnum(activeEnum.name));
      return;
    }
    navigate(urlValue(activeEnum.name, v.value, paramSection));
  };
  const pickSection = (s: EnumSectionDecl) => {
    if (!activeEnum) return;
    // Toggle off when clicking the already-active section.
    if (activeSection?.name === s.name) {
      if (activeValue) navigate(urlValue(activeEnum.name, activeValue.value));
      else             navigate(urlEnum(activeEnum.name));
      return;
    }
    navigate(urlSection(activeEnum.name, activeValue?.value ?? null, s.name));
  };

  if (!agent) return null;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.breadcrumb}>
          <button
            type="button"
            className={`${styles.crumb} ${!paramEnum ? styles.crumbCurrent : ''}`}
            onClick={() => navigate(`/${agentSlug}/builder/enums`)}
          >
            Enums
          </button>
          {activeEnum && (
            <>
              <span> / </span>
              <button
                type="button"
                className={`${styles.crumb} ${!paramValue && !paramSection ? styles.crumbCurrent : ''}`}
                onClick={() => navigate(urlEnum(activeEnum.name))}
              >
                {activeEnum.name}
              </button>
            </>
          )}
          {activeEnum && activeValue && (
            <>
              <span> / </span>
              <button
                type="button"
                className={`${styles.crumb} ${!paramSection ? styles.crumbCurrent : ''}`}
                onClick={() => navigate(urlValue(activeEnum.name, activeValue.value))}
              >
                {activeValue.value}
              </button>
            </>
          )}
          {activeSection && (
            <>
              <span> / </span>
              <span className={`${styles.crumb} ${styles.crumbCurrent}`}>{activeSection.name}</span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 240px 1fr', gap: 16, alignItems: 'start' }}>
        {/* ── Column 1: enums list ──────────────────────────────── */}
        <Column title="Enums" onAdd={handleCreateEnum} addLabel="+ Add enum">
          {enums.length === 0 ? (
            <Empty>Declare an enum to start the bible.</Empty>
          ) : (
            <List
              items={enums.map(e => ({
                key:      e.id,
                label:    e.name,
                active:   e.id === activeEnum?.id,
                onDelete: () => handleDeleteEnum(e),
              }))}
              onPick={({ key }) => {
                const e = enums.find(x => x.id === key)!;
                navigate(urlEnum(e.name));
              }}
            />
          )}
        </Column>

        {/* ── Column 2: values + section schema ─────────────────── */}
        <Column
          title={activeEnum ? `${activeEnum.name} · values` : 'Values'}
          onAdd={activeEnum ? handleAddValue : undefined}
          addLabel="+ Add value"
        >
          {!activeEnum ? (
            <Empty>Pick an enum on the left.</Empty>
          ) : (
            <>
              {activeEnum.values.length === 0 ? (
                <Empty>No values yet. Add one to start authoring.</Empty>
              ) : (
                <List
                  items={activeEnum.values.map(v => ({
                    key:      v.id,
                    label:    v.value,
                    active:   v.id === activeValue?.id,
                    onDelete: () => handleDeleteValue(v),
                  }))}
                  onPick={({ key }) => {
                    const v = activeEnum.values.find(x => x.id === key);
                    if (v) pickValue(v);
                  }}
                />
              )}

              {/* Sections schema — declared on the enum, shared across values.
                  Sections are clickable regardless of whether a value is
                  selected: comparing the same section across values is one
                  click each. */}
              <div style={{ marginTop: 16 }}>
                <ColumnSubtitle title="Sections" onAdd={handleAddSection} addLabel="+ Add section" />
                {(activeEnum.sections ?? []).length === 0 ? (
                  <Empty>No sections yet.</Empty>
                ) : (
                  <List
                    items={(activeEnum.sections ?? []).map(s => ({
                      key:      s.name,
                      label:    s.name,
                      active:   s.name === activeSection?.name,
                      onDelete: () => handleDeleteSection(s.name),
                    }))}
                    onPick={({ key }) => {
                      const s = (activeEnum.sections ?? []).find(x => x.name === key);
                      if (s) pickSection(s);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </Column>

        {/* ── Column 3: editor pane ─────────────────────────────── */}
        <div>
          {!activeEnum && <Hint>Pick an enum on the left, or add one.</Hint>}

          {/* Enum-only — metadata + section schema editor. */}
          {activeEnum && !activeValue && !activeSection && (
            <EnumMetaEditor
              enumDef={activeEnum}
              onRename={(next) => handleRenameEnum(activeEnum, next)}
              onDelete={() => handleDeleteEnum(activeEnum)}
            />
          )}

          {/* Value-only — umbrella editor. */}
          {activeEnum && activeValue && !activeSection && (
            <ValueUmbrellaEditor
              key={`${activeEnum.id}/${activeValue.id}`}
              enumDef={activeEnum}
              value={activeValue}
              mentionOptions={mentionOptions}
              onRename={(next) => handleRenameValue(activeValue, next)}
              onDelete={() => handleDeleteValue(activeValue)}
              onChange={handleValueUmbrellaChange}
            />
          )}

          {/* Section-only (no value) — section name editor + hint to pick a value. */}
          {activeEnum && !activeValue && activeSection && (
            <SectionMetaEditor
              key={`${activeEnum.id}/section:${activeSection.name}`}
              section={activeSection}
              onRename={(next) => handleRenameSection(activeSection.name, next)}
              onDelete={() => handleDeleteSection(activeSection.name)}
            />
          )}

          {/* Value + section — body editor, with editable name and delete. */}
          {activeEnum && activeValue && activeSection && (
            <SectionBodyEditor
              key={`${activeEnum.id}/${activeValue.id}/${activeSection.name}`}
              enumDef={activeEnum}
              value={activeValue}
              section={activeSection}
              body={activeValue.sectionTexts?.[activeSection.name] ?? ''}
              mentionOptions={mentionOptions}
              onRename={(next) => handleRenameSection(activeSection.name, next)}
              onDelete={() => handleDeleteSection(activeSection.name)}
              onChange={handleSectionBodyChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Editor panes
// ────────────────────────────────────────────────────────────────────

function EnumMetaEditor({
  enumDef, onRename, onDelete,
}: {
  enumDef: EnumTypeDef;
  onRename: (next: string) => boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader>Enum</SectionHeader>
      <InlineRename label="Name" value={enumDef.name} onCommit={onRename} />

      <div style={{ marginTop: 14 }}>
        <DangerBtn onClick={onDelete}>Delete this enum</DangerBtn>
      </div>
    </div>
  );
}

function ValueUmbrellaEditor({
  enumDef, value, mentionOptions, onRename, onDelete, onChange,
}: {
  enumDef: EnumTypeDef;
  value: EnumValueDef;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onRename: (next: string) => boolean;
  onDelete: () => void;
  onChange: (text: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader>Value</SectionHeader>
      <InlineRename label="Name" value={value.value} onCommit={onRename} />

      <SectionHeader>Umbrella prompt</SectionHeader>
      <MentionTextarea
        value={value.umbrellaText ?? ''}
        onChange={onChange}
        options={mentionOptions}
        placeholder="Umbrella briefing for this value — what the LLM should understand when this is what it's reasoning about."
        rows={18}
        storageKey={`enum:${enumDef.id}:val:${value.id}:umbrella`}
      />

      <div style={{ marginTop: 14 }}>
        <DangerBtn onClick={onDelete}>Delete this value</DangerBtn>
      </div>
    </div>
  );
}

function SectionMetaEditor({
  section, onRename, onDelete,
}: {
  section: EnumSectionDecl;
  onRename: (next: string) => boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader>Section</SectionHeader>
      <InlineRename label="Name" value={section.name} onCommit={onRename} />
      <Hint>Pick a value on the left to author this section's body.</Hint>
      <div style={{ marginTop: 14 }}>
        <DangerBtn onClick={onDelete}>Delete this section</DangerBtn>
      </div>
    </div>
  );
}

function SectionBodyEditor({
  enumDef, value, section, body, mentionOptions,
  onRename, onDelete, onChange,
}: {
  enumDef: EnumTypeDef;
  value: EnumValueDef;
  section: EnumSectionDecl;
  body: string;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onRename: (next: string) => boolean;
  onDelete: () => void;
  onChange: (text: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader>Section</SectionHeader>
      <InlineRename label="Name" value={section.name} onCommit={onRename} />

      <SectionHeader>{`${value.value} · body`}</SectionHeader>
      <MentionTextarea
        value={body}
        onChange={onChange}
        options={mentionOptions}
        placeholder={`Write the "${section.name}" briefing for ${enumDef.name} = ${value.value}…`}
        rows={18}
        storageKey={`enum:${enumDef.id}:val:${value.id}:sec:${section.name}`}
      />

      <div style={{ marginTop: 14 }}>
        <DangerBtn onClick={onDelete}>Delete this section</DangerBtn>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Inline primitives — minimal styling, slots into the existing CSS
// module with a tiny appended ruleset (bibleListRow*) for hover delete.
// ────────────────────────────────────────────────────────────────────

function Column({
  title, onAdd, addLabel, children,
}: {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff',
      padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#4b5563',
          textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1,
        }}>{title}</span>
        {onAdd && (
          <button type="button" onClick={onAdd} style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px',
            border: '1px dashed #cbd5e1', borderRadius: 6, background: '#fff',
            color: '#2563eb', cursor: 'pointer',
          }}>{addLabel}</button>
        )}
      </div>
      {children}
    </div>
  );
}

function ColumnSubtitle({
  title, onAdd, addLabel,
}: {
  title: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{
        fontSize: 10.5, fontWeight: 700, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1,
      }}>{title}</span>
      {onAdd && (
        <button type="button" onClick={onAdd} style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px',
          border: '1px dashed #cbd5e1', borderRadius: 6, background: '#fff',
          color: '#2563eb', cursor: 'pointer',
        }}>{addLabel}</button>
      )}
    </div>
  );
}

/** List of clickable rows. Each row optionally has a hover-revealed
 *  ✕ delete button. */
function List({
  items, onPick,
}: {
  items: Array<{
    key: string;
    label: string;
    active?: boolean;
    onDelete?: () => void;
  }>;
  onPick: (item: { key: string }) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map(item => (
        <div
          key={item.key}
          role="button"
          tabIndex={0}
          onClick={() => onPick({ key: item.key })}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPick({ key: item.key });
            }
          }}
          className={`${styles.bibleListRow} ${item.active ? styles.bibleListRowActive : ''}`}
        >
          <span className={styles.bibleListRowLabel}>{item.label}</span>
          {item.onDelete && (
            <button
              type="button"
              className={styles.bibleListRowDelete}
              onClick={e => {
                e.stopPropagation();
                item.onDelete!();
              }}
              title="Delete"
              aria-label={`Delete ${item.label}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '12px 10px', fontSize: 12, color: '#6b7280',
      background: '#f9fafb', borderRadius: 6, lineHeight: 1.5,
    }}>{children}</div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '10px 12px', fontSize: 12, color: '#4b5563',
      background: '#f8fafc', borderRadius: 6, lineHeight: 1.6,
      border: '1px solid #e2e8f0',
    }}>{children}</div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: '#4b5563',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      marginTop: 4,
    }}>{children}</div>
  );
}

function InlineRename({
  label, value, onCommit, style,
}: {
  label: string | null;
  value: string;
  onCommit: (next: string) => boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...(style ?? {}) }}>
      {label !== null && (
        <span style={{
          fontSize: 10.5, fontWeight: 700, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>{label}</span>
      )}
      <input
        key={value}
        defaultValue={value}
        spellCheck={false}
        onBlur={e => {
          const ok = onCommit(e.currentTarget.value);
          if (!ok) e.currentTarget.value = value;
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.value = value;
            e.currentTarget.blur();
          }
        }}
        style={{
          fontFamily: 'ui-monospace, Menlo, monospace',
          fontSize: 13, padding: '6px 10px',
          border: '1px solid #e5e7eb', borderRadius: 6,
          background: '#fff', color: '#111827',
        }}
      />
    </div>
  );
}

function DangerBtn({
  children, onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 700,
        background: '#fff', color: '#dc2626',
        border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
