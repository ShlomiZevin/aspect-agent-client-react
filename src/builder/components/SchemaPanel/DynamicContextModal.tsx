/**
 * DynamicContextModal — the agent's Dynamic Context setup panel.
 *
 * v3: one panel for everything. The left rail always shows every enum
 * field on the agent as a collapsible group. Each group shows whether
 * a Dynamic Context is attached (🎯) and how many cases it has. Click
 * a field to expand its tree; click a case inside to edit it on the
 * right. Fields without a DC expand to a single "Attach" CTA.
 *
 * Open modes (controlled by the `initial` prop the caller passes):
 *   - `initial` is a DC → that DC's field group is pre-expanded and
 *     its first case selected. "Focused" UX without losing the
 *     overall map of all DCs.
 *   - `initial` is null → nothing expanded; user picks where to
 *     focus. Adding a new DC is just "expand a field that has no DC,
 *     click Attach".
 *
 * All changes are buffered locally — the doc is touched only on Save.
 * Cancel discards every edit across every DC.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../MentionTextarea/useMentionOptions';
import { SchemaFieldModal } from './SchemaFieldModal';
import type {
  DynamicContextCase,
  DynamicContextDef,
  FieldDef,
  ID,
} from '../../types';
import styles from './DynamicContextModal.module.css';
import editorStyles from './SchemaPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** Optional focus hint. When set, that DC's field group is expanded
   *  and its first case selected on open. When null, the panel opens
   *  with nothing expanded (browse mode). */
  initial: DynamicContextDef | null;
}

const FALLBACK_KEY = '__fallback__';

function newDcId(): ID {
  return `dc_${Math.random().toString(36).slice(2, 10)}`;
}

function snippetOf(text: string): string {
  const t = (text || '').trim().replace(/\s+/g, ' ');
  return t.length > 56 ? t.slice(0, 56) + '…' : t;
}

/**
 * Align a DC's `cases` with the current `enumValues` of its field.
 * - Preserves text for values that still exist.
 * - Drops cases whose value was removed from the enum.
 * - Adds empty cases for new enum entries.
 * Pure; returns a new DC.
 */
function syncCases(dc: DynamicContextDef, field: FieldDef): DynamicContextDef {
  const enumVals = field.enumValues ?? [];
  const byValue = new Map(dc.cases.map(c => [c.value, c]));
  const cases: DynamicContextCase[] = enumVals.map(v => byValue.get(v) ?? { value: v, text: '' });
  return { ...dc, cases };
}

