// ── Context builders: derive context panel data from selection ──

import type { ScanResult } from '../core/engine.js';
import type { TuiFileDiff, ContextData, ChunkInfo } from './types.js';

export function getFileContext(
  fileId: string, result: ScanResult, diffs: Map<string, TuiFileDiff>,
): ContextData | null {
  const diff = diffs.get(fileId);
  if (!diff) return null;

  const chunks: ChunkInfo[] = diff.rows
    .filter(r => r.type === 'hunkHeader')
    .map(r => ({
      file: diff.name,
      method: r.method,
      crit: r.methodCrit,
      label: r.label,
      fileId,
    }));

  return {
    name: diff.name,
    crit: diff.crit,
    summary: `${chunks.length} hunk(s) \u00B7 ${diff.path}`,
    chunks,
    usedBy: diff.usedBy,
  };
}

export function getFolderContext(
  folderName: string, result: ScanResult, diffs: Map<string, TuiFileDiff>,
): ContextData | null {
  const chunks: ChunkInfo[] = [];
  let maxCrit = 0;
  let fileCount = 0;

  for (const repo of result.repos) {
    for (const file of repo.files) {
      if (!file.dir.startsWith(folderName) && file.dir !== folderName) continue;
      fileCount++;
      maxCrit = Math.max(maxCrit, file.crit);

      const fileDiff = diffs.get(file.id);
      if (!fileDiff) continue;

      for (const row of fileDiff.rows) {
        if (row.type !== 'hunkHeader') continue;
        chunks.push({
          file: `${file.name}${file.ext}`,
          method: row.method,
          crit: row.methodCrit,
          label: row.label,
          fileId: file.id,
        });
      }
    }
  }

  if (fileCount === 0) return null;

  return {
    name: folderName,
    crit: Math.round(maxCrit * 10) / 10,
    summary: `${fileCount} file(s) \u00B7 ${chunks.length} change(s)`,
    chunks: chunks.sort((a, b) => b.crit - a.crit),
  };
}

export function getRepoContext(
  repoName: string, result: ScanResult, diffs: Map<string, TuiFileDiff>,
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
        file: `${file.name}${file.ext}`,
        method: row.method,
        crit: row.methodCrit,
        label: row.label,
        fileId: file.id,
      });
    }
  }

  return {
    name: repoName,
    crit: Math.round(maxCrit * 10) / 10,
    summary: `${repo.files.length} file(s) \u00B7 ${repo.branch}`,
    chunks: chunks.sort((a, b) => b.crit - a.crit),
  };
}
