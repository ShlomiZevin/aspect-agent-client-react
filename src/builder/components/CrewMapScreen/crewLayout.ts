/**
 * crewLayout — where the Crew map draws things (task #855). Pure: takes
 * the map from crewGraph.ts, returns card positions, arrow paths and
 * label boxes. Nothing here changes what the map *says*.
 *
 * A small layered ("Sugiyama") layout, top to bottom:
 *  1. rows = fewest moves from the start; never-reached crews get their
 *     own row at the bottom;
 *  2. an arrow that skips rows gets an invisible waypoint in every row it
 *     passes, so it runs between cards instead of through them;
 *  3. crews in a row are ordered to cross as few arrows as possible;
 *  4. each crew slides toward the crews it connects to (parents above
 *     their children) without overlapping its neighbours;
 *  5. arrows leave / enter a card at spread-out points, ordered by where
 *     they go, so a fan of arrows doesn't start from one spot;
 *  6. every arrow gets a rule label placed along its own line where it
 *     touches no card and no other label; when a gap between rows is too
 *     crowded for that, the gap grows and the layout runs again.
 */

import type { ID } from '../../types';
import { ANY_CREW, type CrewMap, type CrewMove } from './crewGraph';

export const CARD_W = 222;
export const CARD_H = 104;
const H_GAP = 58;          // between cards in a row
const WAY_W = 16;          // a waypoint of an arrow that skips rows
const WAY_GAP = 34;        // between a waypoint and its neighbours
const BASE_GAP = 160;      // between rows — the rule labels live here
const GROW_GAP = 26;       // added to a crowded gap per retry
const PAD_X = 36;
const PAD_TOP = 64;        // room for the "Start" tab and the zoom controls
const PAD_BOTTOM = 56;
const BAND_EXTRA = 64;     // above the never-reached row: its header
const ARC_H = 70;          // a move between two crews of the same row hops over the top
const PORT_STEP = 34;      // between arrow ends on one side of a card
const END_GAP = 2;         // arrow tip ↔ card edge
const PAIR_STEP = 50;      // between the two lines of a two-way move
const BAND_GAP = 84;       // last main row ↔ never-reached area (grows if its labels need it)

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** A measured rule label (see measureLabel). Chips sit at the end of the
 *  last line when they fit there, otherwise on a row of their own. */
export interface LabelBox { head: string; lines: string[]; chipsInline: boolean; w: number; h: number }

export interface MapArrow {
  key: string;
  from: ID;
  to: ID;
  moves: CrewMove[];
  d: string;
  /** Label box, top-left corner. */
  label: LabelBox & { x: number; y: number };
}

export interface CrewLayout {
  /** Top-left of each crew card. */
  pos: Map<ID, Pt>;
  arrows: MapArrow[];
  width: number;
  height: number;
  /** The never-reached row's backdrop, if there is one. */
  band: Rect | null;
  /** Label type sizes this layout was measured with (see labelMetrics). */
  metrics: LabelMetrics;
  /** x of the start crew's centre — the map's spine, for centring it on screen. */
  axis: number;
}

// ─────────────────────────── rule labels ───────────────────────────

export const LABEL = {
  textMax: 198,        // widest line of condition text (at boost 1)
  padX: 10,
  padY: 7,
  chipGap: 6,          // text ↔ chip row
};

/** Label type sizes. `boost` > 1 when the map is shown zoomed out, so the
 *  rules stay readable on a laptop; the layout is measured with them. */
export interface LabelMetrics {
  boost: number; textPx: number; lineH: number; chipPx: number; chipH: number; headPx: number; textMax: number; maxLines: number;
  font: string; chipFont: string; headFont: string;
}
export function labelMetrics(boost = 1): LabelMetrics {
  const b = Math.round(boost * 100) / 100;
  const textPx = Math.round(12 * b * 2) / 2, chipPx = Math.round(10.5 * b * 2) / 2, headPx = Math.round(11 * b * 2) / 2;
  return {
    boost: b, textPx, chipPx, headPx,
    lineH: Math.round(textPx * 1.42), chipH: Math.round(chipPx * 1.8), textMax: Math.round(LABEL.textMax * (1 + (b - 1) * 0.25)), maxLines: 12, // never cut a rule short
    font: `500 ${textPx}px`, chipFont: `650 ${chipPx}px`, headFont: `700 ${headPx}px`,
  };
}

let ctx: CanvasRenderingContext2D | null = null;
let family = '';
function textW(s: string, font: string): number {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d');
    family = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  }
  if (!ctx) return s.length * 6.3;
  ctx.font = `${font} ${family}`;
  return ctx.measureText(s).width;
}

