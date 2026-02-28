// ── Keyboard navigation hook ──

import { useInput, useApp, type Key } from 'ink';
import type { FlatItem, DiffRow, TuiFileDiff, ContextData, LineFlag } from '../types.js';
import type { InputMode } from './useInputMode.js';

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
  onExport?: () => void;
}

interface NavContext {
  flatTree: FlatItem[];
  diffRows: DiffRow[];
  diffs: Map<string, TuiFileDiff>;
  ctx: ContextData | null;
  bodyH: number;
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
      setSelectedFile(item.node.id);
      setDiffScroll(() => 0);
      setDiffCursor(() => 0);
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

  if (key.upArrow) { setCtxIdx(i => Math.max(0, i - 1)); return true; }
  if (key.downArrow) { setCtxIdx(i => Math.min(filtered.length - 1, i + 1)); return true; }

  if (key.return && filtered[ctxIdx]) {
    const chunk = filtered[ctxIdx];
    if (chunk.fileId && diffs.has(chunk.fileId)) {
      setSelectedFile(chunk.fileId);
      const fileDiff = diffs.get(chunk.fileId);
      let hunkIdx = 0;
      if (fileDiff) {
        for (let j = 0; j < fileDiff.rows.length; j++) {
          if (fileDiff.rows[j].type === 'hunkHeader' && fileDiff.rows[j].method === chunk.method) {
            hunkIdx = j;
            break;
          }
        }
      }
      setDiffCursor(() => hunkIdx);
      setDiffScroll(() => hunkIdx);
      setPanel(() => 1);
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
      if (input === 'q') { exit(); return; }
      if (key.tab && key.shift) { setPanel(p => (p + 2) % 3); return; }
      if (key.tab) { setPanel(p => (p + 1) % 3); return; }
      if (input === '[') { setMinCrit(v => Math.max(0, v - 0.5)); return; }
      if (input === ']') { setMinCrit(v => Math.min(9, v + 0.5)); return; }
      if (key.meta && input === 'e') { setters.onExport?.(); return; }

      if (panel === 0) handleTreePanel(input, key, state, setters, context);
      else if (panel === 1) handleDiffPanel(input, key, state, setters, context);
      else if (panel === 2) handleContextPanel(input, key, state, setters, context);
    } catch (err) {
      process.stderr.write(`[REVU] useInput error: ${err}\n`);
    }
  });
}
