import styles from './ImportingBanner.module.css';
import { useLanguage } from '../../../context/LanguageContext';
import { useImportStatus } from '../../../hooks/useImportStatus';

interface ImportingBannerProps {
  baseURL: string;
  schema: string;
}

export function ImportingBanner({ baseURL, schema }: ImportingBannerProps) {
  const { t } = useLanguage();
  const isImporting = useImportStatus(baseURL, schema);

  if (!isImporting) return null;

  return (
    <div className={styles.bar}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>{t('importingBanner.message')}</span>
    </div>
  );
}
