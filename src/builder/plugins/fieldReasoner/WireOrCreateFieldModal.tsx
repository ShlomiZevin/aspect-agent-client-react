/**
 * WireOrCreateFieldModal — "pick or create a field, then wire it to
 * this addon" surface. SHARED across every field-bearing plugin
 * (Field Reasoner, Field Interviewer, Field Extractor, Vibe Extractor).
 *
 * Two paths in one modal:
 *   1. Pick an existing eligible field → wires it to the caller.
 *   2. Quick-add (name only, defaults to string + inferred) OR full
 *      `AddFieldModal` for enum / domain / source customization.
 *
 * Extractor list semantics: picking an existing field APPENDS the
 * caller's `instanceId` to that field's extractor list rather than
 * overwriting it, so the same field can be shared across multiple
 * extractors (the Field Extractor's bread-and-butter case). The
 * caller's `onWired(fieldId)` callback patches their own
 * `config.extractsFields[]` — typically by appending.
 *
 * Why one modal across plugins: discoverability of the wire-existing
 * path was the missing piece for Field Extractor. Same modal, same
 * mental model — what differs per plugin is the `allowedTypes` filter
 * and the badge label.
 */

import { useMemo, useState } from 'react';
import { Modal } from '../../components/Modal/Modal';
import { AddFieldModal } from '../../components/FieldsPanel/AddFieldModal';
import { useCrewFields } from '../../state/useCrewFields';
import type { CrewField } from '../../state/useCrewFields';
import type { FieldDef, FieldType, ID } from '../../types';
import styles from './WireOrCreateFieldModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  crewId: ID;
  /** Addon instance id that should own the wiring after pick / create. */
  instanceId: ID;
  /** Fired with the field id once wired (or created+wired). Callers
   *  typically append to their own `config.extractsFields[]`. */
  onWired: (fieldId: ID) => void;
  /** Badge shown in the modal header — defaults to "Field Reasoner".
   *  Other callers pass their own label so the surface reflects them. */
  badgeLabel?: string;
  /** Restrict the existing-field list to these types. Omit for "no
   *  filter" (Field Extractor accepts everything). */
  allowedTypes?: FieldType[];
}

export function WireOrCreateFieldModal({
  open, onClose, agentId, crewId, instanceId, onWired,
  badgeLabel = 'Field Reasoner', allowedTypes,
}: Props) {
  const { allFields, setFieldExtractors, addFieldToScope } = useCrewFields(agentId, crewId);

  const eligible = useMemo<CrewField[]>(
    () => {
      if (!allowedTypes || allowedTypes.length === 0) return allFields;
      const set = new Set(allowedTypes);
      return allFields.filter(cf => set.has(cf.field.type));
    },
    [allFields, allowedTypes],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [quickName, setQuickName] = useState('');

  // Name uniqueness — agent-field names must be unique (memory writes
  // are keyed by name; a collision would silently overwrite).
  const trimmedQuick = quickName.trim();
  const quickCollides = trimmedQuick !== ''
    && allFields.some(cf => cf.field.name === trimmedQuick);
  const canQuickAdd = trimmedQuick.length > 0 && !quickCollides;

  const handlePick = (cf: CrewField) => {
    // APPEND this addon to the field's extractor list — don't overwrite
    // (a field can be shared between multiple extractors / reasoners).
    // setFieldExtractors replaces the WHOLE list, so we compute the
    // union of existing + this addon and pass that.
    const existing = cf.extractors.map(e => e.instanceId);
    const next = existing.includes(instanceId) ? existing : [...existing, instanceId];
    setFieldExtractors(cf.field.id, next);
    onWired(cf.field.id);
    onClose();
  };

  const handleQuickAdd = () => {
    if (!canQuickAdd) return;
    const created = addFieldToScope(
      'agent',
      {
        name:         trimmedQuick,
        type:         'string',
        source:       'inferred',
        howToExtract: '',
      },
      [instanceId],
      { createDefaultExtractor: false },
    );
    onWired(created.id);
    setQuickName('');
    onClose();
  };

  const handleCreated = (field: FieldDef) => {
    // AddFieldModal already called setFieldExtractors via addFieldToScope,
    // appending our instance to the new field's extractors. We then
    // surface the new field id via onWired so the caller can append to
    // its own extractsFields[].
    onWired(field.id);
    setCreateOpen(false);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Output field"
        badge={badgeLabel}
        width={560}
        footer={
          <div className={styles.footer}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setCreateOpen(true)}
              title="Open the full field declaration form (enum values, domain, source, …)"
            >
              + Create with full form
            </button>
          </div>
        }
      >
        <div className={styles.intro}>
          Pick an existing field to populate, or add one inline.
          The reasoning "how" lives in the prompt — a name is enough here.
        </div>

        {eligible.length === 0 ? (
          <div className={styles.empty}>
            No eligible declared fields yet. Add one with quick add below.
          </div>
        ) : (
          <ul className={styles.pickList}>
            {eligible.map(cf => (
              <li key={cf.field.id}>
                <button
                  type="button"
                  className={styles.pickRow}
                  onClick={() => handlePick(cf)}
                >
                  <span className={styles.pickName}>{cf.field.name}</span>
                  <span className={styles.pickPills}>
                    <span className={styles.pickType}>{cf.field.type}</span>
                    {cf.scope === 'crew' && (
                      <span className={styles.pickScope} title="Crew-scoped">🔒 crew</span>
                    )}
                    {cf.field.domain && (
                      <span className={styles.pickDomain}>{cf.field.domain}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.quickAdd}>
          <div className={styles.quickAddLabel}>Quick add</div>
          <div className={styles.quickAddRow}>
            <input
              className={styles.quickAddInput}
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canQuickAdd) handleQuickAdd(); }}
              placeholder="e.g. tier_inferred"
              spellCheck={false}
            />
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!canQuickAdd}
              onClick={handleQuickAdd}
            >
              + Add &amp; wire
            </button>
          </div>
          {quickCollides ? (
            <div className={styles.quickAddCollide}>
              A field named "{trimmedQuick}" already exists. Pick it above or choose a different name.
            </div>
          ) : (
            <div className={styles.quickAddHint}>
              Creates a <strong>string</strong> field with <strong>source = inferred</strong> and an empty "how to extract".
              For enum / domain / extra metadata, use <strong>+ Create with full form</strong> below.
            </div>
          )}
        </div>
      </Modal>

      <AddFieldModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agentId={agentId}
        crewId={crewId}
        // Pre-wire to this Reasoner instance and start with `inferred`
        // (the Reasoner default — the whole point is inference).
        fromExtractor={{ instanceId, defaultSource: 'inferred' }}
        onCreated={handleCreated}
      />
    </>
  );
}
