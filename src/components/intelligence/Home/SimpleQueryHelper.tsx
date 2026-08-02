import { useLanguage } from '../../../context/LanguageContext';
import styles from './SimpleQueryHelper.module.css';

interface Props {
  onAskInChat: () => void;
  onRunAnyway: () => void;
  dontShowAgain: boolean;
  onDontShowAgainChange: (v: boolean) => void;
}

/**
 * "Gentle helper" (design turn 4c) — shown when the typed prompt looks like
 * a quick lookup Data Chat can answer instantly, not a real report.
 * Non-blocking: the user can still run it as a report anyway.
 */
export function SimpleQueryHelper({ onAskInChat, onRunAnyway, dontShowAgain, onDontShowAgainChange }: Props) {
  const { t } = useLanguage();
  return (
    <div className={styles.card}>
      <div className={styles.icon}>💡</div>
      <div className={styles.body}>
        <div className={styles.title}>{t('intel.helper.title')}</div>
        <div className={styles.desc}>{t('intel.helper.desc')}</div>
        <div className={styles.actions}>
          <button className={styles.askBtn} onClick={onAskInChat}>
            <span>✦ {t('intel.helper.ask')}</span>
            <span className={styles.askBtnSub}>{t('intel.helper.askSub')}</span>
          </button>
          <button className={styles.runAnywayBtn} onClick={onRunAnyway}>{t('intel.helper.runAnyway')}</button>
          <label className={styles.dontShow}>
            <input type="checkbox" checked={dontShowAgain} onChange={e => onDontShowAgainChange(e.target.checked)} />
            {t('intel.helper.dontShow')}
          </label>
        </div>
      </div>
    </div>
  );
}
