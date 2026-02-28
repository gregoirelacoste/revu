// ── Core scan engine — pure orchestration, no HTTP ──

import { readFile } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { scanRepos } from './scanner/repo-scanner.js';
import { computeDiff, getFileAtBranch } from './scanner/diff-parser.js';
import { classifyFile, isDisplayableFile, isTypeScriptFile } from './analyzer/file-classifier.js';
import { parseTypeScript } from './analyzer/ast-parser.js';
import { detectLinks } from './analyzer/link-detector.js';
import { computeFileCriticality, computeMethodCriticality } from './scoring/criticality.js';
import type {
  ParsedFile, FileDiff, MethodData, DiffLineType,
  DetectedLink, RepoInfo, MethodStatus,
} from './types.js';

// ── Result types ──

export interface FileEntry {
  id: string;
  name: string;
  ext: string;
  dir: string;
  type: string;
  crit: number;
  add: number;
  del: number;
  tested: boolean;
  methods: MethodData[];
  constants: MethodData[];
}

export interface RepoEntry {
  name: string;
  branch: string;
  files: FileEntry[];
}

export interface ScanResult {
  repos: RepoEntry[];
  links: DetectedLink[];
  allFiles: ParsedFile[];
}

// ── Main orchestrator ──

export async function scan(rootDir: string, baseBranch = 'develop'): Promise<ScanResult> {
  const repos = await scanRepos(rootDir, baseBranch);
  if (repos.length === 0) return { repos: [], links: [], allFiles: [] };

  const allParsedFiles: ParsedFile[] = [];
  const repoEntries: RepoEntry[] = [];

  for (const repo of repos) {
    try {
      const result = await processRepo(repo);
      if (!result) continue;
      allParsedFiles.push(...result.parsedFiles);
      repoEntries.push(result.entry);
    } catch (err) {
      console.error(`Skipping repo ${repo.name}:`, (err as Error).message);
    }
  }

  const fileCritMap = buildFileCritMap(repoEntries);
  const links = detectLinks(allParsedFiles, fileCritMap);

  return { repos: repoEntries, links, allFiles: allParsedFiles };
}

// ── Per-repo processing ──

async function processRepo(repo: RepoInfo): Promise<{ parsedFiles: ParsedFile[]; entry: RepoEntry } | null> {
  const diffs = await computeDiff(repo.path, repo.baseBranch);
  const parsedFiles = await parseRepoFiles(repo, diffs);

  const files: FileEntry[] = [];
  for (const pf of parsedFiles) {
    const diff = diffs.find(d => d.path === pf.path)!;
    const entry = await buildFileEntry(pf, diff, diffs, repo);
    if (entry) files.push(entry);
  }

  if (files.length === 0) return null;

  return {
    parsedFiles,
    entry: { name: repo.name, branch: repo.currentBranch, files },
  };
}

async function parseRepoFiles(repo: RepoInfo, diffs: FileDiff[]): Promise<ParsedFile[]> {
  const parsedFiles: ParsedFile[] = [];
  for (const diff of diffs) {
    const fileType = classifyFile(diff.path);
    if (!isDisplayableFile(fileType)) continue;

    const fullPath = join(repo.path, diff.path);
    const code = await readFile(fullPath, 'utf-8').catch(() => null);
    if (!code) continue;

    if (isTypeScriptFile(diff.path)) {
      const ast = parseTypeScript(code);
      parsedFiles.push({
        path: diff.path, repoName: repo.name, fileType,
        methods: ast.methods, constants: ast.constants,
        imports: ast.imports, injections: ast.injections,
      });
    } else {
      const lineCount = code.split('\n').length;
      parsedFiles.push({
        path: diff.path, repoName: repo.name, fileType,
        methods: [], imports: [], injections: [],
        constants: [{ name: basename(diff.path), startLine: 1, endLine: lineCount, isType: false }],
      });
    }
  }
  return parsedFiles;
}

// ── File entry builder ──

async function buildFileEntry(
  pf: ParsedFile, diff: FileDiff, diffs: FileDiff[], repo: RepoInfo,
): Promise<FileEntry> {
  const hasSpec = diffs.some(d => d.path === pf.path.replace('.ts', '.spec.ts'));
  const fileCrit = computeFileCriticality(pf.fileType, diff.additions, diff.deletions, 0, pf.path);

  const oldCode = await getFileAtBranch(repo.path, repo.baseBranch, pf.path);
  const oldAst = oldCode ? parseTypeScript(oldCode) : null;

  const methods = buildMethodData(pf, diff, oldAst, fileCrit);
  const constants = buildConstantData(pf, diff, oldAst, fileCrit);

  return {
    id: `f-${repo.name}-${pf.path.replace(/\//g, '-').replace(/\./g, '_')}`,
    name: basename(pf.path, extname(pf.path)),
    ext: extname(pf.path),
    dir: dirname(pf.path),
    type: pf.fileType,
    crit: fileCrit,
    add: diff.additions,
    del: diff.deletions,
    tested: hasSpec,
    methods,
    constants,
  };
}

// ── Crit map builder ──

function buildFileCritMap(repos: RepoEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of repos) {
    for (const f of r.files) {
      map.set(f.id, f.crit);
    }
  }
  return map;
}

