// ── Keyboard navigation hook ──

import { useInput, useApp, type Key } from 'ink';
import type { FlatItem, DiffRow, TuiFileDiff, ContextData, LineFlag } from '../types.js';
import type { LineReview } from './useReview.js';
import type { InputMode } from './useInputMode.js';
import type { NavPos } from './useNavHistory.js';

interface NavState {
  panel: number;
  treeIdx: number;
  selectedFile: string | null;
  diffScroll: number;
  diffCursor: number;
  ctxIdx: number;
  minCrit: number;
  collapsed: Set<string>;
  inputMode: InputMode | null;
  searchQuery: string | null;
  showHelp: boolean;
  showTutorial: boolean;
  tutorialPage: number;
  resetPrompt: boolean;
  showMap: boolean;
  mapIdx: number;
}

interface NavSetters {
  setPanel: (fn: (v: number) => number) => void;
  setTreeIdx: (fn: (v: number) => number) => void;
  setSelectedFile: (v: string | null) => void;
  setDiffScroll: (fn: (v: number) => number) => void;
  setDiffCursor: (fn: (v: number) => number) => void;
  setCtxIdx: (fn: (v: number) => number) => void;
  setMinCrit: (fn: (v: number) => number) => void;
  setLineFlag: (lineKey: string, flag: LineFlag | undefined) => void;
  setLineFlagBatch: (entries: Array<[string, LineFlag | undefined]>) => void;
  setBatchMsg: (msg: string | null) => void;
  setCollapsed: (fn: (v: Set<string>) => Set<string>) => void;
  setInputMode: (v: InputMode | null) => void;
  setSearchQuery: (v: string | null) => void;
  setShowHelp: (fn: (v: boolean) => boolean) => void;
  setShowTutorial: (fn: (v: boolean) => boolean) => void;
  setTutorialPage: (fn: (v: number) => number) => void;
  tutorialPageCount: number;
  setShowMap: (fn: (v: boolean) => boolean) => void;
  setMapIdx: (fn: (v: number) => number) => void;
  onRescan?: () => void;
  onExport?: () => void;
  onToggleDiffMode?: () => void;
  onToggleAIScoring?: () => void;
  onResetReview?: (scope: 'review' | 'ai' | 'all') => void;
  setResetPrompt: (v: boolean) => void;
  historyPush?: (pos: NavPos) => void;
  historyGoBack?: (current: NavPos) => NavPos | null;
  historyGoForward?: (current: NavPos) => NavPos | null;
}

interface NavContext {
  flatTree: FlatItem[];
  diffRows: DiffRow[];
  diffs: Map<string, TuiFileDiff>;
  ctx: ContextData | null;
  bodyH: number;
  lineReviews: Map<string, LineReview>;
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>;
  mapFileIds: string[];
}

// ── Batch flag helpers ──

function getHunkLines(rows: DiffRow[], hunkIdx: number, fileId: string): string[] {
  const keys: string[] = [];
  for (let j = hunkIdx + 1; j < rows.length; j++) {
    if (rows[j].type !== 'diffRow') break;
    if (rows[j].reviewLine) keys.push(`${fileId}:${rows[j].reviewLine!.n}`);
  }
  return keys;
}

function getAllFileLines(diffs: Map<string, TuiFileDiff>, fileId: string): string[] {
  const diff = diffs.get(fileId);
  if (!diff) return [];
  const keys: string[] = [];
  for (const row of diff.rows) {
    if (row.type === 'diffRow' && row.reviewLine) keys.push(`${fileId}:${row.reviewLine.n}`);
  }
  return keys;
}

function batchFlagSafe(
  keys: string[],
  flag: LineFlag,
  lineReviews: Map<string, LineReview>,
  setLineFlagBatch: (entries: Array<[string, LineFlag | undefined]>) => void,
): number {
  if (keys.length === 0) return 0;
  const withNoFlag = keys.filter(k => !lineReviews.get(k)?.flag);
  const withThisFlag = keys.filter(k => lineReviews.get(k)?.flag === flag);

  if (withNoFlag.length > 0) {
    setLineFlagBatch(withNoFlag.map(k => [k, flag]));
    return withNoFlag.length;
  }
  if (withThisFlag.length > 0) {
    setLineFlagBatch(withThisFlag.map(k => [k, undefined]));
    return -withThisFlag.length;
  }
  return 0;
}

