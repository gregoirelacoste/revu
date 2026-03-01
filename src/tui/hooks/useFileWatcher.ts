import { useState, useEffect, useRef, useCallback } from 'react';
import { watch, type FSWatcher } from 'node:fs';
import type { ScanResult } from '../../core/engine.js';

interface UseFileWatcherOptions {
  repoPaths: string[];
  rescan: () => Promise<ScanResult>;
  onNewData: (data: ScanResult) => void;
}

const DEBOUNCE_MS = 500;
const SOURCE_RE = /\.(ts|tsx|html|scss|css)$/;
const IGNORE_RE = /(?:^|\/)(?:\.git|node_modules|\.revu|dist|\.next)\//;

export function useFileWatcher({ repoPaths, rescan, onNewData }: UseFileWatcherOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const scanningRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doRescan = useCallback(async () => {
    if (scanningRef.current) {
      pendingRef.current = true;
      return;
    }
    scanningRef.current = true;
    setIsScanning(true);
    try {
      const result = await rescan();
      onNewData(result);
    } catch {
      // Rescan failed — silently continue, watcher stays active
    } finally {
      scanningRef.current = false;
      setIsScanning(false);
      if (pendingRef.current) {
        pendingRef.current = false;
        doRescan();
      }
    }
  }, [rescan, onNewData]);

  const scheduleRescan = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      doRescan();
    }, DEBOUNCE_MS);
  }, [doRescan]);

  useEffect(() => {
    if (repoPaths.length === 0) return;

    const watchers: FSWatcher[] = [];

    for (const repoPath of repoPaths) {
      try {
        const watcher = watch(repoPath, { recursive: true }, (_event, filename) => {
          if (!filename) return;
          if (IGNORE_RE.test(filename)) return;
          if (!SOURCE_RE.test(filename)) return;
          scheduleRescan();
        });
        watchers.push(watcher);
      } catch {
        // fs.watch recursive not supported — continue without watcher for this repo
      }
    }

    return () => {
      for (const w of watchers) w.close();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [repoPaths, scheduleRescan]);

  const triggerRescan = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doRescan();
  }, [doRescan]);

  return { isScanning, triggerRescan };
}
