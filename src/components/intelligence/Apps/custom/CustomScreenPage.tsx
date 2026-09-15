/**
 * A published custom screen's own page — rendered natively inside the
 * shell exactly like Procurement: client branding, both locales, RTL, no
 * iframe, because there is no untrusted code to contain.
 */
import { useEffect, useRef, useState } from 'react';
import styles from './CustomScreenPage.module.css';
import { ottoService } from '../../../../services/ottoService';
import { ScreenRenderer } from './ScreenRenderer';
import { ScreenIcon } from './ScreenIcon';
import { Skeleton } from '../../Insights/Skeleton';
import { useLanguage } from '../../../../context/LanguageContext';
import type { OttoScreen, ScreenDataPayload } from '../../../../types/otto';

interface Props {
  datasetId: string;
  screenId: string;
  baseURL?: string;
}

export function CustomScreenPage({ datasetId, screenId, baseURL }: Props) {
  const { t, language } = useLanguage();
  const [screen, setScreen] = useState<OttoScreen | null>(null);
  const [data, setData] = useState<ScreenDataPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // StrictMode double-invoke: dedupe by key via a ref, never a cancelled flag.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    const key = `${datasetId}/${screenId}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setScreen(null);
    setData(null);
    setError(null);
    Promise.all([
      ottoService.getScreen(datasetId, screenId, baseURL),
      ottoService.getData(datasetId, screenId, baseURL),
    ])
      .then(([s, d]) => { setScreen(s); setData(d); })
      .catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, [datasetId, screenId, baseURL]);

  const lang = language === 'he' ? 'he' : 'en';
  const locale = lang === 'he' ? 'he-IL' : 'en-GB';

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

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <span className={styles.headIcon}><ScreenIcon name={screen.icon || 'grid'} size={20} /></span>
        <div>
          <h1 className={styles.title}>{screen.title[lang] || screen.title.en}</h1>
          {screen.summary && <p className={styles.summary}>{screen.summary[lang] || screen.summary.en}</p>}
        </div>
        {stamp && (
          <span className={styles.stamp}>{t('apps.researchedAt').replace('{time}', stamp)}</span>
        )}
      </div>
      <ScreenRenderer spec={screen.screenSpec} data={data} />
    </div>
  );
}
