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
  setCollapsed: (fn: (v: Set<string>) => Set<string>) => void;
  setInputMode: (v: InputMode | null) => void;
  setSearchQuery: (v: string | null) => void;
  onExport?: () => void;
  onToggleDiffMode?: () => void;
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
}

function handleTreePanel(
  input: string, key: Key,
  state: NavState, setters: NavSetters, context: NavContext,
): boolean {
  const { treeIdx, collapsed } = state;
  const { setTreeIdx, setSelectedFile, setDiffScroll, setDiffCursor, setPanel, setCollapsed } = setters;
  const { flatTree, diffs } = context;

  if (key.upArrow) { setTreeIdx(i => Math.max(0, i - 1)); return true; }
  if (key.downArrow) { setTreeIdx(i => Math.min(flatTree.length - 1, i + 1)); return true; }

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
    }
    return true;
  }

  if (input === 'c' && !item.isFolder && item.node.id) {
    const fileDiff = diffs.get(item.node.id);
    if (fileDiff) {
      const { lineReviews } = context;
      for (const row of fileDiff.rows) {
        if (row.type === 'diffRow' && row.reviewLine) {
          const lineKey = `${item.node.id}:${row.reviewLine.n}`;
          if (lineReviews.get(lineKey)?.flag !== 'ok') {
            setters.setLineFlag(lineKey, 'ok');
          }
        }
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

  if (key.upArrow) { setCtxIdx(i => Math.max(0, i - 1)); return true; }
  if (key.downArrow) { setCtxIdx(i => Math.min(Math.max(0, totalItems - 1), i + 1)); return true; }

  if (key.return) {
    const navigateToFile = (fileId: string, hunkMethod?: string) => {
      if (state.selectedFile) setters.historyPush?.({ fileId: state.selectedFile, cursor: state.diffCursor });
      setSelectedFile(fileId);
      let hunkIdx = 0;
      if (hunkMethod) {
        const fileDiff = diffs.get(fileId);
        if (fileDiff) {
          for (let j = 0; j < fileDiff.rows.length; j++) {
            if (fileDiff.rows[j].type === 'hunkHeader' && fileDiff.rows[j].method === hunkMethod) {
              hunkIdx = j;
              break;
            }
          }
        }
      }
      setDiffCursor(() => hunkIdx);
      setDiffScroll(() => hunkIdx);
      setPanel(() => 1);
    };

    if (ctxIdx < filtered.length) {
      // CHANGES section
      const chunk = filtered[ctxIdx];
      if (chunk?.fileId && diffs.has(chunk.fileId)) navigateToFile(chunk.fileId, chunk.method);
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
