import { describe, it, expect } from 'vitest';
import { computeFileReviewStats, computeGlobalReviewStats } from './review-stats.js';
import { mockTuiFileDiff, mockDiffRow } from '../__tests__/fixtures.js';
import type { LineReview } from './hooks/useReview.js';

describe('computeFileReviewStats', () => {
  it('returns zeros when no reviews exist', () => {
    const diff = mockTuiFileDiff([
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Mod' },
      mockDiffRow({ reviewLine: { n: 1, c: 'x', t: 'add' } }),
      mockDiffRow({ reviewLine: { n: 2, c: 'y', t: 'add' } }),
    ]);
    const stats = computeFileReviewStats('f1', diff, new Map());
    expect(stats.total).toBe(2);
    expect(stats.reviewed).toBe(0);
    expect(stats.bugs).toBe(0);
    expect(stats.questions).toBe(0);
    expect(stats.comments).toBe(0);
  });

  it('counts partial reviews with flags', () => {
    const diff = mockTuiFileDiff([
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Mod' },
      mockDiffRow({ reviewLine: { n: 1, c: 'x', t: 'add' } }),
      mockDiffRow({ reviewLine: { n: 2, c: 'y', t: 'add' } }),
      mockDiffRow({ reviewLine: { n: 3, c: 'z', t: 'del' } }),
    ]);
    const reviews = new Map<string, LineReview>([
      ['f1:1', { flag: 'ok', comments: [] }],
      ['f1:2', { flag: 'bug', comments: [{ text: 'issue', time: 'now' }] }],
    ]);
    const stats = computeFileReviewStats('f1', diff, reviews);
    expect(stats.total).toBe(3);
    expect(stats.reviewed).toBe(2);
    expect(stats.bugs).toBe(1);
    expect(stats.comments).toBe(1);
  });
});

describe('computeGlobalReviewStats', () => {
  it('aggregates across multiple files', () => {
    const diff1 = mockTuiFileDiff([
      { type: 'hunkHeader', method: 'fn', methodCrit: 5, label: 'Mod' },
      mockDiffRow({ reviewLine: { n: 1, c: 'x', t: 'add' } }),
    ]);
    const diff2 = mockTuiFileDiff([
      { type: 'hunkHeader', method: 'fn2', methodCrit: 3, label: 'New' },
      mockDiffRow({ reviewLine: { n: 1, c: 'y', t: 'add' } }),
    ]);
    const diffs = new Map([['f1', diff1], ['f2', diff2]]);
    const reviews = new Map<string, LineReview>([
      ['f1:1', { flag: 'question', comments: [] }],
    ]);
    const stats = computeGlobalReviewStats(diffs, reviews);
    expect(stats.total).toBe(2);
    expect(stats.reviewed).toBe(1);
    expect(stats.questions).toBe(1);
  });
});
