// ── Content-aware scoring signals — pure functions ──

import type { MethodData, DetectedLink } from '../types.js';

interface FileRef { path: string; type: string; methods: MethodData[] }

// ── Couche 1: Base weights ──

const CONTENT_PATTERNS: Array<{ re: RegExp; w: number }> = [
  { re: /password|token|secret|credential/i, w: 0.25 },
  { re: /@UseGuards|canActivate|@Roles/i, w: 0.20 },
  { re: /try\b|catch\b|throw\b/, w: 0.20 },
  { re: /@IsString|@IsEmail|@IsUUID|@IsNotEmpty|@IsOptional|@MaxLength|@MinLength|@IsEnum/, w: 0.15 },
  { re: /if\b|else\b|switch\b|case\b/, w: 0.15 },
  { re: /@Transform|@Type/, w: 0.12 },
  { re: /await\b|Promise\.all/, w: 0.10 },
];

/** Regex-based risk on diff line content (added/deleted lines only). */
export function computeContentRisk(methods: MethodData[]): number {
  let totalWeight = 0;
  let lineCount = 0;
  for (const m of methods) {
    for (const d of m.diff) {
      if (d.t === 'c') continue;
      lineCount++;
      for (const { re, w } of CONTENT_PATTERNS) {
        if (re.test(d.c)) { totalWeight += w; break; }
      }
    }
  }
  return lineCount > 0 ? Math.min(1, totalWeight / lineCount) : 0;
}

/** Aggregate method risk profile: status, sigChanged, body size delta. */
export function computeMethodRisk(methods: MethodData[]): number {
  if (methods.length === 0) return 0;
  let total = 0;
  let active = 0;
  for (const m of methods) {
    if (m.status === 'unch') continue;
    active++;
    let score = m.status === 'del' ? 0.7 : m.status === 'mod' ? 0.5 : 0.2;
    if (m.sigChanged && m.status === 'mod') score += 0.3;
    // Usage amplifier: more callers = more risk
    const usageAmp = 1 + Math.min(1, m.usages / 10) * 0.5;
    total += score * usageAmp;
  }
  return active > 0 ? Math.min(1, total / active) : 0;
}

/** Ratio of modifications vs pure additions. Refactoring > feature add. */
export function computeStabilityRisk(additions: number, deletions: number): number {
  const total = additions + deletions;
  if (total === 0) return 0;
  // Paired add/del = modification (weight 1.0)
  const mods = Math.min(additions, deletions);
  // Pure deletions (weight 0.7), pure additions (weight 0.3)
  const pureDel = deletions - mods;
  const pureAdd = additions - mods;
  const weighted = mods * 1.0 + pureDel * 0.7 + pureAdd * 0.3;
  return Math.min(1, weighted / total);
}

// ── Couche 2: Compound bonuses ──

/** Bonus when signature changed on a file with many dependants. */
export function computeCompoundSigDep(methods: MethodData[], depCount: number): number {
  if (depCount < 3) return 0;
  const hasSigChange = methods.some(m => m.sigChanged);
  if (!hasSigChange) return 0;
  return Math.min(0.15, (depCount / 20) * 0.15);
}

/** Bonus for change propagation: how many importing files are also modified. */
export function computeChangePropagation(
  filePath: string, allFiles: FileRef[], links: DetectedLink[],
): number {
  let bonus = 0;
  const modifiedPaths = new Set(allFiles.map(f => f.path));
  for (const link of links) {
    if (link.toFile !== filePath) continue;
    if (!modifiedPaths.has(link.fromFile)) continue;
    bonus += link.cross ? 0.06 : 0.03;
  }
  return Math.min(0.20, bonus);
}

/** BFS depth of modified file chains. */
export function computeCascadeDepth(
  filePath: string, allFiles: FileRef[], links: DetectedLink[],
): number {
  const modifiedPaths = new Set(allFiles.map(f => f.path));
  // Build adjacency: A→B means A imports B, both modified
  const adj = new Map<string, string[]>();
  for (const link of links) {
    if (!modifiedPaths.has(link.fromFile) || !modifiedPaths.has(link.toFile)) continue;
    const list = adj.get(link.fromFile) ?? [];
    list.push(link.toFile);
    adj.set(link.fromFile, list);
  }

  // BFS from filePath outward
  const visited = new Set<string>([filePath]);
  let frontier = [filePath];
  let depth = 0;
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const node of frontier) {
      for (const neighbor of adj.get(node) ?? []) {
        if (!visited.has(neighbor)) { visited.add(neighbor); next.push(neighbor); }
      }
    }
    if (next.length > 0) depth++;
    frontier = next;
  }

  if (depth <= 1) return 0;
  if (depth === 2) return 0.05;
  if (depth === 3) return 0.10;
  return 0.15;
}

/** Bonus when DTO has validation decorator changes. */
export function computeDtoContractChange(
  fileType: string, methods: MethodData[], constants: MethodData[],
): number {
  if (fileType !== 'dto') return 0;
  const validationRe = /@Is\w+|@Min\w+|@Max\w+|@IsOptional|@IsNotEmpty|@Matches|@ValidateNested|@Type/;
  let validationLines = 0;
  let totalLines = 0;
  for (const m of [...methods, ...constants]) {
    for (const d of m.diff) {
      if (d.t === 'c') continue;
      totalLines++;
      if (validationRe.test(d.c)) validationLines++;
    }
  }
  if (totalLines === 0) return 0;
  return Math.min(0.15, (validationLines / totalLines) * 0.20);
}

/** Bonus for existing HTTP endpoint modification/deletion. */
export function computeExistingEndpointMod(fileType: string, methods: MethodData[]): number {
  if (fileType !== 'controller') return 0;
  let bonus = 0;
  for (const m of methods) {
    if (!m.httpVerb) continue;
    if (m.status === 'del') bonus += 0.08;
    else if (m.status === 'mod') {
      bonus += 0.05;
      if (m.sigChanged) bonus += 0.04;
    }
    // 'new' endpoints don't get the bonus (lower risk)
  }
  return Math.min(0.20, bonus);
}

// ── Couche 3: Attenuations ──

/** Discount for formatting-only or near-formatting changes. */
export function computeFormattingDiscount(methods: MethodData[], constants: MethodData[]): number {
  const all = [...methods, ...constants];
  if (all.length === 0) return 1.0;
  const active = all.filter(m => m.status !== 'unch');
  if (active.length === 0) return 0.1; // All unchanged = near-zero
  // Count total change lines
  let changeLines = 0;
  for (const m of active) {
    changeLines += m.diff.filter(d => d.t !== 'c').length;
  }
  if (changeLines < 5 && active.length <= 1) return 0.7; // Minor tweak
  return 1.0;
}

/** Discount when a spec file is also modified alongside the file. */
export function computeTestDiscount(tested: boolean): number {
  return tested ? 0.85 : 1.0;
}
