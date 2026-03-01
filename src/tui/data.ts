// ── Transform ScanResult → TUI data structures ──

import type { ScanResult, FileEntry, RepoEntry } from '../core/engine.js';
import type { MethodData, LineCritMultipliers } from '../core/types.js';
import { allMethods } from '../core/analyzer/side-effects.js';
import { classifyLine } from '../core/scoring/content-signals.js';
import type {
  TreeItem, FlatItem, TuiFileDiff, DiffRow,
  TuiDiffLine, UsedByEntry,
} from './types.js';
import { injectWordDiffRanges } from './word-diff.js';

// ── Tree builder ──

export function buildTree(result: ScanResult): TreeItem[] {
  return result.repos.map(repo => repoToTree(repo));
}

function repoToTree(repo: RepoEntry): TreeItem {
  // Group files by directory
  const dirMap = new Map<string, FileEntry[]>();
  for (const file of repo.files) {
    const dir = file.dir === '.' ? '' : file.dir;
    const list = dirMap.get(dir) ?? [];
    list.push(file);
    dirMap.set(dir, list);
  }

  // Build folder hierarchy
  const children: TreeItem[] = [];
  const sortedDirs = [...dirMap.keys()].sort();

  for (const dir of sortedDirs) {
    const files = dirMap.get(dir)!;
    const fileItems: TreeItem[] = files.map(f => ({
      name: `${f.name}${f.ext}`,
      type: f.type,
      crit: f.crit,
      id: f.id,
      sideEffect: allMethods(f).some(m => m.impacted),
    }));
    fileItems.sort((a, b) => b.crit - a.crit);

    if (dir === '') {
      children.push(...fileItems);
    } else {
      const dirCrit = Math.max(...files.map(f => f.crit));
      children.push({
        name: dir,
        type: 'folder',
        crit: Math.round(dirCrit * 10) / 10,
        sideEffect: fileItems.some(fi => fi.sideEffect),
        children: fileItems,
      });
    }
  }

  children.sort((a, b) => b.crit - a.crit);

  const repoCrit = repo.files.length > 0
    ? Math.round(Math.max(...repo.files.map(f => f.crit)) * 10) / 10
    : 0;

  return {
    name: repo.name,
    type: 'repo',
    branch: repo.branch,
    crit: repoCrit,
    children,
  };
}

// ── Flatten tree for keyboard navigation ──

export function flattenTree(
  items: TreeItem[], collapsed: Set<string>, depth = 0,
): FlatItem[] {
  const result: FlatItem[] = [];
  for (const item of items) {
    const isFolder = item.type === 'folder' || item.type === 'repo';
    const id = item.id ?? item.name;
    result.push({ node: item, depth, id, isFolder });
    if (isFolder && item.children && !collapsed.has(id)) {
      result.push(...flattenTree(item.children, collapsed, depth + 1));
    }
  }
  return result;
}

// ── Diff builder ──

export function buildFileDiffs(result: ScanResult): Map<string, TuiFileDiff> {
  const diffs = new Map<string, TuiFileDiff>();
  const usedByMap = buildUsedByMap(result);
  const lineCrit = result.config.scoring.lineCriticality;

  for (const repo of result.repos) {
    for (const file of repo.files) {
      const allMethods = [...file.methods, ...file.constants];
      const changed = allMethods.filter(m => m.status !== 'unch');
      if (changed.length === 0) continue;

      const sorted = [...changed].sort((a, b) => b.crit - a.crit);
      const rows = buildDiffRows(sorted, lineCrit);
      diffs.set(file.id, {
        name: `${file.name}${file.ext}`,
        path: file.path,
        type: file.type,
        crit: file.crit,
        rows,
        usedBy: usedByMap.get(file.path) ?? [],
      });
    }
  }
  return diffs;
}

const HUNK_FOOTER_THRESHOLD = 8;

