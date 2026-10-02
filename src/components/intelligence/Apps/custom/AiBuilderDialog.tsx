/**
 * "Build with your own AI" (task #96) — hands the person their personal link
 * to the door a Claude Code / Codex session reads (server:
 * otto/routes/mcp.routes.js). The link is minted per viewer, so whatever their
 * AI saves lands as THEIR draft on this shelf.
 *
 * One decision for the person, one control: copy the prompt. How the door
 * works (tokens, spec, probes) stays behind the scenes.
 */
import { useEffect, useState } from 'react';
import styles from './AiBuilderDialog.module.css';
import { ottoService } from '../../../../services/ottoService';
import { useLanguage } from '../../../../context/LanguageContext';

interface Props {
  datasetId: string;
  viewerId: string | null;
  baseURL?: string;
  onClose: () => void;
}

export function AiBuilderDialog({ datasetId, viewerId, baseURL, onClose }: Props) {
  const { t, language } = useLanguage();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<'prompt' | 'link' | null>(null);

  useEffect(() => {
    let alive = true;
    ottoService.aiLink(datasetId, viewerId, baseURL)
      .then(u => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [datasetId, viewerId, baseURL]);

  const prompt = url ? t('aiBuilder.prompt').replace('{url}', url) : '';

  const copy = (what: 'prompt' | 'link', text: string) => {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(what); setTimeout(() => setCopied(null), 1800); })
      .catch(() => {});
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.dialog} dir={language === 'he' ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}>
        <p className={styles.title}>{t('aiBuilder.title')}</p>
        <p className={styles.text}>{t('aiBuilder.text')}</p>

        <ol className={styles.steps}>
          <li>{t('aiBuilder.step1')}</li>
          <li>{t('aiBuilder.step2')}</li>
          <li>{t('aiBuilder.step3')}</li>
        </ol>

        {failed && <p className={styles.text}>{t('aiBuilder.failed')}</p>}
        {!failed && !url && <p className={styles.text}>{t('aiBuilder.loading')}</p>}

        {url && (
          <>
            <span className={styles.label}>{t('aiBuilder.promptLabel')}</span>
            <div className={styles.copyRow}>
              <pre className={styles.code}>{prompt}</pre>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => copy('prompt', prompt)}>
                {copied === 'prompt' ? t('aiBuilder.copied') : t('aiBuilder.copy')}
              </button>
            </div>

            <span className={styles.label}>{t('aiBuilder.linkLabel')}</span>
            <div className={styles.copyRow}>
              <pre className={styles.code}>{url}</pre>
              <button type="button" className={styles.btn} onClick={() => copy('link', url)}>
                {copied === 'link' ? t('aiBuilder.copied') : t('aiBuilder.copy')}
              </button>
            </div>

            <p className={styles.warn}>{t('aiBuilder.private')}</p>
          </>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onClose}>{t('aiBuilder.close')}</button>
        </div>
      </div>
    </div>
  );
}
