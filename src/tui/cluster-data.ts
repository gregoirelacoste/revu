// ── Cluster map data builder for Review Map overlay ──

import { basename, extname } from 'node:path';
import type { ScanResult } from '../core/engine.js';
import type { FileEntry } from '../core/engine.js';
import type { RepoGraph } from '../core/analyzer/repo-graph.js';
import { allMethods } from '../core/analyzer/side-effects.js';
import { computeFileReviewStats, computeGlobalReviewStats } from './review-stats.js';
import type { TuiFileDiff, ClusterFile, Cluster, RepoClusterData, ClusterMapData } from './types.js';
import type { LineReview } from './hooks/useReview.js';

function buildClusterFile(
  file: FileEntry, diff: TuiFileDiff, lineReviews: Map<string, LineReview>,
): ClusterFile {
  const stats = computeFileReviewStats(file.id, diff, lineReviews);
  const progress: ClusterFile['progress'] =
    stats.total === 0 ? 'complete'
    : stats.reviewed === stats.total ? 'complete'
    : stats.reviewed > 0 ? 'partial' : 'none';
  return {
    fileId: file.id,
    name: basename(file.path, extname(file.path)),
    type: file.type,
    crit: file.crit,
    progress,
    bugs: stats.bugs,
    questions: stats.questions,
    sideEffect: allMethods(file).some(m => m.impacted),
  };
}

function findCommonPrefix(names: string[]): string {
  if (names.length === 0) return '';
  // Extract base names: "case.controller" → "case"
  const bases = names.map(n => {
    const dotIdx = n.indexOf('.');
    return dotIdx > 0 ? n.slice(0, dotIdx) : n;
  });
  // If all share the same base prefix, use it
  const first = bases[0];
  if (bases.every(b => b === first)) return first.charAt(0).toUpperCase() + first.slice(1);
  // Fallback: empty
  return '';
}

function nameCluster(files: ClusterFile[]): string {
  const prefix = findCommonPrefix(files.map(f => f.name));
  if (prefix) return prefix;
  // Fallback: name of highest-crit file
  const top = files.reduce((a, b) => a.crit >= b.crit ? a : b);
  const dotIdx = top.name.indexOf('.');
  const base = dotIdx > 0 ? top.name.slice(0, dotIdx) : top.name;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function buildRepoClusterData(
  repoName: string,
  branch: string,
  files: FileEntry[],
  graph: RepoGraph | undefined,
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): RepoClusterData {
  // Only files with diffs
  const changedFiles = files.filter(f => diffs.has(f.id));
  if (changedFiles.length === 0) {
    return { repoName, branch, fileCount: 0, maxCrit: 0, clusters: [], standalone: [] };
  }

  const changedPaths = new Set(changedFiles.map(f => f.path));
  const pathToFile = new Map(changedFiles.map(f => [f.path, f]));

  // Build bidirectional adjacency restricted to changed files
  const adj = new Map<string, Set<string>>();
  for (const path of changedPaths) adj.set(path, new Set());

  if (graph) {
    for (const path of changedPaths) {
      for (const edge of graph.edges.get(path) ?? []) {
        if (changedPaths.has(edge.to)) {
          adj.get(path)!.add(edge.to);
          adj.get(edge.to)!.add(path);
        }
      }
      for (const edge of graph.reverseEdges.get(path) ?? []) {
        if (changedPaths.has(edge.from)) {
          adj.get(path)!.add(edge.from);
          adj.get(edge.from)!.add(path);
        }
      }
    }
  }

  // BFS connected components
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const path of changedPaths) {
    if (visited.has(path)) continue;
    const component: string[] = [];
    const queue = [path];
    visited.add(path);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      component.push(cur);
      for (const neighbor of adj.get(cur) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  // Separate clusters (2+ files) from standalone (1 file)
  const clusters: Cluster[] = [];
  const standalone: ClusterFile[] = [];

  for (const comp of components) {
    const clusterFiles = comp
      .map(path => {
        const file = pathToFile.get(path)!;
        const diff = diffs.get(file.id)!;
        return buildClusterFile(file, diff, lineReviews);
      })
      .sort((a, b) => b.crit - a.crit);

    if (comp.length === 1) {
      standalone.push(clusterFiles[0]);
    } else {
      clusters.push({
        name: nameCluster(clusterFiles),
        files: clusterFiles,
        maxCrit: clusterFiles[0].crit,
        totalBugs: clusterFiles.reduce((s, f) => s + f.bugs, 0),
      });
    }
  }

  // Sort: clusters by maxCrit desc, standalone by crit desc
  clusters.sort((a, b) => b.maxCrit - a.maxCrit);
  standalone.sort((a, b) => b.crit - a.crit);

  const maxCrit = Math.max(
    ...clusters.map(c => c.maxCrit),
    ...standalone.map(f => f.crit),
    0,
  );

  return { repoName, branch, fileCount: changedFiles.length, maxCrit, clusters, standalone };
}

export function buildClusterMapData(
  scanResult: ScanResult,
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): ClusterMapData {
  const globalStats = computeGlobalReviewStats(diffs, lineReviews);

  const repos: RepoClusterData[] = [];
  for (const repo of scanResult.repos) {
    const graph = scanResult.repoGraph.get(repo.name);
    repos.push(buildRepoClusterData(repo.name, repo.branch, repo.files, graph, diffs, lineReviews));
  }

  // Collect side-effects: files with impacted methods
  const sideEffects: Array<{ file: string; methods: string[] }> = [];
  for (const repo of scanResult.repos) {
    for (const file of repo.files) {
      if (!diffs.has(file.id)) continue;
      const impacted = allMethods(file).filter(m => m.impacted).map(m => m.name);
      if (impacted.length > 0) {
        sideEffects.push({ file: file.name, methods: impacted });
      }
    }
  }

  return { repos, globalStats, sideEffects };
}
