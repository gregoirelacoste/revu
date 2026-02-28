import type { FileType } from '../types.js';

const PATTERNS: Array<[RegExp, FileType]> = [
  [/\.controller\.ts$/, 'controller'],
  [/\.service\.ts$/, 'service'],
  [/\.module\.ts$/, 'module'],
  [/\.component\.ts$/, 'component'],
  [/\.guard\.ts$/, 'guard'],
  [/\.dto\.ts$/, 'dto'],
  [/\.model\.ts$/, 'model'],
  [/\.interceptor\.ts$/, 'interceptor'],
  [/\.pipe\.ts$/, 'pipe'],
  [/\.spec\.ts$/, 'spec'],
  [/\.html$/, 'html'],
  [/\.scss$/, 'scss'],
  [/\.css$/, 'css'],
];

const DTO_DIR = /\/dto\//;

const NON_REVIEWABLE = new Set<FileType>(['spec']);

export function classifyFile(filePath: string): FileType {
  for (const [pattern, type] of PATTERNS) {
    if (pattern.test(filePath)) return type;
  }
  if (DTO_DIR.test(filePath) && filePath.endsWith('.ts')) return 'dto';
  if (filePath.endsWith('.ts')) return 'unknown';
  return 'unknown';
}

export function isDisplayableFile(type: FileType): boolean {
  return !NON_REVIEWABLE.has(type);
}

export function isTypeScriptFile(path: string): boolean {
  return path.endsWith('.ts') && !path.endsWith('.spec.ts');
}
