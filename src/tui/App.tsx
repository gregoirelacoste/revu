import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { C, critColor, FLAG_ICON, FLAG_COLOR } from './colors.js';
import { useTermSize } from './hooks/useTermSize.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useReview } from './hooks/useReview.js';
import { Border } from './components/Border.js';
import { TreeRow } from './components/TreeRow.js';
import { DLine } from './components/DLine.js';
import { ContextPanel } from './components/ContextPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { buildTree, flattenTree, buildFileDiffs } from './data.js';
import { getFileContext, getFolderContext, getRepoContext } from './context.js';
import { computeFileReviewStats, computeGlobalReviewStats } from './review-stats.js';
import type { ScanResult } from '../core/engine.js';
import type { ContextData } from './types.js';

interface AppProps {
  data: ScanResult;
  rootDir: string;
}

export function App({ data, rootDir }: AppProps) {
  const size = useTermSize();

  const tree = useMemo(() => buildTree(data), [data]);
  const diffs = useMemo(() => buildFileDiffs(data), [data]);

  // State
  const [panel, setPanel] = useState(0);
  const [treeIdx, setTreeIdx] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffScroll, setDiffScroll] = useState(0);
  const [ctxIdx, setCtxIdx] = useState(0);
  const [minCrit, setMinCrit] = useState(0);
  const [diffCursor, setDiffCursor] = useState(0);
  const { lineReviews, setLineFlag } = useReview(rootDir, data);

  // Recompute flat tree when collapsed changes
  const flatTree = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);

  // Clamp treeIdx when flatTree shrinks (folder collapsed)
  const safeIdx = Math.min(treeIdx, Math.max(0, flatTree.length - 1));
  useEffect(() => {
    if (safeIdx !== treeIdx) setTreeIdx(safeIdx);
  }, [safeIdx, treeIdx]);

  // Auto-select first file with diff (once)
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current || selectedFile !== null) return;
    for (let i = 0; i < flatTree.length; i++) {
      const item = flatTree[i];
      if (!item.isFolder && item.node.id && diffs.has(item.node.id)) {
        didAutoSelect.current = true;
        setSelectedFile(item.node.id);
        setTreeIdx(i);
        return;
      }
    }
  }, [flatTree, diffs, selectedFile]);

  // Layout
  const treeW = Math.max(30, Math.floor(size.w * 0.22));
  const ctxW = Math.max(28, Math.floor(size.w * 0.24));
  const diffW = Math.max(30, size.w - treeW - ctxW - 6);
  const bodyH = size.h - 5;
  const treeVisibleH = Math.max(1, bodyH - 4);

  // Tree scroll: keep treeIdx visible
  const treeScroll = useMemo(() => {
    if (flatTree.length <= treeVisibleH) return 0;
    const maxScroll = flatTree.length - treeVisibleH;
    if (safeIdx < treeVisibleH / 2) return 0;
    return Math.min(maxScroll, Math.max(0, safeIdx - Math.floor(treeVisibleH / 2)));
  }, [safeIdx, flatTree.length, treeVisibleH]);

  // Current diff + context
  const currentDiff = selectedFile ? diffs.get(selectedFile) ?? null : null;
  const diffRows = currentDiff?.rows ?? [];

  // Clamp diffCursor when switching files
  const safeDiffCursor = Math.min(diffCursor, Math.max(0, diffRows.length - 1));
  useEffect(() => {
    if (safeDiffCursor !== diffCursor && diffRows.length > 0) setDiffCursor(safeDiffCursor);
  }, [safeDiffCursor, diffCursor, diffRows.length]);

  // File review progress for explorer indicators
  const fileProgress = useMemo(() => {
    const map = new Map<string, 'none' | 'partial' | 'complete'>();
    for (const [fileId, diff] of diffs) {
      const s = computeFileReviewStats(fileId, diff, lineReviews);
      if (s.total === 0) map.set(fileId, 'none');
      else if (s.reviewed >= s.total) map.set(fileId, 'complete');
      else if (s.reviewed > 0) map.set(fileId, 'partial');
      else map.set(fileId, 'none');
    }
    return map;
  }, [diffs, lineReviews]);

  // Global review stats (memoized, shared)
  const globalStats = useMemo(
    () => computeGlobalReviewStats(diffs, lineReviews),
    [diffs, lineReviews],
  );

  const ctx = useMemo((): ContextData | null => {
    const item = flatTree[safeIdx];
    if (!item) return null;
    if (item.node.id && diffs.has(item.node.id)) return getFileContext(item.node.id, data, diffs, lineReviews);
    if (item.node.type === 'repo') return getRepoContext(item.node.name, data, diffs, lineReviews);
    if (item.isFolder) return getFolderContext(item.node.name, data, diffs, lineReviews);
    return null;
  }, [safeIdx, flatTree, data, diffs, lineReviews]);

  const branches = data.repos.map(r => r.branch).filter(b => b !== 'develop' && b !== 'main');
  const branchLabel = branches[0] ?? 'HEAD';

  // Navigation
  useNavigation(
    { panel, treeIdx: safeIdx, selectedFile, diffScroll, diffCursor: safeDiffCursor, ctxIdx, minCrit, collapsed },
    { setPanel, setTreeIdx, setSelectedFile, setDiffScroll, setDiffCursor, setCtxIdx, setMinCrit, setLineFlag, setCollapsed },
    { flatTree, diffRows, diffs, ctx, bodyH },
  );

  // Visible slices
  const visibleTree = flatTree.slice(treeScroll, treeScroll + treeVisibleH);
  const halfDiff = Math.floor((diffW - 3) / 2);
  const visibleDiffRows = diffRows.slice(diffScroll, diffScroll + bodyH - 3);

  return (
    <Box flexDirection="column" width={size.w} height={size.h}>
      {/* Title bar */}
      <Box height={1} width={size.w}>
        <Text backgroundColor={C.accent} color="#ffffff" bold>{' \u25C8 REVU '}</Text>
        <Text backgroundColor="#3c3c3c" color={C.bright}>{` ${branchLabel} `}</Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>{'\u2500'.repeat(Math.max(0, size.w - branchLabel.length - 30))}</Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>{' crit\u2265'}</Text>
        <Text backgroundColor="#3c3c3c" color={critColor(minCrit)} bold>{minCrit.toFixed(1)}</Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>{' [/] '}</Text>
      </Box>

      {/* 3 Panels */}
      <Box flexDirection="row" height={bodyH}>
        {/* LEFT: Explorer */}
        <Border label="EXPLORER" color={panel === 0 ? C.accent : C.border} width={treeW} height={bodyH}>
          <Box flexDirection="column" overflow="hidden">
            {visibleTree.map((item, i) => (
              <TreeRow
                key={item.id}
                item={item}
                isSelected={item.node.id === selectedFile}
                isFocused={panel === 0 && (treeScroll + i) === safeIdx}
                isCollapsed={item.isFolder && collapsed.has(item.id)}
                width={treeW - 2}
                progress={item.node.id ? fileProgress.get(item.node.id) : undefined}
              />
            ))}
            {flatTree.length > treeVisibleH && (
              <Text color={C.dim}> {safeIdx + 1}/{flatTree.length}</Text>
            )}
          </Box>
        </Border>

        {/* CENTER: Diff */}
        <Border
          label={currentDiff ? `${currentDiff.name} \u2014 diff` : 'DIFF'}
          color={panel === 1 ? C.accent : C.border}
          width={diffW}
          height={bodyH}
        >
          {currentDiff ? (
            <Box flexDirection="column" overflow="hidden">
              {visibleDiffRows.map((row, i) => {
                const rowIndex = diffScroll + i;
                if (row.type === 'hunkHeader') {
                  const hc = critColor(row.methodCrit);
                  const isCur = panel === 1 && rowIndex === safeDiffCursor;
                  return (
                    <Box key={`h${i}`}>
                      <Text color={isCur ? C.accent : hc} bold>{isCur ? '\u25B6' : '\u2500'}{'\u2500'}</Text>
                      <Text color={hc} bold> {row.method} </Text>
                      <Text color={C.dim}>({row.label})</Text>
                      <Text> </Text>
                      <Text color={hc} bold>{row.methodCrit.toFixed(1)}</Text>
                    </Box>
                  );
                }
                const lineKey = row.reviewLine ? `${selectedFile}:${row.reviewLine.n}` : '';
                const review = lineReviews.get(lineKey);
                const flag = review?.flag;
                const isCur = panel === 1 && rowIndex === safeDiffCursor;
                return (
                  <Box key={`d${i}`}>
                    <Box width={halfDiff}>
                      <DLine line={row.baseLine ?? null} width={halfDiff} minCrit={minCrit} showCrit={false} isCursor={false} />
                    </Box>
                    <Text color={C.border}>{'\u2502'}</Text>
                    <Box width={halfDiff}>
                      <DLine line={row.reviewLine ?? null} width={halfDiff - 4} minCrit={minCrit} showCrit={true} isCursor={isCur} flag={flag} />
                    </Box>
                    {row.reviewLine && (row.reviewLine.t === 'add' || row.reviewLine.t === 'del') ? (
                      <Text color={flag ? (FLAG_COLOR[flag] ?? C.dim) : C.dim}>
                        {flag ? ` ${FLAG_ICON[flag]}` : ' \u25CB'}
                      </Text>
                    ) : (
                      <Text>{'  '}</Text>
                    )}
                  </Box>
                );
              })}
              {diffRows.length > bodyH - 3 && (
                <Text color={C.dim}>
                  {' \u2195 '}{diffScroll + 1}/{diffRows.length} ({Math.round((diffScroll / Math.max(1, diffRows.length - bodyH + 3)) * 100)}%)
                </Text>
              )}
            </Box>
          ) : (
            <Box justifyContent="center" alignItems="center" height={bodyH - 3}>
              <Text color={C.dim}>Select a file to view diff</Text>
            </Box>
          )}
        </Border>

        {/* RIGHT: Context */}
        <Border label="CONTEXT" color={panel === 2 ? C.accent : C.border} width={ctxW} height={bodyH}>
          <ContextPanel ctx={ctx} ctxIdx={ctxIdx} isActive={panel === 2} width={ctxW} minCrit={minCrit} />
        </Border>
      </Box>

      {/* Status bar */}
      <StatusBar repoCount={data.repos.length} stats={globalStats} width={size.w} />
    </Box>
  );
}
