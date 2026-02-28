// ── Shared review statistics computation ──

import type { TuiFileDiff, ReviewStats } from './types.js';
import type { LineReview } from './hooks/useReview.js';

export function computeFileReviewStats(
  fileId: string, diff: TuiFileDiff, lineReviews: Map<string, LineReview>,
): ReviewStats {
  let total = 0, reviewed = 0, bugs = 0, questions = 0, comments = 0;
  for (const row of diff.rows) {
    if (row.type !== 'diffRow') continue;
    if (!row.reviewLine || (row.reviewLine.t !== 'add' && row.reviewLine.t !== 'del')) continue;
    total++;
    const lr = lineReviews.get(`${fileId}:${row.reviewLine.n}`);
    if (!lr) continue;
    reviewed++;
    if (lr.flag === 'bug') bugs++;
    if (lr.flag === 'question') questions++;
    comments += lr.comments.length;
  }
  return { total, reviewed, bugs, questions, comments };
}

export function computeGlobalReviewStats(
  diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): ReviewStats {
  let total = 0, reviewed = 0, bugs = 0, questions = 0, comments = 0;
  for (const [fileId, diff] of diffs) {
    const s = computeFileReviewStats(fileId, diff, lineReviews);
    total += s.total;
    reviewed += s.reviewed;
    bugs += s.bugs;
    questions += s.questions;
    comments += s.comments;
  }
  return { total, reviewed, bugs, questions, comments };
}
