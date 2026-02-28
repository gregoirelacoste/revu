// ── Extracted review progress memos ──

import { useMemo } from 'react';
import { allMethods } from '../../core/analyzer/side-effects.js';
import { computeFileReviewStats, computeGlobalReviewStats } from '../review-stats.js';
import type { ScanResult } from '../../core/engine.js';
import type { TuiFileDiff, ReviewStats } from '../types.js';
import type { LineReview } from './useReview.js';

export function useReviewProgress(
  data: ScanResult,
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
) {
  const fileProgress = useMemo(() => {
    const map = new Map<string, 'none' | 'partial' | 'complete'>();
    for (const [fileId, diff] of diffs) {
      const s = computeFileReviewStats(fileId, diff, lineReviews);
      if (s.total === 0) map.set(fileId, 'none');
      else if (s.reviewed >= s.total) map.set(fileId, 'complete');
      else if (s.reviewed > 0) map.set(fileId, 'partial');
      else map.set(fileId, 'none');
    }
    return map;
  }, [diffs, lineReviews]);

  const globalStats: ReviewStats = useMemo(
    () => computeGlobalReviewStats(diffs, lineReviews),
    [diffs, lineReviews],
  );

  const sideEffectCount = useMemo(() => {
    let count = 0;
    for (const repo of data.repos) {
      for (const file of repo.files) {
        if (allMethods(file).some(m => m.impacted)) count++;
      }
    }
    return count;
  }, [data]);

  return { fileProgress, globalStats, sideEffectCount };
}
