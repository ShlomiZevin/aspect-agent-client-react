/**
 * DynamicContextScreen — full-screen DC authoring surface.
 *
 * Promoted from the v1 modal surface that used to live in SchemaPanel.
 * Reuses the same UX shape — enum fields as collapsible groups, cases
 * underneath, fallback as a special row, MentionTextarea in the editor
 * — and extends it with:
 *
 *   • URL routing — /<agent>/builder/dynamic-context[/field[/value[/section]]]
 *     drives selection. Every level is bookmarkable.
 *   • Sections — a third hierarchy level under each case. Each case has
 *     an optional umbrella (the old `text`) plus an ordered list of
 *     named sub-prompts. Authors a `{{dynamic:F:S}}` token per section.
 *   • A view toggle — tree (default) vs columns.
 *   • A breadcrumb that mirrors the URL.
 *
 * Persistence: edits write straight through `updateAgent`. There's no
 * local draft buffer. AutoSave handles the rest, matching every other
 * Canvas panel (Parameters, Domains, Fields).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import type {
  DynamicContextCase,
  DynamicContextDef,
  DynamicContextSection,
  FieldDef,
  ID,
} from '../../types';
import {
  FALLBACK_SEGMENT,
  newDcId,
  sanitiseSectionName,
  snippetOf,
  syncCases,
  uniqueSectionName,
} from './helpers';
import styles from './DynamicContextScreen.module.css';

type View = 'tree' | 'columns';

export function DynamicContextScreen() {
  const { agent: agentSlug, fieldName, value, section } = useParams<{
    agent: string;
    fieldName?: string;
    value?: string;
    section?: string;
  }>();
  const navigate = useNavigate();
  const { doc, updateAgent } = useBuilder();
  const confirm = useConfirm();

  // First agent is the implicit current one — same convention as
  // BuilderContext's initial selection.
  const agent = doc.agents[0];
  const mentionOptions = useMentionOptions(agent?.id ?? '');

  // ── Enum-field roster (the navigable universe) ─────────────────
  const enumFields = useMemo<FieldDef[]>(
    () => (agent?.fields ?? [])
      .filter(f => f.type === 'enum' && Array.isArray(f.enumValues) && f.enumValues.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [agent?.fields],
  );

  const dcByFieldId = useMemo(() => {
    const m = new Map<ID, DynamicContextDef>();
    for (const d of agent?.dynamicContexts ?? []) m.set(d.fieldId, d);
    return m;
  }, [agent?.dynamicContexts]);

  // Resolve current URL params into concrete state.
  const activeField = useMemo<FieldDef | null>(() => {
    if (!fieldName) return null;
    return enumFields.find(f => f.name === fieldName) ?? null;
  }, [fieldName, enumFields]);

  const activeDc = useMemo<DynamicContextDef | null>(() => {
    if (!activeField) return null;
    const raw = dcByFieldId.get(activeField.id);
    if (!raw) return null;
    // Sync with current enumValues so the UI never shows stale cases.
    return syncCases(raw, activeField);
  }, [activeField, dcByFieldId]);

  const isFallback = value === FALLBACK_SEGMENT;
  const activeCase = useMemo<DynamicContextCase | null>(() => {
    if (!activeDc || !value || isFallback) return null;
    return activeDc.cases.find(c => c.value === value) ?? null;
  }, [activeDc, value, isFallback]);

  // The active section is a DC-level declaration (lives on
  // `dc.sections`); the body shown in the editor is pulled from the
  // active case's `sectionTexts[name]` separately.
  const activeSection = useMemo<DynamicContextSection | null>(() => {
    if (!activeDc || !section) return null;
    return activeDc.sections?.find(s => s.name === section) ?? null;
  }, [activeDc, section]);

  // ── View mode (local UI state, not URL) ────────────────────────
  const [view, setView] = useState<View>('tree');

  // ── Mutation helpers — write through to the doc ────────────────

  const writeDcs = useCallback((nextDcs: DynamicContextDef[]) => {
    if (!agent) return;
    updateAgent(agent.id, { dynamicContexts: nextDcs });
  }, [agent, updateAgent]);

  const upsertDc = useCallback((next: DynamicContextDef) => {
    if (!agent) return;
    const current = agent.dynamicContexts ?? [];
    const idx = current.findIndex(d => d.id === next.id);
    const updated = idx === -1
      ? [...current, next]
      : current.map(d => (d.id === next.id ? next : d));
    writeDcs(updated);
  }, [agent, writeDcs]);

  const handleAttach = useCallback((field: FieldDef) => {
    const fresh: DynamicContextDef = {
      id:    newDcId(),
      fieldId: field.id,
      cases: (field.enumValues ?? []).map(v => ({ value: v, text: '' })),
    };
    upsertDc(fresh);
    // Navigate to the first case so the editor is immediately useful.
    const firstValue = field.enumValues?.[0];
    if (firstValue) {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}/${encodeURIComponent(firstValue)}`);
    } else {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}`);
    }
  }, [upsertDc, navigate, agentSlug]);

  /** Push a new enum value onto a field AND seed an empty case on its DC. */
  const handleAddValue = useCallback((field: FieldDef, rawValue: string) => {
    if (!agent) return;
    const v = rawValue.trim();
    if (!v) return;
    const existing = field.enumValues ?? [];
    if (existing.includes(v)) return;
    const nextFields = agent.fields.map(f =>
      f.id === field.id ? { ...f, enumValues: [...existing, v] } : f,
    );
    updateAgent(agent.id, { fields: nextFields });
    const dc = dcByFieldId.get(field.id);
    if (dc) {
      upsertDc({ ...dc, cases: [...dc.cases, { value: v, text: '' }] });
    }
  }, [agent, updateAgent, dcByFieldId, upsertDc]);

  /** Remove an enum value AND its matching case. Confirms first. */
  const handleRemoveValue = useCallback(async (field: FieldDef, val: string) => {
    if (!agent) return;
    const ok = await confirm({
      title:        `Remove "${val}" from ${field.name}?`,
      message:      'This deletes the enum value from the field and discards the text authored for that case. Other places that reference this value will see it disappear.',
      confirmLabel: 'Remove',
      danger:       true,
    });
    if (!ok) return;
    const nextFields = agent.fields.map(f =>
      f.id === field.id ? { ...f, enumValues: (f.enumValues ?? []).filter(x => x !== val) } : f,
    );
    updateAgent(agent.id, { fields: nextFields });
    const dc = dcByFieldId.get(field.id);
    if (dc) {
      upsertDc({ ...dc, cases: dc.cases.filter(c => c.value !== val) });
    }
    // If the URL was pointing at the removed value, drop back to the field.
    if (fieldName === field.name && value === val) {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}`);
    }
  }, [agent, confirm, updateAgent, dcByFieldId, upsertDc, fieldName, value, navigate, agentSlug]);

  /** Rename a case value — cascades into the field's enumValues. */
  const handleRenameValue = useCallback((field: FieldDef, oldVal: string, raw: string): boolean => {
    if (!agent) return false;
    const next = raw.trim();
    if (!next || next === oldVal) return false;
    const existing = field.enumValues ?? [];
    if (existing.includes(next)) return false;
    const nextFields = agent.fields.map(f =>
      f.id === field.id ? { ...f, enumValues: existing.map(v => (v === oldVal ? next : v)) } : f,
    );
    updateAgent(agent.id, { fields: nextFields });
    const dc = dcByFieldId.get(field.id);
    if (dc) {
      upsertDc({
        ...dc,
        cases: dc.cases.map(c => (c.value === oldVal ? { ...c, value: next } : c)),
      });
    }
    if (fieldName === field.name && value === oldVal) {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}/${encodeURIComponent(next)}${section ? `/${encodeURIComponent(section)}` : ''}`);
    }
    return true;
  }, [agent, updateAgent, dcByFieldId, upsertDc, fieldName, value, section, navigate, agentSlug]);

  /** Write umbrella text for a case. */
  const handleCaseTextChange = useCallback((dc: DynamicContextDef, val: string, text: string) => {
    upsertDc({
      ...dc,
      cases: dc.cases.map(c => (c.value === val ? { ...c, text } : c)),
    });
  }, [upsertDc]);

  const handleFallbackChange = useCallback((dc: DynamicContextDef, text: string) => {
    upsertDc({ ...dc, fallback: text });
  }, [upsertDc]);

  // Sections are declared on the DC (shared across every case) — so
  // these handlers all operate at the DC level, with `caseValue` only
  // showing up where we need to navigate back into the case that was
  // active when the user fired the action.

  const handleAddSection = useCallback((dc: DynamicContextDef, caseValue: string, rawName: string) => {
    const sanitised = sanitiseSectionName(rawName);
    if (!sanitised) return;
    const existing = dc.sections ?? [];
    const name = uniqueSectionName(sanitised, existing);
    const nextDc: DynamicContextDef = {
      ...dc,
      sections: [...existing, { name }],
    };
    upsertDc(nextDc);
    // Navigate into the new section under whichever case is active.
    if (activeField) {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField.name)}/${encodeURIComponent(caseValue)}/${encodeURIComponent(name)}`);
    }
  }, [upsertDc, activeField, agentSlug, navigate]);

  const handleRenameSection = useCallback((dc: DynamicContextDef, oldName: string, raw: string): boolean => {
    const sanitised = sanitiseSectionName(raw);
    if (!sanitised || sanitised === oldName) return false;
    const existing = dc.sections ?? [];
    const others = existing.filter(s => s.name !== oldName);
    if (others.some(s => s.name === sanitised)) return false; // duplicate
    // Rename the declaration on the DC AND migrate the keyed bodies on
    // every case so authored content survives the rename. Cases that
    // didn't have a body for `oldName` stay untouched.
    const nextDc: DynamicContextDef = {
      ...dc,
      sections: existing.map(s => (s.name === oldName ? { ...s, name: sanitised } : s)),
      cases: dc.cases.map(c => {
        const t = c.sectionTexts;
        if (!t || !(oldName in t)) return c;
        const next: Record<string, string> = { ...t };
        next[sanitised] = next[oldName];
        delete next[oldName];
        return { ...c, sectionTexts: next };
      }),
    };
    upsertDc(nextDc);
    if (activeField && fieldName === activeField.name && section === oldName) {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField.name)}/${encodeURIComponent(value ?? '')}/${encodeURIComponent(sanitised)}`);
    }
    return true;
  }, [upsertDc, activeField, fieldName, value, section, navigate, agentSlug]);

  const handleSectionTextChange = useCallback((dc: DynamicContextDef, caseValue: string, sectionName: string, text: string) => {
    upsertDc({
      ...dc,
      cases: dc.cases.map(c =>
        c.value === caseValue
          ? { ...c, sectionTexts: { ...(c.sectionTexts ?? {}), [sectionName]: text } }
          : c,
      ),
    });
  }, [upsertDc]);

  const handleRemoveSection = useCallback(async (dc: DynamicContextDef, caseValue: string, sectionName: string) => {
    const ok = await confirm({
      title:        `Remove section "${sectionName}"?`,
      message:      'This is shared across every value of this field — removing it deletes the section and its authored body under every case. Any addon prompts referencing it via {{dynamic:…:…}} will resolve to empty.',
      confirmLabel: 'Remove',
      danger:       true,
    });
    if (!ok) return;
    upsertDc({
      ...dc,
      sections: (dc.sections ?? []).filter(s => s.name !== sectionName),
      cases: dc.cases.map(c => {
        if (!c.sectionTexts || !(sectionName in c.sectionTexts)) return c;
        const next = { ...c.sectionTexts };
        delete next[sectionName];
        return { ...c, sectionTexts: next };
      }),
    });
    if (activeField && fieldName === activeField.name && section === sectionName) {
      navigate(`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField.name)}/${encodeURIComponent(caseValue)}`);
    }
  }, [confirm, upsertDc, activeField, fieldName, section, navigate, agentSlug]);

  // ── Render ──────────────────────────────────────────────────────

  if (!agent) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>No agent loaded.</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <Breadcrumb
          agentSlug={agentSlug ?? ''}
          fieldName={fieldName}
          value={value}
          section={section}
          isFallback={isFallback}
        />
        <div className={styles.viewToggle} role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'tree'}
            className={`${styles.viewToggleBtn} ${view === 'tree' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setView('tree')}
          >Tree</button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'columns'}
            className={`${styles.viewToggleBtn} ${view === 'columns' ? styles.viewToggleBtnActive : ''}`}
            onClick={() => setView('columns')}
          >Columns</button>
        </div>
      </div>

      <div className={`${styles.body} ${view === 'columns' ? styles.bodyColumns : ''}`}>
        {view === 'tree' ? (
          <TreeNav
            agentSlug={agentSlug ?? ''}
            enumFields={enumFields}
            dcByFieldId={dcByFieldId}
            activeFieldName={fieldName}
            activeValue={value}
            activeSection={section}
            onAttach={handleAttach}
            onAddValue={handleAddValue}
            onRemoveValue={handleRemoveValue}
            onAddSection={handleAddSection}
            onRemoveSection={handleRemoveSection}
          />
        ) : (
          <ColumnsNav
            agentSlug={agentSlug ?? ''}
            enumFields={enumFields}
            dcByFieldId={dcByFieldId}
            activeField={activeField}
            activeDc={activeDc}
            activeCase={activeCase}
            activeSection={section}
            isFallback={isFallback}
            onAttach={handleAttach}
            onAddValue={handleAddValue}
            onRemoveValue={handleRemoveValue}
            onAddSection={handleAddSection}
            onRemoveSection={handleRemoveSection}
          />
        )}

        <Editor
          activeField={activeField}
          activeDc={activeDc}
          activeCase={activeCase}
          activeSection={activeSection}
          isFallback={isFallback}
          mentionOptions={mentionOptions}
          onRenameValue={handleRenameValue}
          onRenameSection={handleRenameSection}
          onCaseTextChange={handleCaseTextChange}
          onFallbackChange={handleFallbackChange}
          onSectionTextChange={handleSectionTextChange}
        />
      </div>
    </div>
  );
}

/* ─── Breadcrumb ───────────────────────────────────────────────── */

function Breadcrumb({
  agentSlug, fieldName, value, section, isFallback,
}: {
  agentSlug: string;
  fieldName?: string;
  value?: string;
  section?: string;
  isFallback: boolean;
}) {
  const crumbs: Array<{ label: string; to?: string }> = [
    { label: 'Builder', to: `/${agentSlug}/builder` },
    { label: 'Agent',   to: `/${agentSlug}/builder` },
    { label: 'Dynamic Context', to: `/${agentSlug}/builder/dynamic-context` },
  ];
  if (fieldName) {
    crumbs.push({
      label: fieldName,
      to: `/${agentSlug}/builder/dynamic-context/${encodeURIComponent(fieldName)}`,
    });
  }
  if (fieldName && value) {
    crumbs.push({
      label: isFallback ? 'Fallback' : value,
      to: section
        ? `/${agentSlug}/builder/dynamic-context/${encodeURIComponent(fieldName)}/${encodeURIComponent(value)}`
        : undefined,
    });
  }
  if (fieldName && value && section) {
    crumbs.push({ label: section });
  }
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span className={styles.crumbSep} aria-hidden>›</span>}
          {c.to && i < crumbs.length - 1 ? (
            <Link to={c.to} className={styles.crumb}>{c.label}</Link>
          ) : (
            <span className={`${styles.crumb} ${styles.crumbCurrent}`}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/* ─── Tree view ────────────────────────────────────────────────── */

function TreeNav({
  agentSlug, enumFields, dcByFieldId, activeFieldName, activeValue, activeSection,
  onAttach, onAddValue, onRemoveValue, onAddSection, onRemoveSection,
}: {
  agentSlug: string;
  enumFields: FieldDef[];
  dcByFieldId: Map<ID, DynamicContextDef>;
  activeFieldName?: string;
  activeValue?: string;
  activeSection?: string;
  onAttach: (field: FieldDef) => void;
  onAddValue: (field: FieldDef, raw: string) => void;
  onRemoveValue: (field: FieldDef, val: string) => void;
  onAddSection: (dc: DynamicContextDef, caseValue: string, rawName: string) => void;
  onRemoveSection: (dc: DynamicContextDef, caseValue: string, sectionName: string) => void;
}) {
  // Expanded-field set tracked locally; auto-expand the active one.
  const [expanded, setExpanded] = useState<Set<ID>>(() => new Set());
  useEffect(() => {
    if (!activeFieldName) return;
    const f = enumFields.find(x => x.name === activeFieldName);
    if (!f) return;
    setExpanded(prev => (prev.has(f.id) ? prev : new Set(prev).add(f.id)));
  }, [activeFieldName, enumFields]);

  const [newValueByField, setNewValueByField] = useState<Record<ID, string>>({});
  const [newSectionByCase, setNewSectionByCase] = useState<Record<string, string>>({});
  // Sections start hidden behind a quiet "+ Add section" button — most
  // cases never grow them, so showing the input row by default just
  // adds clutter. Keyed by `${fieldId}/${caseValue}` and only one open
  // at a time keeps the tree calm.
  const [openAddSectionFor, setOpenAddSectionFor] = useState<string | null>(null);

  const toggle = (id: ID) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (enumFields.length === 0) {
    return (
      <div className={styles.nav}>
        <div className={styles.navEmpty}>
          No enum fields on this agent yet. Declare one from the Schema
          panel, then attach a Dynamic Context to it here.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.nav}>
      <div className={styles.navHeader}>
        <span className={styles.navHeaderTitle}>Enum fields</span>
        <span className={styles.navHeaderCount}>{enumFields.length}</span>
      </div>
      <div className={styles.tree}>
        {enumFields.map(field => {
          const dc = dcByFieldId.get(field.id);
          const isOpen = expanded.has(field.id);
          const hasDc = !!dc;
          return (
            <div
              key={field.id}
              className={`${styles.fieldGroup} ${isOpen ? styles.fieldGroupOpen : ''}`}
            >
              <button type="button" className={styles.fieldRow} onClick={() => toggle(field.id)}>
                <span className={styles.caret} aria-hidden>{isOpen ? '▾' : '▸'}</span>
                <span className={styles.fieldName}>{field.name}</span>
                <span className={styles.fieldType}>{field.type}</span>
                <span className={styles.fieldSpacer} />
                {hasDc ? (
                  <span className={styles.fieldBadge}>
                    {dc.cases.length} case{dc.cases.length === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className={styles.fieldNoDc}>not attached</span>
                )}
              </button>

              {isOpen && !hasDc && (
                <div className={styles.fieldChildren}>
                  <div className={styles.attachPrompt}>
                    <span>No Dynamic Context attached.</span>
                    <button type="button" className={styles.attachBtn} onClick={() => onAttach(field)}>
                      + Attach
                    </button>
                  </div>
                </div>
              )}

              {isOpen && hasDc && dc && (
                <div className={styles.fieldChildren}>
                  <div className={styles.subLabel}>
                    When <code className={styles.subLabelField}>{field.name}</code> is…
                  </div>
                  <div className={styles.list}>
                    {dc.cases.map(c => {
                      const isCaseActive = activeFieldName === field.name && activeValue === c.value;
                      // Section names are declared on the DC, but the
                      // text/empty status shown next to each row is
                      // per-case (the body lives in `case.sectionTexts`).
                      const sectionList = dc.sections ?? [];
                      const sectionTexts = c.sectionTexts ?? {};
                      const filledSections = sectionList.filter(s => (sectionTexts[s.name] ?? '').trim().length > 0).length;
                      return (
                        <div key={c.value}>
                          <Link
                            to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}/${encodeURIComponent(c.value)}`}
                            className={`${styles.row} ${isCaseActive && !activeSection ? styles.rowActive : ''}`}
                          >
                            <span className={styles.op} aria-hidden>=</span>
                            <div className={styles.rowBody}>
                              <span className={styles.rowValue}>{c.value}</span>
                              {c.text || filledSections > 0 ? (
                                <span className={styles.rowSnippet}>
                                  {c.text
                                    ? snippetOf(c.text)
                                    : `${filledSections}/${sectionList.length} section${sectionList.length === 1 ? '' : 's'} written`}
                                </span>
                              ) : (
                                <span className={styles.rowSnippetEmpty}>not yet written</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className={styles.rowRemove}
                              onClick={e => { e.preventDefault(); e.stopPropagation(); onRemoveValue(field, c.value); }}
                              title={`Remove "${c.value}" from ${field.name}`}
                              aria-label={`Remove ${c.value}`}
                            >
                              ×
                            </button>
                          </Link>
                          {isCaseActive && (
                            <div className={styles.caseExpanded}>
                              {/* Section rows + the add-section affordance.
                                  Sections are declared on the DC (shared
                                  across every case), so the list comes
                                  from `dc.sections`; what changes per
                                  case is whether each one has a body
                                  written. The add-section input only
                                  appears after the user clicks
                                  "+ Add section". */}
                              {sectionList.length > 0 && (
                                <div className={styles.list}>
                                  {sectionList.map(s => {
                                    const isSectionActive = activeSection === s.name;
                                    const body = sectionTexts[s.name] ?? '';
                                    return (
                                      <Link
                                        key={s.name}
                                        to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}/${encodeURIComponent(c.value)}/${encodeURIComponent(s.name)}`}
                                        className={`${styles.row} ${isSectionActive ? styles.rowActive : ''}`}
                                      >
                                        <span className={styles.op} aria-hidden>›</span>
                                        <div className={styles.rowBody}>
                                          <span className={styles.rowValue}>{s.name}</span>
                                          {body ? (
                                            <span className={styles.rowSnippet}>{snippetOf(body)}</span>
                                          ) : (
                                            <span className={styles.rowSnippetEmpty}>not yet written</span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          className={styles.rowRemove}
                                          onClick={e => { e.preventDefault(); e.stopPropagation(); onRemoveSection(dc, c.value, s.name); }}
                                          title={`Remove section "${s.name}" (shared across every value)`}
                                          aria-label={`Remove section ${s.name}`}
                                        >
                                          ×
                                        </button>
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                              {openAddSectionFor === `${field.id}/${c.value}` ? (
                                <div className={styles.list}>
                                  <div className={styles.addRow}>
                                    <span className={styles.op} aria-hidden>+</span>
                                    <input
                                      autoFocus
                                      className={styles.addInput}
                                      value={newSectionByCase[`${field.id}/${c.value}`] ?? ''}
                                      onChange={e => setNewSectionByCase(prev => ({ ...prev, [`${field.id}/${c.value}`]: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          const raw = newSectionByCase[`${field.id}/${c.value}`] ?? '';
                                          if (raw.trim()) {
                                            onAddSection(dc, c.value, raw);
                                            setNewSectionByCase(prev => ({ ...prev, [`${field.id}/${c.value}`]: '' }));
                                            setOpenAddSectionFor(null);
                                          }
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setNewSectionByCase(prev => ({ ...prev, [`${field.id}/${c.value}`]: '' }));
                                          setOpenAddSectionFor(null);
                                        }
                                      }}
                                      onBlur={() => {
                                        const raw = newSectionByCase[`${field.id}/${c.value}`] ?? '';
                                        if (!raw.trim()) setOpenAddSectionFor(null);
                                      }}
                                      placeholder="section name (e.g. how to address)"
                                      spellCheck={false}
                                    />
                                    <button
                                      type="button"
                                      className={styles.addBtn}
                                      disabled={!(newSectionByCase[`${field.id}/${c.value}`] ?? '').trim()}
                                      onMouseDown={e => e.preventDefault() /* keep input focused for blur logic */}
                                      onClick={() => {
                                        const raw = newSectionByCase[`${field.id}/${c.value}`] ?? '';
                                        if (raw.trim()) {
                                          onAddSection(dc, c.value, raw);
                                          setNewSectionByCase(prev => ({ ...prev, [`${field.id}/${c.value}`]: '' }));
                                          setOpenAddSectionFor(null);
                                        }
                                      }}
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.addSectionGhost}
                                  onClick={() => setOpenAddSectionFor(`${field.id}/${c.value}`)}
                                  title="Author a sub-prompt under this case"
                                >
                                  + Add section
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className={styles.addRow}>
                      <span className={styles.op} aria-hidden>+</span>
                      <input
                        className={styles.addInput}
                        value={newValueByField[field.id] ?? ''}
                        onChange={e => setNewValueByField(prev => ({ ...prev, [field.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const raw = newValueByField[field.id] ?? '';
                            if (raw.trim()) {
                              onAddValue(field, raw);
                              setNewValueByField(prev => ({ ...prev, [field.id]: '' }));
                            }
                          }
                        }}
                        placeholder="add a value…"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        className={styles.addBtn}
                        disabled={!(newValueByField[field.id] ?? '').trim()}
                        onClick={() => {
                          const raw = newValueByField[field.id] ?? '';
                          if (raw.trim()) {
                            onAddValue(field, raw);
                            setNewValueByField(prev => ({ ...prev, [field.id]: '' }));
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className={styles.subLabel}>Otherwise…</div>
                  <div className={styles.list}>
                    <Link
                      to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}/${encodeURIComponent(FALLBACK_SEGMENT)}`}
                      className={`${styles.row} ${activeFieldName === field.name && activeValue === FALLBACK_SEGMENT ? styles.rowActive : ''}`}
                    >
                      <span className={styles.op} aria-hidden>↳</span>
                      <div className={styles.rowBody}>
                        <span className={`${styles.rowValue} ${styles.fallbackValue}`}>Fallback</span>
                        {dc.fallback ? (
                          <span className={styles.rowSnippet}>{snippetOf(dc.fallback)}</span>
                        ) : (
                          <span className={styles.rowSnippetEmpty}>not yet written</span>
                        )}
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Columns view ─────────────────────────────────────────────── */

function ColumnsNav({
  agentSlug, enumFields, dcByFieldId, activeField, activeDc, activeCase, activeSection, isFallback,
  onAttach, onAddValue, onRemoveValue, onAddSection, onRemoveSection,
}: {
  agentSlug: string;
  enumFields: FieldDef[];
  dcByFieldId: Map<ID, DynamicContextDef>;
  activeField: FieldDef | null;
  activeDc: DynamicContextDef | null;
  activeCase: DynamicContextCase | null;
  activeSection?: string;
  isFallback: boolean;
  onAttach: (field: FieldDef) => void;
  onAddValue: (field: FieldDef, raw: string) => void;
  onRemoveValue: (field: FieldDef, val: string) => void;
  onAddSection: (dc: DynamicContextDef, caseValue: string, rawName: string) => void;
  onRemoveSection: (dc: DynamicContextDef, caseValue: string, sectionName: string) => void;
}) {
  const [newValue, setNewValue] = useState('');
  const [newSection, setNewSection] = useState('');
  // Sections start hidden behind a "+ Add section" button to keep the
  // sections column quiet on cases that haven't grown any yet.
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  return (
    <div className={styles.columns}>
      {/* Column 1: Fields */}
      <div className={styles.column}>
        <div className={styles.columnHeader}>Fields</div>
        <div className={styles.columnList}>
          {enumFields.length === 0 ? (
            <div className={styles.columnEmpty}>No enum fields yet.</div>
          ) : enumFields.map(field => {
            const dc = dcByFieldId.get(field.id);
            const isActive = activeField?.id === field.id;
            return (
              <Link
                key={field.id}
                to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(field.name)}`}
                className={`${styles.columnRow} ${isActive ? styles.columnRowActive : ''}`}
              >
                <span className={styles.columnRowLabel}>{field.name}</span>
                <span className={styles.columnRowMeta}>
                  {dc ? `${dc.cases.length} case${dc.cases.length === 1 ? '' : 's'}` : 'not attached'}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Column 2: Values */}
      <div className={styles.column}>
        <div className={styles.columnHeader}>
          Values{activeField && (<>· <span className={styles.columnHeaderCtx}>{activeField.name}</span></>)}
        </div>
        <div className={styles.columnList}>
          {!activeField ? (
            <div className={styles.columnEmpty}>Pick a field on the left.</div>
          ) : !activeDc ? (
            <div className={styles.columnEmpty} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              <span>No Dynamic Context attached.</span>
              <button type="button" className={styles.attachBtn} onClick={() => onAttach(activeField)}>
                + Attach
              </button>
            </div>
          ) : (
            <>
              {activeDc.cases.map(c => {
                const isActive = activeCase?.value === c.value;
                // Sections come from the DC, but the chip should reflect
                // how many of THIS case's bodies are actually filled —
                // so the author can tell at a glance which value still
                // needs work.
                const declaredSections = activeDc.sections ?? [];
                const texts = c.sectionTexts ?? {};
                const filledSections = declaredSections.filter(s => (texts[s.name] ?? '').trim().length > 0).length;
                return (
                  <Link
                    key={c.value}
                    to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField.name)}/${encodeURIComponent(c.value)}`}
                    className={`${styles.columnRow} ${isActive ? styles.columnRowActive : ''}`}
                  >
                    <span className={styles.columnRowLabel}>{c.value}</span>
                    {declaredSections.length > 0 ? (
                      <span className={styles.columnRowChip}>
                        {filledSections}/{declaredSections.length} section{declaredSections.length === 1 ? '' : 's'}
                      </span>
                    ) : c.text ? (
                      <span className={styles.columnRowMeta}>written</span>
                    ) : (
                      <span className={styles.columnRowMetaEmpty}>empty</span>
                    )}
                    <button
                      type="button"
                      className={styles.rowRemove}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); onRemoveValue(activeField, c.value); }}
                      title={`Remove "${c.value}" from ${activeField.name}`}
                      aria-label={`Remove ${c.value}`}
                    >
                      ×
                    </button>
                  </Link>
                );
              })}
              <Link
                to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField.name)}/${encodeURIComponent(FALLBACK_SEGMENT)}`}
                className={`${styles.columnRow} ${isFallback ? styles.columnRowActive : ''}`}
              >
                <span className={styles.columnRowLabel} style={{ fontStyle: 'italic' }}>↳ Fallback</span>
                {activeDc.fallback ? (
                  <span className={styles.columnRowMeta}>written</span>
                ) : (
                  <span className={styles.columnRowMetaEmpty}>empty</span>
                )}
              </Link>
              {/* Add-value affordance — mirrors the tree view's "+ add
                  a value" so authors don't have to switch views just to
                  extend the enum. Updates the field's enumValues
                  immediately (same handler as the tree). */}
              <div className={styles.addRow}>
                <span className={styles.op} aria-hidden>+</span>
                <input
                  className={styles.addInput}
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newValue.trim()) {
                        onAddValue(activeField, newValue);
                        setNewValue('');
                      }
                    }
                  }}
                  placeholder="add a value…"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className={styles.addBtn}
                  disabled={!newValue.trim()}
                  onClick={() => {
                    if (newValue.trim()) {
                      onAddValue(activeField, newValue);
                      setNewValue('');
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Column 3: Sections */}
      <div className={styles.column}>
        <div className={styles.columnHeader}>
          Sections{activeCase && (<>· <span className={styles.columnHeaderCtx}>{activeCase.value}</span></>)}
        </div>
        <div className={styles.columnList}>
          {!activeCase ? (
            <div className={styles.columnEmpty}>Pick a value.</div>
          ) : (
            <>
              {/* "Umbrella" pseudo-row so the user can route back to the
                  case's main prompt from the columns view. */}
              <Link
                to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField!.name)}/${encodeURIComponent(activeCase.value)}`}
                className={`${styles.columnRow} ${activeCase && !activeSection ? styles.columnRowActive : ''}`}
              >
                <span className={styles.columnRowLabel} style={{ fontStyle: 'italic' }}>[umbrella]</span>
                {activeCase.text ? (
                  <span className={styles.columnRowMeta}>written</span>
                ) : (
                  <span className={styles.columnRowMetaEmpty}>empty</span>
                )}
              </Link>
              {/* Sections declared on the DC — shared across every
                  case. The body shown next to each row comes from the
                  active case's `sectionTexts[name]` so the written /
                  empty status is per-value. */}
              {(activeDc!.sections ?? []).map(s => {
                const body = activeCase.sectionTexts?.[s.name] ?? '';
                return (
                  <Link
                    key={s.name}
                    to={`/${agentSlug}/builder/dynamic-context/${encodeURIComponent(activeField!.name)}/${encodeURIComponent(activeCase.value)}/${encodeURIComponent(s.name)}`}
                    className={`${styles.columnRow} ${activeSection === s.name ? styles.columnRowActive : ''}`}
                  >
                    <span className={styles.columnRowLabel}>{s.name}</span>
                    {body ? (
                      <span className={styles.columnRowMeta}>written</span>
                    ) : (
                      <span className={styles.columnRowMetaEmpty}>empty</span>
                    )}
                    <button
                      type="button"
                      className={styles.rowRemove}
                      onClick={e => { e.preventDefault(); e.stopPropagation(); onRemoveSection(activeDc!, activeCase.value, s.name); }}
                      title={`Remove section "${s.name}" (shared across every value)`}
                      aria-label={`Remove section ${s.name}`}
                    >
                      ×
                    </button>
                  </Link>
                );
              })}
            </>
          )}
          {activeCase && activeDc && (
            addSectionOpen ? (
              <div className={styles.addRow}>
                <span className={styles.op} aria-hidden>+</span>
                <input
                  autoFocus
                  className={styles.addInput}
                  value={newSection}
                  onChange={e => setNewSection(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newSection.trim()) {
                        onAddSection(activeDc, activeCase.value, newSection);
                        setNewSection('');
                        setAddSectionOpen(false);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setNewSection('');
                      setAddSectionOpen(false);
                    }
                  }}
                  onBlur={() => {
                    if (!newSection.trim()) setAddSectionOpen(false);
                  }}
                  placeholder="section name (e.g. how to address)"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className={styles.addBtn}
                  disabled={!newSection.trim()}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    if (newSection.trim()) {
                      onAddSection(activeDc, activeCase.value, newSection);
                      setNewSection('');
                      setAddSectionOpen(false);
                    }
                  }}
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.addSectionGhost}
                onClick={() => setAddSectionOpen(true)}
                title="Author a sub-prompt under this case"
              >
                + Add section
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Editor ───────────────────────────────────────────────────── */

