// ── Review persistence hook (v2: line-level flags + comments) ──

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReviewStore } from '../../core/review/review-store.js';
import type { ReviewData, Flag, ScoringOverride } from '../../core/types.js';
import type { ScanResult } from '../../core/engine.js';
import type { LineFlag, LineComment } from '../types.js';

const VALID_LINE_FLAGS = new Set<string>(['ok', 'bug', 'question']);

export interface LineReview {
  flag: LineFlag;
  comments: LineComment[];
}

export interface UseReviewResult {
  lineReviews: Map<string, LineReview>;
  setLineFlag: (lineKey: string, flag: LineFlag | undefined) => void;
  setLineFlagBatch: (entries: Array<[string, LineFlag | undefined]>) => void;
  addLineComment: (lineKey: string, text: string) => void;
  stale: boolean;
  scoringOverride: ScoringOverride | null;
  resetReview: (scope: 'review' | 'ai' | 'all') => void;
}

export function useReview(rootDir: string, data: ScanResult): UseReviewResult {
  const storeRef = useRef(new ReviewStore(rootDir));
  const [lineReviews, setLineReviews] = useState<Map<string, LineReview>>(new Map());
  const [stale, setStale] = useState(false);
  const [scoringOverride, setScoringOverride] = useState<ScoringOverride | null>(null);
  const loadedRef = useRef(false);

  // Load on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      const merged = new Map<string, LineReview>();
      for (const repo of data.repos) {
        const review = await storeRef.current.load(repo.name, repo.branch);
        if (!review) continue;

        // Staleness detection: compare stored headSha with current
        if (review.headSha && review.headSha !== repo.headSha) {
          setStale(true);
        }

        // Load scoring override from first repo that has one
        if (review.scoringOverride && !scoringOverride) {
          setScoringOverride(review.scoringOverride);
        }

        for (const [filePath, fileReview] of Object.entries(review.files)) {
          const file = repo.files.find(f => f.path === filePath);
          if (!file) continue;

          // Load new line-level format
          if (fileReview.lines) {
            for (const [lineId, lr] of Object.entries(fileReview.lines)) {
              if (lr.flag && VALID_LINE_FLAGS.has(lr.flag)) {
                merged.set(`${file.id}:${lineId}`, {
                  flag: lr.flag as LineFlag,
                  comments: lr.comments ?? [],
                });
              }
            }
          }

          // Fallback: old method-level format
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
      if (merged.size > 0) setLineReviews(merged);
    })().catch(err => {
      process.stderr.write(`[REVU] Failed to load reviews: ${err}\n`);
    });
  }, [data]);

  // Debounced save
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback((reviews: Map<string, LineReview>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveReviews(storeRef.current, data, reviews), 500);
  }, [data]);

  const setLineFlag = useCallback((lineKey: string, flag: LineFlag | undefined) => {
    setLineReviews(prev => {
      const next = new Map(prev);
      const existing = next.get(lineKey);
      if (existing && existing.flag === flag) {
        next.delete(lineKey);
      } else if (flag) {
        next.set(lineKey, { flag, comments: existing?.comments ?? [] });
      } else {
        next.delete(lineKey);
      }
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setLineFlagBatch = useCallback((entries: Array<[string, LineFlag | undefined]>) => {
    if (entries.length === 0) return;
    setLineReviews(prev => {
      const next = new Map(prev);
      for (const [lineKey, flag] of entries) {
        const existing = next.get(lineKey);
        if (flag) {
          next.set(lineKey, { flag, comments: existing?.comments ?? [] });
        } else {
          next.delete(lineKey);
        }
      }
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const addLineComment = useCallback((lineKey: string, text: string) => {
    setLineReviews(prev => {
      const next = new Map(prev);
      const existing = next.get(lineKey);
      const comment: LineComment = { text, time: new Date().toISOString() };
      next.set(lineKey, {
        flag: existing?.flag ?? 'ok',
        comments: [...(existing?.comments ?? []), comment],
      });
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const resetReview = useCallback((scope: 'review' | 'ai' | 'all') => {
    if (scope === 'review' || scope === 'all') {
      setLineReviews(new Map());
    }
    if (scope === 'ai' || scope === 'all') {
      setScoringOverride(null);
    }
    // Persist the reset
    (async () => {
      for (const repo of data.repos) {
        const existing = await storeRef.current.load(repo.name, repo.branch);
        const now = new Date().toISOString();
        if (scope === 'all') {
          const review: ReviewData = {
            version: 3, repo: repo.name, branch: repo.branch,
            baseBranch: repo.baseBranch, headSha: repo.headSha,
            createdAt: existing?.createdAt ?? now, updatedAt: now,
            files: {},
          };
          await storeRef.current.save(repo.name, repo.branch, review);
        } else if (scope === 'review') {
          const review: ReviewData = {
            version: 3, repo: repo.name, branch: repo.branch,
            baseBranch: repo.baseBranch, headSha: repo.headSha,
            createdAt: existing?.createdAt ?? now, updatedAt: now,
            files: {},
          };
          if (existing?.scoringOverride) review.scoringOverride = existing.scoringOverride;
          await storeRef.current.save(repo.name, repo.branch, review);
        } else if (scope === 'ai') {
          if (existing) {
            delete existing.scoringOverride;
            existing.headSha = repo.headSha;
            existing.updatedAt = now;
            await storeRef.current.save(repo.name, repo.branch, existing);
          }
        }
      }
      // Only clear stale when resetting review data or all (not just AI)
      if (scope === 'review' || scope === 'all') setStale(false);
    })().catch(err => {
      process.stderr.write(`[REVU] Reset failed: ${err}\n`);
    });
  }, [data]);

  return { lineReviews, setLineFlag, setLineFlagBatch, addLineComment, stale, scoringOverride, resetReview };
}

async function saveReviews(
  store: ReviewStore, data: ScanResult, reviews: Map<string, LineReview>,
): Promise<void> {
  for (const repo of data.repos) {
    // Load existing to preserve createdAt and scoringOverride
    const existing = await store.load(repo.name, repo.branch).catch(() => null);
    const now = new Date().toISOString();

    const review: ReviewData = {
      version: 4,
      repo: repo.name,
      branch: repo.branch,
      baseBranch: repo.baseBranch,
      headSha: repo.headSha,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      files: {},
    };

    // Preserve scoringOverride from existing review
    if (existing?.scoringOverride) {
      review.scoringOverride = existing.scoringOverride;
    }

    // Persist current scoringContext from scan
    if (data.scoringContext) {
      review.scoringContext = data.scoringContext;
    }

    let hasData = false;
    for (const file of repo.files) {
      const methods: Record<string, { flag?: Flag; comments: []; actions: [] }> = {};
      const lines: Record<string, { flag?: Flag; comments: Array<{ text: string; time: string }> }> = {};

      for (const [key, lr] of reviews) {
        if (!key.startsWith(`${file.id}:`)) continue;
        const rest = key.slice(file.id.length + 1);

        if (rest.startsWith('m:')) {
          methods[rest.slice(2)] = { flag: lr.flag, comments: [], actions: [] };
        } else {
          lines[rest] = { flag: lr.flag, comments: lr.comments };
        }
        hasData = true;
      }

      if (Object.keys(lines).length > 0 || Object.keys(methods).length > 0) {
        review.files[file.path] = { methods, lines };
      }
    }

    if (hasData || review.scoringContext) {
      await store.save(repo.name, repo.branch, review).catch(err => {
        process.stderr.write(`[REVU] Save failed: ${err}\n`);
      });
    }
  }
}
