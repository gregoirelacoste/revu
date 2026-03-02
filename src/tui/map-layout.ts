// ── Spatial zone layout engine for Review Map v2 ──

import type { ClusterMapData, Cluster, CrossLink } from './cluster-data.js';
import { C, critColor, critBar } from './colors.js';

export interface Cell { ch: string; fg?: string; bold?: boolean }
interface Rect { x: number; y: number; w: number; h: number }

const CARD_H = 3;
const MAX_CLUSTERS_PER_ROW = 2;

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

// ── Cluster mini-card ──

function drawClusterCard(
  g: Cell[][], r: Rect, c: Cluster, selected: boolean,
) {
  const bc = selected ? C.accent : C.dim;
  const nw = r.w - 4;
  const nm = c.name.length > nw ? c.name.slice(0, nw - 1) + '\u2026' : c.name;

  // Top border
  put(g, r.x, r.y, '\u250C\u2500' + nm + '\u2500'.repeat(Math.max(0, r.w - 3 - nm.length)) + '\u2510', bc, selected);

  // Content: crit + file count + progress
  const cy = r.y + 1;
  const cb = critBar(c.maxCrit);
  const pct = c.total > 0 ? Math.round(c.reviewed / c.total * 100) : 0;
  const allDone = c.files.every(f => f.progress === 'complete');
  const anyStarted = c.files.some(f => f.progress !== 'none');
  const pi = allDone ? '\u2713' : anyStarted ? '\u25D0' : ' ';
  const pc = allDone ? C.green : anyStarted ? C.orange : C.dim;
  const cs = c.maxCrit.toFixed(1);
  const fc = `${c.files.length}f`;

  put(g, r.x, cy, '\u2502', bc);
  let cx = r.x + 1;
  put(g, cx, cy, cb.char, cb.color); cx++;
  put(g, cx, cy, cs, critColor(c.maxCrit), true); cx += cs.length;
  put(g, cx, cy, ' ', undefined); cx++;
  put(g, cx, cy, pi, pc); cx++;
  put(g, cx, cy, fc, C.dim); cx += fc.length;
  if (c.bugs > 0) { const s = ` \u2717${c.bugs}`; put(g, cx, cy, s, C.red); cx += s.length; }
  if (c.questions > 0) { const s = ` ?${c.questions}`; put(g, cx, cy, s, C.orange); cx += s.length; }
  fillH(g, cx, r.x + r.w - 2, cy);
  put(g, r.x + r.w - 1, cy, '\u2502', bc);

  // Bottom border
  const by = r.y + r.h - 1;
  put(g, r.x, by, '\u2514' + '\u2500'.repeat(r.w - 2) + '\u2518', bc);
}

// ── Repo zone frame ──

function drawRepoFrame(
  g: Cell[][], r: Rect, name: string, isMain: boolean,
) {
  const fc = isMain ? C.accent : C.dim;
  const tl = isMain ? '\u2554' : '\u250C';
  const tr = isMain ? '\u2557' : '\u2510';
  const bl = isMain ? '\u255A' : '\u2514';
  const br = isMain ? '\u255D' : '\u2518';
  const hch = isMain ? '\u2550' : '\u2500';
  const vch = isMain ? '\u2551' : '\u2502';

  // Title: ╔══ name ══╗
  const maxNameW = r.w - 6;
  const nm = name.length > maxNameW ? name.slice(0, maxNameW - 1) + '\u2026' : name;
  const padR = Math.max(0, r.w - 4 - nm.length);
  put(g, r.x, r.y, `${tl}${hch}${hch} ${nm} ${hch.repeat(padR)}${tr}`, fc);

  // Sides
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) {
    put(g, r.x, y, vch, fc);
    put(g, r.x + r.w - 1, y, vch, fc);
  }

  // Bottom
  put(g, r.x, r.y + r.h - 1, `${bl}${hch.repeat(r.w - 2)}${br}`, fc);
}

// ── Side repo zone (satellite) ──

