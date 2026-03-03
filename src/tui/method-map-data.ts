// ── Method-level dependency mind map data builder ──

import { basename, extname } from 'node:path';
import type { RepoGraph } from '../core/analyzer/repo-graph.js';
import type { TuiFileDiff } from './types.js';

const MAX_PER_DEPTH = 8;

export interface MethodMapNode {
  filePath: string;       // relative path within repo
  fileName: string;       // basename without ext
  fileType: string;
  depth: number;          // negative=upstream (imported by), 0=focus, positive=downstream (imports)
  crit?: number;
  isChanged: boolean;     // has a diff entry
  fileId?: string;        // fileId for navigation (may be undefined if not in diff)
  edgeType?: 'import' | 'inject';
  specifiers?: string[];
}

export interface MethodMapData {
  focus: MethodMapNode;
  upstream: MethodMapNode[][];    // upstream[0]=depth-1, upstream[1]=depth-2
  downstream: MethodMapNode[][];  // downstream[0]=depth+1, downstream[1]=depth+2
  focusMethod?: string;
}

export function buildMethodMapData(
  focusFilePath: string,
  focusMethod: string | null,
  graph: RepoGraph,
  fileEntries: Array<{ path: string; id: string; crit: number }>,
  diffs: Map<string, TuiFileDiff>,
  maxDepth = 2,
): MethodMapData {
  const pathToEntry = new Map<string, { id: string; crit: number }>();
  for (const f of fileEntries) pathToEntry.set(f.path, { id: f.id, crit: f.crit });

  const focusEntry = pathToEntry.get(focusFilePath);
  const focusGraphNode = graph.nodes.get(focusFilePath);

  const focus: MethodMapNode = {
    filePath: focusFilePath,
    fileName: basename(focusFilePath, extname(focusFilePath)),
    fileType: focusGraphNode?.fileType ?? 'unknown',
    depth: 0,
    crit: focusEntry?.crit,
    isChanged: focusEntry !== undefined && diffs.has(focusEntry.id),
    fileId: focusEntry?.id,
  };

  const downstream = bfsOutward(focusFilePath, graph, pathToEntry, diffs, maxDepth);
  const upstream = bfsInward(focusFilePath, graph, pathToEntry, diffs, maxDepth);

  return { focus, upstream, downstream, focusMethod: focusMethod ?? undefined };
}

function bfsOutward(
  startPath: string,
  graph: RepoGraph,
  pathToEntry: Map<string, { id: string; crit: number }>,
  diffs: Map<string, TuiFileDiff>,
  maxDepth: number,
): MethodMapNode[][] {
  const visited = new Set<string>([startPath]);
  const levels: MethodMapNode[][] = [];
  let frontier = [startPath];

  for (let d = 1; d <= maxDepth; d++) {
    const nextFrontier: string[] = [];
    const levelNodes: MethodMapNode[] = [];
    for (const path of frontier) {
      for (const edge of graph.edges.get(path) ?? []) {
        if (visited.has(edge.to) || levelNodes.length >= MAX_PER_DEPTH) continue;
        visited.add(edge.to);
        const node = graph.nodes.get(edge.to);
        const entry = pathToEntry.get(edge.to);
        levelNodes.push({
          filePath: edge.to,
          fileName: basename(edge.to, extname(edge.to)),
          fileType: node?.fileType ?? 'unknown',
          depth: d,
          crit: entry?.crit,
          isChanged: entry !== undefined && diffs.has(entry.id),
          fileId: entry?.id,
          edgeType: edge.type,
          specifiers: edge.specifiers,
        });
        nextFrontier.push(edge.to);
      }
    }
    levels.push(levelNodes);
    frontier = nextFrontier;
    if (levelNodes.length === 0) break;
  }
  return levels;
}

function bfsInward(
  startPath: string,
  graph: RepoGraph,
  pathToEntry: Map<string, { id: string; crit: number }>,
  diffs: Map<string, TuiFileDiff>,
  maxDepth: number,
): MethodMapNode[][] {
  const visited = new Set<string>([startPath]);
  const levels: MethodMapNode[][] = [];
  let frontier = [startPath];

  for (let d = 1; d <= maxDepth; d++) {
    const nextFrontier: string[] = [];
    const levelNodes: MethodMapNode[] = [];
    for (const path of frontier) {
      for (const edge of graph.reverseEdges.get(path) ?? []) {
        if (visited.has(edge.from) || levelNodes.length >= MAX_PER_DEPTH) continue;
        visited.add(edge.from);
        const node = graph.nodes.get(edge.from);
        const entry = pathToEntry.get(edge.from);
        levelNodes.push({
          filePath: edge.from,
          fileName: basename(edge.from, extname(edge.from)),
          fileType: node?.fileType ?? 'unknown',
          depth: -d,
          crit: entry?.crit,
          isChanged: entry !== undefined && diffs.has(entry.id),
          fileId: entry?.id,
          edgeType: edge.type,
          specifiers: edge.specifiers,
        });
        nextFrontier.push(edge.from);
      }
    }
    levels.push(levelNodes);
    frontier = nextFrontier;
    if (levelNodes.length === 0) break;
  }
  return levels;
}

// Ordered navigable node list: upstream (closest first) then downstream (closest first)
export function getMapNavNodes(data: MethodMapData): MethodMapNode[] {
  return [
    ...(data.upstream[0] ?? []),
    ...(data.upstream[1] ?? []),
    ...(data.downstream[0] ?? []),
    ...(data.downstream[1] ?? []),
  ];
}
