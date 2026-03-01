// ── Radial layout engine for Review Map ──

import type { MapNode, MapEdge, MapData } from './map-data.js';
import { C, critColor, critBar } from './colors.js';

export interface Cell { ch: string; fg?: string; bold?: boolean }
interface Rect { x: number; y: number; w: number; h: number }

const CARD_H = 3;
const V_GAP = 2;
const MAX_SPOKES = 10;

function cw(name: string, hub: boolean): number {
  const min = hub ? 18 : 14;
  const max = hub ? 24 : 20;
  return Math.min(max, Math.max(min, name.length + 4));
}

function makeGrid(w: number, h: number): Cell[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ch: ' ' })));
}

function put(g: Cell[][], x: number, y: number, s: string, fg?: string, bold?: boolean) {
  if (y < 0 || y >= g.length) return;
  for (let i = 0; i < s.length; i++) {
    const c = x + i;
    if (c >= 0 && c < g[0].length) g[y][c] = { ch: s[i], fg, bold };
  }
}

function fillH(g: Cell[][], x1: number, x2: number, y: number) {
  if (y < 0 || y >= g.length) return;
  for (let x = x1; x <= x2; x++) {
    if (x >= 0 && x < g[0].length) g[y][x] = { ch: ' ' };
  }
}

function drawCard(
  g: Cell[][], r: Rect, n: MapNode,
  sel: boolean, hub: boolean, nextIdx: number, idx: number,
) {
  const bc = sel ? C.accent : C.dim;
  const nw = r.w - 4;
  const nm = n.name.length > nw ? n.name.slice(0, nw - 1) + '\u2026' : n.name;

  // Top border ┌─name───┐
  put(g, r.x, r.y, '\u250C\u2500' + nm + '\u2500'.repeat(Math.max(0, r.w - 3 - nm.length)) + '\u2510', bc, sel);

  // Content line │█8.2 ✓80%  │
  const cy = r.y + 1;
  const cb = critBar(n.crit);
  const pct = n.total > 0 ? Math.round(n.reviewed / n.total * 100) : 0;
  const pi = n.progress === 'complete' ? '\u2713' : n.progress === 'partial' ? '\u25D0' : ' ';
  const pc = n.progress === 'complete' ? C.green : n.progress === 'partial' ? C.orange : C.dim;
  const cs = n.crit.toFixed(1);

  put(g, r.x, cy, '\u2502', bc);
  let cx = r.x + 1;
  put(g, cx, cy, cb.char, cb.color); cx++;
  put(g, cx, cy, cs, critColor(n.crit), true); cx += cs.length;
  put(g, cx, cy, ' ', undefined); cx++;
  put(g, cx, cy, pi, pc); cx++;
  put(g, cx, cy, `${pct}%`, C.dim); cx += `${pct}%`.length;
  if (n.bugs > 0) { const s = `\u2717${n.bugs}`; put(g, cx, cy, s, C.red); cx += s.length; }
  if (n.questions > 0) { const s = `?${n.questions}`; put(g, cx, cy, s, C.orange); cx += s.length; }
  fillH(g, cx, r.x + r.w - 2, cy);
  put(g, r.x + r.w - 1, cy, '\u2502', bc);

  // Hub extra line: method heat blocks
  if (hub && r.h >= 4) {
    const my = r.y + 2;
    put(g, r.x, my, '\u2502', bc);
    let mx = r.x + 1;
    for (const m of n.methods.slice(0, r.w - 3)) {
      const mb = critBar(m.crit);
      put(g, mx, my, mb.char, m.reviewed ? C.dim : mb.color);
      mx++;
    }
    fillH(g, mx, r.x + r.w - 2, my);
    put(g, r.x + r.w - 1, my, '\u2502', bc);
  }

  // Bottom border
  const by = r.y + r.h - 1;
  const isNext = idx === nextIdx && n.progress !== 'complete';
  if (isNext) {
    const tag = 'NEXT';
    put(g, r.x, by, '\u2514' + '\u2500'.repeat(Math.max(0, r.w - tag.length - 3)) + tag + '\u2500\u2518', C.orange, true);
  } else {
    put(g, r.x, by, '\u2514' + '\u2500'.repeat(r.w - 2) + '\u2518', bc);
  }
}

