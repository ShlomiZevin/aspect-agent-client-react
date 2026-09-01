/**
 * AddTriggerModal — pick what a new trigger should watch for.
 *
 * Deliberately the same shape as `AddStepModal` (the addon picker):
 * same modal, same icon + name + description rows, same hover. Adding a
 * trigger and adding an addon are the same gesture from the author's
 * point of view, so they should not look like two different products.
 *
 * No tabs: there is no trigger repository yet. If one arrives, the tab
 * strip from AddStepModal drops straight in.
 */

import { Modal } from '../Modal/Modal';
import { listTriggerTypes } from '../../triggers';
import styles from './AddTriggerModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (typeId: string) => void;
}

export function AddTriggerModal({ open, onClose, onPick }: Props) {
  const types = listTriggerTypes();

  return (
    <Modal open={open} onClose={onClose} width={560} title="Add trigger">
      <div className={styles.section}>
        {types.length === 0 && (
          <div className={styles.empty}>No trigger types are registered.</div>
        )}
        {types.map(t => (
          <button
            key={t.typeId}
            type="button"
            className={styles.item}
            onClick={() => { onPick(t.typeId); onClose(); }}
          >
            <span className={styles.icon} style={{ background: `${t.color}22`, color: t.color }}>
              {t.icon}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{t.displayName}</span>
              <span className={styles.desc}>{t.description}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
