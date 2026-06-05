/**
 * AddFieldModal — define a new field.
 *
 * Field definitions live on `agent.fields` (scope='agent') or
 * `crew.fields` (scope='crew'). At creation time the user picks
 * one or more Field Extractors anywhere in the agent that should
 * extract this field — each extractor's `extractsFields[]` gets
 * the new id appended.
 *
 * The "extracted by" multi-select lists every Field Extractor
 * across the agent (Crew → Extractor format). At least one must
 * be ticked; we default the current crew's first extractor when
 * opened from a CrewView. If there are no extractors at all, the
 * "auto-create one in this crew" option ticks itself and we mint
 * a Field Extractor on submit.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import { DomainInput } from './DomainInput';
import type { FieldDef, FieldSource, FieldType, ID } from '../../types';
import styles from './AddFieldModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  /**
   * When the modal is opened from a specific extractor's config
   * (the "+ Add field" inside an extractor card), the caller passes
   * this so the new field starts wired to THAT extractor and inherits
   * its plugin's preferred default source. Without it, the modal
   * falls back to the first extractor in the crew + 'explicit'.
   */
  fromExtractor?: {
    instanceId: ID;
    defaultSource: FieldSource;
  };
  /**
   * Optional callback for the "Wire it here" affordance shown when
   * the typed name collides with an existing agent field. The parent
   * (FieldsPanel) opens its WireToCrewModal with the colliding field
   * pre-selected so the user lands in the right next step.
   */
  onWireExisting?: (fieldId: ID) => void;
  /**
   * Fired with the newly-created FieldDef right before the modal
   * closes. Used by callers that need to react to the new id — e.g.
   * Field Reasoner's WireOrCreate flow patches its own
   * `extractsFields = [field.id]` to replace any previous link.
   */
  onCreated?: (field: FieldDef) => void;
}

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum',    label: 'Enum' },
];

const SOURCE_LABEL: Record<FieldSource, { label: string; hint: string }> = {
  explicit: { label: 'Explicit', hint: 'Only when the user literally says it' },
  inferred: { label: 'Inferred', hint: 'Can be concluded from conversation' },
};

interface Draft {
  name: string;
  type: FieldType;
  source: FieldSource;
  domain: string;
  howToExtract: string;
  enumValues: string;
}

// New fields are always agent-scoped now — the "schema declares,
// crews collect" model makes crew-private fields equivalent to
// "declared at agent level, wired only to that crew." Legacy crew-
// scoped fields (CrewBody.fields) keep working; users can migrate
// one via FieldEditorModal's Scope picker. No new ones from here.
const emptyDraft = (source: FieldSource = 'explicit'): Draft => ({
  name: '',
  type: 'string',
  source,
  domain: '',
  howToExtract: '',
  enumValues: '',
});

