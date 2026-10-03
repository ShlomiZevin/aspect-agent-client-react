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
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<'prompt' | 'link' | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    let alive = true;
    ottoService.aiLink(datasetId, viewerId, baseURL)
      .then(r => { if (alive) { setUrl(r.url); setShortUrl(r.shortUrl || r.url); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [datasetId, viewerId, baseURL]);

  const prompt = shortUrl ? t('aiBuilder.prompt').replace('{url}', shortUrl) : '';

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

        {/* One thing to do: copy, paste, talk. That is the whole flow in
            Claude Code / Codex / Cursor, which fetch and POST themselves.
            Web chats (ChatGPT, Claude.ai) can only READ a pasted link, so
            building there needs the link added once as a connector — kept
            behind one quiet line for whoever needs it, not in everyone's way. */}
        {failed && <p className={styles.text}>{t('aiBuilder.failed')}</p>}
        {!failed && !url && <p className={styles.text}>{t('aiBuilder.loading')}</p>}

        {url && (
          <>
            <div className={styles.copyRow}>
              <pre className={styles.code}>{prompt}</pre>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => copy('prompt', prompt)}>
                {copied === 'prompt' ? t('aiBuilder.copied') : t('aiBuilder.copy')}
              </button>
            </div>
            <p className={styles.warn}>{t('aiBuilder.private')}</p>

            <button type="button" className={styles.linkBtn} onClick={() => setShowChat(v => !v)} aria-expanded={showChat}>
              {t('aiBuilder.chatToggle')}
            </button>
            {showChat && (
              <div className={styles.chatBox}>
                <p className={styles.text}>{t('aiBuilder.chatExplain')}</p>
                <div className={styles.copyRow}>
                  <pre className={styles.code}>{url}</pre>
                  <button type="button" className={styles.btn} onClick={() => copy('link', url)}>
                    {copied === 'link' ? t('aiBuilder.copied') : t('aiBuilder.copy')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onClose}>{t('aiBuilder.close')}</button>
        </div>
      </div>
    </div>
  );
}
