import type { FileType } from '../types.js';

const PATTERNS: Array<[RegExp, FileType]> = [
  [/\.controller\.ts$/, 'controller'],
  [/\.service\.ts$/, 'service'],
  [/\.module\.ts$/, 'module'],
  [/\.component\.ts$/, 'component'],
  [/\.guard\.ts$/, 'guard'],
  [/\.dto\.ts$/, 'dto'],
  [/\.interceptor\.ts$/, 'interceptor'],
  [/\.pipe\.ts$/, 'pipe'],
  [/\.spec\.ts$/, 'spec'],
  [/\.html$/, 'html'],
  [/\.scss$/, 'scss'],
];

const DTO_DIR = /\/dto\//;

export function classifyFile(filePath: string): FileType {
  for (const [pattern, type] of PATTERNS) {
    if (pattern.test(filePath)) return type;
  }
  if (DTO_DIR.test(filePath) && filePath.endsWith('.ts')) return 'dto';
  if (filePath.endsWith('.ts')) return 'unknown';
  return 'unknown';
}

export function isDisplayableFile(type: FileType): boolean {
  return type !== 'spec' && type !== 'html' && type !== 'scss';
}
