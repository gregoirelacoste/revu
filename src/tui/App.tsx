import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Box, Text } from 'ink';
import { C, critColor, FLAG_ICON, FLAG_COLOR } from './colors.js';
import { useTermSize } from './hooks/useTermSize.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useReview } from './hooks/useReview.js';
import { useInputMode, type InputMode } from './hooks/useInputMode.js';
import { useReviewProgress } from './hooks/useReviewProgress.js';
import { useNavHistory } from './hooks/useNavHistory.js';
import { Border } from './components/Border.js';
import { TreeRow } from './components/TreeRow.js';
import { DLine } from './components/DLine.js';
import { CommentRows } from './components/CommentRows.js';
import { ContextPanel } from './components/ContextPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { buildTree, flattenTree, buildFileDiffs, buildUnifiedRows } from './data.js';
import { getFileContext, getFolderContext, getRepoContext, getLineContext } from './context.js';
import { exportMarkdown } from '../export/markdown-exporter.js';
import { writeExport } from '../export/write-export.js';
import type { ScanResult } from '../core/engine.js';
import type { ContextData, DiffMode } from './types.js';

interface AppProps {
  data: ScanResult;
  rootDir: string;
}

export function App({ data, rootDir }: AppProps) {
  const size = useTermSize();

  const tree = useMemo(() => buildTree(data), [data]);
  const diffs = useMemo(() => buildFileDiffs(data), [data]);
  const fileToRepo = useMemo(() => {
    const map = new Map<string, string>();
    for (const repo of data.repos) {
      for (const file of repo.files) map.set(file.id, repo.name);
    }
    return map;
  }, [data]);

  // State
  const [panel, setPanel] = useState(0);
  const [treeIdx, setTreeIdx] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffScroll, setDiffScroll] = useState(0);
  const [ctxIdx, setCtxIdx] = useState(0);
  const [minCrit, setMinCrit] = useState(0);
  const [diffCursor, setDiffCursor] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode | null>(null);
  const [diffMode, setDiffMode] = useState<DiffMode>('unified');
  const { lineReviews, setLineFlag, setLineFlagBatch, addLineComment } = useReview(rootDir, data);
  const { fileProgress, globalStats, sideEffectCount } = useReviewProgress(data, diffs, lineReviews);
  const history = useNavHistory();
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleExport = useCallback(() => {
    const exported = exportMarkdown(data, diffs, lineReviews);
    const paths: string[] = [];
    const promises: Promise<void>[] = [];
    for (const [repoName, { markdown, branch }] of exported) {
      promises.push(
        writeExport(rootDir, repoName, branch, markdown).then(p => { paths.push(p); }),
      );
    }
    Promise.all(promises).then(() => {
      setExportMsg(`Exported to ${paths.join(', ')}`);
      setTimeout(() => setExportMsg(null), 3000);
    }).catch(err => {
      setExportMsg(`Export failed: ${err}`);
      setTimeout(() => setExportMsg(null), 3000);
    });
  }, [data, diffs, lineReviews, rootDir]);

  const batchMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBatchMsg = useCallback((msg: string | null) => {
    if (batchMsgTimer.current) clearTimeout(batchMsgTimer.current);
    setBatchMsg(msg);
    if (msg) batchMsgTimer.current = setTimeout(() => setBatchMsg(null), 3000);
  }, []);

  // Inline comment input
  useInputMode(panel === 1, inputMode, setInputMode, addLineComment);

  // Recompute flat tree when collapsed changes
  const fullFlatTree = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);
  const flatTree = useMemo(() => {
    if (searchQuery === null || searchQuery === '') return fullFlatTree;
    const q = searchQuery.toLowerCase();
    return fullFlatTree.filter(item => !item.isFolder && item.node.name.toLowerCase().includes(q));
  }, [fullFlatTree, searchQuery]);

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

  // Layout — responsive: active panel gets more space
  const LAYOUT: Record<number, [number, number, number]> = {
    0: [0.30, 0.46, 0.24],  // Explorer focus
    1: [0.15, 0.65, 0.20],  // Diff focus
    2: [0.18, 0.46, 0.36],  // Context focus
  };
  const [treeR, , ctxR] = LAYOUT[panel] ?? LAYOUT[1];
  const usable = size.w - 6;
  const treeW = Math.max(20, Math.floor(usable * treeR));
  const ctxW  = Math.max(20, Math.floor(usable * ctxR));
  const diffW = Math.max(30, usable - treeW - ctxW);
  const bodyH = size.h - 5;
  const hasScrollIndicator = flatTree.length > (bodyH - 3);
  const treeVisibleH = Math.max(1, bodyH - 3 - (hasScrollIndicator ? 1 : 0));

  // Diff mode
  const canSideBySide = size.w >= 140;
  const effectiveMode: DiffMode = diffMode === 'side-by-side' && canSideBySide ? 'side-by-side' : 'unified';

  const handleToggleDiffMode = useCallback(() => {
    if (!canSideBySide) return;
    setDiffMode(m => m === 'unified' ? 'side-by-side' : 'unified');
    setDiffCursor(0);
    setDiffScroll(0);
  }, [canSideBySide]);

  // Tree scroll: edge-based, computed synchronously via ref (no one-frame lag)
  const treeScrollRef = useRef(0);
  if (flatTree.length <= treeVisibleH) {
    treeScrollRef.current = 0;
  } else {
    const maxScroll = flatTree.length - treeVisibleH;
    const prev = treeScrollRef.current;
    const margin = 2;
    if (safeIdx < prev + margin) {
      treeScrollRef.current = Math.max(0, safeIdx - margin);
    } else if (safeIdx >= prev + treeVisibleH - margin) {
      treeScrollRef.current = Math.min(maxScroll, safeIdx - treeVisibleH + margin + 1);
    } else {
      treeScrollRef.current = Math.min(prev, maxScroll);
    }
  }
  const treeScroll = treeScrollRef.current;

  // Preview: when explorer is focused, show diff of hovered file
  const previewFile = useMemo(() => {
    if (panel !== 0) return null;
    const item = flatTree[safeIdx];
    if (item && !item.isFolder && item.node.id && diffs.has(item.node.id)) return item.node.id;
    return null;
  }, [panel, safeIdx, flatTree, diffs]);

  const activeFile = previewFile ?? selectedFile;

  const currentRepo = useMemo(() => {
    for (let i = safeIdx; i >= 0; i--) {
      if (flatTree[i]?.node.type === 'repo') return flatTree[i].node.name;
    }
    return null;
  }, [flatTree, safeIdx]);

  // Reset ctxIdx + diff position when active file changes
  const prevActiveFile = useRef(activeFile);
  useEffect(() => {
    if (activeFile !== prevActiveFile.current) {
      prevActiveFile.current = activeFile;
      setCtxIdx(0);
      // Reset diff position only for preview (not explicit navigation which sets its own cursor)
      if (previewFile && previewFile !== selectedFile) {
        setDiffCursor(0);
        setDiffScroll(0);
      }
    }
  }, [activeFile, previewFile, selectedFile]);

  // Current diff + context
  const currentDiff = activeFile ? diffs.get(activeFile) ?? null : null;
  const unifiedRows = useMemo(
    () => currentDiff ? buildUnifiedRows(currentDiff.rows) : [],
    [currentDiff],
  );
  const activeDiffRows = effectiveMode === 'unified' ? unifiedRows : (currentDiff?.rows ?? []);

  // Clamp diffCursor when switching files or mode
  const safeDiffCursor = Math.min(diffCursor, Math.max(0, activeDiffRows.length - 1));
  useEffect(() => {
    if (safeDiffCursor !== diffCursor && activeDiffRows.length > 0) setDiffCursor(safeDiffCursor);
  }, [safeDiffCursor, diffCursor, activeDiffRows.length]);

  const ctx = useMemo((): ContextData | null => {
    // Mode 4: line-level context when diff panel active
    if (panel === 1 && activeFile && currentDiff) {
      const curRow = activeDiffRows[safeDiffCursor];
      if (curRow?.type === 'diffRow') {
        const line = curRow.reviewLine ?? curRow.baseLine;
        if (line) {
          const lineCtx = getLineContext(currentDiff.path, line.c, data, diffs);
          if (lineCtx) return lineCtx;
        }
      }
      return getFileContext(activeFile, data, diffs, lineReviews);
    }

    // Mode 3: explorer-driven
    const item = flatTree[safeIdx];
    if (!item) return null;
    if (item.node.id && diffs.has(item.node.id)) return getFileContext(item.node.id, data, diffs, lineReviews);
    if (item.node.type === 'repo') return getRepoContext(item.node.name, data, diffs, lineReviews);
    if (item.isFolder) return getFolderContext(item.node.name, data, diffs, lineReviews);
    return null;
  }, [safeIdx, flatTree, data, diffs, lineReviews, panel, activeFile, currentDiff, activeDiffRows, safeDiffCursor]);

  const branches = data.repos.map(r => r.branch).filter(b => b !== 'develop' && b !== 'main');
  const branchLabel = branches[0] ?? 'HEAD';

  // Navigation — pass activeDiffRows so nav works on the correct array
  useNavigation(
    { panel, treeIdx: safeIdx, selectedFile, diffScroll, diffCursor: safeDiffCursor, ctxIdx, minCrit, collapsed, inputMode, searchQuery, showHelp },
    { setPanel, setTreeIdx, setSelectedFile, setDiffScroll, setDiffCursor, setCtxIdx, setMinCrit, setLineFlag, setLineFlagBatch, setBatchMsg: handleBatchMsg, setCollapsed, setInputMode, setSearchQuery, setShowHelp, onExport: handleExport, onToggleDiffMode: handleToggleDiffMode, historyPush: history.push, historyGoBack: history.goBack, historyGoForward: history.goForward },
    { flatTree, diffRows: activeDiffRows, diffs, ctx, bodyH, lineReviews, fileProgress },
  );

  // Visible slices
  const visibleTree = flatTree.slice(treeScroll, treeScroll + treeVisibleH);
  const halfDiff = Math.floor((diffW - 3) / 2);
  const visibleDiffRows = activeDiffRows.slice(diffScroll, diffScroll + bodyH - 3);

  // Diff panel label — breadcrumb with repo context
  const modeTag = effectiveMode === 'unified' ? 'unified' : 'sbs';
  const diffLabel = useMemo(() => {
    if (!currentDiff) return 'DIFF';
    const repo = activeFile ? fileToRepo.get(activeFile) : null;
    const isMulti = data.repos.length > 1;
    const prefix = isMulti && repo ? `${repo} \u203A ` : '';
    const fullLabel = `${prefix}${currentDiff.path} (${modeTag})`;
    const maxLabelW = diffW - 4;
    return fullLabel.length > maxLabelW
      ? '\u2026' + fullLabel.slice(fullLabel.length - maxLabelW + 1)
      : fullLabel;
  }, [currentDiff, activeFile, fileToRepo, data.repos.length, modeTag, diffW]);

  // Explorer label — show current repo
  const explorerLabel = currentRepo ? `EXPLORER \u00B7 ${currentRepo}` : 'EXPLORER';

  return (
    <Box flexDirection="column" width={size.w} height={size.h}>
      {/* Title bar */}
      <Box height={1} width={size.w}>
        {searchQuery !== null ? (
          <>
            <Text backgroundColor={C.accent} color="#ffffff" bold>{' \u25C8 SEARCH: '}</Text>
            <Text backgroundColor="#3c3c3c" color={C.white} bold>{searchQuery}</Text>
            <Text backgroundColor="#3c3c3c" color={C.accent}>{'_'}</Text>
            <Text backgroundColor="#3c3c3c" color={C.dim}>{'\u2500'.repeat(Math.max(0, size.w - searchQuery.length - 12))}</Text>
          </>
        ) : (
          <>
            <Text backgroundColor={C.accent} color="#ffffff" bold>{' \u25C8 REVU '}</Text>
            <Text backgroundColor="#3c3c3c" color={C.bright}>{` ${branchLabel} `}</Text>
            <Text backgroundColor="#3c3c3c" color={C.dim}>{'\u2500'.repeat(Math.max(0, size.w - branchLabel.length - 30))}</Text>
            <Text backgroundColor="#3c3c3c" color={C.dim}>{' crit\u2265'}</Text>
            <Text backgroundColor="#3c3c3c" color={critColor(minCrit)} bold>{minCrit.toFixed(1)}</Text>
            <Text backgroundColor="#3c3c3c" color={C.dim}>{' [/] '}</Text>
          </>
        )}
      </Box>

      {/* Help overlay */}
      {showHelp && <HelpOverlay width={size.w} height={bodyH} />}

      {/* 3 Panels */}
      <Box flexDirection="row" height={bodyH}>
        {/* LEFT: Explorer */}
        <Border label={explorerLabel} color={panel === 0 ? C.accent : C.border} width={treeW} height={bodyH}>
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
          label={diffLabel}
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

                if (row.type === 'hunkFooter') {
                  const hc = critColor(row.methodCrit);
                  const isCur = panel === 1 && rowIndex === safeDiffCursor;
                  return (
                    <Box key={`f${i}`}>
                      <Text color={isCur ? C.accent : C.dim}>{isCur ? '\u25B6' : '\u2500'}</Text>
                      <Text color={C.dim}>{'\u2500 '}</Text>
                      <Text color={C.dim}>{row.method} </Text>
                      <Text color={hc}>{row.methodCrit.toFixed(1)}</Text>
                      <Text color={C.dim}> {'\u2500'.repeat(Math.max(0, diffW - row.method.length - 12))}</Text>
                    </Box>
                  );
                }

                const lineKey = row.reviewLine ? `${activeFile}:${row.reviewLine.n}` : '';
                const review = lineReviews.get(lineKey);
                const flag = review?.flag;
                const comments = review?.comments ?? [];
                const isCur = panel === 1 && rowIndex === safeDiffCursor;

                if (effectiveMode === 'unified') {
                  // Unified: single line, full width
                  const line = row.baseLine ?? row.reviewLine ?? null;
                  const isFlaggable = row.reviewLine && row.reviewLine.t === 'add';
                  return (
                    <Box key={`d${i}`} flexDirection="column">
                      <Box>
                        <DLine line={line} width={diffW - 6} minCrit={minCrit} isCursor={isCur} flag={flag} />
                        {isFlaggable ? (
                          <Text color={flag ? (FLAG_COLOR[flag] ?? C.dim) : C.dim}>
                            {flag ? ` ${FLAG_ICON[flag]}` : ' \u25CB'}
                          </Text>
                        ) : (
                          <Text>{'  '}</Text>
                        )}
                      </Box>
                      {(comments.length > 0 || inputMode?.lineKey === lineKey) && (
                        <CommentRows comments={comments} inputMode={inputMode} lineKey={lineKey} width={diffW} />
                      )}
                    </Box>
                  );
                }

                // Side-by-side
                return (
                  <Box key={`d${i}`} flexDirection="column">
                    <Box>
                      <Box width={halfDiff}>
                        <DLine line={row.baseLine ?? null} width={halfDiff} minCrit={minCrit} isCursor={false} />
                      </Box>
                      <Text color={C.border}>{'\u2502'}</Text>
                      <Box width={halfDiff}>
                        <DLine line={row.reviewLine ?? null} width={halfDiff - 4} minCrit={minCrit} isCursor={isCur} flag={flag} />
                      </Box>
                      {row.reviewLine && (row.reviewLine.t === 'add' || row.reviewLine.t === 'del') ? (
                        <Text color={flag ? (FLAG_COLOR[flag] ?? C.dim) : C.dim}>
                          {flag ? ` ${FLAG_ICON[flag]}` : ' \u25CB'}
                        </Text>
                      ) : (
                        <Text>{'  '}</Text>
                      )}
                    </Box>
                    {(comments.length > 0 || inputMode?.lineKey === lineKey) && (
                      <CommentRows comments={comments} inputMode={inputMode} lineKey={lineKey} width={diffW} />
                    )}
                  </Box>
                );
              })}
              {activeDiffRows.length > bodyH - 3 && (
                <Text color={C.dim}>
                  {' \u2195 '}{diffScroll + 1}/{activeDiffRows.length} ({Math.round((diffScroll / Math.max(1, activeDiffRows.length - bodyH + 3)) * 100)}%)
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
          <ContextPanel ctx={ctx} ctxIdx={ctxIdx} isActive={panel === 2} width={ctxW} minCrit={minCrit} diffs={diffs} fileProgress={fileProgress} />
        </Border>
      </Box>

      {/* Status bar */}
      <StatusBar repoCount={data.repos.length} stats={globalStats} sideEffects={sideEffectCount} width={size.w} exportMsg={exportMsg} batchMsg={batchMsg} canGoBack={history.canGoBack} canGoForward={history.canGoForward} />
    </Box>
  );
}
