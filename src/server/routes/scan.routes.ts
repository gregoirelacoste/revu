import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, basename } from 'node:path';
import { scanRepos } from '../scanner/repo-scanner.js';
import { computeDiff, getFileAtBranch } from '../scanner/diff-parser.js';
import { classifyFile, isDisplayableFile, isTypeScriptFile } from '../analyzer/file-classifier.js';
import { parseTypeScript } from '../analyzer/ast-parser.js';
import { detectLinks } from '../analyzer/link-detector.js';
import { computeFileCriticality, computeMethodCriticality } from '../scoring/criticality.js';
import { computeLayout } from '../layout/spatial-layout.js';
import type {
  ScanResponse, ParsedFile, FileDiff, MethodData, DiffLineType,
  DetectedLink, EdgeData, PlanetData, RepoInfo, MethodStatus,
} from '../types.js';

export function createScanRouter(rootDir: string): Router {
  const router = Router();

  router.get('/scan', async (req, res) => {
    try {
      const baseBranch = typeof req.query.base === 'string' ? req.query.base : 'develop';
      const result = await scanUniverse(rootDir, baseBranch);
      res.json(result);
    } catch (err) {
      console.error('Scan error:', err);
      res.status(500).json({ error: 'Scan failed' });
    }
  });

  return router;
}

// ── Main orchestrator ──

async function scanUniverse(rootDir: string, baseBranch = 'develop'): Promise<ScanResponse> {
  const repos = await scanRepos(rootDir, baseBranch);
  if (repos.length === 0) return { galaxies: [], edges: [] };

  const allParsedFiles: ParsedFile[] = [];
  const layoutInputs = [];

  for (const repo of repos) {
    try {
      const result = await processRepo(repo);
      if (!result) continue;
      allParsedFiles.push(...result.parsedFiles);
      layoutInputs.push(result.layoutInput);
    } catch (err) {
      console.error(`Skipping repo ${repo.name}:`, (err as Error).message);
    }
  }

  const { galaxies } = computeLayout(layoutInputs);
  const fileCritMap = buildFileCritMap(galaxies);
  const links = detectLinks(allParsedFiles, fileCritMap);
  const edges = linksToEdges(links, allParsedFiles, galaxies);

  return { galaxies, edges };
}

// ── Per-repo processing ──