function emitBatchMsg(count: number, flag: LineFlag, scope: string, setBatchMsg: (msg: string | null) => void): void {
  if (count > 0) {
    setBatchMsg(`${count} lines flagged ${flag} \u00B7 ${scope}`);
  } else if (count < 0) {
    setBatchMsg(`${-count} ${flag} flags removed \u00B7 ${scope}`);
  } else {
    setBatchMsg(`All lines already flagged \u00B7 ${scope}`);
  }
}

function handleTreePanel(
  input: string, key: Key,
  state: NavState, setters: NavSetters, context: NavContext,
): boolean {
  const { treeIdx, collapsed } = state;
  const { setTreeIdx, setSelectedFile, setDiffScroll, setDiffCursor, setPanel, setCollapsed } = setters;
  const { flatTree, diffs, bodyH } = context;

  if (flatTree.length === 0) return true;

  const treePageSize = Math.max(1, bodyH - 6);

  if (key.upArrow) { setTreeIdx(i => Math.max(0, i - 1)); return true; }
  if (key.downArrow) { setTreeIdx(i => Math.min(flatTree.length - 1, i + 1)); return true; }
  if (key.pageUp) { setTreeIdx(i => Math.max(0, i - treePageSize)); return true; }
  if (key.pageDown) { setTreeIdx(i => Math.min(flatTree.length - 1, i + treePageSize)); return true; }
  if (input === 'g') { setTreeIdx(() => 0); return true; }
  if (input === 'G') { setTreeIdx(() => flatTree.length - 1); return true; }

  const item = flatTree[treeIdx];
  if (!item) return true;

  if (key.leftArrow) {
    if (item.isFolder && !collapsed.has(item.id)) {
      setCollapsed(prev => new Set(prev).add(item.id));
    } else {
      for (let j = treeIdx - 1; j >= 0; j--) {
        if (flatTree[j].isFolder && flatTree[j].depth < item.depth) {
          setTreeIdx(() => j);
          break;
        }
      }
    }
    return true;
  }

  if (key.rightArrow) {
    if (item.isFolder) {
      if (collapsed.has(item.id)) {
        setCollapsed(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      }
    } else if (item.node.id && diffs.has(item.node.id)) {
      if (state.selectedFile) setters.historyPush?.({ fileId: state.selectedFile, cursor: state.diffCursor });
      setSelectedFile(item.node.id);
      setDiffScroll(() => 0);
      setDiffCursor(() => 0);
      setPanel(() => 1);
    }
    return true;
  }

  // Batch flag: c/x/? — safe (only flags lines without existing flag, toggle off if all same)
  if (input === 'c' || input === 'x' || input === '?') {
    const flag: LineFlag = input === 'c' ? 'ok' : input === 'x' ? 'bug' : 'question';
    let keys: string[];

    if (!item.isFolder && item.node.id) {
      keys = getAllFileLines(diffs, item.node.id);
    } else if (item.isFolder) {
      keys = [];
      for (let j = treeIdx + 1; j < flatTree.length; j++) {
        if (flatTree[j].depth <= item.depth) break;
        if (!flatTree[j].isFolder && flatTree[j].node.id) {
          keys.push(...getAllFileLines(diffs, flatTree[j].node.id!));
        }
      }
    } else {
      keys = [];
    }

    const count = batchFlagSafe(keys, flag, context.lineReviews, setters.setLineFlagBatch);
    emitBatchMsg(count, flag, item.node.name, setters.setBatchMsg);
    return true;
  }

  // Next unreviewed file
  if (input === 'n') {
    const { fileProgress } = context;
    for (let j = 1; j <= flatTree.length; j++) {
      const idx = (treeIdx + j) % flatTree.length;
      const fi = flatTree[idx];
      if (!fi.isFolder && fi.node.id && diffs.has(fi.node.id) && fileProgress.get(fi.node.id) !== 'complete') {
        setTreeIdx(() => idx);
        break;
      }
    }
    return true;
  }

  if (key.return) {
    if (item.isFolder) {
      setCollapsed(prev => {
        const n = new Set(prev);
        if (n.has(item.id)) n.delete(item.id); else n.add(item.id);
        return n;
      });
    } else if (item.node.id && diffs.has(item.node.id)) {
      if (state.selectedFile) setters.historyPush?.({ fileId: state.selectedFile, cursor: state.diffCursor });
      setSelectedFile(item.node.id);
      setDiffScroll(() => 0);
      setDiffCursor(() => 0);
      setPanel(() => 1);
    }
  }
  return true;
}

function handleDiffPanel(
  input: string, key: Key,
  state: NavState, setters: NavSetters, context: NavContext,
): boolean {
  const { diffCursor, selectedFile } = state;
  const { setDiffCursor, setDiffScroll, setLineFlag } = setters;
  const { diffRows, bodyH } = context;

  const maxIdx = Math.max(0, diffRows.length - 1);
  const visibleH = Math.max(1, bodyH - 3);

  const moveCursor = (nc: number) => {
    setDiffCursor(() => nc);
    setDiffScroll(s => {
      if (nc < s) return nc;
      if (nc >= s + visibleH) return nc - visibleH + 1;
      return s;
    });
  };

  if (key.upArrow) { moveCursor(Math.max(0, diffCursor - 1)); return true; }
  if (key.downArrow) { moveCursor(Math.min(maxIdx, diffCursor + 1)); return true; }
  if (key.pageUp) { moveCursor(Math.max(0, diffCursor - visibleH)); return true; }
  if (key.pageDown) { moveCursor(Math.min(maxIdx, diffCursor + visibleH)); return true; }
  if (input === 'g') { moveCursor(0); return true; }
  if (input === 'G') { moveCursor(maxIdx); return true; }

  if (input === '{') {
    for (let j = diffCursor - 1; j >= 0; j--) {
      if (diffRows[j].type === 'hunkHeader') { moveCursor(j); return true; }
    }
    return true;
  }
  if (input === '}') {
    for (let j = diffCursor + 1; j < diffRows.length; j++) {
      if (diffRows[j].type === 'hunkHeader') { moveCursor(j); return true; }
    }
    return true;
  }

  if (input === 's') { setters.onToggleDiffMode?.(); return true; }

  const curRow = diffRows[diffCursor];

  // Hunk-level flag: cursor on hunkHeader or hunkFooter
  if ((curRow?.type === 'hunkHeader' || curRow?.type === 'hunkFooter') && selectedFile) {
    if (input === 'c' || input === 'x' || input === '?') {
      const flag: LineFlag = input === 'c' ? 'ok' : input === 'x' ? 'bug' : 'question';
      let headerIdx = diffCursor;
      if (curRow.type === 'hunkFooter') {
        for (let j = diffCursor - 1; j >= 0; j--) {
          if (diffRows[j].type === 'hunkHeader') { headerIdx = j; break; }
        }
      }
      const keys = getHunkLines(diffRows, headerIdx, selectedFile);
      const count = batchFlagSafe(keys, flag, context.lineReviews, setters.setLineFlagBatch);
      emitBatchMsg(count, flag, curRow.method, setters.setBatchMsg);
      return true;
    }
  }

  // Line-level flag
  if (curRow?.type === 'diffRow' && curRow.reviewLine && selectedFile) {
    const lineKey = `${selectedFile}:${curRow.reviewLine.n}`;
    if (input === 'c') { setLineFlag(lineKey, 'ok'); return true; }
    if (input === 'x') { setLineFlag(lineKey, 'bug'); return true; }
    if (input === '?') { setLineFlag(lineKey, 'question'); return true; }
    if (input === 'n') { setters.setInputMode({ lineKey, draft: '' }); return true; }
  }
  return true;
}

function handleContextPanel(
  input: string, key: Key,
  state: NavState, setters: NavSetters, context: NavContext,
): boolean {
  const { ctxIdx, minCrit } = state;
  const { setCtxIdx, setSelectedFile, setDiffCursor, setDiffScroll, setPanel } = setters;
  const { diffs, ctx } = context;

  if (!ctx) return true;
  const filtered = ctx.chunks.filter(c => c.crit >= minCrit);
  const allImports = ctx.imports ?? [];
  const navUsedBy = (ctx.usedBy ?? []).filter(u => u.fileId && diffs.has(u.fileId!));
  const totalItems = filtered.length + allImports.length + navUsedBy.length;

  if (key.upArrow || key.downArrow) {
    const newIdx = key.upArrow
      ? Math.max(0, ctxIdx - 1)
      : Math.min(Math.max(0, totalItems - 1), ctxIdx + 1);
    setCtxIdx(() => newIdx);
    // Auto-scroll diff to follow context selection
    if (newIdx < filtered.length && state.selectedFile) {
      const chunk = filtered[newIdx];
      if (chunk?.fileId === state.selectedFile) {
        const targetIdx = context.diffRows.findIndex(
          r => r.type === 'hunkHeader' && r.method === chunk.method,
        );
        if (targetIdx >= 0) {
          setDiffCursor(() => targetIdx);
          setDiffScroll(() => targetIdx);
        }
      }
    }
    return true;
  }

  // Flag method from CHANGES section
  if (input === 'c' || input === 'x' || input === '?') {
    if (ctxIdx < filtered.length) {
      const chunk = filtered[ctxIdx];
      if (chunk?.fileId && chunk.hunkIndex !== undefined) {
        const fileDiff = diffs.get(chunk.fileId);
        if (fileDiff) {
          const flag: LineFlag = input === 'c' ? 'ok' : input === 'x' ? 'bug' : 'question';
          const keys = getHunkLines(fileDiff.rows, chunk.hunkIndex, chunk.fileId);
          const count = batchFlagSafe(keys, flag, context.lineReviews, setters.setLineFlagBatch);
          emitBatchMsg(count, flag, chunk.method, setters.setBatchMsg);
        }
      }
    }
    return true;
  }

  if (key.return) {
    const navigateToFile = (fileId: string, hunkIdx?: number) => {
      if (state.selectedFile) setters.historyPush?.({ fileId: state.selectedFile, cursor: state.diffCursor });
      setSelectedFile(fileId);
      const cursor = hunkIdx ?? 0;
      setDiffCursor(() => cursor);
      setDiffScroll(() => cursor);
      setPanel(() => 1);
    };

    if (ctxIdx < filtered.length) {
      // CHANGES section
      const chunk = filtered[ctxIdx];
      if (chunk?.fileId && diffs.has(chunk.fileId)) navigateToFile(chunk.fileId, chunk.hunkIndex);
    } else if (ctxIdx < filtered.length + allImports.length) {
      // IMPORTS section
      const imp = allImports[ctxIdx - filtered.length];
      if (imp?.fileId && diffs.has(imp.fileId)) navigateToFile(imp.fileId);
    } else {
      // USED BY section
      const ub = navUsedBy[ctxIdx - filtered.length - allImports.length];
      if (ub?.fileId && diffs.has(ub.fileId)) navigateToFile(ub.fileId);
    }
  }
  return true;
}

export function useNavigation(
  state: NavState,
  setters: NavSetters,
  context: NavContext,
) {
  const { exit } = useApp();
  const { panel } = state;
  const { setPanel, setMinCrit } = setters;

  useInput((input, key) => {
    try {
      if (state.inputMode) return;

      // Help overlay: 'h' toggles, Escape/q closes
      if (state.showHelp) {
        if (input === 'h' || key.escape || input === 'q') setters.setShowHelp(() => false);
        return;
      }
      if (input === 'h') { setters.setShowHelp(v => !v); return; }

      // Tutorial overlay: 't' toggles, ←/→ navigate pages, Escape closes
      if (state.showTutorial) {
        if (input === 't' || key.escape || input === 'q') { setters.setShowTutorial(() => false); return; }
        if (key.leftArrow) { setters.setTutorialPage(p => Math.max(0, p - 1)); return; }
        if (key.rightArrow) { setters.setTutorialPage(p => Math.min(setters.tutorialPageCount - 1, p + 1)); return; }
        return;
      }
      if (input === 't') { setters.setShowTutorial(v => !v); setters.setTutorialPage(() => 0); return; }

      // Review Map overlay
      if (state.showMap) {
        if (input === 'm' || key.escape) { setters.setShowMap(() => false); return; }
        if (key.upArrow) { setters.setMapIdx(i => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setters.setMapIdx(i => Math.min(context.mapFileIds.length - 1, i + 1)); return; }
        if (input === 'n') {
          const { mapFileIds, fileProgress } = context;
          let found = -1;
          for (let j = 1; j <= mapFileIds.length; j++) {
            const idx = (state.mapIdx + j) % mapFileIds.length;
            if (fileProgress.get(mapFileIds[idx]) !== 'complete') { found = idx; break; }
          }
          if (found >= 0) setters.setMapIdx(() => found);
          return;
        }
        if (key.return) {
          const fileId = context.mapFileIds[state.mapIdx];
          if (fileId) {
            setters.setShowMap(() => false);
            if (state.selectedFile) setters.historyPush?.({ fileId: state.selectedFile, cursor: state.diffCursor });
            setters.setSelectedFile(fileId);
            setters.setDiffScroll(() => 0);
            setters.setDiffCursor(() => 0);
            setters.setPanel(() => 1);
          }
          return;
        }
        return;
      }

      // Reset prompt: r=review, a=ai, A=all, Esc=cancel
      if (state.resetPrompt) {
        if (input === 'r') { setters.onResetReview?.('review'); setters.setBatchMsg('Review flags reset'); setTimeout(() => setters.setBatchMsg(null), 3000); }
        else if (input === 'a') { setters.onResetReview?.('ai'); setters.setBatchMsg('AI scoring reset'); setTimeout(() => setters.setBatchMsg(null), 3000); }
        else if (input === 'A') { setters.onResetReview?.('all'); setters.setBatchMsg('Full review reset'); setTimeout(() => setters.setBatchMsg(null), 3000); }
        else { setters.setBatchMsg(null); } // Esc or any other key: cancel and clear prompt
        setters.setResetPrompt(false);
        return;
      }

      // Search mode: capture all input
      if (state.searchQuery !== null) {
        // Tab closes search and falls through to panel switch below
        if (key.tab) { setters.setSearchQuery(null); }
        else if (key.escape) { setters.setSearchQuery(null); return; }
        else if (key.return) {
          const item = context.flatTree[state.treeIdx];
          if (item && !item.isFolder && item.node.id && context.diffs.has(item.node.id)) {
            setters.setSelectedFile(item.node.id);
            setters.setDiffScroll(() => 0);
            setters.setDiffCursor(() => 0);
            setters.setPanel(() => 1);
          }
          setters.setSearchQuery(null);
          return;
        } else if (key.backspace || key.delete) {
          setters.setSearchQuery(state.searchQuery.slice(0, -1) || '');
          setters.setTreeIdx(() => 0);
          return;
        } else if (key.upArrow) { setters.setTreeIdx(i => Math.max(0, i - 1)); return; }
        else if (key.downArrow) { setters.setTreeIdx(i => Math.min(context.flatTree.length - 1, i + 1)); return; }
        else if (input && !key.ctrl && !key.meta && input.length === 1 && input >= ' ') {
          setters.setSearchQuery(state.searchQuery + input);
          setters.setTreeIdx(() => 0);
          return;
        } else { return; }
      }

      if (input === 'm') { setters.setShowMap(() => true); setters.setMapIdx(() => 0); return; }
      if (input === 'r') { setters.onRescan?.(); return; }
      if (input === 'q') { exit(); return; }
      if (key.tab && key.shift) {
        if (panel === 0) {
          const item = context.flatTree[state.treeIdx];
          if (item && !item.isFolder && item.node.id && context.diffs.has(item.node.id))
            setters.setSelectedFile(item.node.id);
        }
        setPanel(p => (p + 2) % 3); return;
      }
      if (key.tab) {
        if (panel === 0) {
          const item = context.flatTree[state.treeIdx];
          if (item && !item.isFolder && item.node.id && context.diffs.has(item.node.id))
            setters.setSelectedFile(item.node.id);
        }
        setPanel(p => (p + 1) % 3); return;
      }
      if (input === '[') { setMinCrit(v => Math.max(0, v - 0.5)); return; }
      if (input === ']') { setMinCrit(v => Math.min(9, v + 0.5)); return; }
      if (key.meta && input === 'e') { setters.onExport?.(); return; }
      if (key.meta && input === 'a') { setters.onToggleAIScoring?.(); return; }
      if (key.meta && input === 'r') { setters.setResetPrompt(true); setters.setBatchMsg('Reset: [r]eview [a]i [A]ll [Esc]cancel'); return; }

      // Fuzzy search: /
      if (input === '/' && panel === 0) { setters.setSearchQuery(''); setters.setTreeIdx(() => 0); return; }

      // Navigation history: Alt+←/→
      if (key.meta && key.leftArrow && state.selectedFile) {
        const current = { fileId: state.selectedFile, cursor: state.diffCursor };
        const prev = setters.historyGoBack?.(current);
        if (prev) {
          setters.setSelectedFile(prev.fileId);
          setters.setDiffCursor(() => prev.cursor);
          setters.setDiffScroll(() => Math.max(0, prev.cursor - Math.floor(context.bodyH / 2)));
        }
        return;
      }
      if (key.meta && key.rightArrow && state.selectedFile) {
        const current = { fileId: state.selectedFile, cursor: state.diffCursor };
        const next = setters.historyGoForward?.(current);
        if (next) {
          setters.setSelectedFile(next.fileId);
          setters.setDiffCursor(() => next.cursor);
          setters.setDiffScroll(() => Math.max(0, next.cursor - Math.floor(context.bodyH / 2)));
        }
        return;
      }

      if (panel === 0) handleTreePanel(input, key, state, setters, context);
      else if (panel === 1) handleDiffPanel(input, key, state, setters, context);
      else if (panel === 2) handleContextPanel(input, key, state, setters, context);
    } catch (err) {
      process.stderr.write(`[REVU] useInput error: ${err}\n`);
    }
  });
}
