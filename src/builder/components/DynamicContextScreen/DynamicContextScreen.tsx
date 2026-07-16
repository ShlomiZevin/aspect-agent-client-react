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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { EnumDocView } from './EnumDocView';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { TableEditorModalV1 } from '../TableEditor/TableEditorModalV1';
import { MarkdownWithTables } from '../TableEditor/MarkdownWithTables';
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

/** Shared inline style for the tiny keyboard-hint `<kbd>` chips shown
 *  next to the Save/Cancel buttons. */
const kbdStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, "Menlo", monospace',
  fontSize: 10,
  padding: '1px 4px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: '#f9fafb',
  color: '#6b7280',
};

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

  // Tree ↔ Doc toggle persisted on the URL via `?view=doc`. Tree is
  // the default (omitted from the URL when active). The Doc view only
  // makes sense once an active KB is selected — falling back to the
  // tree when no KB is in the URL keeps the toggle from rendering
  // an empty doc. Called "tree" because the three-column layout
  // (KBs → values → sections) is hierarchical, not a flat list.
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode: 'tree' | 'doc' = searchParams.get('view') === 'doc' ? 'doc' : 'tree';
  const setViewMode = (next: 'tree' | 'doc') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'doc') params.set('view', 'doc');
    else                params.delete('view');
    setSearchParams(params, { replace: true });
  };

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
    const ownedField = e.ownedByFieldId
      ? agent?.fields.find(f => f.id === e.ownedByFieldId)
      : undefined;
    const ok = await confirm({
      title:        e.ownedByFieldId ? `Delete the value list "${e.name}"?` : `Delete Targeted KB "${e.name}"?`,
      message:      ownedField
        ? `This list belongs to the field "${ownedField.name}" (Choice type) — deleting it leaves that field without values. Usually you'd delete or retype the field instead.`
        : `Every value and section authored under this Targeted KB is removed. Any field bound to it will be left unwired.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    writeEnums((agent?.enums ?? []).filter(x => x.id !== e.id));
    navigate(`/${agentSlug}/builder/enums`);
  }, [agent, agentSlug, confirm, navigate, writeEnums]);

  const handleRenameEnum = useCallback((e: EnumTypeDef, rawNext: string): boolean => {
    // Field-owned Choice lists are named after their field — rename the
    // FIELD to rename the list (the editor hides the rename input too).
    if (e.ownedByFieldId) return false;
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

  /** Flip the per-value enable flag. Disabled values still exist in
   *  the KB (so their bodies aren't lost) but drop out of every prompt
   *  surface — see EnumValueDef.enabled for the full list of surfaces.
   *  Missing enabled → treated as true; explicit false → hidden. */
  const handleToggleValueEnabled = useCallback((v: EnumValueDef) => {
    if (!activeEnum) return;
    const nextEnabled = v.enabled === false;
    upsertEnum({
      ...activeEnum,
      values: activeEnum.values.map(x =>
        x.id === v.id ? { ...x, enabled: nextEnabled } : x,
      ),
    });
  }, [activeEnum, upsertEnum]);

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
            Targeted KB
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
          {/* List / Doc toggle — visible whenever a KB is active so
              the author can flip into the doc-style read+edit view
              without losing breadcrumb context. Stays URL-persisted
              via `?view=doc`. */}
          {activeEnum && (() => {
            // Field-owned Choice lists are values-only — no doc view.
            // The toggle stays RENDERED (disabled) so the header keeps
            // the exact same height/width and never jumps when
            // switching between a Targeted KB and a Choice list.
            const owned = !!activeEnum.ownedByFieldId;
            const effMode = owned ? 'tree' : viewMode;
            return (
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'inline-flex',
                  border: '1px solid #e5e7eb',
                  borderRadius: 6,
                  overflow: 'hidden',
                  fontSize: 12,
                  fontWeight: 600,
                  opacity: owned ? 0.45 : 1,
                }}
                title={owned ? 'Field lists are values-only — no doc view' : undefined}
              >
                <button
                  type="button"
                  disabled={owned}
                  onClick={() => setViewMode('tree')}
                  style={{
                    background: effMode === 'tree' ? '#6366f1' : '#fff',
                    color:      effMode === 'tree' ? '#fff'    : '#4b5563',
                    border:     0,
                    padding:    '4px 12px',
                    fontFamily: 'inherit',
                    cursor:     owned ? 'default' : 'pointer',
                  }}
                >
                  Tree
                </button>
                <button
                  type="button"
                  disabled={owned}
                  onClick={() => setViewMode('doc')}
                  style={{
                    background: effMode === 'doc' ? '#6366f1' : '#fff',
                    color:      effMode === 'doc' ? '#fff'    : '#4b5563',
                    border:     0,
                    padding:    '4px 12px',
                    fontFamily: 'inherit',
                    cursor:     owned ? 'default' : 'pointer',
                    borderLeft: '1px solid #e5e7eb',
                  }}
                >
                  Doc
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Content area below the top bar. Stays put; children own
          their own scroll so the page header (breadcrumb + toggle)
          doesn't drift up and out of view when the doc / right-pane
          gets long. */}
      <div className={styles.contentArea}>

      {/* Doc view: same data, second renderer. Activated by `?view=doc`
          in the URL. The toggle above flips it; everything else on
          the page (cascades, helpers, mention picker) is reused. */}
      {/* Field-owned Choice lists never doc-render (they're values-only)
          — a stale ?view=doc URL falls through to the tree. */}
      {viewMode === 'doc' && activeEnum && !activeEnum.ownedByFieldId && (
        <EnumDocView agentId={agent.id} enumDef={activeEnum} />
      )}

      {(viewMode === 'tree' || (activeEnum?.ownedByFieldId ?? false)) && (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 240px 1fr',
        gap: 16,
        alignItems: 'stretch',
        height: '100%',
        minHeight: 0,
      }}>
        {/* ── Column 1: enums list — real Targeted KBs first, then the
            field-owned Choice lists in their own group so the two
            concepts never blur (same data behind the scenes). ── */}
        <Column title="Targeted KBs" onAdd={handleCreateEnum} addLabel="+ Add KB">
          {enums.length === 0 ? (
            <Empty>Declare a Targeted KB to get started.</Empty>
          ) : (
            <>
              {enums.some(e => !e.ownedByFieldId) ? (
                <List
                  items={enums.filter(e => !e.ownedByFieldId).map(e => ({
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
              ) : (
                <Empty>Declare a Targeted KB to get started.</Empty>
              )}
              {enums.some(e => e.ownedByFieldId) && (
                <div style={{ marginTop: 16 }}>
                  <ColumnSubtitle title="Field lists (Choice)" />
                  <List
                    items={enums.filter(e => e.ownedByFieldId).map(e => ({
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
                </div>
              )}
            </>
          )}
        </Column>

        {/* ── Column 2: values + section schema ─────────────────── */}
        <Column
          title={activeEnum ? `${activeEnum.name} · values` : 'Values'}
          onAdd={activeEnum ? handleAddValue : undefined}
          addLabel="+ Add value"
        >
          {!activeEnum ? (
            <Empty>Pick a Targeted KB on the left.</Empty>
          ) : (
            <>
              {activeEnum.values.length === 0 ? (
                <Empty>No values yet. Add one to start authoring.</Empty>
              ) : (
                <List
                  items={activeEnum.values.map(v => ({
                    key:              v.id,
                    label:            v.value,
                    active:           v.id === activeValue?.id,
                    disabled:         v.enabled === false,
                    onToggleEnabled:  () => handleToggleValueEnabled(v),
                    onDelete:         () => handleDeleteValue(v),
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
                  click each. Field-owned Choice lists are JUST values —
                  sections/prompts are Targeted-KB concepts, hidden here. */}
              {!activeEnum.ownedByFieldId && (
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
              )}
            </>
          )}
        </Column>

        {/* ── Column 3: editor pane ─────────────────────────────── */}
        <div style={{
          // Independent scroll so only THIS pane moves when its
          // contents overflow. The page header + the two left
          // columns stay anchored.
          height: '100%',
          minHeight: 0,
          overflowY: 'auto',
          boxSizing: 'border-box',
          padding: '0 4px 0 0',
        }}>
          {!activeEnum && <Hint>Pick a Targeted KB on the left, or add one.</Hint>}

          {/* Enum-only — metadata + section schema editor. */}
          {activeEnum && !activeValue && !activeSection && (
            <EnumMetaEditor
              enumDef={activeEnum}
              ownedFieldName={
                activeEnum.ownedByFieldId
                  ? agent?.fields.find(f => f.id === activeEnum.ownedByFieldId)?.name ?? null
                  : null
              }
              agentSlug={agentSlug}
              onRename={(next) => handleRenameEnum(activeEnum, next)}
              onDelete={() => handleDeleteEnum(activeEnum)}
            />
          )}

          {/* Value-only — umbrella editor. Field-owned Choice lists show
              just the value name/delete — no umbrella prompt. */}
          {activeEnum && activeValue && !activeSection && (
            <ValueUmbrellaEditor
              key={`${activeEnum.id}/${activeValue.id}`}
              enumDef={activeEnum}
              value={activeValue}
              hidePrompt={!!activeEnum.ownedByFieldId}
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
      )}
      </div>{/* /contentArea */}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Editor panes
// ────────────────────────────────────────────────────────────────────

function EnumMetaEditor({
  enumDef, ownedFieldName, agentSlug, onRename, onDelete,
}: {
  enumDef: EnumTypeDef;
  /** Set when this is a field-owned Choice list — the name follows the
   *  field (`<field>_choices`) and isn't editable here. */
  ownedFieldName: string | null;
  agentSlug: string;
  onRename: (next: string) => boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader>{ownedFieldName ? 'Field list (Choice)' : 'Targeted KB'}</SectionHeader>
      {ownedFieldName ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, color: '#6b7280',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>Name</span>
          <div style={{
            padding: '9px 11px', border: '1px solid #e5e7eb', borderRadius: 8,
            background: '#f9fafb', fontSize: 13.5, fontFamily: 'ui-monospace, Menlo, monospace',
            color: '#374151',
          }}>{enumDef.name}</div>
          <span style={{ fontSize: 11.5, color: '#9ca3af', lineHeight: 1.4 }}>
            Named after its field{' '}
            <Link to={`/${agentSlug}/builder/fields/${encodeURIComponent(ownedFieldName)}`} style={{ color: '#4f46e5', fontWeight: 600 }}>
              {ownedFieldName}
            </Link>
            {' '}— rename the field to rename this list.
          </span>
        </div>
      ) : (
        <InlineRename label="Name" value={enumDef.name} onCommit={onRename} />
      )}

      <div style={{ marginTop: 14 }}>
        <DangerBtn onClick={onDelete}>
          {ownedFieldName ? 'Delete this value list' : 'Delete this Targeted KB'}
        </DangerBtn>
      </div>
    </div>
  );
}

function ValueUmbrellaEditor({
  enumDef, value, hidePrompt, mentionOptions, onRename, onDelete, onChange,
}: {
  enumDef: EnumTypeDef;
  value: EnumValueDef;
  /** Field-owned Choice lists: value name + delete only — umbrella
   *  prompts are a Targeted-KB concept. */
  hidePrompt?: boolean;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onRename: (next: string) => boolean;
  onDelete: () => void;
  onChange: (text: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <SectionHeader>Value</SectionHeader>
      <InlineRename label="Name" value={value.value} onCommit={onRename} />

      {!hidePrompt && (
        <>
          <SectionHeader>Umbrella prompt</SectionHeader>
          <TextareaWithTableInsert
            value={value.umbrellaText ?? ''}
            onChange={onChange}
            options={mentionOptions}
            placeholder="Umbrella briefing for this value — what the LLM should understand when this is what it's reasoning about."
            rows={18}
            storageKey={`enum:${enumDef.id}:val:${value.id}:umbrella`}
          />
        </>
      )}

      <div style={{ marginTop: 14 }}>
        <DangerBtn onClick={onDelete}>Delete this value</DangerBtn>
      </div>
    </div>
  );
}

/**
 * Tree-view body editor with the SAME read/edit affordance pattern
 * as the doc view: read mode renders prose-with-rendered-tables;
 * clicking prose flips to edit mode (textarea); clicking a rendered
 * table opens the table modal pre-loaded with that table's MD.
 *
 * "+ Table" button is reachable from edit mode to insert a new
 * pipe-table at the end of the current body.
 */
function TextareaWithTableInsert(props: {
  value: string;
  onChange: (next: string) => void;
  options: ReturnType<typeof useMentionOptions>;
  placeholder?: string;
  rows?: number;
  storageKey?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(props.value);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableInitial, setTableInitial] = useState('');
  const [tableRange, setTableRange] = useState<{ start: number; end: number } | null>(null);
  // Captured viewer height — used as the editor's `minHeight` so
  // switching read → edit doesn't shrink the box (and shift the page).
  const [viewerHeight, setViewerHeight] = useState<number | null>(null);
  // Captured source-offset to land the caret at (best-effort: only
  // works when the click lands on prose, not inside a rendered table
  // or before/after structure that doesn't have a clean 1:1 mapping
  // back to the markdown source). Read by an effect on edit mount.
  const [caretOffset, setCaretOffset] = useState<number | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoreRef = useRef<{ y: number; scroller: Element | Window } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Mirror prop changes while not editing so external commits don't
  // get wiped by a stale draft on next entry.
  if (!editing && draft !== props.value) setDraft(props.value);

  /** Walk up to the nearest scrollable ancestor so we can restore the
   *  user's scroll position after the swap. Falls back to `window`. */
  const findScrollContainer = (el: HTMLElement | null): Element | Window => {
    let cur: HTMLElement | null = el?.parentElement ?? null;
    while (cur) {
      const oy = window.getComputedStyle(cur).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return window;
  };

  /** Try to compute the source offset corresponding to a click point.
   *  Uses caretRangeFromPoint / caretPositionFromPoint (browser
   *  support varies). Walks the viewer's DOM accumulating plain-text
   *  prose-content length up to the clicked text node + the offset
   *  within. Returns null if the click was on a non-prose region
   *  (rendered table) or the math is ambiguous. */
  const computeCaretOffset = (
    rootEl: HTMLElement,
    sourceText: string,
    clientX: number,
    clientY: number,
  ): number | null => {
    // Resolve the caret target.
    type CaretPositionLike = { offsetNode: Node; offset: number };
    type DocWithCaret = Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => CaretPositionLike | null;
    };
    const docWithCaret = document as DocWithCaret;
    let node: Node | null = null;
    let off = 0;
    if (typeof docWithCaret.caretRangeFromPoint === 'function') {
      const r = docWithCaret.caretRangeFromPoint(clientX, clientY);
      if (r) { node = r.startContainer; off = r.startOffset; }
    } else if (typeof docWithCaret.caretPositionFromPoint === 'function') {
      const p = docWithCaret.caretPositionFromPoint(clientX, clientY);
      if (p) { node = p.offsetNode; off = p.offset; }
    }
    if (!node) return null;
    // If the click landed inside a rendered table, there's no clean
    // mapping to a single source position — bail.
    let p: Node | null = node;
    while (p && p !== rootEl) {
      if (p.nodeType === Node.ELEMENT_NODE && (p as Element).tagName === 'TABLE') return null;
      p = p.parentNode;
    }
    // Walk the viewer's DOM until we hit the clicked text node,
    // counting characters from prose-only text content along the way.
    let accumulated = 0;
    let found = false;
    const walker = (n: Node): void => {
      if (found) return;
      if (n === node) {
        accumulated += off;
        found = true;
        return;
      }
      if (n.nodeType === Node.TEXT_NODE) {
        accumulated += (n.nodeValue ?? '').length;
        return;
      }
      // Skip table subtrees — their rendered text doesn't 1:1 map to
      // the source MD's pipe-table syntax. If the click never lands
      // inside one we just count what's between them in the source.
      if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'TABLE') {
        // Source offset has to skip over the table's MD too. We
        // bail to null here — getting this exact is complex enough
        // we'd rather land the caret at the start than guess wrong.
        // The caller falls back to a clean "no offset" path.
        return;
      }
      for (let c = n.firstChild; c; c = c.nextSibling) walker(c);
    };
    walker(rootEl);
    if (!found) return null;
    // Clamp to the source length so a slightly-off DOM walk doesn't
    // produce an out-of-bounds caret.
    return Math.max(0, Math.min(accumulated, sourceText.length));
  };

  /** Click on the read-mode viewer → flip to edit mode in place. */
  const enterEditing = (clientX: number, clientY: number) => {
    const v = viewerRef.current;
    if (v) {
      setViewerHeight(v.getBoundingClientRect().height);
      setCaretOffset(computeCaretOffset(v, props.value, clientX, clientY));
    }
    const scroller = findScrollContainer(v);
    const y = scroller === window
      ? window.scrollY
      : (scroller as Element).scrollTop;
    scrollRestoreRef.current = { y, scroller };
    setDraft(props.value);
    setEditing(true);
  };

  // After edit-mode mounts: restore scroll and place caret near the
  // click position (when we managed to compute one).
  useEffect(() => {
    if (!editing) return;
    const target = scrollRestoreRef.current;
    if (target) {
      if (target.scroller === window) window.scrollTo({ top: target.y });
      else (target.scroller as Element).scrollTop = target.y;
    }
    const ta = textareaRef.current;
    if (ta && caretOffset !== null) {
      ta.focus();
      try { ta.setSelectionRange(caretOffset, caretOffset); } catch { /* tolerate */ }
    }
  }, [editing, caretOffset]);

  // ── Read mode: rendered MD + click-to-edit ────────────────────
  if (!editing) {
    const hasContent = props.value.trim().length > 0;
    return (
      <>
        <div
          ref={viewerRef}
          onClick={(e) => {
            // Don't enter prose-edit if the click landed on a table —
            // tables have their own click handler that opens the modal.
            if ((e.target as HTMLElement).closest('table')) return;
            enterEditing(e.clientX, e.clientY);
          }}
          style={{
            cursor: 'text',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            padding: 10,
            minHeight: 120,
            background: '#fafafa',
            position: 'relative',
          }}
          title="Click to edit"
        >
          {hasContent ? (
            <MarkdownWithTables
              text={props.value}
              proseClassName=""
              onEditTable={(md, range) => {
                setTableInitial(md);
                setTableRange(range);
                setTableOpen(true);
              }}
            />
          ) : (
            <span style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 12.5 }}>
              {props.placeholder || 'Empty — click to add content.'}
            </span>
          )}
        </div>
        <TableEditorModalV1
          open={tableOpen}
          initialMarkdown={tableInitial}
          onCancel={() => { setTableOpen(false); setTableRange(null); }}
          onSave={(nextMd) => {
            // We're in read mode — commit directly to the parent.
            // Replace the range we clicked (when an existing table
            // was opened) or append at end (when the user opened a
            // fresh insert from an empty state).
            if (tableRange) {
              const next = props.value.slice(0, tableRange.start) + nextMd + props.value.slice(tableRange.end);
              props.onChange(next);
            } else {
              const base = props.value;
              const next = base.trim() ? `${base.trimEnd()}\n\n${nextMd}\n` : nextMd;
              props.onChange(next);
            }
            setTableOpen(false);
            setTableRange(null);
          }}
        />
      </>
    );
  }

  // ── Edit mode: textarea + insert-table button ─────────────────
  //   - `minHeight = viewerHeight` matches the editor to the
  //     viewer's actual pixel height so swapping from read → edit
  //     doesn't shrink the box. Uses the dedicated MentionTextarea
  //     prop so the textarea's inline style sets it directly (the
  //     `rows` workaround was unreliable when storageKey-restored
  //     `savedHeight` already pinned a value).
    // Commit the draft and leave edit mode. Shared by the Save button
    // and the Ctrl/Cmd+Enter shortcut.
    const commit = () => {
      if (draft !== props.value) props.onChange(draft);
      setEditing(false);
    };
    // Drop the draft and leave edit mode. Shared by the Cancel button
    // and the Escape shortcut.
    const cancel = () => {
      setDraft(props.value);
      setEditing(false);
    };

    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <MentionTextarea
        value={draft}
        onChange={setDraft}
        options={props.options}
        placeholder={props.placeholder}
        rows={props.rows}
        storageKey={props.storageKey}
        minHeight={viewerHeight ?? undefined}
        autoGrow
        autoFocus
        onKeyDown={(e) => {
          // Keyboard shortcuts so the user doesn't have to scroll down
          // to the Save/Cancel buttons on a long body. Only fires when
          // the mention picker is closed (MentionTextarea guards this).
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
        onBlur={() => {
          // Skip blur-commit while the table modal is open so the
          // inserted MD lands in the draft instead of being lost.
          if (tableOpen) return;
          if (draft !== props.value) props.onChange(draft);
          setEditing(false);
        }}
      />
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setTableInitial('');
            setTableRange(null);
            setTableOpen(true);
          }}
          style={{
            fontFamily: 'inherit',
            fontSize:   12,
            fontWeight: 600,
            background: '#fff',
            border:     '1px dashed #cbd5e1',
            color:      '#4b5563',
            borderRadius: 6,
            padding: '4px 10px',
            cursor:  'pointer',
          }}
        >
          + Table
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ alignSelf: 'center', fontSize: 11, color: '#9ca3af', marginRight: 4 }}>
          <kbd style={kbdStyle}>Esc</kbd> cancel · <kbd style={kbdStyle}>⌘/Ctrl</kbd>+<kbd style={kbdStyle}>↵</kbd> save
        </span>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          style={{
            fontFamily: 'inherit',
            fontSize:   12,
            fontWeight: 600,
            background: '#fff',
            border:     '1px solid #e5e7eb',
            color:      '#4b5563',
            borderRadius: 6,
            padding: '4px 10px',
            cursor:  'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            commit();
          }}
          style={{
            fontFamily: 'inherit',
            fontSize:   12,
            fontWeight: 600,
            background: '#6366f1',
            border:     '1px solid #6366f1',
            color:      '#fff',
            borderRadius: 6,
            padding: '4px 10px',
            cursor:  'pointer',
          }}
        >
          Save
        </button>
      </div>
      <TableEditorModalV1
        open={tableOpen}
        initialMarkdown={tableInitial}
        onCancel={() => { setTableOpen(false); setTableRange(null); }}
        onSave={(nextMd) => {
          // In edit mode we're working off `draft`; route through
          // the same helper, then close the modal.
          if (tableRange) {
            const next = draft.slice(0, tableRange.start) + nextMd + draft.slice(tableRange.end);
            setDraft(next);
          } else {
            const next = draft.trim() ? `${draft.trimEnd()}\n\n${nextMd}\n` : nextMd;
            setDraft(next);
          }
          setTableOpen(false);
          setTableRange(null);
        }}
      />
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
      <TextareaWithTableInsert
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
      // Take whatever vertical room the tree grid gives us and scroll
      // within if the contents overflow — keeps the page header pinned
      // and lets each column scroll independently.
      height: '100%',
      minHeight: 0,
      overflowY: 'auto',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#4b5563',
          textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1,
          minWidth: 0,
          // Keep the title on a single line and ellipsise long names
          // so "TEST_ENUM1 · values" doesn't wrap into two rows when
          // the KB name is long. The full string still shows as a
          // tooltip on hover for accessibility.
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }} title={title}>{title}</span>
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
    /** When `false`, the row is greyed and, if `onToggleEnabled` is
     *  supplied, an eye button appears to flip it back on. Undefined
     *  means "no enable/disable concept for this row" — used by the
     *  section list, which never toggles. */
    disabled?: boolean;
    /** Present only on rows that support enable/disable (values). */
    onToggleEnabled?: () => void;
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
          title={item.disabled ? 'Disabled — no prompt will include this value' : undefined}
        >
          <span
            className={styles.bibleListRowLabel}
            style={item.disabled ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}
          >
            {item.label}
          </span>
          {item.onToggleEnabled && (
            // Pill switch — visually mirrors the addon on/off switch
            // on the chain canvas (indigo ON hover-only, amber OFF
            // always visible). Lives in-flex-flow so the absolute-
            // positioned delete ✕ doesn't stack on top of it.
            <span
              role="button"
              tabIndex={0}
              aria-pressed={!item.disabled}
              aria-label={item.disabled ? `Enable ${item.label}` : `Disable ${item.label}`}
              title={item.disabled
                ? 'Disabled — click to enable'
                : 'Enabled — click to disable (hides from every prompt surface)'}
              className={`${styles.enableSwitch} ${item.disabled ? styles.enableSwitchOff : styles.enableSwitchOn}`}
              onClick={e => {
                e.stopPropagation();
                item.onToggleEnabled!();
                // Drop focus so an ON pill hides again once the pointer
                // leaves — same pattern as the addon toggle.
                (e.currentTarget as HTMLElement).blur();
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  item.onToggleEnabled!();
                }
              }}
            >
              <span className={styles.enableSwitchThumb} />
              <span className={styles.enableSwitchLabel}>
                {item.disabled ? 'OFF' : 'ON'}
              </span>
            </span>
          )}
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
