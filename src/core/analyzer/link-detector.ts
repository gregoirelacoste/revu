import { basename, dirname, join, normalize } from 'node:path';
import type { ParsedFile, DetectedLink } from '../types.js';

/**
 * fileCritMap is keyed by file path (e.g. "src/cases/case.service.ts"),
 * NOT by generated IDs. Callers must ensure this.
 */
export function detectLinks(files: ParsedFile[], fileCritMap: Map<string, number>): DetectedLink[] {
  const links: DetectedLink[] = [];
  const fileByPath = new Map(files.map(f => [f.path, f]));
  const fileByClassName = buildClassNameIndex(files);

  for (const file of files) {
    for (const imp of file.imports) {
      const resolved = resolveImportPath(file.path, imp.source, fileByPath);
      if (!resolved) continue;
      const target = fileByPath.get(resolved);
      if (!target) continue;

      const isTypeImport = target.fileType === 'dto' || imp.specifiers.every(s => {
        return target.constants.some(c => c.name === s && c.isType);
      });

      links.push({
        fromFile: file.path,
        toFile: resolved,
        type: isTypeImport ? 'type' : 'import',
        label: `${isTypeImport ? 'type' : 'import'} ${imp.specifiers.join(', ')}`,
        riskCrit: fileCritMap.get(resolved) ?? 0,
        cross: file.repoName !== target.repoName,
        specifiers: imp.specifiers,
      });
    }

    for (const inj of file.injections) {
      const targetPath = fileByClassName.get(inj.typeName);
      if (!targetPath) continue;
      const target = fileByPath.get(targetPath);
      if (!target) continue;

      links.push({
        fromFile: file.path,
        toFile: targetPath,
        type: 'inject',
        label: `inject ${inj.typeName}`,
        riskCrit: fileCritMap.get(targetPath) ?? 0,
        cross: file.repoName !== target.repoName,
        specifiers: [inj.typeName],
      });
    }
  }

  const seen = new Set<string>();
  return links.filter(l => {
    const key = `${l.fromFile}|${l.toFile}|${l.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildClassNameIndex(files: ParsedFile[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const file of files) {
    const name = basename(file.path, '.ts');
    const className = toPascalCase(name);
    index.set(className, file.path);
  }
  return index;
}

function toPascalCase(str: string): string {
  return str.split(/[.-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function resolveImportPath(
  fromPath: string,
  importSource: string,
  fileByPath: Map<string, ParsedFile>,
): string | null {
  if (!importSource.startsWith('.')) return null;

  const fromDir = dirname(fromPath);
  const resolved = normalize(join(fromDir, importSource)).replace(/\\/g, '/');
  const candidates = [
    resolved + '.ts',
    resolved + '/index.ts',
    resolved,
  ];

  for (const candidate of candidates) {
    if (fileByPath.has(candidate)) return candidate;
  }

  return null;
}
