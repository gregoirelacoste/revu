import { describe, it, expect } from 'vitest';
import { buildTree, flattenTree, buildFileDiffs, buildUnifiedRows } from './data.js';
import {
  mockScanResult, mockRepoEntry, mockFileEntry, mockMethodData, mockDiffRow,
} from '../__tests__/fixtures.js';
import type { DiffRow } from './types.js';

// ── buildTree ──

describe('buildTree', () => {
  it('builds a tree with 1 repo and 1 root file', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [mockFileEntry({ dir: '.', name: 'main', ext: '.ts' })],
      })],
    });
    const tree = buildTree(result);
    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('repo');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].name).toBe('main.ts');
  });

  it('groups files into nested folders', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [
          mockFileEntry({ id: 'f1', dir: 'src/auth', name: 'auth.service', ext: '.ts', crit: 7 }),
          mockFileEntry({ id: 'f2', dir: 'src/auth', name: 'auth.guard', ext: '.ts', crit: 5 }),
        ],
      })],
    });
    const tree = buildTree(result);
    const repo = tree[0];
    expect(repo.children).toHaveLength(1); // 1 folder
    expect(repo.children![0].name).toBe('src/auth');
    expect(repo.children![0].children).toHaveLength(2);
  });

  it('sets folder crit to max of children', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [
          mockFileEntry({ id: 'f1', dir: 'src', crit: 3.2 }),
          mockFileEntry({ id: 'f2', dir: 'src', crit: 7.5 }),
        ],
      })],
    });
    const tree = buildTree(result);
    const folder = tree[0].children![0];
    expect(folder.crit).toBe(7.5);
  });

  it('handles repo with no files', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({ files: [] })],
    });
    const tree = buildTree(result);
    expect(tree[0].crit).toBe(0);
    expect(tree[0].children).toHaveLength(0);
  });

  it('propagates sideEffect from impacted methods to file and folder', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [
          mockFileEntry({
            id: 'f1', dir: 'src', name: 'case.controller', ext: '.ts',
            methods: [mockMethodData({ name: 'create', impacted: true })],
          }),
          mockFileEntry({
            id: 'f2', dir: 'src', name: 'auth.service', ext: '.ts',
            methods: [mockMethodData({ name: 'validate', impacted: undefined })],
          }),
        ],
      })],
    });
    const tree = buildTree(result);
    const folder = tree[0].children![0];
    expect(folder.sideEffect).toBe(true);
    expect(folder.children![0].sideEffect).toBe(true);  // f1 impacted
    expect(folder.children![1].sideEffect).toBe(false);  // f2 not impacted
  });
});

// ── flattenTree ──

describe('flattenTree', () => {
  it('flattens a fully expanded tree', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        name: 'repo',
        files: [mockFileEntry({ dir: '.', id: 'f1' })],
      })],
    });
    const tree = buildTree(result);
    const flat = flattenTree(tree, new Set());
    // repo + file = 2 items
    expect(flat).toHaveLength(2);
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(1);
  });

  it('respects collapsed state', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        name: 'repo',
        files: [mockFileEntry({ dir: '.', id: 'f1' })],
      })],
    });
    const tree = buildTree(result);
    const flat = flattenTree(tree, new Set(['repo']));
    expect(flat).toHaveLength(1); // only repo, children hidden
  });

  it('tracks depth for nested folders', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        name: 'repo',
        files: [
          mockFileEntry({ id: 'f1', dir: 'src/auth', name: 'auth.service', ext: '.ts' }),
        ],
      })],
    });
    const tree = buildTree(result);
    const flat = flattenTree(tree, new Set());
    // repo(0) → folder(1) → file(2)
    expect(flat).toHaveLength(3);
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(1);
    expect(flat[2].depth).toBe(2);
  });
});

// ── buildFileDiffs ──

