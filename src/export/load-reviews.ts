// ── Load reviews from disk (pure async, no React) ──

import { ReviewStore } from '../core/review/review-store.js';
import type { ScanResult } from '../core/engine.js';
import type { LineReview } from '../tui/hooks/useReview.js';

const VALID_LINE_FLAGS = new Set(['ok', 'bug', 'question']);

export async function loadAllReviews(
  rootDir: string, data: ScanResult,
): Promise<Map<string, LineReview>> {
  const store = new ReviewStore(rootDir);
  const merged = new Map<string, LineReview>();

  for (const repo of data.repos) {
    const review = await store.load(repo.name, repo.branch);
    if (!review) continue;

    for (const [filePath, fileReview] of Object.entries(review.files)) {
      const file = repo.files.find(f => f.path === filePath);
      if (!file) continue;

      if (fileReview.lines) {
        for (const [lineId, lr] of Object.entries(fileReview.lines)) {
          if (lr.flag && VALID_LINE_FLAGS.has(lr.flag)) {
            merged.set(`${file.id}:${lineId}`, {
              flag: lr.flag as 'ok' | 'bug' | 'question',
              comments: lr.comments ?? [],
            });
          }
        }
      }

      for (const [methodName, methodReview] of Object.entries(fileReview.methods)) {
        if (methodReview.flag === 'ok') {
          const key = `${file.id}:m:${methodName}`;
          if (!merged.has(key)) {
            merged.set(key, { flag: 'ok', comments: [] });
          }
        }
      }
    }
  }

  return merged;
}
