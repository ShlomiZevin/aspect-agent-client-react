/**
 * WireOrCreateFieldModal — Field Reasoner's "pick the output field"
 * surface.
 *
 * Lists existing eligible fields (string / enum, agent or this crew's
 * scope). One click wires the picked field to this Reasoner. A "+
 * Create new field" button opens the canonical `AddFieldModal` — we
 * REUSE that screen rather than re-implementing the field-shape form
 * here (one create-a-field UI in the codebase, not two).
 *
 * On create the AddFieldModal calls back with the created field; we
 * patch our `extractsFields = [id]` to overwrite any previous link
 * (setFieldExtractors only appends, so an explicit overwrite is what
 * keeps Field Reasoner single-field).
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
  /** Fired with the field id once wired (or created+wired). The caller
   *  patches its own `extractsFields = [id]` to mirror the change. */
  onWired: (fieldId: ID) => void;
}

/** Field Reasoner only handles string + enum at the LLM level — filter
 *  the existing-field list accordingly. */
const ELIGIBLE_TYPES = new Set<FieldType>(['string', 'enum']);

export function WireOrCreateFieldModal({
  open, onClose, agentId, crewId, instanceId, onWired,
}: Props) {
  const { allFields, setFieldExtractors } = useCrewFields(agentId, crewId);

  const eligible = useMemo<CrewField[]>(
    () => allFields.filter(cf => ELIGIBLE_TYPES.has(cf.field.type)),
    [allFields],
  );

  const [createOpen, setCreateOpen] = useState(false);

  const handlePick = (cf: CrewField) => {
    setFieldExtractors(cf.field.id, [instanceId]);
    onWired(cf.field.id);
    onClose();
  };

  const handleCreated = (field: FieldDef) => {
    // AddFieldModal already called setFieldExtractors via addFieldToScope
    // — it appends our instance to the new field's extractors. We then
    // overwrite our extractsFields to be [field.id] so any previously
    // linked field is dropped (Field Reasoner is single-field).
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
        badge="Field Reasoner"
        width={560}
        footer={
          <div className={styles.footer}>
            <button type="button" className={styles.btnGhost} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setCreateOpen(true)}
            >
              + Create new field
            </button>
          </div>
        }
      >
        <div className={styles.intro}>
          Pick an existing field to populate, or create a new one.
          Field Reasoner can populate <strong>string</strong> or <strong>enum</strong> fields.
        </div>

        {eligible.length === 0 ? (
          <div className={styles.empty}>
            No eligible declared fields. Click <strong>+ Create new field</strong> below
            to declare one.
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
