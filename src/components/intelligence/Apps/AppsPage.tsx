import { useEffect, useState } from 'react';
import styles from './AppsPage.module.css';
import { AppGlyph } from './AppIcon';
import { appsService } from '../../../services/appsService';
import type { AppsResponse } from '../../../types/apps';
import { useLanguage } from '../../../context/LanguageContext';
import { Skeleton } from '../Insights/Skeleton';

interface Props {
  datasetId: string;
  baseURL?: string;
  onOpenApp: (appId: string) => void;
}

/** "Researched 02:57" — the clock time of the run that built what these apps read. */
function researchedLabel(iso: string | null, locale: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** 5,374 → "5.4K". The badge has room for four characters, not five digits. */
function badgeLabel(n: number) {
  if (n < 1000) return String(n);
  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
}

export function AppsPage({ datasetId, baseURL, onOpenApp }: Props) {
  const { t, language } = useLanguage();
  const [loaded, setLoaded] = useState<AppsResponse | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);

  // Two requests, because they cost wildly different amounts. The shelf itself
  // is a module lookup and answers in a blink; the badge is a full pass over
  // every tracked SKU and takes over a second. Asking for both at once meant
  // the page sat empty for that whole second waiting on a number that goes in
  // the corner of an icon.
  //
  // So the icons arrive first and the badges land on them when they are ready.
  // A tile with no badge yet is not wrong - it is a tile whose count is still
  // being counted - whereas no tiles at all reads as "you have no apps".
  useEffect(() => {
    let alive = true;
    appsService.list(datasetId, false, baseURL)
      .then(r => {
        if (!alive) return;
        setLoaded(r);
        return appsService.list(datasetId, true, baseURL)
          .then(full => { if (alive) setLoaded(full); })
          // The shelf is already on screen; a failed headline costs a badge,
          // not the page.
          .catch(() => {});
      })
      .catch(() => { if (alive) setFailedFor(datasetId); });
    return () => { alive = false; };
  }, [datasetId, baseURL]);

  // Derived rather than cleared in the effect. Resetting to null on the way in
  // costs an extra render pass and, worse, is a synchronous setState inside an
  // effect; tagging what we hold with the dataset it came from answers the same
  // question — "is this the shelf we are looking at?" — during render.
  const data = loaded?.datasetId === datasetId ? loaded : null;
  const failed = failedFor === datasetId;

  const locale = language === 'he' ? 'he-IL' : 'en-GB';

  return (
    <div className={styles.page} dir={language === 'he' ? 'rtl' : 'ltr'}>
      <h1 className={styles.title}>{t('apps.title')}</h1>
      <p className={styles.lede}>{t('apps.lede')}</p>

      {failed && <div className={styles.empty}>{t('apps.failed')}</div>}

      {/* The shelf's own shape while it loads. Four tiles because that is what
          this account has; a spinner in the middle of the page would say
          nothing about what is coming, and an empty grid - which is what this
          page did before - reads as "you have no apps". */}
      {!failed && !data && (
        <div className={styles.grid} aria-busy="true" aria-label={t('apps.loading')}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={styles.app}>
              <Skeleton width={72} height={72} radius={18} />
              <span className={styles.skelLines}>
                <Skeleton width={62} height={10} radius={4} />
                <Skeleton width={44} height={8} radius={4} />
              </span>
            </div>
          ))}
        </div>
      )}

      {!failed && data && data.apps.length === 0 && (
        <div className={styles.empty}>{t('apps.none')}</div>
      )}

      <div className={styles.grid}>
        {data?.apps.map(app => {
          const stamp = researchedLabel(app.researchedAt, locale);
          const badge = app.headline?.badge ?? 0;
          return (
            <button
              key={app.id}
              type="button"
              className={`${styles.app} ${styles.live}`}
              onClick={() => onOpenApp(app.id)}
            >
              <span className={`${styles.tile} ${styles.tileLive}`}>
                <AppGlyph icon={app.icon} />
                {/* Only when there is something to act on. A badge reading 0 is
                    an alarm about nothing. */}
                {badge > 0 && <span className={styles.badge}>{badgeLabel(badge)}</span>}
              </span>
              <span>
                <span className={styles.name}>{app.name[language === 'he' ? 'he' : 'en']}</span>
                {stamp && (
                  <span className={styles.sub} style={{ display: 'block' }}>
                    {t('apps.researchedAt').replace('{time}', stamp)}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {data?.planned.map(app => (
          // Not a button: there is nothing behind it. Rendering one that does
          // nothing when clicked is a worse promise than a plain label.
          <div key={app.id} className={styles.app} title={app.blurb?.[language === 'he' ? 'he' : 'en'] ?? undefined}>
            <span className={`${styles.tile} ${styles.tileSoon}`}>
              <AppGlyph icon={app.icon} color="#8a90a3" />
            </span>
            <span>
              <span className={`${styles.name} ${styles.nameSoon}`}>{app.name[language === 'he' ? 'he' : 'en']}</span>
              <span className={`${styles.sub} ${styles.subSoon}`} style={{ display: 'block' }}>{t('apps.comingSoon')}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
