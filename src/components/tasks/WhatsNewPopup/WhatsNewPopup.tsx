import { useEffect, useMemo, useState } from 'react';
import type { WhatsNewItem } from '../../../types/task';
import { useWhatsNew } from './useWhatsNew';
import styles from './WhatsNewPopup.module.css';

/** How long the "incoming update" message stays before shrinking to the corner badge. */
const INCOMING_MS = 20 * 1000;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Release day label, in Hebrew — the grouping date is when the task was released (deployedAt). */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  return d.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
}

function countLabel(n: number): string {
  return n === 1 ? 'עדכון חדש אחד' : `${n} עדכונים חדשים`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/**
 * Global What's New: the popup, the "incoming update" message, and the corner badge.
 * Mounted once in App. `auto` (Builder V2 pages) turns on everything that appears by
 * itself; elsewhere only the task board's What's New button opens it. Hebrew, RTL.
 */
export function WhatsNewPopup({ auto }: { auto: boolean }) {
  const { items, incoming, isOpen, open, close, gotIt, dismissIncoming } = useWhatsNew(auto);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Items arrive newest first, so consecutive grouping keeps the days in order.
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: WhatsNewItem[] }[] = [];
    for (const item of items) {
      const key = dayKey(item.deployedAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(item);
      else out.push({ key, label: dayLabel(item.deployedAt), items: [item] });
    }
    return out;
  }, [items]);

  // Only announce what is still unseen
  const freshItems = useMemo(
    () => incoming.filter(i => items.some(x => x.id === i.id)),
    [incoming, items]
  );

  // The incoming message shrinks to the badge after a while; the badge stays until "Got it".
  useEffect(() => {
    if (freshItems.length === 0) return;
    const timer = setTimeout(dismissIncoming, INCOMING_MS);
    return () => clearTimeout(timer);
  }, [freshItems, dismissIncoming]);

  if (!isOpen) {
    if (!auto || items.length === 0) return null;
    return (
      <div className={styles.corner} dir="rtl" lang="he">
        {freshItems.length > 0 ? (
          <div className={styles.toast} role="status" aria-live="polite">
            <div className={styles.toastHeader}>
              <span className={styles.toastIcon} aria-hidden="true">🎁</span>
              <span className={styles.toastTitle}>
                {freshItems.length === 1 ? 'עדכון חדש באתר' : `${freshItems.length} עדכונים חדשים באתר`}
              </span>
              <button type="button" className={styles.toastClose} onClick={dismissIncoming} aria-label="סגירה">×</button>
            </div>
            <div className={styles.toastBody}>
              {freshItems[0].whatsNewHeadline || freshItems[0].title}
            </div>
            {freshItems.length > 1 && (
              <div className={styles.toastMore}>ועוד {freshItems.length - 1}</div>
            )}
            <button type="button" className={styles.toastAction} onClick={open}>לצפייה</button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.badgeBtn}
            onClick={open}
            title="מה חדש"
            aria-label={`מה חדש — ${countLabel(items.length)}`}
          >
            <span className={styles.badgeIcon} aria-hidden="true">🎁</span>
            <span className={styles.badgeCount}>{items.length}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={close} dir="rtl" lang="he">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true">🎁</span>
          <div className={styles.headerText}>
            <h3 id="whats-new-title" className={styles.title}>מה חדש</h3>
            <div className={styles.subtitle}>
              {items.length > 0 ? `${countLabel(items.length)} מאז הביקור האחרון` : 'מאז הביקור האחרון'}
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="סגירה">×</button>
        </div>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon} aria-hidden="true">✨</span>
              אין עדכונים חדשים. הכול מעודכן.
            </div>
          ) : (
            groups.map(group => (
              <section key={group.key} className={styles.group}>
                <div className={styles.dayLabel}>{group.label}</div>
                {group.items.map(item => {
                  const expanded = expandedId === item.id;
                  return (
                    <div key={item.id} className={`${styles.item} ${expanded ? styles.itemOpen : ''}`}>
                      <button
                        type="button"
                        className={styles.itemRow}
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        aria-expanded={expanded}
                      >
                        <span className={styles.dot} aria-hidden="true" />
                        <span className={styles.itemText}>{item.whatsNewHeadline || item.title}</span>
                        <Chevron open={expanded} />
                      </button>
                      {expanded && (
                        <div className={styles.details}>
                          {item.whatChanged ? (
                            <div className={styles.whatChanged}>{item.whatChanged}</div>
                          ) : (
                            <div className={styles.noDetails}>עדיין אין פירוט לעדכון הזה.</div>
                          )}
                          <a
                            className={styles.openTask}
                            href={`/tasks/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            לפתיחת המשימה <bdi>#{item.id}</bdi>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.gotItBtn} onClick={items.length > 0 ? gotIt : close}>
            הבנתי
          </button>
        </div>
      </div>
    </div>
  );
}