function drawSideZone(
  g: Cell[][], r: Rect, repoName: string,
  cd: ClusterMapData,
) {
  drawRepoFrame(g, r, repoName, false);

  // List files belonging to this repo from all clusters
  const repoFiles: { name: string; type: string; crit: number; progress: string }[] = [];
  for (const cluster of cd.clusters) {
    for (const f of cluster.files) {
      if (f.repo === repoName) {
        repoFiles.push({ name: f.name, type: f.type, crit: f.crit, progress: f.progress });
      }
    }
  }
  repoFiles.sort((a, b) => b.crit - a.crit);

  const maxLines = r.h - 3;
  const innerW = r.w - 4;
  let y = r.y + 1;
  const shown = repoFiles.slice(0, maxLines);
  for (const f of shown) {
    if (y >= r.y + r.h - 1) break;
    const nm = f.name.length > innerW - 5 ? f.name.slice(0, innerW - 6) + '\u2026' : f.name;
    const pi = f.progress === 'complete' ? '\u2713' : f.progress === 'partial' ? '\u25D0' : ' ';
    const pc = f.progress === 'complete' ? C.green : f.progress === 'partial' ? C.orange : C.dim;
    put(g, r.x + 2, y, nm, C.text);
    put(g, r.x + 2 + nm.length + 1, y, pi, pc);
    y++;
  }
  if (repoFiles.length > maxLines) {
    put(g, r.x + 2, Math.min(y, r.y + r.h - 2), `${repoFiles.length} files`, C.dim);
  }
}

// ── Cross-repo arrows ──

function drawCrossArrows(
  g: Cell[][], clusterRects: Map<number, Rect>,
  sideRects: Map<string, Rect>, cd: ClusterMapData,
) {
  for (const link of cd.crossLinks) {
    const fromR = clusterRects.get(link.fromCluster);
    const toR = clusterRects.get(link.toCluster);
    if (!fromR || !toR) continue;

    const lc = link.crossRepo ? C.orange : C.cyan;
    const hch = link.crossRepo ? '\u2550' : '\u2500';

    // Horizontal arrow between rects
    const [left, right] = fromR.x < toR.x ? [fromR, toR] : [toR, fromR];
    const y = left.y + Math.floor(left.h / 2);
    const x1 = left.x + left.w;
    const x2 = right.x - 1;
    if (x1 >= x2 || y < 0 || y >= g.length) continue;
    for (let x = x1; x <= x2; x++) put(g, x, y, hch, lc);
    put(g, x2, y, left === fromR ? '\u25B6' : '\u25C0', lc);
  }

  // Arrows from side zones to clusters that touch them
  for (const [repoName, sideRect] of sideRects) {
    const linkedClusters = new Set<number>();
    for (const link of cd.crossLinks) {
      const fromCluster = cd.clusters[link.fromCluster];
      const toCluster = cd.clusters[link.toCluster];
      if (fromCluster?.mainRepo === repoName) linkedClusters.add(link.toCluster);
      if (toCluster?.mainRepo === repoName) linkedClusters.add(link.fromCluster);
    }
    for (const ci of linkedClusters) {
      const cr = clusterRects.get(ci);
      if (!cr) continue;
      const lc = C.orange;
      const y = sideRect.y + Math.floor(sideRect.h / 2);
      if (sideRect.x < cr.x) {
        // Side is left of cluster
        const x1 = sideRect.x + sideRect.w;
        const x2 = cr.x - 1;
        if (x1 >= x2) continue;
        for (let x = x1; x <= x2; x++) put(g, x, y, '\u2500', lc);
        put(g, x2, y, '\u25B6', lc);
      } else {
        // Side is right of cluster
        const x1 = cr.x + cr.w;
        const x2 = sideRect.x - 1;
        if (x1 >= x2) continue;
        for (let x = x1; x <= x2; x++) put(g, x, y, '\u2500', lc);
        put(g, x1, y, '\u25C0', lc);
      }
    }
  }
}

// ── Intra-repo edges (vertical between clusters) ──

function drawIntraEdges(
  g: Cell[][], clusterRects: Map<number, Rect>, cd: ClusterMapData,
) {
  for (const link of cd.crossLinks) {
    if (link.crossRepo) continue;
    const fromR = clusterRects.get(link.fromCluster);
    const toR = clusterRects.get(link.toCluster);
    if (!fromR || !toR) continue;

    const lc = C.cyan;
    // Vertical line if roughly same column
    const [top, bot] = fromR.y < toR.y ? [fromR, toR] : [toR, fromR];
    const tx = top.x + Math.floor(top.w / 2);
    const ty = top.y + top.h;
    const by = bot.y - 1;
    if (ty > by) continue;
    for (let y = ty; y <= by; y++) put(g, tx, y, '\u2502', lc);
    put(g, tx, by, '\u25BC', lc);
  }
}

