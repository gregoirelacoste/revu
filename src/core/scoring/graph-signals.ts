// ── Graph-based scoring signals ──
// Pure functions that derive objective structural signals from the full repo graph.
// These become the primary source of truth for file criticality scoring.

import type { RepoGraph } from '../analyzer/repo-graph.js';
import type { ScoringConfig } from '../types.js';

// ── graphImportance: how many files import this one (direct) ──

export function computeGraphImportance(path: string, graph: RepoGraph): number {
  const incoming = graph.reverseEdges.get(path);
  if (!incoming) return 0;
  return Math.min(1.0, incoming.length / 15);
}

// ── callerCritWeight: max fileType weight among importers ──

export function computeCallerCritWeight(
  path: string,
  graph: RepoGraph,
  fileTypes: Record<string, number>,
): number {
  const incoming = graph.reverseEdges.get(path);
  if (!incoming || incoming.length === 0) return 0;

  let maxWeight = 0;
  for (const edge of incoming) {
    const callerNode = graph.nodes.get(edge.from);
    if (!callerNode) continue;
    const weight = fileTypes[callerNode.fileType] ?? 0.4;
    if (weight > maxWeight) maxWeight = weight;
  }
  return maxWeight;
}

// ── entryProximity: inverse distance to nearest entry point (controller/resolver) ──

export function computeEntryProximity(path: string, graph: RepoGraph): number {
  const node = graph.nodes.get(path);
  if (!node) return 0;
  if (node.isEntry) return 1.0;

  // BFS on reverse edges (who imports me → who imports them → ...)
  const visited = new Set<string>([path]);
  let frontier = [path];
  let depth = 0;
  const maxDepth = 10;

  while (frontier.length > 0 && depth < maxDepth) {
    depth++;
    const next: string[] = [];

    for (const current of frontier) {
      const incoming = graph.reverseEdges.get(current);
      if (!incoming) continue;

      for (const edge of incoming) {
        if (visited.has(edge.from)) continue;
        visited.add(edge.from);

        const callerNode = graph.nodes.get(edge.from);
        if (callerNode?.isEntry) {
          return 1 / (1 + depth);
        }
        next.push(edge.from);
      }
    }

    frontier = next;
  }

  // No entry point reachable
  return 0;
}

// ── exclusivity: is this the only provider for its callers? ──
// For each caller that imports this file, count how many OTHER files
// provide similar exports. If this file is the sole provider, exclusivity = 1.0.

export function computeExclusivity(path: string, graph: RepoGraph): number {
  const incoming = graph.reverseEdges.get(path);
  if (!incoming || incoming.length === 0) return 0;

  const node = graph.nodes.get(path);
  if (!node) return 0;

  let totalScore = 0;
  let callerCount = 0;

  for (const edge of incoming) {
    // For this caller, how many other files does it import?
    const callerEdges = graph.edges.get(edge.from);
    if (!callerEdges) {
      totalScore += 1.0; // sole import = exclusive
      callerCount++;
      continue;
    }

    // Count alternatives: other files imported by this caller with same type
    const alternatives = callerEdges.filter(e =>
      e.to !== path && graph.nodes.get(e.to)?.fileType === node.fileType,
    ).length;

    totalScore += 1 / (1 + alternatives);
    callerCount++;
  }

  return callerCount > 0 ? totalScore / callerCount : 0;
}

// ── Aggregate: compute all graph signals for a file ──

export interface GraphSignals {
  graphImportance: number;
  callerCritWeight: number;
  entryProximity: number;
  exclusivity: number;
}

export function computeGraphSignals(
  path: string,
  graph: RepoGraph,
  config: ScoringConfig,
): GraphSignals {
  return {
    graphImportance: computeGraphImportance(path, graph),
    callerCritWeight: computeCallerCritWeight(path, graph, config.fileTypes),
    entryProximity: computeEntryProximity(path, graph),
    exclusivity: computeExclusivity(path, graph),
  };
}
