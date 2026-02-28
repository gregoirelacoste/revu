import { describe, it, expect } from 'vitest';
import { computeWordDiff, injectWordDiffRanges } from './word-diff.js';
import type { TuiDiffLine } from './types.js';

describe('computeWordDiff', () => {
  it('returns empty ranges for identical strings', () => {
    const { oldRanges, newRanges } = computeWordDiff('foo bar', 'foo bar');
    expect(oldRanges).toEqual([]);
    expect(newRanges).toEqual([]);
  });

  it('highlights changed word', () => {
    const { oldRanges, newRanges } = computeWordDiff('foo bar', 'foo baz');
    expect(oldRanges).toEqual([[4, 7]]);
    expect(newRanges).toEqual([[4, 7]]);
  });

  it('highlights entirely replaced string', () => {
    const { oldRanges, newRanges } = computeWordDiff('abc', 'xyz');
    expect(oldRanges).toEqual([[0, 3]]);
    expect(newRanges).toEqual([[0, 3]]);
  });

  it('highlights multiple changed words', () => {
    const { oldRanges, newRanges } = computeWordDiff('a b c d', 'a x c y');
    expect(oldRanges).toEqual([[2, 3], [6, 7]]);  // 'b' and 'd'
    expect(newRanges).toEqual([[2, 3], [6, 7]]);  // 'x' and 'y'
  });

  it('handles empty strings', () => {
    const { oldRanges, newRanges } = computeWordDiff('', '');
    expect(oldRanges).toEqual([]);
    expect(newRanges).toEqual([]);
  });

  it('handles one empty string', () => {
    const { oldRanges, newRanges } = computeWordDiff('foo', '');
    expect(oldRanges).toEqual([[0, 3]]);
    expect(newRanges).toEqual([]);
  });
});

describe('injectWordDiffRanges', () => {
  const mkLine = (t: 'del' | 'add' | 'ctx', c: string, n = 1): TuiDiffLine => ({ n, c, t });

  it('pairs del+add and sets hiRanges', () => {
    const base = [mkLine('del', 'foo bar')];
    const review = [mkLine('add', 'foo baz')];
    injectWordDiffRanges(base, review);
    expect(base[0].hiRanges).toEqual([[4, 7]]);
    expect(review[0].hiRanges).toEqual([[4, 7]]);
  });

  it('pairs only matching count in unequal blocks', () => {
    const base = [mkLine('del', 'aaa', 1), mkLine('del', 'bbb', 2)];
    const review = [mkLine('add', 'xxx')];
    injectWordDiffRanges(base, review);
    expect(base[0].hiRanges).toEqual([[0, 3]]);  // paired
    expect(base[1].hiRanges).toBeUndefined();      // unpaired
    expect(review[0].hiRanges).toEqual([[0, 3]]);
  });

  it('handles ctx lines between blocks', () => {
    const base = [mkLine('del', 'old'), mkLine('ctx', 'same'), mkLine('del', 'old2')];
    const review = [mkLine('add', 'new'), mkLine('ctx', 'same'), mkLine('add', 'new2')];
    injectWordDiffRanges(base, review);
    expect(base[0].hiRanges).toEqual([[0, 3]]);
    expect(base[2].hiRanges).toEqual([[0, 4]]);
    expect(review[0].hiRanges).toEqual([[0, 3]]);
    expect(review[2].hiRanges).toEqual([[0, 4]]);
  });

  it('does nothing for identical lines', () => {
    const base = [mkLine('del', 'same thing')];
    const review = [mkLine('add', 'same thing')];
    injectWordDiffRanges(base, review);
    expect(base[0].hiRanges).toBeUndefined();
    expect(review[0].hiRanges).toBeUndefined();
  });
});
