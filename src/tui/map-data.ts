// ── Data layer for Review Map overlay ──

import type { ScanResult } from '../core/engine.js';
import type { TuiFileDiff } from './types.js';
import type { LineReview } from './hooks/useReview.js';
import { allMethods } from '../core/analyzer/side-effects.js';

export interface MapMethod {
  name: string;
  crit: number;
  reviewed: boolean;
}

export interface MapNode {
  fileId: string;
  name: string;
  repo: string;
  type: string;
  crit: number;
  progress: 'none' | 'partial' | 'complete';
  methods: MapMethod[];
  reviewed: number;
  total: number;
  bugs: number;
  questions: number;
}

export interface MapEdge {
  from: string;
  to: string;
  label: string;
  crossRepo: boolean;
}

export interface MapImpact {
  file: string;
  method: string;
  via: string;
  source: string;
}

export interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  impacts: MapImpact[];
  repoOrder: string[];
  nextIdx: number;
}

export function buildMapData(
  data: ScanResult,
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>,
): MapData {
  const nodes: MapNode[] = [];
  const changedPaths = new Set<string>();
  const pathToName = new Map<string, string>();

  for (const repo of data.repos) {
    const repoNodes: MapNode[] = [];
    for (const file of repo.files) {
      if (!diffs.has(file.id)) continue;
      changedPaths.add(file.path);
      const name = `${file.name}${file.ext}`;
      pathToName.set(file.path, name);

      const fileDiff = diffs.get(file.id)!;
      const changed = allMethods(file).filter(m => m.status !== 'unch');
      const sorted = [...changed].sort((a, b) => b.crit - a.crit);

      const methods: MapMethod[] = sorted.slice(0, 8).map(m => {
        const hIdx = fileDiff.rows.findIndex(r => r.type === 'hunkHeader' && r.method === m.name);
        let reviewed = false;
        if (hIdx >= 0) {
          let ok = true;
          for (let j = hIdx + 1; j < fileDiff.rows.length; j++) {
            if (fileDiff.rows[j].type !== 'diffRow') break;
            const rl = fileDiff.rows[j].reviewLine;
            if (rl && rl.t === 'add' && !lineReviews.get(`${file.id}:${rl.n}`)?.flag) { ok = false; break; }
          }
          reviewed = ok;
        }
        return { name: m.name, crit: m.crit, reviewed };
      });

      let rev = 0, tot = 0, bugs = 0, questions = 0;
      for (const row of fileDiff.rows) {
        if (row.type === 'diffRow' && row.reviewLine && row.reviewLine.t === 'add') {
          tot++;
          const lr = lineReviews.get(`${file.id}:${row.reviewLine.n}`);
          if (lr?.flag) rev++;
          if (lr?.flag === 'bug') bugs++;
          if (lr?.flag === 'question') questions++;
        }
      }

      repoNodes.push({
        fileId: file.id, name, repo: repo.name, type: file.type,
        crit: file.crit, progress: fileProgress.get(file.id) ?? 'none',
        methods, reviewed: rev, total: tot, bugs, questions,
      });
    }
    repoNodes.sort((a, b) => b.crit - a.crit);
    nodes.push(...repoNodes);
  }

  // Edges: only between changed files, deduplicated
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  for (const link of data.links) {
    if (!changedPaths.has(link.fromFile) || !changedPaths.has(link.toFile)) continue;
    const from = pathToName.get(link.fromFile) ?? link.fromFile.split('/').pop()!;
    const to = pathToName.get(link.toFile) ?? link.toFile.split('/').pop()!;
    const key = `${from}\u2192${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ from, to, label: link.label, crossRepo: link.cross });
  }

  // Impacts: methods marked as impacted by side-effect detection
  const impacts: MapImpact[] = [];
  for (const repo of data.repos) {
    for (const file of repo.files) {
      if (!diffs.has(file.id)) continue;
      const name = `${file.name}${file.ext}`;
      for (const m of allMethods(file)) {
        if (!m.impacted) continue;
        const link = data.links.find(l =>
          l.toFile === file.path && (l.type === 'inject' || l.specifiers?.includes(m.name)),
        );
        const source = link ? (pathToName.get(link.fromFile) ?? link.fromFile.split('/').pop()!) : '?';
        impacts.push({ file: name, method: m.name, via: link?.type ?? 'import', source });
      }
    }
  }

  const repoOrder = [...new Set(nodes.map(n => n.repo))];
  const nextIdx = nodes.findIndex(n => n.progress !== 'complete');

  return { nodes, edges, impacts, repoOrder, nextIdx: nextIdx >= 0 ? nextIdx : 0 };
}
