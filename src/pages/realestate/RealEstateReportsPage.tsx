/**
 * "דוחות" — the Intelligence reports of the real-estate demo, inside the demo
 * and without a sign-in: /aspect/realestate/reports lists them,
 * /aspect/realestate/reports/:reportId opens one. Same reports the
 * Intelligence product shows (insights API, "system" user), drawn in the
 * demo's own look.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUserContext } from '../../context/UserContext';
import { useDocumentMeta } from '../../hooks';
import { realestateService, type ReportBlock, type ReportDetail, type ReportProgress, type ReportSummary } from '../../services/realestateService';
import { useRealEstateChat } from './chatContext';
import { REPORTS_PATH } from './shared';
import { RealEstateTopbar } from './RealEstateTopbar';
import { Icon } from './ui';
import styles from './RealEstateReportsPage.module.css';

// The reports carry English category names; the demo speaks Hebrew.
const CATEGORY_HE: Record<string, string> = { 'Margin alert': 'רווחיות', Trend: 'הזדמנות', Risk: 'סיכון', Inventory: 'מלאי ותמחור' };
const categoryHe = (label: string) => CATEGORY_HE[label] || 'תובנה';
const SCENARIO_CLASS: Record<string, string> = { current: 'scCurrent', good: 'scGood', neutral: 'scNeutral', negative: 'scBad' };

// Ready-made topics for a new report — questions that take a real investigation, not a quick lookup.
const REPORT_TOPICS = [
  'למה ההמרה בחיפה ירדה מאז מאי 2026, ומה צריך לשנות?',
  'אילו קמפיינים מחזירים את ההשקעה ואילו שורפים כסף?',
  'מתי כל פרויקט יימכר עד הסוף בקצב הנוכחי, ואיפה יש סיכון?',
  'מי הרוכשים שלנו — גיל, מקצוע, עשירון ומטרת הרכישה — ולמי כדאי לכוון?',
];
const STAGE_HE: Record<string, string> = { plan: 'מתכנן את הניתוח', query: 'שולף את הנתונים', aggregate: 'מסכם את התוצאות', synthesize: 'כותב את הדוח', verify: 'בודק את המספרים', done: 'הדוח מוכן' };

/** "דוח חדש": a topic or a typed question -> a real investigation (2-3 minutes) -> the new report. */
function NewReport({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = (text: string) => {
    const question = text.trim();
    if (!question || running) return;
    const jobId = crypto.randomUUID();
    setRunning(question); setError(null); setProgress(null);
    const poll = setInterval(() => {
      realestateService.getReportProgress(jobId).then(setProgress).catch(() => { /* not started yet */ });
    }, 1500);
    realestateService.createReport(question, userId, jobId)
      .then(id => navigate(`${REPORTS_PATH}/${id}`))
      .catch(e => { setError(e.message); setRunning(null); })
      .finally(() => clearInterval(poll));
  };

  if (running) {
    const pct = progress?.percent ?? 2;
    const eta = progress?.etaMs ? Math.max(5, Math.round(progress.etaMs / 1000)) : null;
    return (
      <section className={styles.newReport}>
        <h2><Icon name="sparkle" size={18} /> כותב דוח חדש</h2>
        <p className={styles.runningQ}>{running}</p>
        <div className={styles.progressTrack}><i style={{ width: `${pct}%` }} /></div>
        <p className={styles.progressText}>
          {STAGE_HE[progress?.stage || 'plan'] || 'עובד על זה'}… {pct}%{eta ? ` · עוד כ־${eta} שניות` : ''}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.newReport}>
      <h2><Icon name="sparkle" size={18} /> דוח חדש</h2>
      <p>בחרו נושא או כתבו שאלה — ה-AI יחקור את הנתונים ויכתוב דוח מלא תוך 2–3 דקות.</p>
      <div className={styles.topics}>
        {REPORT_TOPICS.map(t => <button key={t} type="button" onClick={() => start(t)}>{t}</button>)}
      </div>
      <form className={styles.newForm} onSubmit={e => { e.preventDefault(); start(prompt); }}>
        <input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="או כתבו שאלה משלכם, למשל: איזה איש מכירות סוגר הכי מהר?" />
        <button type="submit" disabled={!prompt.trim()}>צור דוח</button>
      </form>
      {error && <p className={styles.newError}>לא הצלחתי לכתוב את הדוח: {error}. נסו שוב או נושא אחר.</p>}
    </section>
  );
}

/**
 * The reports are written by a model and spell figures out in full ("₪12,770,955",
 * "2,034 דקות", "+3.03pp"). Shown to a developer, they read as the same figures
 * the brief and board round: ₪12.8M, 34 שעות, +3.03 נק׳.
 */
const toNum = (s: string) => Number(s.replace(/,/g, ''));
function say(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/₪\s?(\d{1,3}(?:,\d{3}){2,}|\d{7,})/g, (_, n) => `₪${(toNum(n) / 1e6).toFixed(1)}M`)
    .replace(/(\d{1,3}(?:,\d{3}){2,})\s?₪/g, (_, n) => `₪${(toNum(n) / 1e6).toFixed(1)}M`)
    .replace(/₪\s?(\d{2,3}),(\d{3})(?![\d,])/g, (_, a, b) => `₪${Math.round(toNum(a + b) / 1e3)}K`)
    .replace(/(\d+(?:\.\d+)?)K\s?דקות/g, (_, n) => `${Math.round(Number(n) * 1000 / 60)} שעות`)
    .replace(/(\d{1,3}(?:,\d{3})+|\d{3,})\s?דקות/g, (m, n) => (toNum(n) >= 120 ? `${Math.round(toNum(n) / 60)} שעות` : m))
    .replace(/([+-]?\d+(?:\.\d+)?)\s?pp\b/g, '$1 נק׳');
}

