// ── Context builders: derive context panel data from selection ──

import type { ScanResult } from '../core/engine.js';
import type { TuiFileDiff, ContextData, ChunkInfo, ReviewStats } from './types.js';
import type { LineReview } from './hooks/useReview.js';
import { computeFileReviewStats } from './review-stats.js';

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

  return {
    name: diff.name,
    crit: diff.crit,
    summary,
    chunks,
    usedBy: diff.usedBy,
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
