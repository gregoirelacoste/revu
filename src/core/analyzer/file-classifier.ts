import type { FileType } from '../types.js';

const PATTERNS: Array<[RegExp, FileType]> = [
  [/\.controller\.tsx?$/, 'controller'],
  [/\.service\.tsx?$/, 'service'],
  [/\.module\.tsx?$/, 'module'],
  [/\.component\.tsx?$/, 'component'],
  [/\.guard\.tsx?$/, 'guard'],
  [/\.dto\.tsx?$/, 'dto'],
  [/\.model\.tsx?$/, 'model'],
  [/\.interceptor\.tsx?$/, 'interceptor'],
  [/\.pipe\.tsx?$/, 'pipe'],
  [/\.resolver\.tsx?$/, 'service'],
  [/\.middleware\.tsx?$/, 'interceptor'],
  [/\.filter\.tsx?$/, 'interceptor'],
  [/\.strategy\.tsx?$/, 'service'],
  [/\.spec\.tsx?$/, 'spec'],
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
  if (DTO_DIR.test(filePath) && /\.tsx?$/.test(filePath)) return 'dto';
  if (/\.tsx?$/.test(filePath)) return 'unknown';
  return 'unknown';
}

export function isDisplayableFile(type: FileType): boolean {
  return !NON_REVIEWABLE.has(type);
}

export function isTypeScriptFile(path: string): boolean {
  return /\.tsx?$/.test(path) && !path.endsWith('.spec.ts') && !path.endsWith('.spec.tsx');
}
