// ── Comment/flag collector for Comments overlay ──

import type { TuiFileDiff, LineFlag, LineComment } from './types.js';
import type { LineReview } from './hooks/useReview.js';

export interface CommentEntry {
  fileId: string;
  fileName: string;
  fileCrit: number;
  method: string;
  flag: LineFlag;
  comments: string[];
  diffRowIdx: number;       // first flagged row → jump target
}

export interface CommentListData {
  entries: CommentEntry[];
  totalBugs: number;
  totalQuestions: number;
  totalComments: number;
}

const FLAG_ORDER: Record<string, number> = { bug: 0, question: 1, ok: 2 };

/** Highest-priority flag wins when merging lines into one method entry */
function mergeFlags(a: LineFlag, b: LineFlag): LineFlag {
  return (FLAG_ORDER[a] ?? 3) <= (FLAG_ORDER[b] ?? 3) ? a : b;
}

export function collectAllComments(
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): CommentListData {
  let totalBugs = 0, totalQuestions = 0, totalComments = 0;

  // Group by fileId::method → one entry per method
  const map = new Map<string, CommentEntry>();

  for (const [fileId, diff] of diffs) {
    for (let rowIdx = 0; rowIdx < diff.rows.length; rowIdx++) {
      const row = diff.rows[rowIdx];
      if (row.type !== 'diffRow' || !row.reviewLine) continue;

      const key = `${fileId}:${row.reviewLine.n}`;
      const lr = lineReviews.get(key);
      if (!lr) continue;

      // Only keep bugs, questions, or lines with text comments
      const hasBugOrQuestion = lr.flag === 'bug' || lr.flag === 'question';
      const hasComments = lr.comments.length > 0;
      if (!hasBugOrQuestion && !hasComments) continue;

      if (lr.flag === 'bug') totalBugs++;
      if (lr.flag === 'question') totalQuestions++;
      totalComments += lr.comments.length;

      const groupKey = `${fileId}::${row.method}`;
      const existing = map.get(groupKey);
      if (existing) {
        existing.flag = mergeFlags(existing.flag, lr.flag);
        for (const c of lr.comments) existing.comments.push(c.text);
      } else {
        map.set(groupKey, {
          fileId,
          fileName: diff.name,
          fileCrit: diff.crit,
          method: row.method,
          flag: lr.flag,
          comments: lr.comments.map(c => c.text),
          diffRowIdx: rowIdx,
        });
      }
    }
  }

  const entries = [...map.values()];
  entries.sort((a, b) => {
    const fa = FLAG_ORDER[a.flag] ?? 3;
    const fb = FLAG_ORDER[b.flag] ?? 3;
    if (fa !== fb) return fa - fb;
    return b.fileCrit - a.fileCrit;
  });

  return { entries, totalBugs, totalQuestions, totalComments };
}