function compact(n: number, unit?: string): string {
  const abs = Math.abs(n);
  const s = abs >= 1e6 ? `${(n / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M` : abs >= 1e4 ? `${Math.round(n / 1e3)}K` : n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
  return unit === '₪' ? `₪${s}` : unit && unit !== '%' ? `${s} ${unit}` : unit === '%' ? `${s}%` : s;
}

/** Horizontal bars, one per category — the report's chart. */
function Bars({ categories, points, unit }: { categories: string[]; points: number[]; unit?: string }) {
  const max = Math.max(...points.map(p => Math.abs(p)), 1);
  return (
    <div className={styles.bars}>
      {categories.map((c, i) => (
        <div key={c} className={styles.barRow}>
          <span className={styles.barLabel}>{say(c)}</span>
          <span className={styles.barTrack}><i style={{ width: `${Math.max(2, (Math.abs(points[i] ?? 0) / max) * 100)}%` }} /></span>
          <span className={styles.barValue}>{compact(points[i] ?? 0, unit)}</span>
        </div>
      ))}
    </div>
  );
}

function Block({ block }: { block: ReportBlock }) {
  switch (block.type) {
    case 'stat_callout':
      return (
        <div className={styles.stat}>
          <small>{say(block.label)}</small>
          <strong>{say(block.value)}</strong>
          {block.description && <p>{say(block.description)}</p>}
        </div>
      );
    case 'ranked_list':
      return (
        <div className={styles.card}>
          {block.title && <h3>{say(block.title)}</h3>}
          <div className={styles.bars}>
            {block.items.map(it => (
              <div key={it.label} className={styles.barRow}>
                <span className={styles.barLabel}>{say(it.label)}</span>
                <span className={styles.barTrack}><i style={{ width: `${Math.max(2, Math.min(100, it.pct))}%` }} /></span>
                <span className={styles.barValue}>{say(it.value)}{block.unit ? <small> {block.unit}</small> : null}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'comparison':
      return (
        <div className={styles.compare}>
          {block.items.map(it => (
            <div key={it.label} className={`${styles.compareItem} ${it.direction === 'positive' ? styles.good : it.direction === 'negative' ? styles.bad : ''}`}>
              <small>{say(it.label)}</small>
              <strong>{say(it.value)}</strong>
              {it.sub && <p>{say(it.sub)}</p>}
            </div>
          ))}
        </div>
      );
    case 'scenarios':
      return (
        <div className={styles.card}>
          <h3>תרחישים</h3>
          <div className={styles.scenarios}>
            {block.items.map(it => (
              <div key={it.key} className={`${styles.scenario} ${styles[SCENARIO_CLASS[it.key] || 'scNeutral']}`}>
                <small>{say(it.label)}</small>
                <strong>{say(it.value)}</strong>
                {it.description && <p>{say(it.description)}</p>}
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}

/** The chart is skipped when a ranked list in the report already shows the same categories. */
function chartRepeatsList(report: ReportDetail): boolean {
  const cats = new Set(report.chart?.categories ?? []);
  return report.blocks.some(b => b.type === 'ranked_list' && b.items.length > 0
    && b.items.filter(it => cats.has(it.label)).length >= 0.7 * Math.min(b.items.length, cats.size));
}

function ReportView({ id, userId }: { id: string; userId: string }) {
  const { openChat } = useRealEstateChat();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    realestateService.getReport(id, userId).then(r => { if (alive) setReport(r); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [id, userId]);

  if (error) return <div className={styles.error}>לא הצלחתי לטעון את הדוח: {error}</div>;
  if (!report) return <div className={styles.loading}>טוען את הדוח…</div>;

  return (
    <article className={styles.report}>
      <Link to={REPORTS_PATH} className={styles.back}><Icon name="chevronRight" size={16} /> כל הדוחות</Link>
      <div className={styles.reportHead}>
        <div>
          <span className={styles.chip}>{categoryHe(report.categoryLabel)}</span>
          <h1>{say(report.title)}</h1>
          <p className={styles.headline}>{say(report.headline)}</p>
        </div>
        <div className={`${styles.impact} ${report.impactDirection === 'positive' ? styles.good : styles.bad}`}>
          <strong>{say(report.impactValue)}</strong>
          <small>{say(report.impactLabel)}</small>
          <span className={styles.confidence}>רמת ביטחון {report.confidence}%</span>
        </div>
      </div>

      {report.chart && report.chart.series[0] && !chartRepeatsList(report) && (
        <div className={styles.card}>
          <h3>{say(report.chart.title)}</h3>
          <Bars categories={report.chart.categories} points={report.chart.series[0].points} unit={report.chart.unit} />
        </div>
      )}

      <div className={styles.blocks}>
        {report.blocks.map((b, i) => <Block key={i} block={b} />)}
      </div>

      {report.reasoning.length > 0 && (
        <div className={styles.card}>
          <h3>איך הגענו לזה</h3>
          {/* Step titles only: the descriptions name SQL views, columns and formulas. */}
          <ol className={styles.steps}>
            {report.reasoning.map(s => <li key={s.title}><strong>{say(s.title)}</strong></li>)}
          </ol>
          {report.confidenceBasis && <p className={styles.basis}>{say(report.confidenceBasis)}</p>}
        </div>
      )}

      <button type="button" className={styles.askBtn} onClick={() => openChat(`לגבי הממצא "${report.headline}" — מה כדאי לעשות מחר בבוקר, ובכמה זה ישפיע?`)}>
        <Icon name="sparkle" size={16} /> שאל את ה-AI על הדוח
      </button>
    </article>
  );
}

function ReportList({ userId }: { userId: string }) {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    realestateService.getReports(userId).then(r => { if (alive) setReports(r); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [userId]);

  return (
    <>
      <div className={styles.listHead}>
        <h1>דוחות</h1>
        <p>מה ה-AI מצא כשעבר על הלידים, העסקאות והדירות — כל דוח עם המספרים, הסיבה ומה לעשות.</p>
      </div>
      <NewReport userId={userId} />
      {error && <div className={styles.error}>לא הצלחתי לטעון את הדוחות: {error}</div>}
      {!reports && !error && <div className={styles.loading}>טוען דוחות…</div>}
      <div className={styles.grid}>
        {reports?.map(r => (
          <Link key={r.id} to={`${REPORTS_PATH}/${r.id}`} className={styles.tile}>
            <div className={styles.tileTop}>
              <span className={styles.chips}>
                <span className={styles.chip}>{categoryHe(r.categoryLabel)}</span>
                {!r.shared && <span className={styles.chipNew}>הדוח שלך</span>}
              </span>
              <span className={styles.confidence}>ביטחון {r.confidence}%</span>
            </div>
            <h2>{say(r.headline)}</h2>
            <div className={`${styles.tileImpact} ${r.impactDirection === 'positive' ? styles.good : styles.bad}`}>
              <strong>{say(r.impactValue)}</strong>
              <small>{say(r.impactLabel)}</small>
            </div>
            <span className={styles.open}>לדוח המלא <Icon name="chevronLeft" size={14} /></span>
          </Link>
        ))}
      </div>
    </>
  );
}

export function RealEstateReportsPage() {
  const { reportId } = useParams<{ reportId?: string }>();
  // The visitor's anonymous user (the chat's): their own reports live under it.
  const { userId } = useUserContext();
  useDocumentMeta({ title: 'אופק יזמות — דוחות', favicon: '/img/realestate-logo.svg', description: 'AI reports for Ofek Development' });

  return (
    <div className={styles.page} dir="rtl">
      <RealEstateTopbar active="reports" />
      <main className={styles.main}>
        {!userId ? <div className={styles.loading}>טוען…</div> : reportId ? <ReportView id={reportId} userId={userId} /> : <ReportList userId={userId} />}
      </main>
    </div>
  );
}