// ── Main layout builder ──

export function buildSpatialGrid(
  cd: ClusterMapData, width: number, height: number, selCluster: number,
): Cell[][] {
  if (cd.clusters.length === 0) {
    const g = makeGrid(width, height);
    put(g, Math.floor((width - 16) / 2), Math.floor(height / 2), 'No changed files', C.dim);
    return g;
  }

  const g = makeGrid(width, height);
  const narrow = width < 100;

  // Horizontal allocation
  let mainX: number, mainW: number;
  let leftX = 0, leftW = 0, rightX = 0, rightW = 0;

  if (cd.sideRepos.length === 0 || narrow) {
    mainX = 1; mainW = width - 2;
  } else if (cd.sideRepos.length === 1) {
    leftW = Math.floor(width * 0.25);
    mainW = width - leftW - 2;
    leftX = 0;
    mainX = leftW + 1;
  } else {
    leftW = Math.floor(width * 0.22);
    rightW = Math.floor(width * 0.22);
    mainW = width - leftW - rightW - 2;
    leftX = 0;
    mainX = leftW + 1;
    rightX = mainX + mainW + 1;
  }

  const mainH = height;
  const clusterRects = new Map<number, Rect>();
  const sideRects = new Map<string, Rect>();

  // Draw main repo frame
  drawRepoFrame(g, { x: mainX, y: 0, w: mainW, h: mainH }, cd.mainRepo, true);

  // Place clusters inside main zone (grid layout)
  const mainClusters = cd.clusters
    .map((c, i) => ({ cluster: c, idx: i }))
    .filter(ci => ci.cluster.mainRepo === cd.mainRepo);

  const cardW = Math.max(14, Math.min(28, Math.floor((mainW - 4) / MAX_CLUSTERS_PER_ROW) - 2));
  const vGap = 1;
  let row = 0, col = 0;
  const startY = 2;
  const startX = mainX + 2;

  for (const { cluster, idx } of mainClusters) {
    const cx = startX + col * (cardW + 3);
    const cy = startY + row * (CARD_H + vGap);
    if (cy + CARD_H > mainH - 1) break; // don't overflow
    const rect: Rect = { x: cx, y: cy, w: cardW, h: CARD_H };
    clusterRects.set(idx, rect);
    drawClusterCard(g, rect, cluster, idx === selCluster);
    col++;
    if (col >= MAX_CLUSTERS_PER_ROW) { col = 0; row++; }
  }

  // Also place non-main clusters in the main zone (they span repos)
  const otherClusters = cd.clusters
    .map((c, i) => ({ cluster: c, idx: i }))
    .filter(ci => ci.cluster.mainRepo !== cd.mainRepo);

  for (const { cluster, idx } of otherClusters) {
    if (!clusterRects.has(idx)) {
      const cx = startX + col * (cardW + 3);
      const cy = startY + row * (CARD_H + vGap);
      if (cy + CARD_H > mainH - 1) break;
      const rect: Rect = { x: cx, y: cy, w: cardW, h: CARD_H };
      clusterRects.set(idx, rect);
      drawClusterCard(g, rect, cluster, idx === selCluster);
      col++;
      if (col >= MAX_CLUSTERS_PER_ROW) { col = 0; row++; }
    }
  }

  // Draw side zones
  if (!narrow && cd.sideRepos.length >= 1) {
    const sr = cd.sideRepos[0];
    const sideH = Math.min(mainH, Math.max(6, mainH));
    const rect: Rect = { x: leftX, y: 0, w: leftW, h: sideH };
    sideRects.set(sr, rect);
    drawSideZone(g, rect, sr, cd);
  }
  if (!narrow && cd.sideRepos.length >= 2) {
    const sr = cd.sideRepos[1];
    const sideH = Math.min(mainH, Math.max(6, mainH));
    const rect: Rect = { x: rightX, y: 0, w: rightW, h: sideH };
    sideRects.set(sr, rect);
    drawSideZone(g, rect, sr, cd);
  }

  // Draw edges
  drawIntraEdges(g, clusterRects, cd);
  drawCrossArrows(g, clusterRects, sideRects, cd);

  return g;
}
