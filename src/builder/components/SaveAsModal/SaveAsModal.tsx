/**
 * SaveAsModal — collects an optional description for a new version.
 * Reused by both crew and (later) agent Save-As flows.
 */

import { useEffect, useState } from 'react';
import { Modal } from '../Modal/Modal';
import styles from './SaveAsModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** "Crew" or "Agent" — used in the title. */
  entityLabel: string;
  /** Suggested next version number — shown in the modal.
   *  Omit when each entity in the save has its own number
   *  (e.g. "save all as" across agent + every crew); the
   *  modal renders without a version badge and shows the
   *  button as "Save as new version". */
  nextNumber?: number;
  onSubmit: (description?: string) => void;
}

export function SaveAsModal({ open, onClose, entityLabel, nextNumber, onSubmit }: Props) {
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) setDescription('');
  }, [open]);

  const submit = () => {
    onSubmit(description.trim() || undefined);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={460}
      title={`Save ${entityLabel} as new version`}
      badge={nextNumber ? `v${nextNumber}` : undefined}
      footer={
        <>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.save} onClick={submit} autoFocus>
            {nextNumber ? `Save as v${nextNumber}` : 'Save as new version'}
          </button>
        </>
      }
    >
      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Description (optional)</span>
          <input
            className={styles.input}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. tuned the talker prompt, added income_range"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>
        <p className={styles.hint}>
          Short label so you can recognise this version later. Skip if not useful.
        </p>
      </div>
    </Modal>
  );
}
