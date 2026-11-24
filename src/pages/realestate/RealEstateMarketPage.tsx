/**
 * "רוכשים ושיווק" — the topics on the developer's own list, as charts: who the
 * buyers are (purpose, age, income decile, first/second home, gender,
 * profession), which lead sources pay off, how each project sells, demand vs
 * free stock by size, and which benefit closes each segment.
 * Data: /api/realestate/market (deterministic, from the dataset's views).
 */
import { useEffect, useState } from 'react';
import { useDocumentMeta } from '../../hooks';
import { realestateService, type MarketData, type Share } from '../../services/realestateService';
import { useRealEstateChat } from './chatContext';
import { shekels } from './shared';
import { RealEstateTopbar } from './RealEstateTopbar';
import { Icon } from './ui';
import styles from './RealEstateMarketPage.module.css';

/** One horizontal bar per row; the bar is the share (or the value against the largest). */
function BarList({ rows }: { rows: { label: string; value: string; pct: number; tone?: 'good' | 'bad' }[] }) {
  return (
    <div className={styles.bars}>
      {rows.map(r => (
        <div key={r.label} className={styles.barRow}>
          <span className={styles.barLabel}>{r.label}</span>
          <span className={styles.barTrack}><i className={r.tone ? styles[r.tone] : ''} style={{ width: `${Math.max(2, Math.min(100, r.pct))}%` }} /></span>
          <span className={styles.barValue}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const shareRows = (list: Share[]) => {
  const max = Math.max(...list.map(s => s.pct), 1);
  return list.map(s => ({ label: s.label, value: `${s.pct}%`, pct: (100 * s.pct) / max }));
};

function Card({ title, note, ask, children }: { title: string; note?: string; ask?: string; children: React.ReactNode }) {
  const { openChat } = useRealEstateChat();
  return (
    <section className={styles.card}>
      <header>
        <h2>{title}</h2>
        {ask && (
          <button type="button" className={styles.askLink} onClick={() => openChat(ask)}>
            <Icon name="sparkle" size={14} /> שאל את ה-AI
          </button>
        )}
      </header>
      {note && <p className={styles.note}>{note}</p>}
      {children}
    </section>
  );
}

export function RealEstateMarketPage() {
  useDocumentMeta({ title: 'אופק יזמות — רוכשים ושיווק', favicon: '/img/realestate-logo.svg', description: 'Buyers and marketing for Ofek Development' });
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    realestateService.getMarket().then(d => { if (alive) setData(d); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const b = data?.buyers;
  const topPurpose = b?.purpose[0];
  const firstHome = b?.homes.find(h => h.label === 'דירה ראשונה');
  const withCost = data?.sources.filter(s => s.costPerDeal != null) ?? [];
  const maxCost = Math.max(...withCost.map(s => s.costPerDeal as number), 1);
  const maxDemand = Math.max(...(data?.rooms.map(r => Math.max(r.demand, r.freeUnits)) ?? [1]), 1);

  return (
    <div className={styles.page} dir="rtl">
      <RealEstateTopbar active="market" />
      <main className={styles.main}>
        <div className={styles.head}>
          <h1>רוכשים ושיווק</h1>
          <p>מי קונה, מאיפה הם מגיעים, מה הם מחפשים — ואיזו הטבה סוגרת כל סגמנט. מבוסס על כל העסקאות והלידים.</p>
        </div>
        {error && <div className={styles.error}>לא הצלחתי לטעון את הנתונים: {error}</div>}
        {!data && !error && <div className={styles.loading}>טוען…</div>}

        {data && b && (
          <>
            <div className={styles.kpis}>
              {topPurpose && <div className={styles.kpi}><strong>{topPurpose.pct}%</strong><small>מהרוכשים — {topPurpose.label}</small></div>}
              {firstHome && <div className={styles.kpi}><strong>{firstHome.pct}%</strong><small>קונים דירה ראשונה</small></div>}
              {withCost[0] && <div className={styles.kpi}><strong>{shekels(withCost[0].costPerDeal as number)}</strong><small>עלות לעסקה — {withCost[0].source}, המקור הזול</small></div>}
              {data.segments[0] && <div className={styles.kpi}><strong>{data.segments.length}</strong><small>סגמנטים — לכל אחד הטבה אחרת שסוגרת</small></div>}
            </div>

            <h3 className={styles.groupTitle}>מי הרוכשים</h3>
            <div className={styles.grid3}>
              <Card title="מטרת הרכישה" ask="מי הרוכשים שלנו לפי מטרת רכישה, ומה מאפיין כל סגמנט?">
                <BarList rows={shareRows(b.purpose)} />
              </Card>
              <Card title="גיל">
                <BarList rows={shareRows(b.age)} />
              </Card>
              <Card title="עשירון הכנסה">
                <BarList rows={shareRows(b.decile)} />
              </Card>
              <Card title="דירה ראשונה או נוספת">
                <BarList rows={shareRows(b.homes)} />
              </Card>
              <Card title="מגדר הרוכש הרשום">
                <BarList rows={shareRows(b.gender)} />
              </Card>
              <Card title="מקצועות נפוצים" note="אחוז מכלל הרוכשים">
                <BarList rows={shareRows(b.profession)} />
              </Card>
            </div>

            <h3 className={styles.groupTitle}>מקורות לידים</h3>
            <div className={styles.grid2}>
              <Card title="עלות לעסקה חתומה לפי מקור" note="מהזול ליקר — כל הוצאות השיווק חלקי העסקאות שנחתמו" ask="אילו מקורות לידים הכי משתלמים, ולאן להעביר את תקציב השיווק?">
                <BarList rows={withCost.map(s => ({ label: s.source, value: shekels(s.costPerDeal as number), pct: (100 * (s.costPerDeal as number)) / maxCost, tone: (s.costPerDeal as number) <= 10000 ? 'good' : (s.costPerDeal as number) >= 40000 ? 'bad' : undefined }))} />
              </Card>
              <Card title="שיעור המרה מליד לעסקה" note="לידים שחתמו חוזה מתוך כל הלידים מהמקור">
                <BarList rows={[...data.sources].sort((x, y) => y.conversionPct - x.conversionPct).map(s => ({ label: s.source, value: `${s.conversionPct.toFixed(1)}%`, pct: (100 * s.conversionPct) / Math.max(...data.sources.map(z => z.conversionPct)) }))} />
              </Card>
            </div>

            <h3 className={styles.groupTitle}>אזורים, גודל וביקוש</h3>
            <div className={styles.grid2}>
              <Card title="הפרויקטים לפי אזור" ask="מתי כל פרויקט יימכר עד הסוף בקצב הנוכחי, ואיפה יש סיכון?">
                <table className={styles.table}>
                  <thead><tr><th>פרויקט</th><th>אזור</th><th>נמכר</th><th>קצב בחודש</th><th>מחיר למ״ר</th></tr></thead>
                  <tbody>
                    {data.projects.map(p => (
                      <tr key={p.name}><td><strong>{p.name}</strong><small>{p.city}</small></td><td>{p.region}</td><td>{Math.round(p.pctSold)}%</td><td>{p.monthlyPace}</td><td>{shekels(p.pricePerSqm)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card title="ביקוש מול מלאי לפי מספר חדרים" note="לידים בחצי השנה האחרונה מול דירות פנויות היום" ask="איזה גודל דירה מבוקש ואין לנו מלאי, ואיזה גודל עודף?">
                <div className={styles.pairs}>
                  {data.rooms.map(r => (
                    <div key={r.rooms} className={styles.pair}>
                      <span className={styles.pairLabel}>{r.rooms} חד׳ <small>~{r.avgSqm} מ״ר</small></span>
                      <div className={styles.pairBars}>
                        <span className={styles.demand} style={{ width: `${Math.max(1, (100 * r.demand) / maxDemand)}%` }}>{r.demand} לידים</span>
                        <span className={styles.supply} style={{ width: `${Math.max(1, (100 * r.freeUnits) / maxDemand)}%` }}>{r.freeUnits} פנויות</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <h3 className={styles.groupTitle}>הטבה לכל סגמנט</h3>
            <Card title="איזו הטבה סוגרת כל סגמנט" note="שיעור הסגירה במשא ומתן שהסתיים, לפי ההטבה שהוצעה" ask="איזו הטבה לתת לכל סגמנט, ומה זה שווה בעסקאות?">
              <div className={styles.segments}>
                {data.segments.map(s => (
                  <div key={s.segment} className={styles.segment}>
                    <strong>{s.segment}</strong>
                    <span className={styles.best}><Icon name="trendUp" size={15} /> {s.best} — {s.bestRate}%</span>
                    <span className={styles.worst}><Icon name="trendDown" size={15} /> {s.worst} — {s.worstRate}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