function buildDiffRows(methods: MethodData[], lineCrit: LineCritMultipliers): DiffRow[] {
  const rows: DiffRow[] = [];
  // Global counters across all methods — ensures unique lineKeys per file
  let globalBaseLineNum = 0;
  let globalReviewLineNum = 0;

  for (const m of methods) {
    const label = methodLabel(m);
    const hunkStart = rows.length;
    rows.push({
      type: 'hunkHeader',
      method: m.name,
      methodCrit: m.crit,
      label,
    });

    if (m.status === 'del') {
      for (const d of m.diff) {
        globalBaseLineNum++;
        const lc = classifyLine(d.c, lineCrit);
        rows.push({
          type: 'diffRow',
          method: m.name,
          methodCrit: m.crit,
          label,
          baseLine: { n: globalBaseLineNum, c: d.c, t: 'del', crit: lc },
          reviewLine: null,
        });
      }
      if (rows.length - hunkStart - 1 >= HUNK_FOOTER_THRESHOLD) {
        rows.push({ type: 'hunkFooter', method: m.name, methodCrit: m.crit, label });
      }
      continue;
    }

    // Split diff lines into base (del/ctx) and review (add/ctx)
    const baseLines: TuiDiffLine[] = [];
    const reviewLines: TuiDiffLine[] = [];

    let methodReviewStart = globalReviewLineNum;
    for (const d of m.diff) {
      if (d.t === 'd') {
        globalBaseLineNum++;
        const lc = classifyLine(d.c, lineCrit);
        baseLines.push({ n: globalBaseLineNum, c: d.c, t: 'del', crit: lc });
      } else if (d.t === 'a') {
        globalReviewLineNum++;
        const localIdx = globalReviewLineNum - methodReviewStart;
        const isSig = m.sigChanged && localIdx <= 2;
        const lc = classifyLine(d.c, lineCrit);
        reviewLines.push({
          n: globalReviewLineNum, c: d.c, t: 'add',
          crit: isSig ? Math.max(lc, 2.0) : lc,
          isSig,
        });
      } else {
        globalBaseLineNum++;
        globalReviewLineNum++;
        baseLines.push({ n: globalBaseLineNum, c: d.c, t: 'ctx' });
        reviewLines.push({ n: globalReviewLineNum, c: d.c, t: 'ctx' });
      }
    }

    injectWordDiffRanges(baseLines, reviewLines);

    // Align side-by-side
    const maxLen = Math.max(baseLines.length, reviewLines.length);
    for (let i = 0; i < maxLen; i++) {
      rows.push({
        type: 'diffRow',
        method: m.name,
        methodCrit: m.crit,
        label,
        baseLine: baseLines[i] ?? null,
        reviewLine: reviewLines[i] ?? null,
      });
    }

    if (rows.length - hunkStart - 1 >= HUNK_FOOTER_THRESHOLD) {
      rows.push({ type: 'hunkFooter', method: m.name, methodCrit: m.crit, label });
    }
  }

  return rows;
}

function methodLabel(m: MethodData): string {
  if (m.status === 'new') return m.httpVerb ? `New ${m.httpVerb} endpoint` : 'New';
  if (m.status === 'del') return 'Deleted';
  if (m.sigChanged) return 'Signature changed';
  if (m.isType) return 'Type modified';
  return 'Modified';
}

// ── Unified diff: reorder paired DiffRows into unified format ──

export function buildUnifiedRows(rows: DiffRow[]): DiffRow[] {
  const out: DiffRow[] = [];
  let pending: { dels: DiffRow[]; adds: DiffRow[] } = { dels: [], adds: [] };

  const flush = () => {
    out.push(...pending.dels, ...pending.adds);
    pending = { dels: [], adds: [] };
  };

  for (const row of rows) {
    if (row.type === 'hunkHeader' || row.type === 'hunkFooter') {
      flush();
      out.push(row);
      continue;
    }

    const base = row.baseLine;
    const review = row.reviewLine;

    // Context line (both sides present, both ctx)
    if (base && review && base.t === 'ctx' && review.t === 'ctx') {
      flush();
      out.push({ ...row, baseLine: null, reviewLine: review });
      continue;
    }

    // Del-only or del side of a paired row
    if (base && base.t === 'del') {
      pending.dels.push({
        type: 'diffRow', method: row.method, methodCrit: row.methodCrit, label: row.label,
        baseLine: base, reviewLine: null,
      });
    }

    // Add-only or add side of a paired row
    if (review && review.t === 'add') {
      pending.adds.push({
        type: 'diffRow', method: row.method, methodCrit: row.methodCrit, label: row.label,
        baseLine: null, reviewLine: review,
      });
    }
  }

  flush();
  return out;
}

// ── UsedBy map: file path → who uses it ──

function buildUsedByMap(result: ScanResult): Map<string, UsedByEntry[]> {
  const pathToId = new Map<string, string>();
  for (const repo of result.repos) {
    for (const file of repo.files) pathToId.set(file.path, file.id);
  }

  const map = new Map<string, UsedByEntry[]>();
  for (const link of result.links) {
    const entries = map.get(link.toFile) ?? [];
    entries.push({
      file: link.fromFile.split('/').pop() ?? link.fromFile,
      method: link.methodName ?? link.label,
      what: `${link.type}: ${link.label}`,
      fileId: pathToId.get(link.fromFile),
    });
    map.set(link.toFile, entries);
  }
  // Deduplicate
  for (const [path, entries] of map) {
    const seen = new Set<string>();
    map.set(path, entries.filter(e => {
      const key = `${e.file}:${e.method}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }
  return map;
}

