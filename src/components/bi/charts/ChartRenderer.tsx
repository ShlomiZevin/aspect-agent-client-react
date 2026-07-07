/**
 * Dependency-free SVG chart renderer for the BI tool.
 * Renders a QueryResult as KPI tiles, bar / grouped-bar, area-line, donut, or a
 * table. Gradient fills, soft glows, smoothed lines and entrance animation give
 * it a modern, immersive feel. Colors adapt to the BI theme via CSS variables.
 *
 * Bars, slices, dots and table rows are clickable — used for dashboard
 * cross-filtering.
 */
import { useId, useMemo } from 'react';
import type { ChartType, QueryResult, QuerySpec, Measure } from '../../../types/bi';
import { formatValue, formatExact, compact, measureFormat, seriesColor } from '../format';
import styles from './Charts.module.css';

interface Props {
  chartType: ChartType;
  result: QueryResult;
  spec: QuerySpec;
  measures: Measure[];
  labels: Record<string, string>;
  onSelect?: (dimId: string, value: string) => void;
  selected?: { dimId: string; value: string } | null;
}

interface SubProps {
  rows: Record<string, unknown>[];
  spec: QuerySpec;
  measures: Measure[];
  labels: Record<string, string>;
  onSelect?: (dimId: string, value: string) => void;
  selected?: { dimId: string; value: string } | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isNaN(n) ? 0 : n;
};

export function ChartRenderer({ chartType, result, spec, measures, labels, onSelect, selected }: Props) {
  const rows = result.rows || [];
  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyMark}>∅</div>
        <span>No data for this query.</span>
      </div>
    );
  }

  const p: SubProps = { rows, spec, measures, labels, onSelect, selected };
  switch (chartType) {
    case 'kpi':         return <KpiTiles {...p} />;
    case 'bar':         return <BarChart {...p} />;
    case 'grouped-bar': return <GroupedBar {...p} />;
    case 'line':        return <LineChart {...p} />;
    case 'pie':         return <DonutChart {...p} />;
    case 'table':       return <DataTable {...p} />;
    default:            return <div className={styles.empty}>Unsupported chart type.</div>;
  }
}

// ── KPI tiles ────────────────────────────────────────────────────────
function KpiTiles({ rows, spec, measures, labels }: SubProps) {
  const row = rows[0];
  return (
    <div className={styles.kpiRow}>
      {spec.measures.map((mid, i) => (
        <div key={mid} className={styles.kpiTile} style={{ animationDelay: `${i * 60}ms` }}>
          <span className={styles.kpiAccent} style={{ background: seriesColor(i) }} />
          <span className={styles.kpiLabel}>{labels[mid] ?? mid}</span>
          <span className={styles.kpiValue}>{formatValue(row[mid], measureFormat(measures, mid))}</span>
        </div>
      ))}
    </div>
  );
}

// ── shared geometry ──────────────────────────────────────────────────
const W = 760, H = 340, PAD_L = 58, PAD_R = 18, PAD_T = 20, PAD_B = 66;
const plotW = W - PAD_L - PAD_R;
const plotH = H - PAD_T - PAD_B;

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const step = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(step)));
  const norm = step / mag;
  const niceStep = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let t = 0; t <= max + niceStep / 2; t += niceStep) ticks.push(t);
  return ticks;
}