export function AddFieldModal({
  open, onClose, agentId, crewId, fromExtractor, onWireExisting, onCreated,
}: Props) {
  const { agentExtractors, extractorOptions, domainNames, addFieldToScope } =
    useCrewFields(agentId, crewId);
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Existing agent-field-name lookup for collision detection. Memory
  // writes are keyed by NAME (not id), so a second declaration with the
  // same name would silently overwrite the first at runtime — a real
  // footgun. We block submit and offer to wire the existing one instead.
  const agentFieldByName = useMemo(() => {
    const map = new Map<string, FieldDef>();
    for (const f of agent?.fields ?? []) map.set(f.name, f);
    return map;
  }, [agent?.fields]);

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(fromExtractor?.defaultSource));
  // Which extractor instances should extract this field. At least one
  // required to submit. When opened from a specific extractor's "+ Add
  // field", that one is pre-ticked. Otherwise we fall back to the
  // first extractor in the current crew (or empty → auto-create).
  const [selectedExtractors, setSelectedExtractors] = useState<Set<ID>>(new Set());

  // Reset on open. Pick a sensible default extractor for the crew
  // (or the calling extractor when opened from an extractor's config).
  useEffect(() => {
    if (!open) return;
    setDraft(emptyDraft(fromExtractor?.defaultSource));
    if (fromExtractor) {
      setSelectedExtractors(new Set([fromExtractor.instanceId]));
    } else {
      const firstInThisCrew = extractorOptions[0]?.instanceId;
      setSelectedExtractors(firstInThisCrew ? new Set([firstInThisCrew]) : new Set());
    }
  }, [open, extractorOptions, fromExtractor]);

  const noExtractorsAnywhere = agentExtractors.length === 0;

  // Collision check — does the typed name match an already-declared
  // agent field? If so, surface the wire-instead path and block submit
  // so the user can't accidentally create a duplicate.
  const trimmedName = draft.name.trim();
  const collidesWith = trimmedName ? agentFieldByName.get(trimmedName) ?? null : null;

  const canSubmit = trimmedName.length > 0
    && !collidesWith
    && (noExtractorsAnywhere || selectedExtractors.size > 0);

  const toggleExtractor = (id: ID) => {
    setSelectedExtractors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group extractors by crew for clearer multi-select display.
  const byCrew = useMemo(() => {
    const groups = new Map<string, { crewName: string; items: typeof agentExtractors }>();
    for (const e of agentExtractors) {
      if (!groups.has(e.crewId)) groups.set(e.crewId, { crewName: e.crewName, items: [] });
      groups.get(e.crewId)!.items.push(e);
    }
    return Array.from(groups.values());
  }, [agentExtractors]);

  const submit = () => {
    if (!canSubmit) return;
    const draftField: Omit<FieldDef, 'id'> = {
      name: draft.name.trim(),
      type: draft.type,
      source: draft.source,
      howToExtract: draft.howToExtract.trim(),
      domain: draft.domain.trim() || undefined,
      ...(draft.type === 'enum' && {
        enumValues: draft.enumValues
          .split(',')
          .map(v => v.trim())
          .filter(Boolean),
      }),
    };
    const created = addFieldToScope(
      'agent',
      draftField,
      Array.from(selectedExtractors),
      // If the agent has zero extractors anywhere, bootstrap one in
      // this crew automatically so the field has something to do.
      { createDefaultExtractor: noExtractorsAnywhere },
    );
    onCreated?.(created);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={560}
      title="Add field"
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={submit}
            disabled={!canSubmit}
          >
            Add field
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            autoFocus
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. employment_status"
            onKeyDown={e => {
              if (e.key === 'Enter' && canSubmit) submit();
            }}
          />
          {collidesWith && (
            <div className={styles.collisionNote}>
              A field <strong>"{collidesWith.name}"</strong> is already declared at the agent level.
              <div className={styles.collisionActions}>
                <button
                  type="button"
                  className={styles.collisionPrimary}
                  onClick={() => {
                    onWireExisting?.(collidesWith.id);
                    onClose();
                  }}
                  disabled={!onWireExisting}
                  title={onWireExisting
                    ? 'Wire this declared field to this crew'
                    : 'Wiring from this context is not available — close and use + Wire field'}
                >
                  Wire it here
                </button>
                <button
                  type="button"
                  className={styles.collisionGhost}
                  onClick={() => setDraft(d => ({ ...d, name: '' }))}
                >
                  Use a different name
                </button>
              </div>
            </div>
          )}
        </label>

        <div className={styles.row3}>
          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <select
              className={styles.input}
              value={draft.type}
              onChange={e => setDraft(d => ({ ...d, type: e.target.value as FieldType }))}
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Source</span>
            <select
              className={styles.input}
              value={draft.source}
              onChange={e => setDraft(d => ({ ...d, source: e.target.value as FieldSource }))}
            >
              {(['explicit', 'inferred'] as FieldSource[]).map(s => (
                <option key={s} value={s} title={SOURCE_LABEL[s].hint}>
                  {SOURCE_LABEL[s].label}
                </option>
              ))}
            </select>
          </label>

        </div>

        <label className={styles.field}>
          <span className={styles.label}>Domain</span>
          <DomainInput
            value={draft.domain}
            onChange={domain => setDraft(d => ({ ...d, domain }))}
            options={domainNames}
            onSubmit={() => {
              if (canSubmit) submit();
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How to extract</span>
          <textarea
            className={styles.textarea}
            value={draft.howToExtract}
            onChange={e => setDraft(d => ({ ...d, howToExtract: e.target.value }))}
            placeholder="What this field means. Don't list allowed enum values here — they're injected automatically."
          />
        </label>

        {draft.type === 'enum' && (
          <label className={styles.field}>
            <span className={styles.label}>Allowed values (comma-separated)</span>
            <input
              className={styles.input}
              value={draft.enumValues}
              onChange={e => setDraft(d => ({ ...d, enumValues: e.target.value }))}
              placeholder="e.g. salaried, self_employed, unemployed, retired"
            />
          </label>
        )}

        {/* ── Extracted-by multi-select ─────────────────────────── */}
        <div className={styles.field}>
          <span className={styles.label}>Extracted by</span>
          {noExtractorsAnywhere ? (
            <div className={styles.hintBlock}>
              No Field Extractors anywhere yet. A new one will be created
              in this crew when you add the field.
            </div>
          ) : (
            <div className={styles.extractorPickGroups}>
              {byCrew.map(group => (
                <div key={group.crewName} className={styles.extractorPickGroup}>
                  <div className={styles.extractorPickCrew}>{group.crewName}</div>
                  <div className={styles.extractorPickChips}>
                    {group.items.map(e => {
                      const active = selectedExtractors.has(e.instanceId);
                      return (
                        <button
                          key={e.instanceId}
                          type="button"
                          className={`${styles.extractorPickChip} ${active ? styles.extractorPickChipActive : ''}`}
                          onClick={() => toggleExtractor(e.instanceId)}
                        >
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