export function DynamicContextModal({ open, onClose, agentId, initial }: Props) {
  const { doc, updateAgent } = useBuilder();
  const confirm = useConfirm();
  const mentionOptions = useMentionOptions(agentId);
  const agent = doc.agents.find(a => a.id === agentId);

  // ── Eligible fields = every enum field on the agent with at least
  //    one value declared. Sorted by name for a stable rail order. ──
  const enumFields = useMemo<FieldDef[]>(
    () => (agent?.fields ?? [])
      .filter(f => f.type === 'enum' && Array.isArray(f.enumValues) && f.enumValues.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [agent?.fields],
  );

  // ── Local draft of agent.dynamicContexts. All edits buffer here
  //    until Save. Reset whenever the modal opens. ──
  const [draft, setDraft] = useState<DynamicContextDef[]>([]);
  const [expanded, setExpanded] = useState<Set<ID>>(new Set());
  const [activeFieldId, setActiveFieldId] = useState<ID>('');
  const [activeCaseKey, setActiveCaseKey] = useState<string>('');
  const [fieldModalOpen, setFieldModalOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Re-sync existing DC cases against their field's current enum
    // values so a field rename / value add/remove shows up correctly.
    const synced = (agent?.dynamicContexts ?? []).map(dc => {
      const field = agent?.fields.find(f => f.id === dc.fieldId);
      return field ? syncCases(dc, field) : dc;
    });
    setDraft(synced);

    if (initial) {
      setExpanded(new Set([initial.fieldId]));
      setActiveFieldId(initial.fieldId);
      const fst = synced.find(d => d.fieldId === initial.fieldId)?.cases?.[0]?.value;
      setActiveCaseKey(fst ?? '');
    } else {
      setExpanded(new Set());
      setActiveFieldId('');
      setActiveCaseKey('');
    }
  }, [open, initial, agent?.dynamicContexts, agent?.fields]);

  const dcByFieldId = useMemo(() => {
    const m = new Map<ID, DynamicContextDef>();
    for (const d of draft) m.set(d.fieldId, d);
    return m;
  }, [draft]);

  // ── Mutations on the draft ──────────────────────────────────────

  const toggleExpanded = (fieldId: ID) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
      return next;
    });
  };

  const handleAttach = (fieldId: ID) => {
    const field = agent?.fields.find(f => f.id === fieldId);
    if (!field) return;
    const fresh: DynamicContextDef = {
      id:       newDcId(),
      fieldId,
      cases:    (field.enumValues ?? []).map(v => ({ value: v, text: '' })),
    };
    setDraft(prev => [...prev, fresh]);
    setActiveFieldId(fieldId);
    setActiveCaseKey(field.enumValues?.[0] ?? '');
  };

  const handleDetach = async (fieldId: ID) => {
    const field = agent?.fields.find(f => f.id === fieldId);
    const ok = await confirm({
      title:        `Detach Dynamic Context from ${field?.name ?? 'this field'}?`,
      message:      'All authored cases for this field will be discarded. The field itself stays.',
      confirmLabel: 'Detach',
      danger:       true,
    });
    if (!ok) return;
    setDraft(prev => prev.filter(d => d.fieldId !== fieldId));
    if (activeFieldId === fieldId) {
      setActiveFieldId('');
      setActiveCaseKey('');
    }
  };

  const handleCaseChange = (fieldId: ID, value: string, text: string) => {
    setDraft(prev => prev.map(d =>
      d.fieldId === fieldId
        ? { ...d, cases: d.cases.map(c => (c.value === value ? { ...c, text } : c)) }
        : d
    ));
  };

  const handleFallbackChange = (fieldId: ID, text: string) => {
    setDraft(prev => prev.map(d =>
      d.fieldId === fieldId ? { ...d, fallback: text } : d
    ));
  };

  // ── Save / Cancel ───────────────────────────────────────────────

  const dirty = useMemo(() => {
    const a = JSON.stringify(agent?.dynamicContexts ?? []);
    const b = JSON.stringify(draft);
    return a !== b;
  }, [agent?.dynamicContexts, draft]);

  const handleSave = () => {
    updateAgent(agentId, { dynamicContexts: draft });
    onClose();
  };

  const handleCancel = async () => {
    if (dirty) {
      const ok = await confirm({
        title:        'Discard changes?',
        message:      'Your edits to dynamic contexts will be lost.',
        confirmLabel: 'Discard',
        danger:       true,
      });
      if (!ok) return;
    }
    onClose();
  };

  // ── Right-pane derived state ────────────────────────────────────

  const activeField = activeFieldId ? agent?.fields.find(f => f.id === activeFieldId) ?? null : null;
  const activeDc    = activeFieldId ? dcByFieldId.get(activeFieldId) ?? null : null;
  const showFallback = activeCaseKey === FALLBACK_KEY;
  const activeCase  = activeDc?.cases.find(c => c.value === activeCaseKey) ?? null;

  return (
    <>
      <Modal
        open={open}
        onClose={handleCancel}
        title="Dynamic Context"
        width={1000}
        footer={
          <div className={styles.actions}>
            <span className={styles.spacer} />
            <button type="button" className={editorStyles.btnGhost} onClick={handleCancel}>
              Cancel
            </button>
            <button
              type="button"
              className={editorStyles.btnPrimary}
              disabled={!dirty}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        }
      >
        <div className={styles.layout}>
          <div className={styles.rail}>
            <div className={styles.railHeader}>
              <span className={styles.railHeaderTitle}>Enum fields</span>
              <button
                type="button"
                className={styles.railHeaderCreate}
                onClick={() => setFieldModalOpen(true)}
                title="Declare a new enum field on this agent"
              >
                + New
              </button>
            </div>

            {enumFields.length === 0 ? (
              <div className={styles.railEmpty}>
                No enum fields yet. Use <strong>+ New</strong> to declare one,
                then attach a Dynamic Context to it.
              </div>
            ) : (
              enumFields.map(field => {
                const dc = dcByFieldId.get(field.id);
                const isOpen = expanded.has(field.id);
                const hasDc = !!dc;
                return (
                  <div key={field.id} className={`${styles.fieldGroup} ${isOpen ? styles.fieldGroupOpen : ''}`}>
                    <button
                      type="button"
                      className={`${styles.fieldRow} ${activeFieldId === field.id ? styles.fieldRowActive : ''}`}
                      onClick={() => toggleExpanded(field.id)}
                    >
                      <span className={styles.caret} aria-hidden>
                        {isOpen ? '▾' : '▸'}
                      </span>
                      <span className={styles.fieldName}>{field.name}</span>
                      <span className={styles.fieldType}>{field.type}</span>
                      <span className={styles.fieldSpacer} />
                      {hasDc ? (
                        <span className={styles.fieldBadge} title={`${dc.cases.length} case${dc.cases.length === 1 ? '' : 's'} authored`}>
                          {dc.cases.length} case{dc.cases.length === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className={styles.fieldNoDc}>not attached</span>
                      )}
                    </button>

                    {isOpen && (
                      hasDc ? (
                        <div className={styles.fieldChildren}>
                          {dc.cases.map(c => {
                            const active = activeFieldId === field.id && activeCaseKey === c.value;
                            return (
                              <button
                                key={c.value}
                                type="button"
                                className={`${styles.caseRow} ${active ? styles.caseRowActive : ''}`}
                                onClick={() => {
                                  setActiveFieldId(field.id);
                                  setActiveCaseKey(c.value);
                                }}
                              >
                                <div className={styles.caseBody}>
                                  <span className={styles.caseValue}>{c.value}</span>
                                  <span className={`${styles.caseSnippet} ${c.text ? '' : styles.caseEmpty}`}>
                                    {c.text ? snippetOf(c.text) : '(empty)'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className={`${styles.caseRow} ${styles.fallbackRow} ${activeFieldId === field.id && activeCaseKey === FALLBACK_KEY ? styles.caseRowActive : ''}`}
                            onClick={() => {
                              setActiveFieldId(field.id);
                              setActiveCaseKey(FALLBACK_KEY);
                            }}
                          >
                            <div className={styles.caseBody}>
                              <span className={`${styles.caseValue} ${styles.fallbackValue}`}>
                                Fallback
                              </span>
                              <span className={`${styles.caseSnippet} ${dc.fallback ? '' : styles.caseEmpty}`}>
                                {dc.fallback ? snippetOf(dc.fallback) : '(empty)'}
                              </span>
                            </div>
                          </button>
                          <button
                            type="button"
                            className={styles.detachLink}
                            onClick={() => handleDetach(field.id)}
                            title="Remove this Dynamic Context (the field stays)"
                          >
                            Detach from {field.name}
                          </button>
                        </div>
                      ) : (
                        <div className={styles.fieldChildren}>
                          <div className={styles.attachPrompt}>
                            <span>No Dynamic Context attached.</span>
                            <button
                              type="button"
                              className={styles.attachBtn}
                              onClick={() => handleAttach(field.id)}
                            >
                              + Attach
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.editor}>
            {!activeField ? (
              <div className={styles.empty}>
                Expand a field on the left and pick a case to edit it here.
                Multi-paragraph "how to handle this case" prose is fine.
              </div>
            ) : !activeDc ? (
              <div className={styles.empty}>
                <strong>{activeField.name}</strong> has no Dynamic Context yet.
                <br />
                Click <strong>+ Attach</strong> on the left to start.
              </div>
            ) : showFallback ? (
              <>
                <div className={styles.editorHeader}>
                  <span className={styles.editorHeaderKind}>Fallback</span>
                  <span className={styles.editorHeaderSep}>·</span>
                  <span className={styles.editorHeaderValue}>{activeField.name}</span>
                </div>
                <p className={styles.editorHint}>
                  Rendered when <code>{activeField.name}</code> has no value or
                  doesn't match any case above. Leave empty for silent fallback.
                </p>
                <div className={styles.editorBody}>
                  <MentionTextarea
                    value={activeDc.fallback ?? ''}
                    onChange={text => handleFallbackChange(activeField.id, text)}
                    options={mentionOptions}
                    placeholder="(optional) Default guidance when no case matches…"
                    rows={16}
                  />
                </div>
              </>
            ) : activeCase ? (
              <>
                <div className={styles.editorHeader}>
                  <span className={styles.editorHeaderKind}>Case</span>
                  <span className={styles.editorHeaderSep}>·</span>
                  <span className={styles.editorHeaderField}>{activeField.name}</span>
                  <span className={styles.editorHeaderOp}>=</span>
                  <span className={styles.editorHeaderValue}>{activeCase.value}</span>
                </div>
                <p className={styles.editorHint}>
                  Rendered inline at <code>{`{{dynamic:${activeField.name}}}`}</code>
                  {' '}whenever the live value is <code>{activeCase.value}</code>.
                  Multi-paragraph prose is fine — Dynamic Context is the
                  deterministic "how-to book" alternative to KB.
                </p>
                <div className={styles.editorBody}>
                  <MentionTextarea
                    value={activeCase.text}
                    onChange={text => handleCaseChange(activeField.id, activeCase.value, text)}
                    options={mentionOptions}
                    placeholder="Write the guidance / context to inject for this value…"
                    rows={16}
                  />
                </div>
              </>
            ) : (
              <div className={styles.empty}>Pick a case on the left.</div>
            )}
          </div>
        </div>
      </Modal>

      <SchemaFieldModal
        open={fieldModalOpen}
        onClose={() => setFieldModalOpen(false)}
        agentId={agentId}
        initial={null}
        initialType="enum"
      />
    </>
  );
}