function truncate(s: string, n = 14): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Reusable <defs>: a vertical fade gradient + a soft glow per series index. */
function ChartDefs({ uid, colors }: { uid: string; colors: number[] }) {
  return (
    <defs>
      {colors.map(i => (
        <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={seriesColor(i)} stopOpacity="0.95" />
          <stop offset="100%" stopColor={seriesColor(i)} stopOpacity="0.45" />
        </linearGradient>
      ))}
      {colors.map(i => (
        <linearGradient key={`a${i}`} id={`${uid}-area${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={seriesColor(i)} stopOpacity="0.35" />
          <stop offset="100%" stopColor={seriesColor(i)} stopOpacity="0" />
        </linearGradient>
      ))}
      <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3.2" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function Grid({ ticks, top }: { ticks: number[]; top: number }) {
  return (
    <>
      {ticks.map(t => {
        const y = PAD_T + plotH - (t / top) * plotH;
        return (
          <g key={t}>
            <line className={styles.gridLine} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} />
            <text className={styles.axisLabel} x={PAD_L - 10} y={y + 4} textAnchor="end">{compact(t)}</text>
          </g>
        );
      })}
    </>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className={styles.legend}>
      {items.map(it => (
        <span key={it.label} className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

// ── Bar (1 dim + 1 measure) ──────────────────────────────────────────
function BarChart({ rows, spec, measures, labels, onSelect, selected }: SubProps) {
  const uid = useId();
  const dim = spec.dimensions[0];
  const mid = spec.measures[0];
  const fmt = measureFormat(measures, mid);
  const data = rows.map(r => ({ cat: String(r[dim] ?? '—'), val: num(r[mid]) }));
  const max = Math.max(...data.map(d => d.val), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const bw = plotW / data.length;
  const barW = Math.min(bw * 0.62, 54);

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${labels[mid]} by ${labels[dim]}`}>
        <ChartDefs uid={uid} colors={[0]} />
        <Grid ticks={ticks} top={top} />
        {data.map((d, i) => {
          const h = Math.max(top ? (d.val / top) * plotH : 0, 0);
          const x = PAD_L + i * bw + (bw - barW) / 2;
          const y = PAD_T + plotH - h;
          const isSel = selected && selected.dimId === dim && selected.value === d.cat;
          const dimmed = selected && selected.dimId === dim && !isSel;
          const cx = PAD_L + i * bw + bw / 2;
          return (
            <g key={i} className={`${styles.rise} ${dimmed ? styles.barDim : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
              <rect className={styles.bar} x={x} y={y} width={barW} height={h}
                rx={7} fill={`url(#${uid}-g0)`} onClick={() => onSelect?.(dim, d.cat)}>
                <title>{`${d.cat}: ${formatExact(d.val, fmt)}`}</title>
              </rect>
              <text className={styles.axisLabel} x={cx} y={H - PAD_B + 18}
                textAnchor={data.length > 8 ? 'end' : 'middle'}
                transform={data.length > 8 ? `rotate(-32 ${cx} ${H - PAD_B + 18})` : undefined}>
                {truncate(d.cat)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Grouped bar (1 dim + N measures) ─────────────────────────────────
function GroupedBar({ rows, spec, measures, labels }: SubProps) {
  const uid = useId();
  const dim = spec.dimensions[0];
  const mids = spec.measures;
  const max = Math.max(...rows.flatMap(r => mids.map(m => num(r[m]))), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const gw = plotW / rows.length;
  const groupW = Math.min(gw * 0.72, 96);
  const barW = groupW / mids.length;

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img">
        <ChartDefs uid={uid} colors={mids.map((_, j) => j)} />
        <Grid ticks={ticks} top={top} />
        {rows.map((r, i) => {
          const gx = PAD_L + i * gw + (gw - groupW) / 2;
          const cx = PAD_L + i * gw + gw / 2;
          return (
            <g key={i} className={styles.rise} style={{ animationDelay: `${i * 30}ms` }}>
              {mids.map((mid, j) => {
                const val = num(r[mid]);
                const h = Math.max(top ? (val / top) * plotH : 0, 0);
                const x = gx + j * barW;
                const y = PAD_T + plotH - h;
                return (
                  <rect key={mid} className={styles.bar} x={x} y={y} width={barW * 0.82} height={h}
                    rx={4} fill={`url(#${uid}-g${j})`}>
                    <title>{`${r[dim]} · ${labels[mid]}: ${formatExact(val, measureFormat(measures, mid))}`}</title>
                  </rect>
                );
              })}
              <text className={styles.axisLabel} x={cx} y={H - PAD_B + 18}
                textAnchor={rows.length > 8 ? 'end' : 'middle'}
                transform={rows.length > 8 ? `rotate(-32 ${cx} ${H - PAD_B + 18})` : undefined}>
                {truncate(String(r[dim] ?? '—'))}
              </text>
            </g>
          );
        })}
      </svg>
      <Legend items={mids.map((m, j) => ({ label: labels[m] ?? m, color: seriesColor(j) }))} />
    </div>
  );
}

/** Smooth cardinal-spline path through points. */
function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return '';
  if (pts.length < 3) return `M ${pts.map(p => `${p[0]} ${p[1]}`).join(' L ')}`;
  const d = [`M ${pts[0][0]} ${pts[0][1]}`];
  const t = 0.16;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d.push(`C ${p1[0] + (p2[0] - p0[0]) * t} ${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t} ${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]} ${p2[1]}`);
  }
  return d.join(' ');
}

// ── Line + area (1 dim + N measures) ─────────────────────────────────
function LineChart({ rows, spec, measures, labels }: SubProps) {
  const uid = useId();
  const dim = spec.dimensions[0];
  const mids = spec.measures;
  const max = Math.max(...rows.flatMap(r => mids.map(m => num(r[m]))), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const stepX = rows.length > 1 ? plotW / (rows.length - 1) : plotW;
  const xAt = (i: number) => PAD_L + (rows.length > 1 ? i * stepX : plotW / 2);
  const yAt = (v: number) => PAD_T + plotH - (top ? (v / top) * plotH : 0);
  const baseY = PAD_T + plotH;

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.svg} viewBox={`0 0 ${W} ${H}`} role="img">
        <ChartDefs uid={uid} colors={mids.map((_, j) => j)} />
        <Grid ticks={ticks} top={top} />
        {mids.map((mid, j) => {
          const pts = rows.map((r, i) => [xAt(i), yAt(num(r[mid]))] as [number, number]);
          const line = smoothPath(pts);
          const area = `${line} L ${xAt(rows.length - 1)} ${baseY} L ${xAt(0)} ${baseY} Z`;
          return (
            <g key={mid}>
              {mids.length === 1 && <path d={area} fill={`url(#${uid}-area${j})`} className={styles.fade} />}
              <path className={`${styles.linePath} ${styles.draw}`} d={line} stroke={seriesColor(j)}
                filter={`url(#${uid}-glow)`} />
              {rows.map((r, i) => (
                <circle key={i} className={styles.dot} cx={xAt(i)} cy={yAt(num(r[mid]))} r={3.5}
                  fill={seriesColor(j)}>
                  <title>{`${r[dim]} · ${labels[mid]}: ${formatExact(num(r[mid]), measureFormat(measures, mid))}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {rows.map((r, i) => (
          (rows.length <= 12 || i % Math.ceil(rows.length / 12) === 0) ? (
            <text key={i} className={styles.axisLabel} x={xAt(i)} y={H - PAD_B + 18} textAnchor="middle">
              {truncate(String(r[dim] ?? '—'), 10)}
            </text>
          ) : null
        ))}
      </svg>
      {mids.length > 1 && <Legend items={mids.map((m, j) => ({ label: labels[m] ?? m, color: seriesColor(j) }))} />}
    </div>
  );
}

// ── Donut (1 dim + 1 measure) ────────────────────────────────────────
function DonutChart({ rows, spec, measures, onSelect, selected }: SubProps) {
  const dim = spec.dimensions[0];
  const mid = spec.measures[0];
  const fmt = measureFormat(measures, mid);
  const data = rows.slice(0, 10).map(r => ({ cat: String(r[dim] ?? '—'), val: num(r[mid]) }));
  const total = data.reduce((s, d) => s + d.val, 0) || 1;
  const cx = 150, cy = 150, R = 128, r = 78;
  const gap = 0.018;
  let angle = -Math.PI / 2;

  const arcs = data.map((d, i) => {
    const frac = d.val / total;
    const a0 = angle + gap;
    const a1 = angle + frac * Math.PI * 2 - gap;
    angle += frac * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)} ${cy + rad * Math.sin(a)}`;
    const path = `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`;
    return { ...d, path, color: seriesColor(i), pct: frac * 100 };
  });

  return (
    <div className={styles.donutWrap}>
      <svg className={styles.donutSvg} viewBox="0 0 300 300" role="img">
        {arcs.map((a, i) => {
          const isSel = selected && selected.dimId === dim && selected.value === a.cat;
          const dimmed = selected && selected.dimId === dim && !isSel;
          return (
            <path key={i} d={a.path} fill={a.color} className={`${styles.slice} ${dimmed ? styles.barDim : ''}`}
              onClick={() => onSelect?.(dim, a.cat)}>
              <title>{`${a.cat}: ${formatExact(a.val, fmt)} (${a.pct.toFixed(1)}%)`}</title>
            </path>
          );
        })}
        <text className={styles.donutTotal} x={cx} y={cy - 4} textAnchor="middle">{formatValue(total, fmt)}</text>
        <text className={styles.donutCap} x={cx} y={cy + 18} textAnchor="middle">TOTAL</text>
      </svg>
      <Legend items={arcs.map(a => ({ label: `${truncate(a.cat, 18)} · ${a.pct.toFixed(0)}%`, color: a.color }))} />
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────
function DataTable({ rows, spec, measures, labels, onSelect, selected }: SubProps) {
  const cols = useMemo(() => [...spec.dimensions, ...spec.measures], [spec]);
  const measureSet = useMemo(() => new Set(spec.measures), [spec]);
  const primaryDim = spec.dimensions[0];
  // Faint in-cell bar for the leading measure — gives the table a data-viz feel.
  const leadMeasure = spec.measures[0];
  const maxLead = leadMeasure ? Math.max(...rows.map(r => num(r[leadMeasure])), 0) : 0;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {cols.map(c => <th key={c} className={measureSet.has(c) ? styles.num : ''}>{labels[c] ?? c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const active = selected && primaryDim && String(row[primaryDim]) === selected.value;
            return (
              <tr key={i} className={active ? styles.active : ''}
                onClick={() => primaryDim && onSelect?.(primaryDim, String(row[primaryDim] ?? ''))}>
                {cols.map(c => {
                  const isMeasure = measureSet.has(c);
                  const isLead = c === leadMeasure && maxLead > 0;
                  const pct = isLead ? (num(row[c]) / maxLead) * 100 : 0;
                  return (
                    <td key={c} className={isMeasure ? styles.num : ''}
                      style={isLead ? { background: `linear-gradient(90deg, var(--bi-accent-soft) ${pct}%, transparent ${pct}%)` } : undefined}>
                      {isMeasure ? formatExact(row[c], measureFormat(measures, c)) : String(row[c] ?? '—')}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
