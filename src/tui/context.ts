// ── Context builders: derive context panel data from selection ──

import type { ScanResult } from '../core/engine.js';
import type { TuiFileDiff, ContextData, ChunkInfo, ReviewStats, SideEffect, UsedByEntry, ImportEntry } from './types.js';
import type { LineReview } from './hooks/useReview.js';
import { computeFileReviewStats } from './review-stats.js';
import { allMethods, buildSigChangedMap } from '../core/analyzer/side-effects.js';

function aggregateStats(
  files: Array<{ id: string }>, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): ReviewStats {
  const stats: ReviewStats = { total: 0, reviewed: 0, bugs: 0, questions: 0, comments: 0 };
  for (const file of files) {
    const diff = diffs.get(file.id);
    if (!diff) continue;
    const s = computeFileReviewStats(file.id, diff, lineReviews);
    stats.total += s.total;
    stats.reviewed += s.reviewed;
    stats.bugs += s.bugs;
    stats.questions += s.questions;
    stats.comments += s.comments;
  }
  return stats;
}

export function getFileContext(
  fileId: string, result: ScanResult, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): ContextData | null {
  const diff = diffs.get(fileId);
  if (!diff) return null;

  const chunks: ChunkInfo[] = diff.rows
    .filter(r => r.type === 'hunkHeader')
    .map(r => ({ file: diff.name, method: r.method, crit: r.methodCrit, label: r.label, fileId }));

  const stats = computeFileReviewStats(fileId, diff, lineReviews);
  const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
  const summary = stats.total > 0
    ? `${chunks.length} hunk(s) \u00B7 ${stats.reviewed}/${stats.total} (${pct}%)`
    : `${chunks.length} hunk(s) \u00B7 ${diff.path}`;

  // Outgoing imports/injections
  const outLinks = result.links.filter(l => l.fromFile === diff.path);
  const imports: ImportEntry[] = [];
  const seenImport = new Set<string>();
  for (const link of outLinks) {
    const targetName = link.toFile.split('/').pop() ?? link.toFile;
    const targetFileId = findFileIdByPath(link.toFile, result);
    for (const spec of link.specifiers ?? [link.label]) {
      const key = `${spec}:${targetName}`;
      if (seenImport.has(key)) continue;
      seenImport.add(key);
      imports.push({
        name: spec,
        sourceFile: targetName,
        type: link.type === 'inject' ? 'inject' : 'import',
        fileId: targetFileId,
      });
    }
  }

  // Side-effects: find sources of impact for this file
  const sideEffects = findSideEffects(diff.path, result);

  return {
    name: diff.name,
    crit: diff.crit,
    summary,
    chunks,
    imports: imports.length > 0 ? imports : undefined,
    usedBy: diff.usedBy,
    sideEffects: sideEffects.length > 0 ? sideEffects : undefined,
    reviewStats: stats,
  };
}

export function getFolderContext(
  folderName: string, result: ScanResult, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): ContextData | null {
  const chunks: ChunkInfo[] = [];
  let maxCrit = 0;
  let totalAdd = 0, totalDel = 0, sigCount = 0;
  const folderFiles: Array<{ id: string }> = [];

  for (const repo of result.repos) {
    for (const file of repo.files) {
      if (!file.dir.startsWith(folderName) && file.dir !== folderName) continue;
      folderFiles.push(file);
      maxCrit = Math.max(maxCrit, file.crit);

      const fileDiff = diffs.get(file.id);
      if (!fileDiff) continue;

      for (const row of fileDiff.rows) {
        if (row.type === 'hunkHeader') {
          chunks.push({
            file: `${file.name}${file.ext}`, method: row.method,
            crit: row.methodCrit, label: row.label, fileId: file.id,
          });
          continue;
        }
        if (row.reviewLine?.t === 'add') totalAdd++;
        if (row.baseLine?.t === 'del') totalDel++;
        if (row.reviewLine?.isSig) sigCount++;
      }
    }
  }

  if (folderFiles.length === 0) return null;

  const stats = aggregateStats(folderFiles, diffs, lineReviews);
  const sigStr = sigCount > 0 ? ` \u00B7 ${sigCount} sig` : '';

  return {
    name: folderName,
    crit: Math.round(maxCrit * 10) / 10,
    summary: `${folderFiles.length} file(s) \u00B7 +${totalAdd} -${totalDel}${sigStr}`,
    chunks: chunks.sort((a, b) => b.crit - a.crit),
    reviewStats: stats.total > 0 ? stats : undefined,
  };
}

