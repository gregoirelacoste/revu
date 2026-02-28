// ── Review persistence hook ──

import { useState, useEffect, useRef, useCallback } from 'react';
import { ReviewStore } from '../../core/review/review-store.js';
import type { ReviewData } from '../../core/types.js';
import type { ScanResult } from '../../core/engine.js';

interface UseReviewResult {
  checkedLines: Set<string>;
  setCheckedLines: (fn: (v: Set<string>) => Set<string>) => void;
}

export function useReview(rootDir: string, data: ScanResult): UseReviewResult {
  const storeRef = useRef(new ReviewStore(rootDir));
  const [checkedLines, setCheckedLinesRaw] = useState<Set<string>>(new Set());
  const loadedRef = useRef(false);

  // Load on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      const merged = new Set<string>();
      for (const repo of data.repos) {
        const review = await storeRef.current.load(repo.name, repo.branch);
        if (!review) continue;
        for (const [filePath, fileReview] of Object.entries(review.files)) {
          // Find matching file ID
          const file = repo.files.find(f => f.path === filePath);
          if (!file) continue;
          for (const [methodName, methodReview] of Object.entries(fileReview.methods)) {
            if (methodReview.flag === 'ok') {
              merged.add(`${file.id}:${methodName}`);
            }
          }
        }
      }
      if (merged.size > 0) setCheckedLinesRaw(merged);
    })();
  }, [data]);

  // Save on change (debounced)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCheckedLines = useCallback((fn: (v: Set<string>) => Set<string>) => {
    setCheckedLinesRaw(prev => {
      const next = fn(prev);
      // Debounce save
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => saveReviews(storeRef.current, data, next), 500);
      return next;
    });
  }, [data]);

  return { checkedLines, setCheckedLines };
}

async function saveReviews(
  store: ReviewStore, data: ScanResult, checked: Set<string>,
): Promise<void> {
  for (const repo of data.repos) {
    const review: ReviewData = {
      version: 2,
      repo: repo.name,
      branch: repo.branch,
      baseBranch: 'develop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      files: {},
    };

    let hasData = false;
    for (const file of repo.files) {
      const methods: Record<string, { flag?: 'ok'; comments: never[]; actions: never[] }> = {};
      for (const key of checked) {
        if (!key.startsWith(`${file.id}:`)) continue;
        const methodOrLine = key.slice(file.id.length + 1);
        methods[methodOrLine] = { flag: 'ok', comments: [], actions: [] };
        hasData = true;
      }
      if (Object.keys(methods).length > 0) {
        review.files[file.path] = { methods };
      }
    }

    if (hasData) {
      await store.save(repo.name, repo.branch, review).catch(() => {});
    }
  }
}