describe('buildFileDiffs', () => {
  it('sorts methods by crit descending', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [mockFileEntry({
          id: 'f1',
          methods: [
            mockMethodData({ name: 'low', crit: 2.0, status: 'mod' }),
            mockMethodData({ name: 'high', crit: 8.0, status: 'mod' }),
          ],
        })],
      })],
    });
    const diffs = buildFileDiffs(result);
    const fileDiff = diffs.get('f1')!;
    const headers = fileDiff.rows.filter(r => r.type === 'hunkHeader');
    expect(headers[0].method).toBe('high');
    expect(headers[1].method).toBe('low');
  });

  it('filters out unchanged methods', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [mockFileEntry({
          id: 'f1',
          methods: [
            mockMethodData({ name: 'changed', status: 'mod' }),
            mockMethodData({ name: 'unchanged', status: 'unch' }),
          ],
        })],
      })],
    });
    const diffs = buildFileDiffs(result);
    const fileDiff = diffs.get('f1')!;
    const headers = fileDiff.rows.filter(r => r.type === 'hunkHeader');
    expect(headers).toHaveLength(1);
    expect(headers[0].method).toBe('changed');
  });

  it('generates hunkHeader rows for each method', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [mockFileEntry({
          id: 'f1',
          methods: [mockMethodData({ name: 'fn1', status: 'new' })],
          constants: [mockMethodData({ name: 'CONST', status: 'mod' })],
        })],
      })],
    });
    const diffs = buildFileDiffs(result);
    const fileDiff = diffs.get('f1')!;
    const headers = fileDiff.rows.filter(r => r.type === 'hunkHeader');
    expect(headers).toHaveLength(2);
  });
});

// ── buildUnifiedRows ──

describe('buildUnifiedRows', () => {
  it('preserves hunkHeaders', () => {
    const rows: DiffRow[] = [
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Modified' },
      mockDiffRow({ baseLine: { n: 1, c: 'old', t: 'del' }, reviewLine: { n: 1, c: 'new', t: 'add' } }),
    ];
    const unified = buildUnifiedRows(rows);
    expect(unified[0].type).toBe('hunkHeader');
    expect(unified[0].method).toBe('fn');
  });

  it('emits context lines once without duplication', () => {
    const rows: DiffRow[] = [
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Mod' },
      {
        type: 'diffRow', method: 'fn', methodCrit: 5, label: 'Mod',
        baseLine: { n: 1, c: '  const x = 1;', t: 'ctx' },
        reviewLine: { n: 1, c: '  const x = 1;', t: 'ctx' },
      },
    ];
    const unified = buildUnifiedRows(rows);
    const diffLines = unified.filter(r => r.type === 'diffRow');
    expect(diffLines).toHaveLength(1);
    expect(diffLines[0].reviewLine?.t).toBe('ctx');
    expect(diffLines[0].baseLine).toBeNull();
  });

  it('orders del before add within a hunk', () => {
    const rows: DiffRow[] = [
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Mod' },
      mockDiffRow({
        baseLine: { n: 1, c: 'old line', t: 'del', crit: 4 },
        reviewLine: { n: 1, c: 'new line', t: 'add', crit: 3 },
      }),
      mockDiffRow({
        baseLine: { n: 2, c: 'old line 2', t: 'del', crit: 4 },
        reviewLine: { n: 2, c: 'new line 2', t: 'add', crit: 3 },
      }),
    ];
    const unified = buildUnifiedRows(rows);
    const diffLines = unified.filter(r => r.type === 'diffRow');
    // Should be: del, del, add, add
    expect(diffLines).toHaveLength(4);
    expect(diffLines[0].baseLine?.t).toBe('del');
    expect(diffLines[1].baseLine?.t).toBe('del');
    expect(diffLines[2].reviewLine?.t).toBe('add');
    expect(diffLines[3].reviewLine?.t).toBe('add');
  });

  it('preserves hiRanges on lines', () => {
    const rows: DiffRow[] = [
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Mod' },
      mockDiffRow({
        baseLine: null,
        reviewLine: { n: 1, c: 'new code', t: 'add', crit: 3, hiRanges: [[0, 3]] },
      }),
    ];
    const unified = buildUnifiedRows(rows);
    const addRow = unified.find(r => r.reviewLine?.t === 'add');
    expect(addRow?.reviewLine?.hiRanges).toEqual([[0, 3]]);
  });

  it('handles deleted method (baseLine only rows)', () => {
    const rows: DiffRow[] = [
      { type: 'hunkHeader', method: 'removed', methodCrit: 6, label: 'Deleted' },
      {
        type: 'diffRow', method: 'removed', methodCrit: 6, label: 'Deleted',
        baseLine: { n: 1, c: 'line 1', t: 'del', crit: 6 },
        reviewLine: null,
      },
      {
        type: 'diffRow', method: 'removed', methodCrit: 6, label: 'Deleted',
        baseLine: { n: 2, c: 'line 2', t: 'del', crit: 6 },
        reviewLine: null,
      },
    ];
    const unified = buildUnifiedRows(rows);
    const diffLines = unified.filter(r => r.type === 'diffRow');
    expect(diffLines).toHaveLength(2);
    expect(diffLines.every(r => r.baseLine?.t === 'del')).toBe(true);
    expect(diffLines.every(r => r.reviewLine === null)).toBe(true);
  });
});