function drawEdge(g: Cell[][], a: Rect, b: Rect, edge: MapEdge) {
  const lc = edge.crossRepo ? C.orange : C.cyan;
  const vc = edge.crossRepo ? '\u2551' : '\u2502';
  const hch = edge.crossRepo ? '\u2550' : '\u2500';

  // Same row? → horizontal
  if (Math.abs(a.y - b.y) < CARD_H) {
    const [left, right] = a.x < b.x ? [a, b] : [b, a];
    const y = left.y + Math.floor(left.h / 2);
    const x1 = left.x + left.w;
    const x2 = right.x - 1;
    if (x1 >= x2) return;
    for (let x = x1; x <= x2; x++) put(g, x, y, hch, lc);
    put(g, x2, y, '\u25B6', lc);
    if (edge.label && x2 - x1 > edge.label.length + 2) {
      put(g, x1 + Math.floor((x2 - x1 - edge.label.length) / 2), y, edge.label, C.dim);
    }
    return;
  }

  // Different rows → L-shaped or vertical
  const [top, bot] = a.y < b.y ? [a, b] : [b, a];
  const tx = top.x + Math.floor(top.w / 2);
  const ty = top.y + top.h;
  const bx = bot.x + Math.floor(bot.w / 2);
  const by = bot.y - 1;
  if (ty > by) return;

  if (Math.abs(tx - bx) <= 1) {
    // Straight vertical
    for (let y = ty; y <= by; y++) put(g, tx, y, vc, lc);
    put(g, tx, by, '\u25BC', lc);
    if (edge.label && by - ty >= 2) put(g, tx + 1, ty + 1, edge.label, C.dim);
  } else {
    // L-shape: down from top, horizontal, down to bot
    const midY = Math.floor((ty + by) / 2);
    for (let y = ty; y < midY; y++) put(g, tx, y, vc, lc);
    const [lx, rx] = tx < bx ? [tx, bx] : [bx, tx];
    for (let x = lx; x <= rx; x++) put(g, x, midY, hch, lc);
    put(g, tx, midY, tx < bx ? '\u2514' : '\u2518', lc);
    put(g, bx, midY, bx > tx ? '\u2510' : '\u250C', lc);
    for (let y = midY + 1; y <= by; y++) put(g, bx, y, vc, lc);
    put(g, bx, by, '\u25BC', lc);
    if (edge.label && rx - lx > edge.label.length + 2) {
      put(g, lx + Math.floor((rx - lx - edge.label.length) / 2), midY, edge.label, C.dim);
    }
  }
}

function placeRow(
  idxs: number[], y: number, totalW: number,
  nodes: MapNode[], rects: Map<number, Rect>,
) {
  if (idxs.length === 0) return;
  const widths = idxs.map(i => cw(nodes[i].name, false));
  const totalNeeded = widths.reduce((s, w) => s + w, 0) + (idxs.length - 1) * 2;
  let x = Math.max(1, Math.floor((totalW - totalNeeded) / 2));
  for (let i = 0; i < idxs.length; i++) {
    if (x + widths[i] > totalW - 1) break; // don't overflow
    rects.set(idxs[i], { x, y, w: widths[i], h: CARD_H });
    x += widths[i] + 2;
  }
}

export function buildMapGrid(
  md: MapData, width: number, height: number, selIdx: number,
): Cell[][] {
  const { nodes, edges, nextIdx } = md;
  if (nodes.length === 0) {
    const g = makeGrid(width, height);
    put(g, Math.floor((width - 16) / 2), Math.floor(height / 2), 'No changed files', C.dim);
    return g;
  }

  const g = makeGrid(width, height);
  const hub = nodes[0];

  // Connected node indices (linked to hub)
  const connSet = new Set<number>();
  for (const e of edges) {
    for (let i = 1; i < nodes.length; i++) {
      if ((nodes[i].name === e.from || nodes[i].name === e.to) &&
          (hub.name === e.from || hub.name === e.to)) {
        connSet.add(i);
      }
    }
  }

  // If few connections, promote all nodes as spokes
  const allSpokes = connSet.size >= 2
    ? [...connSet].sort((a, b) => nodes[b].crit - nodes[a].crit)
    : nodes.slice(1).map((_, i) => i + 1);
  const spokeIdxs = allSpokes.slice(0, MAX_SPOKES);
  const restIdxs = nodes.map((_, i) => i).filter(i => i !== 0 && !spokeIdxs.includes(i));

  // Hub placement (center)
  const hw = cw(hub.name, true);
  const hh = hub.methods.length > 0 ? 4 : 3;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const hubRect: Rect = { x: cx - Math.floor(hw / 2), y: cy - Math.floor(hh / 2), w: hw, h: hh };

  const topSpokes = spokeIdxs.slice(0, Math.ceil(spokeIdxs.length / 2));
  const botSpokes = spokeIdxs.slice(Math.ceil(spokeIdxs.length / 2));

  const rects = new Map<number, Rect>();
  rects.set(0, hubRect);

  const topY = Math.max(0, hubRect.y - V_GAP - CARD_H);
  placeRow(topSpokes, topY, width, nodes, rects);

  const botY = Math.min(height - CARD_H, hubRect.y + hubRect.h + V_GAP);
  placeRow(botSpokes, botY, width, nodes, rects);

  if (restIdxs.length > 0) {
    const restY = Math.min(height - CARD_H, botY + CARD_H + V_GAP);
    placeRow(restIdxs.slice(0, 6), restY, width, nodes, rects);
  }

  // Draw edges first (behind nodes)
  for (const e of edges) {
    const fi = nodes.findIndex(n => n.name === e.from);
    const ti = nodes.findIndex(n => n.name === e.to);
    const fr = rects.get(fi);
    const tr = rects.get(ti);
    if (fr && tr) drawEdge(g, fr, tr, e);
  }

  // Draw nodes on top
  for (const [idx, rect] of rects) {
    drawCard(g, rect, nodes[idx], idx === selIdx, idx === 0, nextIdx, idx);
  }

  return g;
}