export function getRepoContext(
  repoName: string, result: ScanResult, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): ContextData | null {
  const repo = result.repos.find(r => r.name === repoName);
  if (!repo) return null;

  const chunks: ChunkInfo[] = [];
  let maxCrit = 0;

  for (const file of repo.files) {
    maxCrit = Math.max(maxCrit, file.crit);
    const fileDiff = diffs.get(file.id);
    if (!fileDiff) continue;

    for (const row of fileDiff.rows) {
      if (row.type !== 'hunkHeader') continue;
      chunks.push({
        file: `${file.name}${file.ext}`, method: row.method,
        crit: row.methodCrit, label: row.label, fileId: file.id,
      });
    }
  }

  const stats = aggregateStats(repo.files, diffs, lineReviews);
  const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
  const summary = stats.total > 0
    ? `${repo.files.length} file(s) \u00B7 ${stats.reviewed}/${stats.total} (${pct}%)`
    : `${repo.files.length} file(s) \u00B7 ${repo.branch}`;

  return {
    name: repoName,
    crit: Math.round(maxCrit * 10) / 10,
    summary,
    chunks: chunks.sort((a, b) => b.crit - a.crit),
    reviewStats: stats.total > 0 ? stats : undefined,
  };
}

// ── Helper: resolve file path → fileId ──

function findFileIdByPath(path: string, result: ScanResult): string | undefined {
  for (const repo of result.repos) {
    for (const file of repo.files) {
      if (file.path === path) return file.id;
    }
  }
  return undefined;
}

// ── Line-level context (Mode 4) ──

export function getLineContext(
  filePath: string,
  lineContent: string,
  result: ScanResult,
  diffs: Map<string, TuiFileDiff>,
): ContextData | null {
  const outLinks = result.links.filter(l => l.fromFile === filePath);
  if (outLinks.length === 0) return null;

  // Build path → (fileId, diff) lookup once instead of O(n) scans per match
  const pathToDiff = new Map<string, { fileId: string; diff: TuiFileDiff }>();
  for (const [fileId, diff] of diffs) {
    pathToDiff.set(diff.path, { fileId, diff });
  }

  for (const link of outLinks) {
    for (const spec of link.specifiers ?? []) {
      if (!lineContent.includes(spec)) continue;

      const target = pathToDiff.get(link.toFile);
      const chunks: ChunkInfo[] = target
        ? target.diff.rows
            .filter(r => r.type === 'hunkHeader')
            .map(r => ({ file: target.diff.name, method: r.method, crit: r.methodCrit, label: r.label, fileId: target.fileId }))
        : [];

      const calledBy: UsedByEntry[] = result.links
        .filter(l => l.toFile === link.toFile && l.fromFile !== filePath)
        .map(l => ({
          file: l.fromFile.split('/').pop() ?? l.fromFile,
          method: l.methodName ?? l.label,
          what: `${l.type}: ${l.label}`,
        }));

      const targetName = link.toFile.split('/').pop() ?? link.toFile;
      return {
        name: spec,
        crit: link.riskCrit,
        summary: `from ${targetName}`,
        chunks,
        usedBy: calledBy.length > 0 ? calledBy : undefined,
      };
    }
  }
  return null;
}

// ── Side-effect source lookup ──

function findSideEffects(filePath: string, result: ScanResult): SideEffect[] {
  const file = result.repos.flatMap(r => r.files).find(f => f.path === filePath);
  if (!file || !allMethods(file).some(m => m.impacted)) return [];

  const sigMap = buildSigChangedMap(result.repos);

  const effects: SideEffect[] = [];
  for (const link of result.links) {
    if (link.fromFile !== filePath) continue;
    const changedNames = sigMap.get(link.toFile);
    if (!changedNames) continue;

    const isInject = link.type === 'inject';
    const matchingSpecs = link.specifiers?.filter(s => changedNames.has(s)) ?? [];
    if (isInject) {
      for (const name of changedNames) {
        effects.push({ sourceFile: link.toFile.split('/').pop() ?? link.toFile, method: name, via: 'inject' });
      }
    } else if (matchingSpecs.length > 0) {
      for (const spec of matchingSpecs) {
        effects.push({ sourceFile: link.toFile.split('/').pop() ?? link.toFile, method: spec, via: 'import' });
      }
    }
  }
  return effects;
}
