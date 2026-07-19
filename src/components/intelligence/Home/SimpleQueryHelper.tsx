import styles from './SimpleQueryHelper.module.css';

interface Props {
  onAskInChat: () => void;
  onRunAnyway: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (v: boolean) => void;
}

/**
 * "Gentle helper" (design turn 4c) — shown when the typed prompt looks like
 * a quick lookup Data Chat can answer instantly, not a real investigation.
 * Non-blocking: the user can still run it as an investigation anyway.
 */
export function SimpleQueryHelper({ onAskInChat, onRunAnyway, dontShowAgain, onDontShowAgainChange }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.icon}>💡</div>
      <div className={styles.body}>
        <div className={styles.title}>This looks like a quick question — Data Chat can answer it in seconds</div>
        <div className={styles.desc}>Investigations are for non-trivial analysis and take a few minutes. Data Chat will query your data instantly instead — no waiting.</div>
        <div className={styles.actions}>
          <button className={styles.askBtn} onClick={onAskInChat}>
            <span>✦ Ask in Data Chat</span>
            <span className={styles.askBtnSub}>— opens with your question</span>
          </button>
          <button className={styles.runAnywayBtn} onClick={onRunAnyway}>Run as investigation anyway</button>
          <label className={styles.dontShow}>
            <input type="checkbox" checked={dontShowAgain} onChange={e => onDontShowAgainChange(e.target.checked)} />
            Don&apos;t show this again
          </label>
        </div>
      </div>
    </div>
  );
}
