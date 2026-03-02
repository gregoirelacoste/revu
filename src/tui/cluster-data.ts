// ── Cluster-based data layer for Review Map v2 ──

import type { ScanResult } from '../core/engine.js';
import type { TuiFileDiff } from './types.js';
import type { LineReview } from './hooks/useReview.js';

export interface ClusterFile {
  fileId: string;
  path: string;
  name: string;
  repo: string;
  type: string;
  crit: number;
  progress: 'none' | 'partial' | 'complete';
  isAnchor: boolean;
  reviewed: number;
  total: number;
  bugs: number;
  questions: number;
}

export interface CrossLink {
  fromCluster: number;
  toCluster: number;
  fromFile: string;
  toFile: string;
  type: string;
  crossRepo: boolean;
}

export interface Cluster {
  name: string;
  maxCrit: number;
  repos: string[];
  mainRepo: string;
  files: ClusterFile[];
  reviewed: number;
  total: number;
  bugs: number;
  questions: number;
}

export interface ClusterMapData {
  clusters: Cluster[];
  crossLinks: CrossLink[];
  mainRepo: string;
  sideRepos: string[];
  totalFiles: number;
  repoCount: number;
}

// ── Helpers ──

interface FileNode {
  fileId: string;
  path: string;
  name: string;
  repo: string;
  type: string;
  crit: number;
  progress: 'none' | 'partial' | 'complete';
  reviewed: number;
  total: number;
  bugs: number;
  questions: number;
}

function countFileStats(
  fileId: string,
  diff: TuiFileDiff,
  lineReviews: Map<string, LineReview>,
): { reviewed: number; total: number; bugs: number; questions: number } {
  let rev = 0, tot = 0, bugs = 0, questions = 0;
  for (const row of diff.rows) {
    if (row.type === 'diffRow' && row.reviewLine && row.reviewLine.t === 'add') {
      tot++;
      const lr = lineReviews.get(`${fileId}:${row.reviewLine.n}`);
      if (lr?.flag) rev++;
      if (lr?.flag === 'bug') bugs++;
      if (lr?.flag === 'question') questions++;
    }
  }
  return { reviewed: rev, total: tot, bugs, questions };
}

function isAnchorType(type: string): boolean {
  return type === 'controller' || type === 'component';
}

// BFS connected components on file adjacency graph
function findComponents(adj: Map<string, Set<string>>, paths: string[]): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const p of paths) {
    if (visited.has(p)) continue;
    const comp: string[] = [];
    const queue = [p];
    visited.add(p);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    components.push(comp);
  }
  return components;
}