function Editor({
  activeField, activeDc, activeCase, activeSection, isFallback, mentionOptions,
  onRenameValue, onRenameSection, onCaseTextChange, onFallbackChange, onSectionTextChange,
}: {
  activeField: FieldDef | null;
  activeDc: DynamicContextDef | null;
  activeCase: DynamicContextCase | null;
  activeSection: DynamicContextSection | null;
  isFallback: boolean;
  mentionOptions: ReturnType<typeof useMentionOptions>;
  onRenameValue: (field: FieldDef, oldVal: string, raw: string) => boolean;
  onRenameSection: (dc: DynamicContextDef, oldName: string, raw: string) => boolean;
  onCaseTextChange: (dc: DynamicContextDef, val: string, text: string) => void;
  onFallbackChange: (dc: DynamicContextDef, text: string) => void;
  onSectionTextChange: (dc: DynamicContextDef, caseValue: string, sectionName: string, text: string) => void;
}) {
  if (!activeField) {
    return (
      <div className={styles.editor}>
        <div className={styles.empty}>
          Pick a field on the left to start authoring.
          <br />
          Each Dynamic Context switches a chunk of prompt text based on a memory field's current value.
        </div>
      </div>
    );
  }

  if (!activeDc) {
    return (
      <div className={styles.editor}>
        <div className={styles.empty}>
          <strong>{activeField.name}</strong> has no Dynamic Context yet.
          <br />
          Click <strong>+ Attach</strong> on the left to start.
        </div>
      </div>
    );
  }

  if (isFallback) {
    return (
      <div className={styles.editor}>
        <div className={styles.editorHeader}>
          <span className={styles.editorHeaderKind}>Fallback</span>
          <span className={styles.editorHeaderSep}>·</span>
          <span className={styles.editorHeaderField}>{activeField.name}</span>
        </div>
        <p className={styles.editorHint}>
          Rendered when <code>{activeField.name}</code> has no value or
          doesn't match any case above. Leave empty for silent fallback.
        </p>
        <div className={styles.editorBody}>
          <MentionTextarea
            value={activeDc.fallback ?? ''}
            onChange={text => onFallbackChange(activeDc, text)}
            options={mentionOptions}
            placeholder="(optional) Default guidance when no case matches…"
            rows={18}
            storageKey={`dc:${activeField.id}:fallback`}
          />
        </div>
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className={styles.editor}>
        <div className={styles.empty}>Pick a case on the left.</div>
      </div>
    );
  }

  if (activeSection) {
    // Section names are shared across every case (they're declared
    // on the DC). The body shown here is the active case's text for
    // this section — `case.sectionTexts[name]`.
    const sectionBody = activeCase.sectionTexts?.[activeSection.name] ?? '';
    return (
      <div className={styles.editor}>
        <div className={styles.editorHeader}>
          <span className={styles.editorHeaderKind}>Section</span>
          <span className={styles.editorHeaderSep}>·</span>
          <span className={styles.editorHeaderField}>{activeField.name}</span>
          <span className={styles.editorHeaderOp}>=</span>
          <span className={styles.editorHeaderField}>{activeCase.value}</span>
          <span className={styles.editorHeaderOp}>›</span>
          <input
            /* Force remount when switching sections so defaultValue picks up. */
            key={`${activeField.id}/${activeCase.value}/${activeSection.name}`}
            className={styles.editorHeaderSectionInput}
            defaultValue={activeSection.name}
            onBlur={e => {
              const ok = onRenameSection(activeDc, activeSection.name, e.target.value);
              if (!ok) e.target.value = activeSection.name;
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
              if (e.key === 'Escape') {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).value = activeSection.name;
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            spellCheck={false}
            title="Rename this section (snake_case; renames everywhere it's used)"
          />
        </div>
        <p className={styles.editorHint}>
          Reference as <code>{`{{dynamic:${activeField.name}:${activeSection.name}}}`}</code> from any addon prompt.
          Section names are <strong>shared</strong> across every value of <code>{activeField.name}</code>; the body
          below is what gets injected when the live value is <code>{activeCase.value}</code>.
        </p>
        <div className={styles.editorBody}>
          <MentionTextarea
            value={sectionBody}
            onChange={text => onSectionTextChange(activeDc, activeCase.value, activeSection.name, text)}
            options={mentionOptions}
            placeholder={`Write the body for ${activeField.name}=${activeCase.value} › ${activeSection.name}…`}
            rows={18}
            storageKey={`dc:${activeField.id}:${activeCase.value}:section:${activeSection.name}`}
          />
        </div>
      </div>
    );
  }

  // Umbrella editor for a case.
  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <span className={styles.editorHeaderKind}>Case</span>
        <span className={styles.editorHeaderSep}>·</span>
        <span className={styles.editorHeaderField}>{activeField.name}</span>
        <span className={styles.editorHeaderOp}>=</span>
        <input
          key={`${activeField.id}/${activeCase.value}`}
          className={styles.editorHeaderValueInput}
          defaultValue={activeCase.value}
          onBlur={e => {
            const ok = onRenameValue(activeField, activeCase.value, e.target.value);
            if (!ok) e.target.value = activeCase.value;
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
            if (e.key === 'Escape') {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).value = activeCase.value;
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          spellCheck={false}
          title="Click to rename this enum value"
        />
      </div>
      <p className={styles.editorHint}>
        Rendered inline at <code>{`{{dynamic:${activeField.name}}}`}</code>
        {' '}whenever the live value is <code>{activeCase.value}</code>.
        Use <code>{`{{dynamic:${activeField.name}:*}}`}</code> to inject every section under this case as headed blocks,
        or address a specific section via <code>{`{{dynamic:${activeField.name}:SECTION}}`}</code>.
      </p>
      <div className={styles.editorBody}>
        <MentionTextarea
          value={activeCase.text ?? ''}
          onChange={text => onCaseTextChange(activeDc, activeCase.value, text)}
          options={mentionOptions}
          placeholder="Umbrella prompt for this case — optional if you only use sections…"
          rows={18}
          storageKey={`dc:${activeField.id}:${activeCase.value}:umbrella`}
        />
      </div>
    </div>
  );
}
