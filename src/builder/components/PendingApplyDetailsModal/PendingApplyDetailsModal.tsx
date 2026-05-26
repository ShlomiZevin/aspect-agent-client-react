/**
 * PendingApplyDetailsModal — shows the full Alfred-apply plan that's
 * currently sitting in the working copy (i.e. before Save).
 *
 * The in-canvas banner shows just the short summary so it doesn't eat
 * the viewport. This modal is the "tell me more" surface: the full
 * consolidator description + each target's per-body `what_to_do`. Once
 * the user Saves, those become real `agent_log` rows visible in the
 * History modal — this modal is the pre-save equivalent.
 */

import { Modal } from '../Modal/Modal';
import type { PendingAlfredApply } from '../../state/BuilderContext';
import styles from './PendingApplyDetailsModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  pending: PendingAlfredApply;
}

export function PendingApplyDetailsModal({ open, onClose, pending }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Alfred draft — details"
      width={640}
      footer={<button type="button" className={styles.btn} onClick={onClose}>Close</button>}
    >
      <p className={styles.intro}>
        These changes are sitting in your working copy. Nothing is committed
        yet — Save (or Save as) commits them and writes the change-log entry.
        Discard reverts to the saved version.
      </p>

      {pending.summary && (
        <div className={styles.summary}>{pending.summary}</div>
      )}

      {pending.description && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Plan</div>
          <div className={styles.descriptionBlock}>{pending.description}</div>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          Targets ({pending.targets.length})
        </div>
        <ul className={styles.targetList}>
          {pending.targets.map(t => (
            <li key={`${t.entity}_${t.entityId}`} className={styles.target}>
              <div className={styles.targetHeader}>
                <span className={styles.entityBadge}>
                  {t.entity === 'agent' ? 'AGENT' : 'CREW'}
                </span>
                <span className={styles.entityName}>{t.entityName}</span>
                {t.applied && <span className={styles.appliedTag}>✓ committed</span>}
              </div>
              <p className={styles.whatToDo}>{t.what_to_do}</p>
            </li>
          ))}
        </ul>
      </div>

      {pending.reason && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Reason for the log</div>
          <div className={styles.descriptionBlock}>{pending.reason}</div>
        </div>
      )}
    </Modal>
  );
}
