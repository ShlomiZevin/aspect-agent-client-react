/**
 * "היועץ החכם שלי" — the real-estate demo's AI advisor morning brief (design C,
 * GPT Image 2.6, picked 2026-11-24): who to call today, which apartments are
 * stuck and why, where discounts leak money. Every figure and sentence comes
 * from /api/realestate/brief; the actions open the chat modal with the
 * question, or the live board on the apartment.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentMeta } from '../../hooks';
import { realestateService, type BriefData } from '../../services/realestateService';
import { greeting, buildingLetter, BOARD_PATH } from './shared';
import { useRealEstateChat } from './chatContext';
import { Icon } from './ui';
import { RealEstateTopbar } from './RealEstateTopbar';
import styles from './RealEstateBriefPage.module.css';

export function RealEstateBriefPage() {
  useDocumentMeta({ title: 'אופק יזמות — היועץ החכם שלי', favicon: '/img/realestate-logo.svg', description: 'AI sales advisor for Ofek Development' });
  const navigate = useNavigate();
  const { openChat } = useRealEstateChat();
  const [data, setData] = useState<BriefData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    realestateService.getBrief().then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  // The KPI cards lead to the section that explains them.
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });


  return (
    <div className={styles.page} dir="rtl">
      <RealEstateTopbar active="brief" />

      <main className={styles.main}>
        <header className={styles.hero}>
          <div className={styles.heroImage} />
          <div className={styles.dateChip}>
            <span className={styles.dateRow}><Icon name="calendar" size={16} /> {data?.date || ''}</span>
            <span className={styles.scopeRow}>תמונת מצב: כלל הפרויקטים</span>
          </div>
          <div className={styles.heroText}>
            <div className={styles.titleRow}>
              <span className={styles.sparkleBadge}><Icon name="sparkle" size={30} stroke={1.4} /></span>
              <div>
                <h1 className={styles.title}>{greeting()}.</h1>
                <p className={styles.subtitle}>הנה מה שחשוב לך היום במכירות.</p>
              </div>
            </div>
            <p className={styles.intro}>{data ? data.intro : (error ? `לא הצלחתי לטעון את הנתונים: ${error}` : 'עובר על הלידים, הדירות והעסקאות…')}</p>
          </div>

          {data && (
            <div className={styles.kpis}>
              <button type="button" className={styles.kpi} onClick={() => goTo('brief-calls')}>
                <span className={`${styles.kpiIcon} ${styles.kpiGreen}`}><Icon name="phone" size={22} /></span>
                <div><strong>{data.kpis.calls.count} שיחות קריטיות להיום</strong><small>{data.kpis.calls.sub}</small></div>
              </button>
              <button type="button" className={styles.kpi} onClick={() => goTo('brief-stuck')}>
                <span className={`${styles.kpiIcon} ${styles.kpiSand}`}><Icon name="home" size={22} /></span>
                <div><strong>{data.kpis.stuck.count} דירות תקועות</strong><small>{data.kpis.stuck.sub}</small></div>
              </button>
              <button type="button" className={styles.kpi} onClick={() => goTo('brief-leakage')}>
                <span className={`${styles.kpiIcon} ${styles.kpiRed}`}><Icon name="percent" size={22} /></span>
                <div><strong>זליגת הנחות: {data.kpis.leakage.amount}</strong><small>{data.kpis.leakage.sub}</small></div>
              </button>
            </div>
          )}
        </header>

        {data && (
          <div className={styles.sections}>
            <section id="brief-calls" className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.num}>1</span>
                <div><h2>למי כדאי להתקשר היום?</h2><p>{data.calls.length} לידים בשלב מתקדם שאף אחד לא דיבר איתם כבר כמה ימים.</p></div>
              </div>
              <div className={styles.rows}>
                {data.calls.map(c => (
                  <div key={c.leadId} className={`${styles.row} ${styles.callRow}`}>
                    <div className={styles.who}>
                      <span className={styles.avatar}><Icon name="user" size={18} /></span>
                      <div><strong>{c.name}</strong><small>{c.project} · {c.rep}</small></div>
                    </div>
                    <div className={styles.reason}>{c.reason}<span className={styles.silence}>ללא קשר {c.daysWithoutContact} ימים</span></div>
                    <div className={styles.score}>ציון ליד <span className={styles.scoreChip}>{c.score}</span></div>
                    <button type="button" className={styles.darkBtn} onClick={() => openChat(`תכין אותי לשיחה עם ${c.name} מ${c.project}: מי זה, מה הוא מחפש, מה התקציב, ואיזו הטבה הכי סוגרת את הסגמנט שלו`)}>
                      <Icon name="phone" size={15} /> הכן שיחה
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section id="brief-stuck" className={styles.section}>
              <div className={styles.sectionHead}>
                <span className={styles.num}>2</span>
                <div><h2>אילו דירות תקועות — ולמה?</h2><p>הדירות שנמצאות הכי הרבה זמן על המדף, עם הסיבה המרכזית והמלצה מה לעשות.</p></div>
              </div>
              <div className={styles.rows}>
                {data.stuck.map(s => (
                  <div key={s.unitId} className={`${styles.row} ${styles.stuckRow}`}>
                    <div className={styles.who}>
                      <img className={styles.thumb} src={`/img/realestate/p${s.projectId}.jpg`} alt="" />
                      <div><strong>דירה {s.number}, בניין {buildingLetter(s.building)}</strong><small>{s.project} · {s.rooms} חד׳ · קומה {s.floor} · {s.daysOnMarket} ימים</small></div>
                    </div>
                    <span className={styles.reasonChip}>{s.reason}</span>
                    <div className={styles.action}>{s.action}</div>
                    <button type="button" className={styles.outlineBtn} onClick={() => navigate(`${BOARD_PATH}?project=${s.projectId}&unit=${s.unitId}`)}>
                      ללוח הדירות <Icon name="chevronLeft" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section id="brief-leakage" className={`${styles.section} ${styles.leakSection}`}>
              <div className={styles.sectionHead}>
                <span className={styles.num}>3</span>
                <div><h2>איפה ההנחות "זולגות" כסף?</h2><p>תבנית הנחות שמתרחבת בשקט, ומשחקת את שורת הרווח.</p></div>
              </div>
              <ul className={styles.bullets}>{data.leakage.bullets.map(b => <li key={b}>{b}</li>)}</ul>
              <div className={styles.leakCard}>
                <Icon name="trendDown" size={26} className={styles.leakIcon} />
                <strong>{data.leakage.amount}</strong>
                <small>{data.leakage.amountSub}</small>
              </div>
              <button type="button" className={styles.darkBtnTall} onClick={() => openChat('איזה איש מכירות נותן הכי הרבה הנחות, כמה זה עולה לנו, ומה הייתה התקרה הנכונה?')}>
                לצפייה בפרטים ולהמלצות תיקון <Icon name="chevronLeft" size={14} />
              </button>
            </section>
          </div>
        )}

      </main>
    </div>
  );
}
