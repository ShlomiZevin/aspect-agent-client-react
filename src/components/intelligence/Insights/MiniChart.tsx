/** Small inline SVG preview chart (line/bar/donut) for InsightCard. */
import type { ChartSeriesPoint } from '../../../types/insights';

function scale(points: number[], width: number, height: number, min: number, range: number, pad = 4) {
  return points.map((v, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * width : width / 2;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
}

/** One shared placeholder for every "nothing to plot" case (all-zero data,
 * or a donut whose ratio rounds to 0%/100%) — same box, same centering,
 * regardless of which variant would otherwise have rendered here. */
function NoSignal({ svgWidth, height }: { svgWidth: string | number; height: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: svgWidth, height,
      color: 'var(--ai-text-mute)', fontSize: 11.5, fontWeight: 600,
      flexShrink: svgWidth === '100%' ? undefined : 0,
    }}>
      No signal
    </div>
  );
}

interface Props {
  series: ChartSeriesPoint[];
  variant?: 'line' | 'bar' | 'donut';
  width?: number;
  height?: number;
  /** true (default): SVG stretches to fill its container (InsightCard use). false: fixed pixel size, won't compete for flex space (Tracked strip use). */
  fluid?: boolean;
}

export function MiniChart({ series, variant = 'line', width = 100, height = 44, fluid = true }: Props) {
  if (!series.length) return null;
  const svgWidth = fluid ? '100%' : width;

  // A genuine "nothing found" result (e.g. "0 product families at risk")
  // has no real shape to plot — a donut divides 0 by 0 (NaN dasharray,
  // renders as a broken sliver) and a bar/line of all-zero values is just a
  // flat, meaningless blob either way. Say so plainly instead of forcing a
  // chart shape that can't honestly represent "nothing."
  const allZero = series.every(s => s.points.every(v => v === 0));
  if (allZero) return <NoSignal svgWidth={svgWidth} height={height} />;

  if (variant === 'donut') {
    const pct = Math.round((series[0].points[0] / (series[0].points[0] + (series[0].points[1] ?? 0))) * 100);
    // 0% or 100% is a mathematically valid ratio (e.g. "0 declining families
    // out of 1 total category") but visually it's still just an empty ring
    // with a stray rounded cap where the arc would start — no less
    // uninformative than the literal-all-zero case above. Same placeholder,
    // same box as every other "nothing to plot" case (not the donut's own
    // fixed 52×52 — that left it pinned to the left edge instead of
    // centered like the all-zero case above, an inconsistency Kosta caught
    // immediately by comparing two cards side by side).
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return <NoSignal svgWidth={svgWidth} height={height} />;
    const r = 15.9;
    const dash = `${pct} ${100 - pct}`;
    return (
      <svg width={52} height={52} viewBox="0 0 42 42">
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--ai-accent-soft)" strokeWidth="7" />
        {/* Rotate -90deg so 0% starts at 12 o'clock, not the SVG circle's default 3 o'clock start. */}
        <circle cx="21" cy="21" r={r} fill="none" stroke={series[0].color} strokeWidth="7" strokeDasharray={dash} strokeLinecap="round" transform="rotate(-90 21 21)" />
      </svg>
    );
  }

  if (variant === 'bar') {
    // Same global-min/max reasoning as the line branch below — and looping
    // over every series (not just series[0]) so a 2-series comparison
    // (e.g. "avg transaction value" vs "loyalty conversion" per cashier)
    // actually shows both bars per group instead of silently dropping the
    // second series entirely.
    const n = series[0]?.points.length ?? 0;
    const allPoints = series.flatMap(s => s.points);
    const min = Math.min(...allPoints);
    const max = Math.max(...allPoints);
    const range = max - min || 1;
    const groupW = width / n;
    const seriesCount = series.length;
    return (
      <svg width={svgWidth} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={fluid ? undefined : { flexShrink: 0 }}>
        {Array.from({ length: n }, (_, i) => series.map((s, si) => {
          const v = s.points[i] ?? 0;
          const h = 4 + ((v - min) / range) * (height - 8);
          const barW = (groupW - 4) / seriesCount;
          const x = i * groupW + 2 + si * barW;
          return <rect key={`${s.key}-${i}`} x={x} y={height - h} width={Math.max(2, barW - 2)} height={h} rx={2} fill={s.color} opacity={seriesCount === 1 ? 0.4 + 0.6 * ((v - min) / range) : 1} />;
        }))}
      </svg>
    );
  }

  // Normalize every series against the SAME min/max, not each series' own —
  // per-series normalization made a 2-point line always span the full
  // height regardless of magnitude, so several declining series produced
  // IDENTICAL coordinates and rendered as one line hiding the rest
  // underneath (only the last-drawn color was ever visible).
  const allPoints = series.flatMap(s => s.points);
  const gMin = Math.min(...allPoints);
  const gMax = Math.max(...allPoints);
  const gRange = gMax - gMin || 1;

  return (
    <svg width={svgWidth} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={fluid ? undefined : { flexShrink: 0 }}>
      {series.map(s => {
        const pts = scale(s.points, width, height, gMin, gRange);
        return (
          <polyline
            key={s.key}
            points={pts.map(p => p.join(',')).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? '8 6' : undefined}
          />
        );
      })}
    </svg>
  );
}
