// ── Side-effect detection: mark files impacted by signature changes ──

import type { DetectedLink, MethodData, LinkType } from '../types.js';
import type { FileEntry, RepoEntry } from '../engine.js';

const INJECT_TYPES: Set<LinkType> = new Set(['inject']);

/** Collect methods with sigChanged, grouped by file path */
export function buildSigChangedMap(repos: RepoEntry[]): Map<string, Set<string>> {
  const sigMap = new Map<string, Set<string>>();
  for (const repo of repos) {
    for (const file of repo.files) {
      for (const m of file.methods) {
        if (!m.sigChanged) continue;
        const set = sigMap.get(file.path) ?? new Set();
        set.add(m.name);
        sigMap.set(file.path, set);
      }
      for (const m of file.constants) {
        if (!m.sigChanged) continue;
        const set = sigMap.get(file.path) ?? new Set();
        set.add(m.name);
        sigMap.set(file.path, set);
      }
    }
  }
  return sigMap;
}

/** All methods + constants for a file entry */
export function allMethods(file: FileEntry): MethodData[] {
  return [...file.methods, ...file.constants];
}

/** Mark methods as impacted when their file imports a sigChanged method */
export function detectSideEffects(repos: RepoEntry[], links: DetectedLink[]): void {
  const sigMap = buildSigChangedMap(repos);

  // For each link, check if target has sigChanged methods that match specifiers
  const impactedFiles = new Set<string>();
  for (const link of links) {
    const changedNames = sigMap.get(link.toFile);
    if (!changedNames) continue;

    const isInject = INJECT_TYPES.has(link.type);
    const matchesSpecifier = link.specifiers?.some(s => changedNames.has(s));
    if (isInject || matchesSpecifier) {
      impactedFiles.add(link.fromFile);
    }
  }

  // Mark impacted methods on affected files
  for (const repo of repos) {
    for (const file of repo.files) {
      if (!impactedFiles.has(file.path)) continue;
      for (const m of file.methods) m.impacted = true;
      for (const m of file.constants) m.impacted = true;
    }
  }
}
