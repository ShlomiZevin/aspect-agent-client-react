/**
 * SaveAttributionModal — appears when the user clicks Save (or Save As)
 * while a pending Alfred Apply is active for the entity. Three options:
 *
 *   ✨ Save as Alfred apply  (default — they kept Alfred's plan)
 *   👤 Save as manual edit   (they reshaped it; credit themselves)
 *   🚫 Save without logging  (don't write a log row at all)
 *
 * Clicking any option fires the underlying save() with the matching
 * attribution and closes the modal. The "🚫" option still commits the
 * body — it just skips the log row for this save.
 */

import { Modal } from '../Modal/Modal';
import type { SaveAttribution } from '../../state/BuilderContext';
import styles from './SaveAttributionModal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** "save" or "save as" — used for copy + button labels only. */
  variant: 'save' | 'save-as';
  /** Optional one-line headline of the pending Alfred Apply, shown
   *  so the user remembers what they're committing. */
  applyHeadline?: string;
  onChoose: (attribution: SaveAttribution) => void;
}

const VERB: Record<Props['variant'], string> = {
  'save':    'Save',
  'save-as': 'Save as new version',
};

export function SaveAttributionModal({
  open, onClose, variant, applyHeadline, onChoose,
}: Props) {
  const pick = (attribution: SaveAttribution) => {
    onChoose(attribution);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${VERB[variant]} — how should we log this?`}
      width={520}
      footer={
        <button type="button" className={styles.btn} onClick={onClose}>
          Cancel
        </button>
      }
    >
      <p className={styles.intro}>
        This change started from an Alfred apply. How should it appear
        in the agent's change history?
      </p>

      {applyHeadline && (
        <div className={styles.applyHeadline}>{applyHeadline}</div>
      )}

      <div className={styles.choiceList}>
        <button
          type="button"
          className={`${styles.choice} ${styles.choiceRecommended}`}
          onClick={() => pick('alfred')}
          autoFocus
        >
          <div className={styles.choiceLabel}>
            ✨ Save as Alfred apply
            <span className={styles.recommendedTag}>RECOMMENDED</span>
          </div>
          <div className={styles.choiceHint}>
            Credit Alfred for the change. Use this even if you tweaked a few
            things — the saved body is what gets recorded.
          </div>
        </button>

        <button
          type="button"
          className={styles.choice}
          onClick={() => pick('manual')}
        >
          <div className={styles.choiceLabel}>👤 Save as manual edit</div>
          <div className={styles.choiceHint}>
            You reshaped Alfred's draft enough that you want it logged as
            your own change.
          </div>
        </button>

        <button
          type="button"
          className={styles.choice}
          onClick={() => pick('none')}
        >
          <div className={styles.choiceLabel}>🚫 Save without logging</div>
          <div className={styles.choiceHint}>
            Commit the body to the version, but skip the change-log entry
            entirely. Use sparingly — the history won't show this Save.
          </div>
        </button>
      </div>
    </Modal>
  );
}
