// ── Test fixtures factory ──

import type { MethodData, ScoringConfig } from '../core/types.js';
import type { FileEntry, RepoEntry, ScanResult } from '../core/engine.js';
import type { TuiFileDiff, DiffRow } from '../tui/types.js';

// ── Scoring config ──

export function defaultScoringConfig(): ScoringConfig {
  return {
    weights: { fileType: 0.25, changeVolume: 0.25, dependencies: 0.25, securityContext: 0.25 },
    fileTypes: {
      module: 1.0, guard: 0.9, interceptor: 0.8, service: 0.8,
      controller: 0.7, component: 0.5, pipe: 0.4, dto: 0.3,
      model: 0.3, html: 0.1, scss: 0.05, css: 0.05, spec: 0.1, unknown: 0.4,
    },
    securityKeywords: {
      high: ['crypto', 'auth', 'guard', 'security', 'signature', 'certificate', 'secret', 'private.key'],
      medium: ['billing', 'payment', 'subscription', 'trust', 'score', 'verify'],
      low: ['config', 'env', 'migration'],
    },
    securityBonus: { high: 0.5, medium: 0.3, low: 0.1 },
    lineCriticality: {
      signatureChange: 2.0, returnTypeChange: 1.8, parameterChange: 1.5,
      guardDecorator: 1.3, newDependencyInjection: 1.2, errorHandling: 1.0,
      regularCode: 0.5, comment: 0.1, import: 0.1, whitespace: 0.0,
    },
  };
}

// ── Method data ──

export function mockMethodData(overrides?: Partial<MethodData>): MethodData {
  return {
    name: 'doSomething',
    status: 'mod',
    crit: 5.0,
    usages: 1,
    tested: false,
    sigChanged: false,
    diff: [{ t: 'a', c: '  return true;' }],
    ...overrides,
  };
}

// ── File entry ──

export function mockFileEntry(overrides?: Partial<FileEntry>): FileEntry {
  return {
    id: 'f-my-repo-src-app_service_ts',
    path: 'src/app.service.ts',
    name: 'app.service',
    ext: '.ts',
    dir: 'src',
    type: 'service',
    crit: 5.0,
    add: 10,
    del: 3,
    tested: false,
    methods: [mockMethodData()],
    constants: [],
    ...overrides,
  };
}

// ── Repo entry ──

export function mockRepoEntry(overrides?: Partial<RepoEntry>): RepoEntry {
  return {
    name: 'my-repo',
    branch: 'feature/test',
    files: [mockFileEntry()],
    ...overrides,
  };
}

// ── Scan result ──

export function mockScanResult(overrides?: Partial<ScanResult>): ScanResult {
  return {
    repos: [mockRepoEntry()],
    links: [],
    allFiles: [],
    config: {
      version: 1,
      stack: 'generic',
      scoring: defaultScoringConfig(),
      rules: { alwaysShow: [], sideEffectDetection: true, minCritForDisplay: 0 },
    },
    ...overrides,
  };
}

// ── Diff row ──

export function mockDiffRow(overrides?: Partial<DiffRow>): DiffRow {
  return {
    type: 'diffRow',
    method: 'doSomething',
    methodCrit: 5.0,
    label: 'Modified',
    baseLine: null,
    reviewLine: { n: 1, c: '  return true;', t: 'add', crit: 3.0 },
    ...overrides,
  };
}

// ── TUI file diff ──

export function mockTuiFileDiff(rows?: DiffRow[]): TuiFileDiff {
  return {
    name: 'app.service.ts',
    path: 'src/app.service.ts',
    type: 'service',
    crit: 5.0,
    rows: rows ?? [
      { type: 'hunkHeader', method: 'doSomething', methodCrit: 5.0, label: 'Modified' },
      mockDiffRow(),
    ],
    usedBy: [],
  };
}
