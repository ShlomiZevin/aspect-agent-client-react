/** Chart card with a line/bar/pie/table view switcher over one insight's fixed series data. */
import { useState } from 'react';
import type { InsightDetail } from '../../../types/insights';
import styles from './InsightChart.module.css';

type View = 'line' | 'bar' | 'pie' | 'table';
const VIEWS: { key: View; label: string }[] = [
  { key: 'line', label: 'Line' },
  { key: 'bar', label: 'Bar' },
  { key: 'pie', label: 'Pie' },
  { key: 'table', label: 'Table' },
];

const W = 1000;
const H = 240;
const PIE_COLORS = ['#7C3AED', '#C026D3', '#E0752E', '#12996B', '#8B5CF6', '#D946EF', '#F59E0B', '#0EA5E9'];

/**
 * A pie only reads honestly when it's one series of non-negative values that
 * genuinely sum to a whole, and there are few enough slices to label. Real
 * generated insights often violate this (mixed-sign % changes across
 * several series, per-store percentages that don't sum to anything) — for
 * those, disable the tab instead of rendering a chart whose slice sizes
 * don't mean what a pie implies they mean.
 */
function isPieEligible(chart: InsightDetail['chart']): boolean {
  if (chart.series.length !== 1) return false;
  const points = chart.series[0].points;
  if (points.length < 2 || points.length > 8) return false;
  return points.every(v => v >= 0);
}

function pieSlices(chart: InsightDetail['chart']) {
  const points = chart.series[0].points;
  return chart.categories.map((label, i) => ({
    label,
    value: points[i] ?? 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
}

export function InsightChart({ chart }: { chart: InsightDetail['chart'] }) {
  const pieOk = isPieEligible(chart);
  // Pie simply isn't offered when the data can't honestly be one (multiple
  // series, negative values, too many slices) — a disabled-but-visible tab
  // just invites "why is this here" with no upside over not showing it.
  const views = pieOk ? VIEWS : VIEWS.filter(v => v.key !== 'pie');
  const [view, setView] = useState<View>('line');
  const allValues = chart.series.flatMap(s => s.points);
  const min = Math.min(0, ...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>{chart.title}</span>
        <div className={styles.switcher}>
          {views.map(v => (
            <button
              key={v.key}
              className={`${styles.switchBtn} ${view === v.key ? styles.switchActive : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartArea}>
        {view === 'line' && <LineView chart={chart} min={min} range={range} />}
        {view === 'bar' && <BarView chart={chart} min={min} range={range} />}
        {view === 'pie' && pieOk && <PieView chart={chart} />}
        {view === 'table' && <TableView chart={chart} />}
      </div>

      {/* Which point/bar is which category — with no gridline text inside the
          SVG (preserveAspectRatio="none" would distort it), this was
          missing entirely, making every chart unreadable without switching
          to Table. */}
      {(view === 'line' || view === 'bar') && (
        <div className={styles.categoryLabels}>
          {chart.categories.map((c, i) => <span key={i}>{c}</span>)}
        </div>
      )}

      {view === 'pie' && pieOk && <PieLegend chart={chart} />}

      {view !== 'table' && view !== 'pie' && (
        <div className={styles.legend}>
          {chart.series.map(s => (
            <span key={s.key} className={styles.legendItem} style={{ color: s.color }}>
              {s.dashed ? '– –' : '—'} {s.label || s.key}
            </span>
          ))}
          <span className={styles.sourceNote}>{chart.unit}</span>
        </div>
      )}
    </div>
  );
}

function LineView({ chart, min, range }: { chart: InsightDetail['chart']; min: number; range: number }) {
  const n = chart.categories.length;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={0} y1={H * 0.25} x2={W} y2={H * 0.25} stroke="var(--ai-border-soft)" />
      <line x1={0} y1={H * 0.5} x2={W} y2={H * 0.5} stroke="var(--ai-border-soft)" />
      <line x1={0} y1={H * 0.75} x2={W} y2={H * 0.75} stroke="var(--ai-border-soft)" />
      {chart.series.map(s => {
        const pts = s.points.map((v, i) => {
          const x = n > 1 ? (i / (n - 1)) * W : W / 2;
          const y = H - 20 - ((v - min) / range) * (H - 40);
          return `${x},${y}`;
        }).join(' ');
        return <polyline key={s.key} points={pts} fill="none" stroke={s.color} strokeWidth={3.5} strokeDasharray={s.dashed ? '8 6' : undefined} />;
      })}
    </svg>
  );
}

function BarView({ chart, min, range }: { chart: InsightDetail['chart']; min: number; range: number }) {
  const n = chart.categories.length;
  const groupW = W / n;
  const seriesCount = chart.series.length;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {chart.categories.map((_, i) => (
        chart.series.map((s, si) => {
          const v = s.points[i] ?? 0;
          const h = ((v - min) / range) * (H - 40);
          const barW = (groupW - 16) / seriesCount;
          const x = i * groupW + 8 + si * barW;
          return <rect key={`${s.key}-${i}`} x={x} y={H - 20 - h} width={Math.max(4, barW - 4)} height={h} rx={3} fill={s.color} />;
        })
      ))}
    </svg>
  );
}

function PieView({ chart }: { chart: InsightDetail['chart'] }) {
  const slices = pieSlices(chart);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  let cumulative = 0;
  const r = 80;
  const cx = W / 2 - 140;
  const cy = H / 2;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {slices.map((s, i) => {
        const startAngle = (cumulative / total) * 2 * Math.PI;
        cumulative += s.value;
        const endAngle = (cumulative / total) * 2 * Math.PI;
        const x1 = cx + r * Math.sin(startAngle);
        const y1 = cy - r * Math.cos(startAngle);
        const x2 = cx + r * Math.sin(endAngle);
        const y2 = cy - r * Math.cos(endAngle);
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
        return <path key={`${s.label}-${i}`} d={path} fill={s.color} stroke="var(--ai-surface)" strokeWidth={2} />;
      })}
    </svg>
  );
}

/** Its own legend, not the shared line/bar one — a pie's colors are assigned per-category (PIE_COLORS), not per-series, so the generic legend would show the wrong colors entirely. */
function PieLegend({ chart }: { chart: InsightDetail['chart'] }) {
  const slices = pieSlices(chart);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={styles.pieLegend}>
      {slices.map((s, i) => (
        <div key={`${s.label}-${i}`} className={styles.pieLegendRow}>
          <span className={styles.pieLegendSwatch} style={{ background: s.color }} />
          <span className={styles.pieLegendLabel}>{s.label}</span>
          <span className={styles.pieLegendValue}>{s.value.toLocaleString('en-US')}{chart.unit ? ` ${chart.unit}` : ''}</span>
          <span className={styles.pieLegendPct}>{Math.round((s.value / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function TableView({ chart }: { chart: InsightDetail['chart'] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{chart.unit}</th>
          {chart.series.map(s => <th key={s.key}>{s.label || s.key}</th>)}
        </tr>
      </thead>
      <tbody>
        {chart.categories.map((cat, i) => (
          <tr key={cat}>
            <td>{cat}</td>
            {chart.series.map(s => <td key={s.key}>{(s.points[i] ?? 0).toLocaleString('en-US')}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
