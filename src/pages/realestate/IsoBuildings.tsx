/**
 * The live board's buildings, drawn from the units table: an isometric block
 * per building, one window per apartment (floor x position), lit by status.
 * Positions 1-2 face left, 3-4 face right, so every apartment is visible.
 */
import type { BoardBuilding, BoardUnit } from '../../services/realestateService';
import { buildingLetter, unitKind } from './shared';
import { Ring } from './ui';

const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
const W = 118; // left face width
const D = 84;  // right face width
const GAP = 46;
const SCENE_H = 470;
const LABEL_H = 64;

type Pt = [number, number];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const mul = (v: Pt, k: number): Pt => [v[0] * k, v[1] * k];
const up = (z: number): Pt => [0, -z];
const poly = (pts: Pt[]) => pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

const FILL: Record<string, [string, string]> = {
  sold: ['#5a9c6c', '#477f57'],
  reserved: ['#e9b84f', '#cf9e3e'],
  free: ['#fff4d8', '#efdfb6'],
  stuck: ['#f08a3a', '#d6732a'],
};

interface Props {
  buildings: BoardBuilding[];
  floors: number;
  selectedId: number | null;
  onSelect: (u: BoardUnit) => void;
}

export function IsoBuildings({ buildings, floors, selectedId, onSelect }: Props) {
  const levels = floors + 1;
  const h = Math.min(26, (SCENE_H - LABEL_H - 30 - (W + D) * SIN) / levels);
  const bodyH = levels * h + 6;
  const span = (W + D) * COS;
  const width = buildings.length * span + (buildings.length - 1) * GAP + 80;
  const groundY = SCENE_H - 24;
  const L: Pt = [-W * COS, -W * SIN];
  const R: Pt = [D * COS, -D * SIN];

  return (
    <svg viewBox={`0 0 ${width} ${SCENE_H + 20}`} width="100%" height="100%" preserveAspectRatio="xMidYMax meet" role="img" aria-label="לוח דירות">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="slab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efe9df" /><stop offset="1" stopColor="#ddd5c8" />
        </linearGradient>
      </defs>

      {/* plaza */}
      <polygon points={poly([[20, groundY + 6], [width - 20, groundY + 6], [width - 60, groundY - 30], [60, groundY - 30]])} fill="rgba(236,232,224,0.85)" />

      {buildings.map((b, i) => {
        // Right to left, like the page: building א' stands on the right.
        const slot = buildings.length - 1 - i;
        const P0: Pt = [40 + W * COS + slot * (span + GAP), groundY];
        const top = up(bodyH);
        const face = (v: Pt, a: number, bb: number, z0: number, z1: number) =>
          poly([add(add(P0, mul(v, a)), up(z0)), add(add(P0, mul(v, bb)), up(z0)), add(add(P0, mul(v, bb)), up(z1)), add(add(P0, mul(v, a)), up(z1))]);
        const units = b.units;
        const at = (floor: number, pos: number) => units.find(u => u.floor === floor && u.position === pos);
        const labelX = P0[0] + (R[0] + L[0]) / 2;
        const labelY = groundY - bodyH - (W + D) * SIN - 2; // just above the roof's far corner

        return (
          <g key={b.building}>
            <ellipse cx={P0[0] + (L[0] + R[0]) / 2} cy={groundY + 2} rx={span * 0.62} ry={14} fill="rgba(40,50,60,0.16)" />
            {/* faces */}
            <polygon points={poly([P0, add(P0, L), add(add(P0, L), top), add(P0, top)])} fill="#f1ebe1" stroke="#d8cfc1" />
            <polygon points={poly([P0, add(P0, R), add(add(P0, R), top), add(P0, top)])} fill="#d9d0c2" stroke="#c9bfae" />
            <polygon points={poly([add(P0, top), add(add(P0, L), top), add(add(add(P0, L), R), top), add(add(P0, R), top)])} fill="url(#slab)" stroke="#cfc6b7" />
            {/* floor slabs */}
            {Array.from({ length: levels + 1 }, (_, k) => (
              <g key={k} stroke="#cbbfac" strokeWidth={0.8}>
                <line x1={P0[0]} y1={P0[1] - k * h} x2={P0[0] + L[0]} y2={P0[1] + L[1] - k * h} />
                <line x1={P0[0]} y1={P0[1] - k * h} x2={P0[0] + R[0]} y2={P0[1] + R[1] - k * h} />
              </g>
            ))}
            {/* apartments */}
            {Array.from({ length: levels }, (_, floor) => [1, 2, 3, 4].map(pos => {
              const u = at(floor, pos);
              const onLeft = pos <= 2;
              const v = onLeft ? L : R;
              const [a, bb] = onLeft ? (pos === 2 ? [0.06, 0.47] : [0.53, 0.94]) : (pos === 3 ? [0.06, 0.47] : [0.53, 0.94]);
              const z0 = floor * h + h * 0.16;
              const z1 = (floor + 1) * h - h * 0.12;
              if (!u) return <polygon key={pos} points={face(v, a, bb, z0, z1)} fill={onLeft ? '#e6dfd3' : '#cdc3b3'} />;
              const kind = unitKind(u);
              const selected = u.id === selectedId;
              return (
                <polygon
                  key={pos}
                  points={face(v, a, bb, z0, z1)}
                  fill={FILL[kind][onLeft ? 0 : 1]}
                  stroke={selected ? '#ffffff' : 'rgba(60,50,40,0.25)'}
                  strokeWidth={selected ? 2.6 : 0.6}
                  filter={selected || kind === 'free' ? 'url(#glow)' : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelect(u)}
                >
                  <title>{`דירה ${u.number} · קומה ${u.floor} · ${u.rooms} חד׳ · ${u.status}`}</title>
                  {kind === 'stuck' && <animate attributeName="opacity" values="1;0.6;1" dur="2.4s" repeatCount="indefinite" />}
                </polygon>
              );
            }))}
            {/* trees */}
            {[P0[0] + L[0] * 1.02, P0[0] + R[0] * 1.06].map((x, k) => (
              <g key={k} transform={`translate(${x}, ${groundY - 2})`}>
                <rect x={-1.5} y={-10} width={3} height={12} fill="#8a6a4a" />
                <circle cx={0} cy={-18} r={11} fill="#7fa86a" />
                <circle cx={-6} cy={-13} r={7} fill="#6c9658" />
              </g>
            ))}
            {/* label */}
            <foreignObject x={labelX - 74} y={labelY - LABEL_H + 8} width={148} height={LABEL_H - 8}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', direction: 'rtl' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.92)', borderRadius: 14, padding: '6px 10px', boxShadow: '0 4px 14px rgba(30,40,60,0.12)', color: '#1d2430' }}>
                  <div style={{ lineHeight: 1.15, textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>בניין {buildingLetter(b.building)}</div>
                    <div style={{ fontSize: 11.5, color: '#5d6574' }}>{b.pctSold}% נמכרו</div>
                  </div>
                  <Ring pct={b.pctSold} size={30} stroke={4} label={false} />
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