async function processRepo(repo: RepoInfo) {
  const diffs = await computeDiff(repo.path, repo.baseBranch);
  const parsedFiles = await parseRepoFiles(repo, diffs);

  const dirMap = new Map<string, PlanetData[]>();
  for (const pf of parsedFiles) {
    const diff = diffs.find(d => d.path === pf.path)!;
    await buildPlanetEntry(pf, diff, diffs, repo, dirMap);
  }

  if (dirMap.size === 0) return null;

  const dirAffinity = computeDirAffinity(parsedFiles);

  return {
    parsedFiles,
    layoutInput: { repoName: repo.name, branch: repo.currentBranch, directories: dirMap, dirAffinity },
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
      // HTML/CSS/SCSS — single constant spanning the whole file for diff display
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

async function buildPlanetEntry(
  pf: ParsedFile, diff: FileDiff, diffs: FileDiff[],
  repo: RepoInfo, dirMap: Map<string, PlanetData[]>,
) {
  const dir = dirname(pf.path);
  if (!dirMap.has(dir)) dirMap.set(dir, []);

  const hasSpec = diffs.some(d => d.path === pf.path.replace('.ts', '.spec.ts'));
  const fileCrit = computeFileCriticality(pf.fileType, diff.additions, diff.deletions, 0, pf.path);

  const oldCode = await getFileAtBranch(repo.path, repo.baseBranch, pf.path);
  const oldAst = oldCode ? parseTypeScript(oldCode) : null;

  const methods = buildMethodData(pf, diff, oldAst, fileCrit);
  const constants = buildConstantData(pf, diff, fileCrit);

  dirMap.get(dir)!.push({
    id: `p-${repo.name}-${pf.path.replace(/\//g, '-').replace(/\./g, '_')}`,
    name: basename(pf.path, extname(pf.path)),
    ext: extname(pf.path),
    type: pf.fileType,
    crit: fileCrit,
    add: diff.additions,
    del: diff.deletions,
    tested: hasSpec,
    ox: 0, oy: 0,
    methods,
    constants,
  });
}

// ── Dir affinity (inter-directory links) ──

function computeDirAffinity(parsedFiles: ParsedFile[]): Map<string, Map<string, number>> {
  const affinity = new Map<string, Map<string, number>>();

  for (const pf of parsedFiles) {
    const fromDir = dirname(pf.path);
    // Collect target strings from imports (.source) and injections (.typeName)
    const targets: string[] = [
      ...(pf.imports ?? []).map(i => i.source),
      ...(pf.injections ?? []).map(i => i.typeName),
    ];
    for (const target of targets) {
      const targetFile = parsedFiles.find(f => f.path.includes(target) || f.path.endsWith(`${target}.ts`));
      if (!targetFile) continue;
      const toDir = dirname(targetFile.path);
      if (fromDir === toDir) continue;

      if (!affinity.has(fromDir)) affinity.set(fromDir, new Map());
      const inner = affinity.get(fromDir)!;
      inner.set(toDir, (inner.get(toDir) ?? 0) + 1);

      if (!affinity.has(toDir)) affinity.set(toDir, new Map());
      const innerRev = affinity.get(toDir)!;
      innerRev.set(fromDir, (innerRev.get(fromDir) ?? 0) + 1);
    }
  }

  return affinity;
}

// ── Crit map builder ──

function buildFileCritMap(galaxies: { systems: { planets: { id: string; crit: number }[] }[] }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const g of galaxies) {
    for (const s of g.systems) {
      for (const p of s.planets) {
        map.set(p.id, p.crit);
      }
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
  return pf.methods.map(m => {
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
}

function buildConstantData(pf: ParsedFile, diff: FileDiff, fileCrit: number): MethodData[] {
  return pf.constants.map(c => {
    const rawDiff = extractMethodDiff(c.startLine, c.endLine, diff, true);
    if (rawDiff.length === 0 || isFormattingOnly(rawDiff)) return null;
    return {
      name: c.name, status: 'new' as const,
      crit: Math.round(fileCrit * 0.6 * 10) / 10,
      usages: 1, tested: false, sigChanged: false,
      isType: c.isType, diff: rawDiff,
    };
  }).filter(Boolean) as MethodData[];
}

// ── Formatting filter ──

/** Normalize a line for comparison: collapse whitespace, remove trailing commas/semicolons, normalize quotes */
function normalizeLine(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/[;,]$/g, '').replace(/'/g, '"');
}

/** True if the diff only contains whitespace / formatting changes (no semantic change) */
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

// ── Links → Edges (optimized O(n)) ──

function linksToEdges(
  links: DetectedLink[], files: ParsedFile[],
  galaxies: { systems: { planets: { id: string; methods: { sigChanged: boolean }[] }[] }[] }[],
): EdgeData[] {
  // Build planet id set + sigChanged map
  const planetIds = new Set<string>();
  const sigChangedMap = new Map<string, boolean>();
  for (const g of galaxies) {
    for (const s of g.systems) {
      for (const p of s.planets) {
        planetIds.add(p.id);
        if (p.methods.some(m => m.sigChanged)) sigChangedMap.set(p.id, true);
      }
    }
  }

  // Build filepath → planet id + file → repo maps
  const idByRepoFile = new Map<string, string>();
  const repoByFile = new Map<string, string>();
  for (const f of files) {
    repoByFile.set(f.path, f.repoName);
    const suffix = f.path.replace(/\//g, '-').replace(/\./g, '_');
    const expectedId = `p-${f.repoName}-${suffix}`;
    if (planetIds.has(expectedId)) {
      idByRepoFile.set(`${f.repoName}:${f.path}`, expectedId);
    }
  }

  return links.map(link => {
    const fromRepo = repoByFile.get(link.fromFile) ?? '';
    const toRepo = repoByFile.get(link.toFile) ?? '';
    const fromId = idByRepoFile.get(`${fromRepo}:${link.fromFile}`);
    const toId = idByRepoFile.get(`${toRepo}:${link.toFile}`);
    if (!fromId || !toId || fromId === toId) return null;

    const hasSigChange = sigChangedMap.get(toId) ?? false;
    return {
      from: fromId, to: toId, label: link.label,
      riskCrit: link.riskCrit,
      cross: link.cross || undefined,
      critical: link.riskCrit >= 7.5 || hasSigChange || undefined,
      dashed: link.type === 'side-effect' || undefined,
      linkType: link.type,
      specifiers: link.specifiers,
      sigChanged: hasSigChange || undefined,
    };
  }).filter(Boolean) as EdgeData[];
}
