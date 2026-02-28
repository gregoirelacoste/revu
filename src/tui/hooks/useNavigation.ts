// ── Keyboard navigation hook ──

import { useInput, useApp } from 'ink';
import type { FlatItem, DiffRow, TuiFileDiff, ContextData } from '../types.js';

interface NavState {
  panel: number;
  treeIdx: number;
  selectedFile: string | null;
  diffScroll: number;
  ctxIdx: number;
  minCrit: number;
  checkedLines: Set<string>;
  collapsed: Set<string>;
}

interface NavSetters {
  setPanel: (fn: (v: number) => number) => void;
  setTreeIdx: (fn: (v: number) => number) => void;
  setSelectedFile: (v: string) => void;
  setDiffScroll: (fn: (v: number) => number) => void;
  setCtxIdx: (fn: (v: number) => number) => void;
  setMinCrit: (fn: (v: number) => number) => void;
  setCheckedLines: (fn: (v: Set<string>) => Set<string>) => void;
  setCollapsed: (fn: (v: Set<string>) => Set<string>) => void;
}

interface NavContext {
  flatTree: FlatItem[];
  diffRows: DiffRow[];
  diffs: Map<string, TuiFileDiff>;
  ctx: ContextData | null;
  bodyH: number;
}

export function useNavigation(
  state: NavState,
  setters: NavSetters,
  context: NavContext,
) {
  const { exit } = useApp();
  const { panel, treeIdx, selectedFile, diffScroll, ctxIdx, minCrit, collapsed } = state;
  const {
    setPanel, setTreeIdx, setSelectedFile, setDiffScroll,
    setCtxIdx, setMinCrit, setCheckedLines, setCollapsed,
  } = setters;
  const { flatTree, diffRows, diffs, ctx, bodyH } = context;

  useInput((input, key) => {
    try {
      if (input === 'q') { exit(); return; }

      if (key.tab) {
        setPanel(p => (p + 1) % 3);
        return;
      }

      if (input === '[') { setMinCrit(v => Math.max(0, v - 0.5)); return; }
      if (input === ']') { setMinCrit(v => Math.min(9, v + 0.5)); return; }

      // Tree panel
      if (panel === 0) {
        if (key.upArrow) { setTreeIdx(i => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setTreeIdx(i => Math.min(flatTree.length - 1, i + 1)); return; }

        const item = flatTree[treeIdx];
        if (!item) return;

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
          return;
        }

        if (key.rightArrow) {
          if (item.isFolder) {
            if (collapsed.has(item.id)) {
              setCollapsed(prev => { const n = new Set(prev); n.delete(item.id); return n; });
            }
          } else if (item.node.id && diffs.has(item.node.id)) {
            setSelectedFile(item.node.id);
            setDiffScroll(() => 0);
          }
          return;
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
            setPanel(() => 1);
          }
        }
        return;
      }

      // Diff panel
      if (panel === 1) {
        if (key.upArrow) { setDiffScroll(s => Math.max(0, s - 1)); return; }
        if (key.downArrow) { setDiffScroll(s => Math.min(Math.max(0, diffRows.length - bodyH + 5), s + 1)); return; }
        if (key.pageDown) { setDiffScroll(s => Math.min(Math.max(0, diffRows.length - bodyH + 5), s + 10)); return; }
        if (key.pageUp) { setDiffScroll(s => Math.max(0, s - 10)); return; }
        if (input === 'c') {
          const row = diffRows[diffScroll];
          if (row?.type === 'diffRow' && row.reviewLine) {
            const lineKey = `${selectedFile}:${row.reviewLine.n}`;
            setCheckedLines(prev => {
              const next = new Set(prev);
              if (next.has(lineKey)) next.delete(lineKey); else next.add(lineKey);
              return next;
            });
          }
        }
        return;
      }

      // Context panel
      if (panel === 2 && ctx) {
        const filtered = ctx.chunks.filter(c => c.crit >= minCrit);
        if (key.upArrow) { setCtxIdx(i => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setCtxIdx(i => Math.min(filtered.length - 1, i + 1)); return; }
        if (key.return && filtered[ctxIdx]) {
          const chunk = filtered[ctxIdx];
          if (chunk.fileId && diffs.has(chunk.fileId)) {
            setSelectedFile(chunk.fileId);
            setDiffScroll(() => 0);
            setPanel(() => 1);
          }
        }
      }
    } catch (err) {
      process.stderr.write(`[REVU] useInput error: ${err}\n`);
    }
  });
}
