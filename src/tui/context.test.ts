import { describe, it, expect } from 'vitest';
import { getFileContext, getFolderContext, getRepoContext } from './context.js';
import {
  mockScanResult, mockRepoEntry, mockFileEntry, mockTuiFileDiff, mockDiffRow,
} from '../__tests__/fixtures.js';
import type { LineReview } from './hooks/useReview.js';

const emptyReviews = new Map<string, LineReview>();

describe('getFileContext', () => {
  it('returns null when file not in diffs', () => {
    const result = mockScanResult();
    const diffs = new Map();
    expect(getFileContext('nonexistent', result, diffs, emptyReviews)).toBeNull();
  });

  it('returns context with chunks from hunkHeaders', () => {
    const diff = mockTuiFileDiff([
      { type: 'hunkHeader', method: 'fn1', methodCrit: 5, label: 'Modified' },
      mockDiffRow({ reviewLine: { n: 1, c: 'x', t: 'add' } }),
    ]);
    const diffs = new Map([['f1', diff]]);
    const result = mockScanResult();
    const ctx = getFileContext('f1', result, diffs, emptyReviews);
    expect(ctx).not.toBeNull();
    expect(ctx!.chunks).toHaveLength(1);
    expect(ctx!.chunks[0].method).toBe('fn1');
    expect(ctx!.name).toBe('app.service.ts');
  });
});

describe('getFolderContext', () => {
  it('returns null when no files match folder', () => {
    const result = mockScanResult({
      repos: [mockRepoEntry({
        files: [mockFileEntry({ dir: 'src/other' })],
      })],
    });
    const ctx = getFolderContext('src/auth', result, new Map(), emptyReviews);
    expect(ctx).toBeNull();
  });
});

describe('getRepoContext', () => {
  it('returns null when repo not found', () => {
    const result = mockScanResult();
    const ctx = getRepoContext('nonexistent', result, new Map(), emptyReviews);
    expect(ctx).toBeNull();
  });
});
