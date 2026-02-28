import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { C, critColor } from './colors.js';
import { useTermSize } from './hooks/useTermSize.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useReview } from './hooks/useReview.js';
import { Border } from './components/Border.js';
import { TreeRow } from './components/TreeRow.js';
import { DLine } from './components/DLine.js';
import { ContextPanel } from './components/ContextPanel.js';
import { buildTree, flattenTree, buildFileDiffs } from './data.js';
import { getFileContext, getFolderContext, getRepoContext } from './context.js';
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
  const { checkedLines, setCheckedLines } = useReview(rootDir, data);

  // Recompute flat tree when collapsed changes
  const flatTree = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);

  // Clamp treeIdx when flatTree shrinks (folder collapsed)
  const clampedTreeIdx = Math.min(treeIdx, Math.max(0, flatTree.length - 1));
  if (clampedTreeIdx !== treeIdx) {
    setTreeIdx(clampedTreeIdx);
  }

  // Auto-select first file with diff (once)
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current || selectedFile !== null) return;
    didAutoSelect.current = true;
    for (const item of flatTree) {
      if (!item.isFolder && item.node.id && diffs.has(item.node.id)) {
        setSelectedFile(item.node.id);
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
  const safeIdx = clampedTreeIdx;
  const treeScroll = useMemo(() => {
    if (flatTree.length <= treeVisibleH) return 0;
    const maxScroll = flatTree.length - treeVisibleH;
    if (safeIdx < treeVisibleH / 2) return 0;
    return Math.min(maxScroll, Math.max(0, safeIdx - Math.floor(treeVisibleH / 2)));
  }, [safeIdx, flatTree.length, treeVisibleH]);

  // Current diff + context
  const currentDiff = selectedFile ? diffs.get(selectedFile) ?? null : null;
  const diffRows = currentDiff?.rows ?? [];

  const ctx = useMemo((): ContextData | null => {
    const item = flatTree[safeIdx];
    if (!item) return null;
    if (item.node.id && diffs.has(item.node.id)) return getFileContext(item.node.id, data, diffs);
    if (item.node.type === 'repo') return getRepoContext(item.node.name, data, diffs);
    if (item.isFolder) return getFolderContext(item.node.name, data, diffs);
    return null;
  }, [safeIdx, flatTree, data, diffs]);

  const branches = data.repos.map(r => r.branch).filter(b => b !== 'develop' && b !== 'main');
  const branchLabel = branches[0] ?? 'HEAD';

  // Navigation
  useNavigation(
    { panel, treeIdx: safeIdx, selectedFile, diffScroll, ctxIdx, minCrit, checkedLines, collapsed },
    { setPanel, setTreeIdx, setSelectedFile, setDiffScroll, setCtxIdx, setMinCrit, setCheckedLines, setCollapsed },
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
                if (row.type === 'hunkHeader') {
                  const hc = critColor(row.methodCrit);
                  return (
                    <Box key={`h${i}`}>
                      <Text color={hc} bold>{'\u2500\u2500'}</Text>
                      <Text color={hc} bold> {row.method} </Text>
                      <Text color={C.dim}>({row.label})</Text>
                      <Text> </Text>
                      <Text color={hc} bold>{row.methodCrit.toFixed(1)}</Text>
                    </Box>
                  );
                }
                const lineKey = row.reviewLine ? `${selectedFile}:${row.reviewLine.n}` : '';
                const checked = checkedLines.has(lineKey);
                return (
                  <Box key={`d${i}`}>
                    <Box width={halfDiff}>
                      <DLine line={row.baseLine ?? null} width={halfDiff} minCrit={minCrit} showCrit={false} />
                    </Box>
                    <Text color={C.border}>{'\u2502'}</Text>
                    <Box width={halfDiff}>
                      <DLine line={row.reviewLine ?? null} width={halfDiff - 4} minCrit={minCrit} showCrit={true} />
                    </Box>
                    {row.reviewLine && (row.reviewLine.t === 'add' || row.reviewLine.t === 'del') ? (
                      <Text color={checked ? C.green : C.dim}>{checked ? ' \u2713' : ' \u25CB'}</Text>
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
      <Box height={1} width={size.w}>
        <Text backgroundColor={C.accent} color="#ffffff">{` ${data.repos.length} repo(s) `}</Text>
        <Text backgroundColor="#3c3c3c" color={C.bright}>{' Tab:\u21B9  \u2190\u2191\u2193\u2192:nav  Enter:toggle  c:check  [/]:crit  q:quit '}</Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>{'\u2500'.repeat(Math.max(0, size.w - 75))}</Text>
        <Text backgroundColor="#3c3c3c" color={C.green}>{' \u2713'}{checkedLines.size}{' '}</Text>
      </Box>
    </Box>
  );
}