/** The words on a label: the conditions, first letter up. */
export function ruleText(m: CrewMove): string {
  const s = m.when.length ? m.when.join(' and ') : 'always';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timingText(sameTurn: boolean): string {
  return sameTurn ? 'Right away' : 'Next message';
}

/** "+1 rule" when several rules make the same move. */
export function moreText(moves: CrewMove[]): string {
  const n = moves.length - 1;
  return n > 0 ? `+${n} rule${n === 1 ? '' : 's'}` : '';
}

function wrap(text: string, max: number, maxLines: number, font: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const tryLine = line ? `${line} ${words[i]}` : words[i];
    if (textW(tryLine, font) <= max || !line) { line = tryLine; continue; }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) {
      // Out of room: the rest goes on the last line, cut with an ellipsis.
      line = '';
      let last = lines.pop()!;
      const rest = words.slice(i).join(' ');
      last = `${last} ${rest}`;
      while (last.length > 1 && textW(`${last}…`, font) > max) last = last.slice(0, -1);
      lines.push(`${last.trimEnd()}…`);
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const CHIP_ICON = 11;
const CHIP_PAD = 7;
function chipW(text: string, M: LabelMetrics): number {
  return CHIP_PAD * 2 + CHIP_ICON + 4 + textW(text, M.chipFont);
}

/** `head`: a direction line for one side of a two-way move ("↓ To Young"). */
export function measureLabel(moves: CrewMove[], head: string, M: LabelMetrics): LabelBox {
  let headLine = head;
  while (headLine.length > 4 && textW(headLine, M.headFont) > M.textMax) headLine = `${headLine.slice(0, -2)}…`;
  const lines = wrap(ruleText(moves[0]), M.textMax, M.maxLines, M.font);
  const widths = lines.map(l => textW(l, M.font));
  const more = moreText(moves);
  const chips = chipW(timingText(moves[0].sameTurn), M) + (more ? 6 + textW(more, M.chipFont) + CHIP_PAD * 2 : 0);
  const lastW = widths[widths.length - 1] + 8 + chips;
  const chipsInline = lastW <= M.textMax;
  const headW = headLine ? textW(headLine, M.headFont) : 0;
  const inner = Math.max(headW, chipsInline ? Math.max(...widths.slice(0, -1), lastW) : Math.max(...widths, chips));
  const w = Math.ceil(inner + LABEL.padX * 2 + 2);
  const lastH = chipsInline ? Math.max(M.lineH, M.chipH) : M.lineH;
  const h = LABEL.padY * 2 + (headLine ? M.lineH : 0) + (lines.length - 1) * M.lineH + lastH
    + (chipsInline ? 0 : LABEL.chipGap + M.chipH) + 2;
  return { head: headLine, lines, chipsInline, w, h };
}

/** Does the segment p→q pass through rectangle r? (Liang–Barsky) */
function segHits(p: Pt, q: Pt, r: Rect): boolean {
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  const tests: [number, number][] = [[-dx, p.x - r.x], [dx, r.x + r.w - p.x], [-dy, p.y - r.y], [dy, r.y + r.h - p.y]];
  for (const [pp, qq] of tests) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

// ─────────────────────────── geometry helpers ───────────────────────────

type Cubic = [Pt, Pt, Pt, Pt];

function bez(c: Cubic, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, d = 3 * u * t * t, e = t * t * t;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

function overlap(a: Rect, b: Rect, pad: number): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + pad;
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + pad;
  return w > 0 && h > 0 ? w * h : 0;
}

// ─────────────────────────── the layout ───────────────────────────

function arrowsExist(l: CrewLayout): boolean { return l.arrows.length > 0; }

interface Node { id: string; layer: number; w: number; way: boolean }
interface Chain {
  key: string; moves: CrewMove[]; from: ID; to: ID; nodes: string[]; same: boolean; twoWay: boolean; down: boolean;
  /** A move straight back up one row: it hooks into the side of its target instead of joining the fan under it. */
  ret: boolean;
}

export function layoutCrewMap(map: CrewMap, boost = 1): CrewLayout {
  const M = labelMetrics(boost);
  const empty: CrewLayout = { pos: new Map(), arrows: [], width: 400, height: 200, band: null, metrics: M, axis: 200 };
  if (!map.crews.length) return empty;

  // ── rows ──
  const maxDepth = map.depth.size ? Math.max(...map.depth.values()) : -1;
  const bandLayer = map.unreachable.length ? maxDepth + 1 : -1;
  // Never-reached crews wrap into rows no wider than the widest main row (min 4).
  const rowSize = new Map<number, number>();
  for (const d of map.depth.values()) rowSize.set(d, (rowSize.get(d) ?? 0) + 1);
  const perBandRow = Math.max(4, ...rowSize.values());
  const bandRow = new Map(map.unreachable.map((id, i) => [id, Math.floor(i / perBandRow)]));
  const bandRows = map.unreachable.length ? Math.ceil(map.unreachable.length / perBandRow) : 0;
  const layerOf = (id: ID) => map.depth.get(id) ?? bandLayer + (bandRow.get(id) ?? 0);
  const L = Math.max(maxDepth + 1, bandLayer + bandRows);

  const nodes = new Map<string, Node>();
  const layers: string[][] = Array.from({ length: L }, () => []);
  for (const c of map.crews) {
    const l = layerOf(c.id);
    nodes.set(c.id, { id: c.id, layer: l, w: CARD_W, way: false });
    layers[l].push(c.id);
  }

  // ── one arrow per pair of crews; several rules between the same two share it ──
  const pairs = new Map<string, CrewMove[]>();
  for (const m of map.moves) {
    if (m.from === ANY_CREW || !m.toExists || m.from === m.to) continue;
    const key = `${m.from}>${m.to}`;
    pairs.set(key, [...(pairs.get(key) ?? []), m]);
  }
  const chains: Chain[] = [...pairs.entries()].map(([key, moves]) => {
    const from = moves[0].from, to = moves[0].to;
    const lf = layerOf(from), lt = layerOf(to);
    const chainNodes = [from];
    if (Math.abs(lt - lf) > 1) {
      const step = lt > lf ? 1 : -1;
      for (let l = lf + step; l !== lt; l += step) {
        const id = `~${key}~${l}`;
        nodes.set(id, { id, layer: l, w: WAY_W, way: true });
        layers[l].push(id);
        chainNodes.push(id);
      }
    }
    chainNodes.push(to);
    return {
      key, moves, from, to, nodes: chainNodes, same: lf === lt, twoWay: lf !== lt && pairs.has(`${to}>${from}`), down: lt > lf,
      ret: lt === lf - 1 && map.depth.has(from),
    };
  });

  const nbr = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (nbr.get(a)?.includes(b)) return; // a two-way move pulls no harder than a one-way one
    nbr.set(a, [...(nbr.get(a) ?? []), b]);
    nbr.set(b, [...(nbr.get(b) ?? []), a]);
  };
  for (const ch of chains) if (!ch.same) for (let i = 0; i + 1 < ch.nodes.length; i++) link(ch.nodes[i], ch.nodes[i + 1]);
  const node = (id: string) => nodes.get(id)!;

  // ── first order: a balanced tree. Each crew's first way in from the row
  // above makes it a child; siblings are arranged heaviest-in-the-middle so
  // the deepest branch runs down the centre of the board. ──
  const crewOrder = new Map(map.crews.map((c, i) => [c.id, i]));
  const kids = new Map<ID, ID[]>();
  const hasParent = new Set<ID>();
  if (map.startId) {
    const queue: ID[] = [map.startId];
    const seen = new Set<ID>(queue);
    while (queue.length) {
      const at = queue.shift()!;
      for (const ch of chains) {
        if (ch.from !== at || seen.has(ch.to) || map.depth.get(ch.to) !== (map.depth.get(at) ?? 0) + 1) continue;
        seen.add(ch.to);
        hasParent.add(ch.to);
        kids.set(at, [...(kids.get(at) ?? []), ch.to]);
        queue.push(ch.to);
      }
    }
  }
  const weight = new Map<ID, number>();
  const weigh = (id: ID): number => {
    const w = 1 + (kids.get(id) ?? []).reduce((s, k) => s + weigh(k), 0);
    weight.set(id, w);
    return w;
  };
  const pre = new Map<string, number>();
  // The heaviest child goes in the middle (under its parent), the rest split
  // around it; a child with a move back up to its parent goes to an outer
  // end, so its return hook runs round the outside, crossing nothing.
  const visit = (id: ID) => {
    pre.set(id, pre.size);
    const sorted = [...(kids.get(id) ?? [])].sort((a, b) => weight.get(b)! - weight.get(a)! || crewOrder.get(a)! - crewOrder.get(b)!);
    if (!sorted.length) return;
    const [heavy, ...rest] = sorted;
    rest.sort((a, b) => crewOrder.get(a)! - crewOrder.get(b)!);
    const back = rest.filter(k => pairs.has(`${k}>${id}`));
    const plain = rest.filter(k => !pairs.has(`${k}>${id}`));
    const nL = Math.floor(rest.length / 2), nR = rest.length - nL;
    const ls: (ID | null)[] = Array(nL).fill(null), rs: (ID | null)[] = Array(nR).fill(null);
    const bq = [...back];
    if (bq.length && nL) ls[0] = bq.shift()!;
    if (bq.length && nR) rs[nR - 1] = bq.shift()!;
    const rem = [...plain, ...bq];
    for (let k = 0; k < Math.max(nL, nR); k++) {
      if (k < nR && rs[k] === null) rs[k] = rem.shift()!;
      if (k < nL && ls[nL - 1 - k] === null) ls[nL - 1 - k] = rem.shift()!;
    }
    [...ls, heavy, ...rs].forEach(k => visit(k!));
  };
  const roots = map.crews.map(c => c.id).filter(id => !hasParent.has(id));
  roots.sort((a, b) => Number(b === map.startId) - Number(a === map.startId) || crewOrder.get(a)! - crewOrder.get(b)!);
  for (const r of roots) { weigh(r); visit(r); }
  for (const ch of chains) for (const id of ch.nodes) if (!pre.has(id)) pre.set(id, pre.get(ch.from)! + 0.5);

  // The spine: a child whose branch runs far deeper than its siblings' (or
  // an only child with no other way in) sits straight under its parent.
  const hgt = new Map<ID, number>();
  const heightOf = (id: ID): number => {
    const h = Math.max(-1, ...(kids.get(id) ?? []).map(heightOf)) + 1;
    hgt.set(id, h);
    return h;
  };
  for (const r of roots) heightOf(r);
  const domLink = new Set<string>();
  const pinned = new Set<string>();
  const upCount = (id: ID) => (nbr.get(id) ?? []).filter(n => node(n).layer === node(id).layer - 1).length;
  for (const [id, ks] of kids) {
    const byH = [...ks].sort((a, b) => hgt.get(b)! - hgt.get(a)!);
    const top = byH[0];
    const second = byH.length > 1 ? hgt.get(byH[1])! : -Infinity;
    if (hgt.get(top)! >= second + 2 && upCount(top) === 1) {
      domLink.add(`${id}|${top}`); domLink.add(`${top}|${id}`);
      pinned.add(id); pinned.add(top);
    }
  }
  for (const r of layers) r.sort((a, b) => pre.get(a)! - pre.get(b)!);

  // ── then barycentre sweeps, kept only if they cross fewer arrows ──
  const idx = new Map<string, number>();
  const reindex = (l: number) => layers[l].forEach((id, i) => idx.set(id, i));
  for (let l = 0; l < L; l++) reindex(l);
  const sortLayer = (l: number, adj: number) => {
    const keyed = layers[l].map((id, i) => {
      const ns = (nbr.get(id) ?? []).filter(n => node(n).layer === adj);
      return { id, i, k: ns.length ? ns.reduce((s, n) => s + idx.get(n)!, 0) / ns.length : i };
    });
    keyed.sort((a, b) => a.k - b.k || a.i - b.i);
    layers[l] = keyed.map(k => k.id);
    reindex(l);
  };
  const crossings = () => {
    let total = 0;
    for (let l = 0; l + 1 < L; l++) {
      const segs: [number, number][] = [];
      for (const id of layers[l]) for (const n of nbr.get(id) ?? []) if (node(n).layer === l + 1) segs.push([idx.get(id)!, idx.get(n)!]);
      for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
        if ((segs[i][0] - segs[j][0]) * (segs[i][1] - segs[j][1]) < 0) total++;
      }
    }
    return total;
  };
  let best = layers.map(r => [...r]);
  let bestX = crossings();
  for (let it = 0; it < 12 && bestX > 0; it++) {
    if (it % 2 === 0) for (let l = 1; l < L; l++) sortLayer(l, l - 1);
    else for (let l = L - 2; l >= 0; l--) sortLayer(l, l + 1);
    const x = crossings();
    if (x < bestX) { bestX = x; best = layers.map(r => [...r]); }
    if (bestX === 0) break;
  }
  best.forEach((r, l) => { layers[l] = r; reindex(l); });

  // ── x: pack, then slide toward connected crews (no overlaps, order kept) ──
  const gapOf = (a: string, b: string) => (node(a).way || node(b).way ? WAY_GAP : H_GAP);
  const left = new Map<string, number>();
  const center = (id: string) => left.get(id)! + node(id).w / 2;
  for (const r of layers) {
    let x = 0;
    r.forEach((id, i) => { if (i) x += gapOf(r[i - 1], id); left.set(id, x); x += node(id).w; });
    const shift = -x / 2;
    r.forEach(id => left.set(id, left.get(id)! + shift));
  }
  /** Lefts closest to the wished-for centres, keeping order and gaps. */
  const resolve = (r: string[], wish: number[]) => {
    interface Block { start: number; end: number; sum: number; n: number; left: number; width: number }
    const blocks: Block[] = [];
    r.forEach((id, i) => {
      const w = node(id).w;
      const wt = pinned.has(id) ? 60 : 1; // the spine holds its place; its row packs round it
      let b: Block = { start: i, end: i, sum: (wish[i] - w / 2) * wt, n: wt, left: wish[i] - w / 2, width: w };
      while (blocks.length) {
        const p = blocks[blocks.length - 1];
        const g = gapOf(r[p.end], r[b.start]);
        if (p.left + p.width + g <= b.left) break;
        const off = p.width + g;
        p.sum += b.sum - b.n * off;
        p.n += b.n;
        p.width += g + b.width;
        p.end = b.end;
        p.left = p.sum / p.n;
        b = blocks.pop()!;
      }
      blocks.push(b);
    });
    for (const b of blocks) {
      let x = b.left;
      for (let j = b.start; j <= b.end; j++) {
        left.set(r[j], x);
        x += node(r[j]).w + (j < b.end ? gapOf(r[j], r[j + 1]) : 0);
      }
    }
  };
  for (let it = 0; it < 14; it++) {
    const order = [...Array(L).keys()];
    if (it % 2) order.reverse();
    for (const l of order) {
      const r = layers[l];
      resolve(r, r.map(id => {
        const ns = nbr.get(id) ?? [];
        if (!ns.length) return center(id);
        // Waypoints pull harder: long arrows should run straight.
        let s = 0, n = 0;
        for (const o of ns) { const wt = domLink.has(`${id}|${o}`) ? 60 : node(o).way || node(id).way ? 2 : 1; s += center(o) * wt; n += wt; }
        return s / n;
      }));
    }
  }
  // The never-reached area sits centred under the start crew.
  if (map.startId) {
    const c0 = center(map.startId);
    const centreBlock = (ls: number[]) => {
      const ids = ls.flatMap(l => layers[l] ?? []);
      if (!ids.length) return;
      const lo = Math.min(...ids.map(id => left.get(id)!));
      const hi = Math.max(...ids.map(id => left.get(id)! + node(id).w));
      const shift = c0 - (lo + hi) / 2;
      for (const id of ids) left.set(id, left.get(id)! + shift);
    };
    if (bandLayer >= 0) centreBlock([...Array(L).keys()].filter(l => l >= bandLayer));
  }
  let minX = Infinity, maxX = -Infinity;
  for (const [id, x] of left) { minX = Math.min(minX, x); maxX = Math.max(maxX, x + node(id).w); }
  for (const [id, x] of left) left.set(id, x - minX + PAD_X);
  let width = maxX - minX + PAD_X * 2;

  // A move back up hooks into the side of its target facing its source.
  const retSide = new Map<number, 'l' | 'r'>();
  chains.forEach((ch, ci) => { if (ch.ret) retSide.set(ci, center(ch.from) >= center(ch.to) ? 'r' : 'l'); });
  const partnerRet = new Set(chains.filter(ch => ch.ret).map(ch => `${ch.to}>${ch.from}`));
  const lastStops = new Set<string>(map.noWayOut);
  // Same-row hops in one row get different heights, so their labels don't meet.
  const arcK = new Map<number, number>();
  const arcsInRow = new Map<number, number>();
  chains.forEach((ch, ci) => {
    if (!ch.same) return;
    const l = node(ch.from).layer;
    arcK.set(ci, arcsInRow.get(l) ?? 0);
    arcsInRow.set(l, (arcsInRow.get(l) ?? 0) + 1);
  });

  // ── y + arrows + labels; a gap too crowded for its labels grows and we go again ──
  const gaps = Array.from({ length: Math.max(0, L - 1) }, (_, l) => (l === bandLayer - 1 ? BAND_GAP : BASE_GAP));
  let result: CrewLayout = empty;
  let ext = { lo: 0, hi: 0 };
  for (let pass = 0; pass < 2; pass++) {
  for (let attempt = 0; attempt < 24; attempt++) {
    const top: number[] = [];
    let y = PAD_TOP;
    for (let l = 0; l < L; l++) {
      if (l === bandLayer && l > 0) y += BAND_EXTRA;
      top.push(y);
      y += CARD_H + (gaps[l] ?? 0);
    }
    const height = top[L - 1] + CARD_H + PAD_BOTTOM;

    // Arrow ends: on each side of each node, spread out and ordered by
    // where the arrow goes next, so neighbouring arrows don't cross.
    interface End { chain: number; at: number; otherX: number; down: boolean; x?: number }
    const ends = new Map<string, End[]>();
    const sideOf = (id: string, other: string) => (node(other).layer > node(id).layer ? 'b' : 't');
    chains.forEach((ch, ci) => {
      const down = node(ch.to).layer > node(ch.from).layer;
      if (ch.ret) return; // leaves its card's top corner, enters its target's side (below)
      ch.nodes.forEach((id, at) => {
        for (const o of [ch.nodes[at - 1], ch.nodes[at + 1]]) {
          if (o === undefined) continue;
          const sk = `${id}|${sideOf(id, o)}`;
          ends.set(sk, [...(ends.get(sk) ?? []), { chain: ci, at, otherX: center(o), down }]);
        }
      });
    });
    // Return moves into the same side of one card are spread vertically.
    const retY = new Map<number, number>();
    const bySide = new Map<string, number[]>();
    for (const [ci, side] of retSide) {
      const k = `${chains[ci].to}|${side}`;
      bySide.set(k, [...(bySide.get(k) ?? []), ci]);
    }
    for (const list of bySide.values()) {
      list.sort((a, b) => center(chains[a].from) - center(chains[b].from));
      list.forEach((ci, k) => retY.set(ci, (k - (list.length - 1) / 2) * 20));
    }
    const endX = new Map<string, number>(); // `${chain}|${at}|${side}` → x
    for (const [sk, list] of ends) {
      const [id, side] = sk.split('|');
      list.sort((a, b) => a.otherX - b.otherX || Number(b.down) - Number(a.down) || a.chain - b.chain);
      const n = list.length;
      const w = node(id).w;
      const step = n > 1 ? Math.min(PORT_STEP, (w * 0.72) / (n - 1)) : 0;
      // The two lines of a two-way move get extra room between them.
      const offs: number[] = [0];
      for (let k = 1; k < n; k++) {
        const a = chains[list[k - 1].chain], b = chains[list[k].chain];
        offs.push(offs[k - 1] + (a.from === b.to && a.to === b.from ? Math.max(step, PAIR_STEP) : step));
      }
      const span = offs[n - 1];
      // Keep clear of the card's tabs: "Last stop" sits bottom-right, "Start" top-left.
      const bias = side === 'b' && lastStops.has(id) ? -46 : side === 't' && id === map.startId ? 46 : 0;
      const base = Math.max(node(id).w * 0.14 + span / 2, Math.min(node(id).w * 0.86 - span / 2, node(id).w / 2 + bias));
      list.forEach((e, k) => endX.set(`${e.chain}|${e.at}|${side}`, left.get(id)! + base - span / 2 + offs[k]));
    }
    const sideY = (id: string, side: string) => top[node(id).layer] + (side === 'b' ? CARD_H : 0);

    const cards: Rect[] = map.crews.map(c => ({ x: left.get(c.id)!, y: top[node(c.id).layer], w: CARD_W, h: CARD_H }));
    const placed: Rect[] = [];
    const crowded = new Set<number>();

    const arrows: MapArrow[] = [];
    const plans = chains.map((ch, ci) => {
      const segs: { c: Cubic; gap: number; lean: number }[] = [];
      let d = '';
      if (ch.ret) {
        const side = retSide.get(ci)!, dir = side === 'r' ? 1 : -1;
        // Out of its card's side (the side it hooks toward), up the channel
        // between cards, into its target's side — the space above the card
        // stays free for the arrows and labels coming in.
        const fl = left.get(ch.from)!;
        const p0 = { x: side === 'r' ? fl + CARD_W : fl, y: top[node(ch.from).layer] + 26 };
        const tl = left.get(ch.to)!;
        const p3 = { x: side === 'r' ? tl + CARD_W + END_GAP : tl - END_GAP, y: top[node(ch.to).layer] + CARD_H / 2 + (retY.get(ci) ?? 0) };
        const reach = Math.max(70, Math.abs(p0.x - p3.x) * 0.5 + 40);
        const c: Cubic = [p0, { x: p0.x + dir * 34, y: p0.y - (p0.y - p3.y) * 0.55 }, { x: p3.x + dir * reach, y: p3.y }, p3];
        const d = `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${c[1].x.toFixed(1)} ${c[1].y.toFixed(1)}, ${c[2].x.toFixed(1)} ${c[2].y.toFixed(1)}, ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`;
        segs.push({ c, gap: node(ch.to).layer, lean: 1 });
        const name = map.crews.find(cr => cr.id === ch.to)?.name ?? '';
        return { ch, ci, segs, d, box: measureLabel(ch.moves, ch.twoWay ? `↑ Back to ${name}` : '', M) };
      }
      for (let i = 0; i + 1 < ch.nodes.length; i++) {
        const a = ch.nodes[i], b = ch.nodes[i + 1];
        const sa = ch.same ? 't' : sideOf(a, b);
        const sb = ch.same ? 't' : sideOf(b, a);
        const p0 = { x: endX.get(`${ci}|${i}|${sa}`) ?? center(a), y: sideY(a, sa) };
        const p3 = { x: endX.get(`${ci}|${i + 1}|${sb}`) ?? center(b), y: sideY(b, sb) };
        const last = i + 2 === ch.nodes.length;
        if (last) p3.y += sb === 't' ? -END_GAP : END_GAP;
        let c: Cubic;
        if (ch.same) {
          const hgt = ARC_H + (arcK.get(ci) ?? 0) * 46;
          c = [p0, { x: p0.x, y: p0.y - hgt }, { x: p3.x, y: p3.y - hgt }, p3];
        } else {
          const dy = (p3.y - p0.y) / 2;
          c = [p0, { x: p0.x, y: p0.y + dy }, { x: p3.x, y: p3.y - dy }, p3];
        }
        if (!d) d = `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}`;
        else d += ` L ${p0.x.toFixed(1)} ${p0.y.toFixed(1)}`; // straight through a waypoint
        d += ` C ${c[1].x.toFixed(1)} ${c[1].y.toFixed(1)}, ${c[2].x.toFixed(1)} ${c[2].y.toFixed(1)}, ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`;
        const la = node(a).layer, lb = node(b).layer;
        // Lean the label toward the end where arrows are spread out: above
        // each target of a fan, beside each source of a merge.
        const na = ends.get(`${a}|${sa}`)?.length ?? 1, nb = ends.get(`${b}|${sb}`)?.length ?? 1;
        segs.push({ c, gap: ch.same ? la - 1 : Math.min(la, lb), lean: ch.same ? 0 : Math.sign(na - nb) });
      }
      const name = map.crews.find(c => c.id === ch.to)?.name ?? '';
      const head = ch.twoWay ? `${ch.down ? '↓' : '↑'} ${ch.down ? 'To' : 'Back to'} ${name}` : '';
      return { ch, ci, segs, d, box: measureLabel(ch.moves, head, M) };
    });

    // The never-reached area's header is an obstacle too.
    if (bandLayer >= 0) {
      const bx = Math.min(...map.unreachable.map(id => left.get(id)!)) - 22;
      cards.push({ x: bx, y: top[bandLayer] - 46, w: 300, h: 30 });
    }
    // Every arrow as a polyline (with its box), so a label can keep off
    // the other arrows.
    const lines = plans.map(p => {
      const pts: Pt[] = [];
      for (const sg of p.segs) for (let k = 0; k <= 20; k++) pts.push(bez(sg.c, k / 20));
      const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
      const lo = { x: Math.min(...xs), y: Math.min(...ys) };
      return { key: p.ch.key, pts, box: { x: lo.x, y: lo.y, w: Math.max(...xs) - lo.x + 1, h: Math.max(...ys) - lo.y + 1 } };
    });
    /** How many other arrows pass through r; the partner of a two-way move counts as 1000. */
    const crossesOthers = (r: Rect, own: string, partner: string) => {
      let n = 0;
      const rr = { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 };
      for (const ln of lines) {
        if (ln.key === own || !overlap(rr, ln.box, 1)) continue;
        for (let k = 0; k + 1 < ln.pts.length; k++) if (segHits(ln.pts[k], ln.pts[k + 1], rr)) { n += ln.key === partner ? 1000 : 1; break; }
      }
      return n;
    };

    // Most constrained first: two-way labels, labels in the busiest gaps, then by position.
    const busy = new Map<number, number>();
    for (const p of plans) for (const s of p.segs) busy.set(s.gap, (busy.get(s.gap) ?? 0) + 1);
    const T_MID = [0.5, 0.42, 0.58, 0.35, 0.65, 0.28, 0.72, 0.22, 0.78];
    const T_LATE = [0.7, 0.64, 0.76, 0.58, 0.82, 0.5, 0.42, 0.35, 0.28];
    const T_EARLY = T_LATE.map(t => 1 - t);
    const order = [...plans].sort((p, q) => {
      const bp = Math.max(...p.segs.map(s => busy.get(s.gap) ?? 0));
      const bq = Math.max(...q.segs.map(s => busy.get(s.gap) ?? 0));
      const mp = bez(p.segs[0].c, 0.5), mq = bez(q.segs[0].c, 0.5);
      // One-sided labels first (return hooks, two-way pairs): they have the fewest spots.
      const cp = p.ch.ret || (p.ch.twoWay && !partnerRet.has(p.ch.key)), cq = q.ch.ret || (q.ch.twoWay && !partnerRet.has(q.ch.key));
      return Number(cq) - Number(cp) || bq - bp || mp.y - mq.y || mp.x - mq.x;
    });
    for (const p of order) {
      const { w, h } = p.box;
      // The two labels of a two-way move sit on their own side of the pair
      // (the down line is the left one), each hugging its line.
      // (A pair whose return move hooks round the side needs no such care.)
      // A return hook's label sits on the outer side of the hook, in the open.
      const side = p.ch.ret ? (retSide.get(p.ci) === 'r' ? 1 : -1)
        : p.ch.twoWay && !partnerRet.has(p.ch.key) ? (p.ch.down ? -1 : 1) : 0;
      const partnerKey = p.ch.twoWay ? `${p.ch.to}>${p.ch.from}` : '';
      const dxs = p.ch.ret ? [side * (w / 2 - 12), side * (w / 2 - 26), 0, -side * (w / 2 - 12)]
        : side ? [side * (w / 2 - 12), side * (w / 2 - 26), side * (w / 2 - PAIR_STEP + 8)] : [0, -w * 0.15, w * 0.15, -w * 0.28, w * 0.28];
      // Prefer the middle stretch of a long arrow.
      const segOrder = p.segs.map((s, i) => ({ s, i })).sort((a, b) => Math.abs(a.i - (p.segs.length - 1) / 2) - Math.abs(b.i - (p.segs.length - 1) / 2));
      let bestRect: Rect | null = null, bestCost = Infinity, bestHard = Infinity, bestGap = 0;
      outer: for (const { s } of segOrder) {
        for (const t of s.lean > 0 ? T_LATE : s.lean < 0 ? T_EARLY : T_MID) {
          const m = bez(s.c, t);
          for (const dx of dxs) {
            const r = { x: m.x + dx - w / 2, y: m.y - h / 2, w, h };
            let hard = 0;
            for (const c of cards) hard += overlap(r, c, 12) * 4;
            for (const o of placed) hard += overlap(r, o, 8);
            if (r.y < 6) hard += 1e6;
            // Soft: sitting on someone else's arrow, or drifting off its own line.
            // Hard overlaps always lose to soft ones; only a clean spot pays for the line check.
            const cost = hard > 0 ? 1e7 + hard : crossesOthers(r, p.ch.key, partnerKey) * 2500 + (side ? 0 : Math.abs(dx) * 2);
            if (cost < bestCost) { bestCost = cost; bestHard = hard; bestRect = r; bestGap = s.gap; }
            if (cost === 0) break outer;
          }
        }
      }
      // Too tight (no spot clear of cards and labels, or a two-way label on its
      // partner's line): the gap grows. Sitting on some other arrow grows it a
      // few times too, then is tolerated, so a busy map doesn't balloon.
      if (bestGap >= 0 && (bestHard > 0 || bestCost >= 2500 * 1000 || (bestCost >= 2500 && attempt < 8))) crowded.add(bestGap);
      placed.push(bestRect!);
      arrows.push({ key: p.ch.key, from: p.ch.from, to: p.ch.to, moves: p.ch.moves, d: p.d, label: { ...p.box, x: bestRect!.x, y: bestRect!.y } });
    }

    let band: Rect | null = null;
    if (bandLayer >= 0) {
      const xs = map.unreachable.map(id => left.get(id)!);
      const bx = Math.min(...xs) - 22;
      const by = top[bandLayer] - 46;
      band = { x: bx, y: by, w: Math.max(...xs) + CARD_W + 22 - bx, h: top[L - 1] + CARD_H + 22 - by };
    }

    const pos = new Map<ID, Pt>(map.crews.map(c => [c.id, { x: left.get(c.id)!, y: top[node(c.id).layer] }]));
    const axis = map.startId ? center(map.startId) : width / 2;
    result = { pos, arrows, width, height: band ? Math.max(height, band.y + band.h + 24) : height, band, metrics: M, axis };
    ext = {
      lo: Math.min(...arrows.map(a => a.label.x), ...lines.flatMap(l => [l.box.x])),
      hi: Math.max(...arrows.map(a => a.label.x + a.label.w), ...lines.map(l => l.box.x + l.box.w)),
    };
    if (!crowded.size) break;
    for (const g of crowded) if (g < gaps.length) gaps[g] += GROW_GAP;
  }
  // Labels or hooks past the board's edge: widen it (and move everything in) and go again.
  const shift = Math.max(0, 18 - ext.lo);
  const grow = Math.max(0, ext.hi + 18 - width);
  if (!arrowsExist(result) || (!shift && !grow)) break;
  for (const [id, x] of left) left.set(id, x + shift);
  width += shift + grow;
  }
  return result;
}