// ── Method/Constant data builders ──

function buildMethodData(
  pf: ParsedFile,
  diff: FileDiff,
  oldAst: { methods: { name: string; signature: string }[]; constants: { name: string }[] } | null,
  fileCrit: number,
): MethodData[] {
  const result: MethodData[] = pf.methods.map(m => {
    const oldMethod = oldAst?.methods.find(om => om.name === m.name);
    const isNew = !oldMethod;
    const sigChanged = !isNew && oldMethod.signature !== m.signature;
    const rawDiff = extractMethodDiff(m.startLine, m.endLine, diff, isNew);
    const formatOnly = !isNew && isFormattingOnly(rawDiff);
    const methodDiff = formatOnly ? [] : rawDiff;
    const status: MethodStatus = isNew ? 'new' : methodDiff.length > 0 ? 'mod' : 'unch';
    const crit = computeMethodCriticality(fileCrit, 1, 5, sigChanged, pf.path);

    return {
      name: m.name, status, crit, usages: 1, tested: false,
      sigChanged, httpVerb: m.httpVerb, diff: methodDiff,
    };
  });

  if (oldAst?.methods) {
    const newNames = new Set(pf.methods.map(m => m.name));
    for (const om of oldAst.methods) {
      if (!newNames.has(om.name)) {
        const delDiff = extractDeletedBlockDiff(om.name, diff);
        if (delDiff.length === 0) continue;
        result.push({
          name: om.name, status: 'del',
          crit: Math.round(fileCrit * 0.8 * 10) / 10,
          usages: 0, tested: false, sigChanged: false, diff: delDiff,
        });
      }
    }
  }

  return result;
}

function buildConstantData(
  pf: ParsedFile, diff: FileDiff,
  oldAst: { methods: { name: string; signature: string }[]; constants: { name: string }[] } | null,
  fileCrit: number,
): MethodData[] {
  const result = pf.constants.map(c => {
    const rawDiff = extractMethodDiff(c.startLine, c.endLine, diff, true);
    if (rawDiff.length === 0 || isFormattingOnly(rawDiff)) return null;
    return {
      name: c.name, status: 'new' as MethodStatus,
      crit: Math.round(fileCrit * 0.6 * 10) / 10,
      usages: 1, tested: false, sigChanged: false,
      isType: c.isType, diff: rawDiff,
    };
  }).filter(Boolean) as MethodData[];

  if (oldAst?.constants) {
    const newNames = new Set(pf.constants.map(c => c.name));
    for (const oc of oldAst.constants) {
      if (!newNames.has(oc.name)) {
        const delDiff = extractDeletedBlockDiff(oc.name, diff);
        if (delDiff.length === 0) continue;
        result.push({
          name: oc.name, status: 'del',
          crit: Math.round(fileCrit * 0.5 * 10) / 10,
          usages: 0, tested: false, sigChanged: false, diff: delDiff,
        });
      }
    }
  }

  return result;
}

// ── Formatting filter ──

function normalizeLine(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/[;,]$/g, '').replace(/'/g, '"');
}

function isFormattingOnly(diff: Array<{ t: DiffLineType; c: string }>): boolean {
  if (diff.length === 0) return true;
  const adds = diff.filter(d => d.t === 'a').map(d => normalizeLine(d.c));
  const dels = diff.filter(d => d.t === 'd').map(d => normalizeLine(d.c));
  if (adds.length === 0 && dels.length === 0) return true;
  if (adds.length !== dels.length) return false;
  const sortedAdds = [...adds].sort();
  const sortedDels = [...dels].sort();
  return sortedAdds.every((a, i) => a === sortedDels[i]);
}

// ── Diff extraction ──

function extractDeletedBlockDiff(
  name: string, diff: FileDiff,
): Array<{ t: DiffLineType; c: string }> {
  const result: Array<{ t: DiffLineType; c: string }> = [];
  for (const hunk of diff.hunks) {
    const delBlock: string[] = [];
    for (const line of hunk.lines) {
      if (line.type === 'del') {
        delBlock.push(line.content);
      } else {
        if (delBlock.some(l => l.includes(name))) {
          for (const dl of delBlock) result.push({ t: 'd', c: dl });
        }
        delBlock.length = 0;
      }
    }
    if (delBlock.some(l => l.includes(name))) {
      for (const dl of delBlock) result.push({ t: 'd', c: dl });
    }
  }
  return result;
}

function extractMethodDiff(
  startLine: number, endLine: number, diff: FileDiff, isNew: boolean,
): Array<{ t: DiffLineType; c: string }> {
  const result: Array<{ t: DiffLineType; c: string }> = [];
  for (const hunk of diff.hunks) {
    let newLine = hunk.newStart;
    for (const line of hunk.lines) {
      if (line.type === 'del') {
        if (newLine >= startLine && newLine <= endLine + 5) {
          result.push({ t: 'd', c: line.content });
        }
        continue;
      }
      if (newLine >= startLine && newLine <= endLine) {
        if (line.type === 'add') result.push({ t: 'a', c: line.content });
        else if (line.type === 'context') result.push({ t: 'c', c: line.content });
      }
      newLine++;
    }
  }
  return result;
}