function clusterName(files: FileNode[]): string {
  const anchor = files.find(f => isAnchorType(f.type));
  if (anchor) {
    const base = anchor.name.replace(/\.(controller|component|resolver)\.[^.]+$/, '');
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  // Dominant directory
  const dirs = new Map<string, number>();
  for (const f of files) {
    const parts = f.path.split('/');
    const dir = parts.length > 2 ? parts[parts.length - 2] : parts[0] ?? '';
    dirs.set(dir, (dirs.get(dir) ?? 0) + 1);
  }
  let best = '', bestCount = 0;
  for (const [d, c] of dirs) {
    if (c > bestCount) { best = d; bestCount = c; }
  }
  if (best) return best.charAt(0).toUpperCase() + best.slice(1);
  // Fallback: highest crit file
  const top = [...files].sort((a, b) => b.crit - a.crit)[0];
  return top?.name.replace(/\.[^.]+$/, '') ?? 'Cluster';
}

function buildCluster(files: FileNode[], name: string): Cluster {
  const sorted = [...files].sort((a, b) => {
    const aAnch = isAnchorType(a.type);
    const bAnch = isAnchorType(b.type);
    if (aAnch !== bAnch) return aAnch ? -1 : 1;
    return b.crit - a.crit;
  });
  const maxCrit = Math.max(0, ...files.map(f => f.crit));
  const repos = [...new Set(files.map(f => f.repo))];
  const repoCounts = new Map<string, number>();
  for (const f of files) repoCounts.set(f.repo, (repoCounts.get(f.repo) ?? 0) + 1);
  let mainRepo = repos[0] ?? '';
  let mainCount = 0;
  for (const [r, c] of repoCounts) {
    if (c > mainCount) { mainRepo = r; mainCount = c; }
  }

  const clusterFiles: ClusterFile[] = sorted.map(f => ({
    fileId: f.fileId,
    path: f.path,
    name: f.name,
    repo: f.repo,
    type: f.type,
    crit: f.crit,
    progress: f.progress,
    isAnchor: isAnchorType(f.type),
    reviewed: f.reviewed,
    total: f.total,
    bugs: f.bugs,
    questions: f.questions,
  }));

  const reviewed = files.reduce((s, f) => s + f.reviewed, 0);
  const total = files.reduce((s, f) => s + f.total, 0);
  const bugs = files.reduce((s, f) => s + f.bugs, 0);
  const questions = files.reduce((s, f) => s + f.questions, 0);

  return { name, maxCrit, repos, mainRepo, files: clusterFiles, reviewed, total, bugs, questions };
}

// ── Main builder ──

export function buildClusterMapData(
  data: ScanResult,
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>,
): ClusterMapData {
  // 1. Build file nodes for all changed files
  const fileNodes = new Map<string, FileNode>();
  const changedPaths = new Set<string>();

  for (const repo of data.repos) {
    for (const file of repo.files) {
      if (!diffs.has(file.id)) continue;
      changedPaths.add(file.path);
      const diff = diffs.get(file.id)!;
      const stats = countFileStats(file.id, diff, lineReviews);
      fileNodes.set(file.path, {
        fileId: file.id,
        path: file.path,
        name: `${file.name}${file.ext}`,
        repo: repo.name,
        type: file.type,
        crit: file.crit,
        progress: fileProgress.get(file.id) ?? 'none',
        ...stats,
      });
    }
  }

  const paths = [...changedPaths];
  if (paths.length === 0) {
    return { clusters: [], crossLinks: [], mainRepo: '', sideRepos: [], totalFiles: 0, repoCount: 0 };
  }

  // 2. Adjacency graph from links (excluding 'type' links)
  const adj = new Map<string, Set<string>>();
  for (const p of paths) adj.set(p, new Set());
  for (const link of data.links) {
    if (link.type === 'type') continue;
    if (!changedPaths.has(link.fromFile) || !changedPaths.has(link.toFile)) continue;
    adj.get(link.fromFile)!.add(link.toFile);
    adj.get(link.toFile)!.add(link.fromFile);
  }

  // 3. Connected components via BFS
  let components = findComponents(adj, paths);

  // 4. Split large components (>30 files): remove hubs
  const finalComponents: string[][] = [];
  for (const comp of components) {
    if (comp.length <= 30) { finalComponents.push(comp); continue; }
    const degrees = new Map<string, number>();
    for (const p of comp) degrees.set(p, adj.get(p)?.size ?? 0);
    const degValues = [...degrees.values()].sort((a, b) => a - b);
    const median = degValues[Math.floor(degValues.length / 2)] ?? 1;
    const threshold = median * 2;
    const hubs = new Set<string>();
    for (const p of comp) {
      const node = fileNodes.get(p);
      if ((degrees.get(p)! > threshold) && (node?.type === 'module' || node?.type === 'service')) {
        hubs.add(p);
      }
    }
    if (hubs.size === 0) { finalComponents.push(comp); continue; }
    // Remove hub edges and recompute components
    const subAdj = new Map<string, Set<string>>();
    const nonHubs = comp.filter(p => !hubs.has(p));
    for (const p of nonHubs) subAdj.set(p, new Set());
    for (const p of nonHubs) {
      for (const nb of adj.get(p) ?? []) {
        if (!hubs.has(nb) && subAdj.has(nb)) subAdj.get(p)!.add(nb);
      }
    }
    const subComps = findComponents(subAdj, nonHubs);
    finalComponents.push(...subComps);
    if (hubs.size > 0) finalComponents.push([...hubs]); // "Shared" cluster
  }

  // 5. Merge small clusters (<=2 files AND maxCrit < 3) into "Minor Changes"
  const realClusters: string[][] = [];
  const minorFiles: string[] = [];
  for (const comp of finalComponents) {
    const maxCrit = Math.max(0, ...comp.map(p => fileNodes.get(p)?.crit ?? 0));
    if (comp.length <= 2 && maxCrit < 3) {
      minorFiles.push(...comp);
    } else {
      realClusters.push(comp);
    }
  }
  if (minorFiles.length > 0) realClusters.push(minorFiles);

  // 6. Build Cluster objects
  const pathToCluster = new Map<string, number>();
  const clusters: Cluster[] = [];
  for (let i = 0; i < realClusters.length; i++) {
    const comp = realClusters[i];
    const files = comp.map(p => fileNodes.get(p)!).filter(Boolean);
    if (files.length === 0) continue;
    const isMinor = comp === minorFiles && minorFiles.length > 0;
    const isShared = files.every(f => f.type === 'module' || f.type === 'service') && files.length <= 3;
    const name = isMinor ? 'Minor Changes' : isShared ? 'Shared' : clusterName(files);
    const cluster = buildCluster(files, name);
    const idx = clusters.length;
    clusters.push(cluster);
    for (const p of comp) pathToCluster.set(p, idx);
  }

  // 7. Sort clusters by maxCrit desc
  const sortOrder = clusters.map((_, i) => i).sort((a, b) => clusters[b].maxCrit - clusters[a].maxCrit);
  const reindexed = sortOrder.map(i => clusters[i]);
  const oldToNew = new Map<number, number>();
  sortOrder.forEach((oldIdx, newIdx) => oldToNew.set(oldIdx, newIdx));
  // Remap pathToCluster
  for (const [p, oldIdx] of pathToCluster) {
    pathToCluster.set(p, oldToNew.get(oldIdx) ?? oldIdx);
  }

  // 8. Cross-links between clusters
  const crossLinks: CrossLink[] = [];
  const seenLinks = new Set<string>();
  for (const link of data.links) {
    if (link.type === 'type') continue;
    if (!changedPaths.has(link.fromFile) || !changedPaths.has(link.toFile)) continue;
    const fromC = pathToCluster.get(link.fromFile);
    const toC = pathToCluster.get(link.toFile);
    if (fromC === undefined || toC === undefined || fromC === toC) continue;
    const key = `${Math.min(fromC, toC)}-${Math.max(fromC, toC)}`;
    if (seenLinks.has(key)) continue;
    seenLinks.add(key);
    crossLinks.push({
      fromCluster: fromC,
      toCluster: toC,
      fromFile: link.fromFile,
      toFile: link.toFile,
      type: link.type,
      crossRepo: link.cross,
    });
  }

  // 9. Repo layout
  const repoClusters = new Map<string, number>();
  for (const c of reindexed) {
    repoClusters.set(c.mainRepo, (repoClusters.get(c.mainRepo) ?? 0) + 1);
  }
  let mainRepo = '';
  let mainCount = 0;
  for (const [r, c] of repoClusters) {
    if (c > mainCount) { mainRepo = r; mainCount = c; }
  }
  const allRepos = [...new Set(data.repos.map(r => r.name))];
  const sideRepos = allRepos.filter(r => r !== mainRepo);

  return {
    clusters: reindexed,
    crossLinks,
    mainRepo,
    sideRepos,
    totalFiles: paths.length,
    repoCount: allRepos.length,
  };
}
