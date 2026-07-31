import { useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './SqlViewerModal.module.css';

interface Props {
  prompt: string;
  dataQuestion: string;
  sql: string;
  onClose: () => void;
}

/**
 * Proof this insight is a real computed result, not a fabricated number:
 * shows the exact investigation prompt -> derived data question -> SQL that
 * actually ran against the dataset (see investigation.service.js's `evidence`
 * field). Bespoke modal (not the app-wide Modal component) to stay
 * self-contained in Aspect Intelligence's own design system, same as every
 * other component in this feature.
 */
export function SqlViewerModal({ prompt, dataQuestion, sql, onClose }: Props) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.headerText}>
            <div className={styles.title}>{t('intel.sql.title')}</div>
            <div className={styles.subtitle}>{t('intel.sql.subtitle')}</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>{t('intel.sql.prompt')}</div>
            <div className={styles.fieldValue}>{prompt}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabel}>{t('intel.sql.dataQuestion')}</div>
            <div className={styles.fieldValue}>{dataQuestion}</div>
          </div>
          <div className={styles.field}>
            <div className={styles.fieldLabelRow}>
              <div className={styles.fieldLabel}>{t('intel.sql.executed')}</div>
              <button className={styles.copyBtn} onClick={copy}>{copied ? t('intel.sql.copied') : t('intel.sql.copy')}</button>
            </div>
            <pre className={styles.sqlBlock}>{sql}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
