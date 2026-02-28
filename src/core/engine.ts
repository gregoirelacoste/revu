// ── Core scan engine — pure orchestration, no HTTP ──

import { readFile } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { scanRepos } from './scanner/repo-scanner.js';
import { computeDiff, getFileAtBranch } from './scanner/diff-parser.js';
import { classifyFile, isDisplayableFile, isTypeScriptFile } from './analyzer/file-classifier.js';
import { parseTypeScript } from './analyzer/ast-parser.js';
import { detectLinks } from './analyzer/link-detector.js';
import { computeFileCriticality, computeMethodCriticality } from './scoring/criticality.js';
import { loadConfig } from './scoring/config.js';
import { buildMethodData, buildConstantData } from './analyzer/diff-extractor.js';
import { detectSideEffects } from './analyzer/side-effects.js';
import type {
  ParsedFile, FileDiff, MethodData,
  DetectedLink, RepoInfo, RevuConfig, ScoringConfig,
} from './types.js';

// ── Result types ──

export interface FileEntry {
  id: string;
  path: string;
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
  config: RevuConfig;
}

// ── Main orchestrator ──

export async function scan(rootDir: string, baseBranch = 'develop'): Promise<ScanResult> {
  const config = await loadConfig(rootDir);
  const repos = await scanRepos(rootDir, baseBranch);
  if (repos.length === 0) return { repos: [], links: [], allFiles: [], config };

  const allParsedFiles: ParsedFile[] = [];
  const repoEntries: RepoEntry[] = [];

  for (const repo of repos) {
    try {
      const result = await processRepo(repo, config.scoring);
      if (!result) continue;
      allParsedFiles.push(...result.parsedFiles);
      repoEntries.push(result.entry);
    } catch (err) {
      console.error(`Skipping repo ${repo.name}:`, (err as Error).message);
    }
  }

  // Build crit map keyed by file PATH (not id) for link-detector
  const fileCritMap = buildFileCritMap(repoEntries);
  const links = detectLinks(allParsedFiles, fileCritMap);

  // Enrich files with real dependency counts, then recompute criticality
  enrichWithDependencies(repoEntries, links, config.scoring);

  // Mark methods impacted by signature changes in their dependencies
  if (config.rules.sideEffectDetection) {
    detectSideEffects(repoEntries, links);
  }

  return { repos: repoEntries, links, allFiles: allParsedFiles, config };
}

// ── Per-repo processing ──

async function processRepo(
  repo: RepoInfo, scoring: ScoringConfig,
): Promise<{ parsedFiles: ParsedFile[]; entry: RepoEntry } | null> {
  const diffs = await computeDiff(repo.path, repo.baseBranch);
  const parsedFiles = await parseRepoFiles(repo, diffs);

  const files: FileEntry[] = [];
  for (const pf of parsedFiles) {
    const diff = diffs.find(d => d.path === pf.path);
    if (!diff) continue;
    const entry = await buildFileEntry(pf, diff, diffs, repo, scoring);
    files.push(entry);
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
    if (!code) {
      console.warn(`\x1b[33m⚠\x1b[0m Cannot read ${diff.path}, skipping`);
      continue;
    }

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
  pf: ParsedFile, diff: FileDiff, diffs: FileDiff[],
  repo: RepoInfo, scoring: ScoringConfig,
): Promise<FileEntry> {
  const hasSpec = diffs.some(d =>
    d.path === pf.path.replace(/\.tsx?$/, '.spec.ts') ||
    d.path === pf.path.replace(/\.tsx?$/, '.spec.tsx'),
  );
  // Initial crit with depCount=0, will be recomputed after link detection
  const fileCrit = computeFileCriticality(scoring, pf.fileType, diff.additions, diff.deletions, 0, pf.path);

  const oldCode = await getFileAtBranch(repo.path, repo.baseBranch, pf.path);
  const oldAst = oldCode ? parseTypeScript(oldCode) : null;

  const methods = buildMethodData(pf, diff, oldAst, fileCrit, scoring);
  const constants = buildConstantData(pf, diff, oldAst, fileCrit);

  return {
    id: `f-${repo.name}-${pf.path.replace(/\//g, '-').replace(/\./g, '_')}`,
    path: pf.path,
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

// ── Crit map: keyed by file PATH for link-detector ──

function buildFileCritMap(repos: RepoEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of repos) {
    for (const f of r.files) {
      map.set(f.path, f.crit);
    }
  }
  return map;
}

// ── Enrich with real dependency counts ──

function enrichWithDependencies(repos: RepoEntry[], links: DetectedLink[], scoring: ScoringConfig): void {
  // Count how many files depend on each file (inbound links)
  const depCount = new Map<string, number>();
  for (const link of links) {
    depCount.set(link.toFile, (depCount.get(link.toFile) ?? 0) + 1);
  }

  // Count max usages across all methods for normalization
  const methodUsages = new Map<string, number>();
  for (const link of links) {
    if (link.methodName) {
      const key = `${link.toFile}:${link.methodName}`;
      methodUsages.set(key, (methodUsages.get(key) ?? 0) + 1);
    }
  }
  const maxUsage = Math.max(1, ...methodUsages.values());

  for (const repo of repos) {
    for (const file of repo.files) {
      const deps = depCount.get(file.path) ?? 0;
      if (deps > 0) {
        // Recompute with real dependency count
        file.crit = computeFileCriticality(
          scoring, file.type, file.add, file.del, deps, `${file.dir}/${file.name}${file.ext}`,
        );
      }

      for (const m of file.methods) {
        const key = `${file.path}:${m.name}`;
        const usages = methodUsages.get(key) ?? 1;
        m.usages = usages;
        m.crit = computeMethodCriticality(
          scoring, file.crit, usages, maxUsage, m.sigChanged, `${file.dir}/${file.name}${file.ext}`,
        );
      }
    }
  }
}

