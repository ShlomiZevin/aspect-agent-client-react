/**
 * A published custom app's own page — rendered natively inside the shell
 * exactly like Procurement: client branding, both locales, RTL, no iframe,
 * because there is no untrusted code to contain.
 *
 * "Edit app" is the one action a published app offers: after a warning
 * (the app drops back to draft state until republished) it unpublishes and
 * hands the same URL over to the builder — Cancel changes there restores
 * what was published.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './CustomScreenPage.module.css';
import builderStyles from './OttoBuilder.module.css';
import { ottoService } from '../../../../services/ottoService';
import { ScreenRenderer } from './ScreenRenderer';
import { ScreenIcon } from './ScreenIcon';
import { Skeleton } from '../../Insights/Skeleton';
import { useLanguage } from '../../../../context/LanguageContext';
import { useUserContext } from '../../../../context/UserContext';
import type { OttoScreen, ScreenDataPayload } from '../../../../types/otto';

interface Props {
  datasetId: string;
  screenId: string;
  baseURL?: string;
  /** After a successful unpublish — the router refetches and the same URL
   *  renders the builder. */
  onUnpublished?: () => void;
  /** The shell's breadcrumb leaf — the app's own name, no Draft prefix. */
  onCrumb?: (crumb: string) => void;
}

export function CustomScreenPage({ datasetId, screenId, baseURL, onUnpublished, onCrumb }: Props) {
  const { t, language } = useLanguage();
  const { userId } = useUserContext();
  const [screen, setScreen] = useState<OttoScreen | null>(null);
  const [data, setData] = useState<ScreenDataPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmEdit, setConfirmEdit] = useState(false);
  // StrictMode double-invoke: dedupe by key via a ref, never a cancelled flag.
  const loadedFor = useRef<string | null>(null);

  const lang = language === 'he' ? 'he' : 'en';
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';

  useEffect(() => {
    const key = `${datasetId}/${screenId}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setScreen(null);
    setData(null);
    setError(null);
    Promise.all([
      ottoService.getScreen(datasetId, screenId, userId, baseURL),
      ottoService.getData(datasetId, screenId, userId, baseURL),
    ])
      .then(([s, d]) => { setScreen(s); setData(d); })
      .catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, [datasetId, screenId, baseURL, userId]);

  useEffect(() => {
    if (screen) onCrumb?.(screen.title[lang] || screen.title.en);
  }, [screen, lang, onCrumb]);

  const startEdit = useCallback(async () => {
    setConfirmEdit(false);
    try {
      await ottoService.unpublish(datasetId, screenId, userId, baseURL);
      onUnpublished?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('otto.error.editFailed'));
    }
  }, [datasetId, screenId, baseURL, userId, onUnpublished, t]);

  if (error) {
    return <div className={styles.error}>{t('otto.screen.failed')}</div>;
  }
  if (!screen || !data || !screen.screenSpec) {
    return (
      <div className={styles.page}>
        <Skeleton width={220} height={22} radius={6} />
        <Skeleton width={340} height={12} radius={4} />
        <Skeleton width={0} height={220} radius={14} />
      </div>
    );
  }

  const stamp = data.dataThrough
    ? new Date(data.dataThrough).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : null;
  // Only the creator can go back into Otto and edit a published app (task
  // #92) — a screen from before per-creator scoping has no createdBy and
  // stays editable by anyone, same carve-out as the server's canEdit.
  const canEdit = !screen.createdBy || screen.createdBy === userId;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <span className={styles.headIcon}><ScreenIcon name={screen.icon || 'grid'} size={20} /></span>
        <div>
          <h1 className={styles.title}>{screen.title[lang] || screen.title.en}</h1>
          {screen.summary && <p className={styles.summary}>{screen.summary[lang] || screen.summary.en}</p>}
        </div>
        <div className={styles.headActions}>
          {stamp && (
            <span className={styles.stamp}>{t('apps.researchedAt').replace('{time}', stamp)}</span>
          )}
          {canEdit && (
            <button type="button" className={styles.editBtn} onClick={() => setConfirmEdit(true)}>
              ✎ {t('otto.editApp')}
            </button>
          )}
        </div>
      </div>
      <ScreenRenderer spec={screen.screenSpec} data={data} />

      {confirmEdit && (
        <div className={builderStyles.overlay} role="dialog" aria-modal="true">
          <div className={builderStyles.dialog}>
            <p className={builderStyles.dialogTitle}>{t('otto.confirm.editTitle')}</p>
            <p className={builderStyles.dialogText}>{t('otto.confirm.editText')}</p>
            <div className={builderStyles.dialogActions}>
              <button type="button" className={`${builderStyles.btn} ${builderStyles.btnPrimary}`}
                onClick={() => void startEdit()}>
                {t('otto.confirm.editYes')}
              </button>
              <button type="button" className={builderStyles.btn} onClick={() => setConfirmEdit(false)}>
                {t('otto.confirm.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
