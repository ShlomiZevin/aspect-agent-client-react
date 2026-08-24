import { useState } from 'react';
import styles from './DataHealthModal.module.css';
import { DataHealthModal } from './DataHealthModal';
import { useLanguage } from '../../../context/LanguageContext';

/**
 * The small database glyph that sits beside the Last sync label. Kept as its
 * own component so the status bar only has to render one element, and so the
 * modal is not mounted until it is actually opened.
 */
export function DataHealthTrigger({ baseURL, schema }: { baseURL: string; schema: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
        aria-label={t('dataHealth.title')}
        title={t('dataHealth.title')}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <ellipse cx="8" cy="3.5" rx="5.5" ry="2.2" />
          <path d="M2.5 3.5v9c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v-9" />
          <path d="M2.5 8c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2" />
        </svg>
      </button>
      {open && <DataHealthModal baseURL={baseURL} schema={schema} onClose={() => setOpen(false)} />}
    </>
  );
}
