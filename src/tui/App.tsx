import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Box, Text } from 'ink';
import { C, critColor, FLAG_ICON, FLAG_COLOR } from './colors.js';
import { useTermSize } from './hooks/useTermSize.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useReview } from './hooks/useReview.js';
import { useFileWatcher } from './hooks/useFileWatcher.js';
import { useInputMode, type InputMode } from './hooks/useInputMode.js';
import { useReviewProgress } from './hooks/useReviewProgress.js';
import { useNavHistory } from './hooks/useNavHistory.js';
import { useMouseScroll } from './hooks/useMouseScroll.js';
import { Border } from './components/Border.js';
import { TreeRow } from './components/TreeRow.js';
import { DLine } from './components/DLine.js';
import { CommentRows } from './components/CommentRows.js';
import { ContextPanel } from './components/ContextPanel.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { MethodMapOverlay } from './components/MethodMapOverlay.js';
import { CommentsOverlay } from './components/CommentsOverlay.js';
import { loadSyntaxTheme } from './syntax.js';
import { buildMethodMapData } from './method-map-data.js';
import { collectAllComments } from './comment-data.js';
import { buildTree, filterTree, flattenTree, buildFileDiffs, buildUnifiedRows } from './data.js';
import { getFileContext, getMethodContext, getFolderContext, getRepoContext } from './context.js';
import { exportMarkdown, exportLightMarkdown } from '../export/markdown-exporter.js';
import { writeExport } from '../export/write-export.js';
import { openEditor, ensureNotesFile } from './editor.js';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { ScanResult } from '../core/engine.js';
import { rescore } from '../core/engine.js';
import type { ContextData, DiffMode, DiffRow, FlatItem, TreeItem, TuiDiffLine, TuiFileDiff } from './types.js';

import type { LineReview } from './hooks/useReview.js';
import { isReviewValid } from './hooks/useReview.js';

function computeMethodReviewStatus(
  rows: DiffRow[], fileId: string, lineReviews: Map<string, LineReview>,
): Map<string, boolean> {
  const status = new Map<string, boolean>();
  let method = '';
  let allFlagged = true;
  let hasFlaggable = false;
  for (const row of rows) {
    if (row.type === 'hunkHeader') {
      if (method && hasFlaggable) status.set(method, allFlagged);
      method = row.method;
      allFlagged = true;
      hasFlaggable = false;
      continue;
    }
    if (row.reviewLine && (row.reviewLine.t === 'add' || row.reviewLine.t === 'del')) {
      hasFlaggable = true;
      const review = lineReviews.get(`${fileId}:${row.reviewLine.n}`);
      if (!isReviewValid(review, row.reviewLine.c)) allFlagged = false;
    }
  }
  if (method && hasFlaggable) status.set(method, allFlagged);
  return status;
}


interface AppProps {
  initialData: ScanResult;
  rootDir: string;
  rescan: () => Promise<ScanResult>;
}

export function App({ initialData, rootDir, rescan }: AppProps) {
  const size = useTermSize();
  const [data, setData] = useState(initialData);

  // Invalidation counter: force re-computation after rescore mutates data in-place
  const [dataVersion, setDataVersion] = useState(0);

  // File watcher for live reload
  const repoPaths = useMemo(
    () => data.repos.map(r => join(rootDir, r.name)),
    [data.repos.length, rootDir],
  );

  const handleNewData = useCallback((newData: ScanResult) => {
    setData(newData);
    setDataVersion(v => v + 1);
  }, []);

  const { isScanning, triggerRescan } = useFileWatcher({
    repoPaths, rescan, onNewData: handleNewData,
  });

  const tree = useMemo(() => buildTree(data), [data, dataVersion]);
  const diffs = useMemo(() => buildFileDiffs(data), [data, dataVersion]);
  const fileToRepo = useMemo(() => {
    const map = new Map<string, string>();
    for (const repo of data.repos) {
      for (const file of repo.files) map.set(file.id, repo.name);
    }
    return map;
  }, [data]);

  // Syntax theme (config-driven, null = disabled)
  const syntaxTheme = useMemo(() => loadSyntaxTheme(data.config.syntax), [data.config.syntax]);

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
  const { lineReviews, setLineFlag, setLineFlagBatch, addLineComment, stale, scoringOverride, resetReview } = useReview(rootDir, data);
  const { fileProgress, globalStats, sideEffectCount } = useReviewProgress(data, diffs, lineReviews);
  const history = useNavHistory();
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [explorerToggle, setExplorerToggle] = useState<0 | 1>(0);
  const [diffToggle, setDiffToggle] = useState<0 | 1 | 2>(0);
  const [aiScoringActive, setAiScoringActive] = useState(false);
  const [resetPrompt, setResetPrompt] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapNodeIdx, setMapNodeIdx] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [commentIdx, setCommentIdx] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [fullFileLines, setFullFileLines] = useState<TuiDiffLine[] | null>(null);

  // Comment data for comments overlay
  const commentData = useMemo(
    () => showComments ? collectAllComments(diffs, lineReviews) : null,
    [showComments, diffs, lineReviews, dataVersion],
  );

  // Store original crits to restore when AI scoring is toggled off
  const originalCrits = useRef<Map<string, { fileCrit: number; methods: Map<string, number> }> | null>(null);

  const handleToggleAIScoring = useCallback(() => {
    if (!scoringOverride && !aiScoringActive) {
      setBatchMsg('No AI scoring found. Export with Alt+E, run AI scoring, then import.');
      setTimeout(() => setBatchMsg(null), 3000);
      return;
    }

    if (aiScoringActive) {
      // Restore original crits
      if (originalCrits.current) {
        for (const r of data.repos) {
          for (const file of r.files) {
            const saved = originalCrits.current.get(file.id);
            if (saved) {
              file.crit = saved.fileCrit;
              for (const m of [...file.methods, ...file.constants]) {
                const mc = saved.methods.get(m.name);
                if (mc !== undefined) m.crit = mc;
              }
            }
          }
        }
        originalCrits.current = null;
      }
      setAiScoringActive(false);
      setDataVersion(v => v + 1);
      setBatchMsg('AI scoring deactivated');
    } else if (scoringOverride) {
      // Save original crits before rescore
      const saved = new Map<string, { fileCrit: number; methods: Map<string, number> }>();
      for (const r of data.repos) {
        for (const file of r.files) {
          const methods = new Map<string, number>();
          for (const m of [...file.methods, ...file.constants]) methods.set(m.name, m.crit);
          saved.set(file.id, { fileCrit: file.crit, methods });
        }
      }
      originalCrits.current = saved;
      rescore(data, scoringOverride);
      setAiScoringActive(true);
      setDataVersion(v => v + 1);
      setBatchMsg(`AI scoring active: ${scoringOverride.rationale}`);
    }
    setTimeout(() => setBatchMsg(null), 3000);
  }, [data, aiScoringActive, scoringOverride]);

  const handleResetReview = useCallback((scope: 'review' | 'ai' | 'all') => {
    resetReview(scope);
    if (scope === 'ai' || scope === 'all') {
      setAiScoringActive(false);
      originalCrits.current = null;
    }
  }, [resetReview]);

  const handleExport = useCallback(() => {
    const full = exportMarkdown(data, diffs, lineReviews);
    const light = exportLightMarkdown(data, diffs, lineReviews);
    const paths: string[] = [];
    const promises: Promise<void>[] = [];
    for (const [repoName, { markdown, branch }] of full) {
      promises.push(
        writeExport(rootDir, repoName, branch, markdown, 'review').then(p => { paths.push(p); }),
      );
    }
    for (const [repoName, { markdown, branch }] of light) {
      promises.push(
        writeExport(rootDir, repoName, branch, markdown, 'comments').then(p => { paths.push(p); }),
      );
    }
    Promise.all(promises).then(() => {
      setExportMsg(`Exported ${paths.length} files to .revu/{branch}/exports/`);
      setTimeout(() => setExportMsg(null), 3000);
    }).catch(err => {
      setExportMsg(`Export failed: ${err}`);
      setTimeout(() => setExportMsg(null), 3000);
    });
  }, [data, diffs, lineReviews, rootDir]);

  // Reset diff toggle when file changes — auto-sync for reviewed files
  useEffect(() => {
    if (!selectedFile) return;
    const isComplete = diffs.has(selectedFile) && fileProgress.get(selectedFile) === 'complete';
    if (isComplete && explorerToggle >= 1) {
      setDiffToggle(1); // show all blocks for reviewed files (not full file)
    } else {
      setDiffToggle(0);
    }
  // Intentionally omit diffs/fileProgress: only sync on navigation or toggle change,
  // not when review progress updates mid-file (would cause jarring toggle changes).
  }, [selectedFile, explorerToggle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenNotes = useCallback(() => {
    const branch = data.repos[0]?.branch;
    if (!branch) return;
    ensureNotesFile(rootDir, branch).then(notesPath => {
      openEditor(notesPath);
      setDataVersion(v => v + 1);
    }).catch(() => {});
  }, [rootDir, data.repos]);

  const batchMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleBatchMsg = useCallback((msg: string | null) => {
    if (batchMsgTimer.current) clearTimeout(batchMsgTimer.current);
    setBatchMsg(msg);
    if (msg) batchMsgTimer.current = setTimeout(() => setBatchMsg(null), 3000);
  }, []);

  // Inline comment input
  useInputMode(panel === 1, inputMode, setInputMode, addLineComment);

  // Filter tree BEFORE flattening: only files with diffs, hide empty folders
  const filteredTree = useMemo(
    () => filterTree(tree, diffs, fileProgress, explorerToggle === 0),
    [tree, diffs, fileProgress, explorerToggle],
  );

  // Folder progress from filtered tree (recursive)
  const folderProgress = useMemo(() => {
    const map = new Map<string, 'none' | 'partial' | 'complete'>();
    function walk(items: TreeItem[]) {
      for (const item of items) {
        const isFolder = item.type === 'folder' || item.type === 'repo';
        if (!isFolder || !item.children) continue;
        walk(item.children);
        let hasFiles = false, allComplete = true, anyReviewed = false;
        function check(children: TreeItem[]) {
          for (const c of children) {
            if (c.type === 'folder' || c.type === 'repo') { check(c.children ?? []); continue; }
            if (!c.id || !diffs.has(c.id)) continue;
            hasFiles = true;
            const fp = fileProgress.get(c.id);
            if (fp === 'complete') anyReviewed = true;
            else if (fp === 'partial') { allComplete = false; anyReviewed = true; }
            else allComplete = false;
          }
        }
        check(item.children);
        if (!hasFiles) continue;
        const id = item.id ?? item.name;
        if (allComplete) map.set(id, 'complete');
        else if (anyReviewed) map.set(id, 'partial');
        else map.set(id, 'none');
      }
    }
    walk(filteredTree);
    return map;
  }, [filteredTree, fileProgress, diffs]);

  // Flatten filtered tree with user collapse state
  const flatTree = useMemo(() => {
    let items = flattenTree(filteredTree, collapsed);
    if (searchQuery !== null && searchQuery !== '') {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => !item.isFolder && item.node.name.toLowerCase().includes(q));
    }
    return items;
  }, [filteredTree, collapsed, searchQuery]);

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

  // Clear selectedFile if it no longer exists after rescan
  useEffect(() => {
    if (!selectedFile) return;
    const exists = data.repos.some(r => r.files.some(f => f.id === selectedFile));
    if (!exists) setSelectedFile(null);
  }, [data, selectedFile]);

  // Layout — responsive: active panel gets more space
  const LAYOUT: Record<number, [number, number, number]> = {
    0: [0.30, 0.46, 0.24],  // Explorer focus
    1: [0.15, 0.65, 0.20],  // Diff focus
    2: [0.18, 0.46, 0.36],  // Context focus
  };
  const inFocus = focusMode && panel === 1;
  const [treeR, , ctxR] = LAYOUT[panel] ?? LAYOUT[1];
  const usable = size.w - 6;
  const treeW = inFocus ? 0 : Math.max(20, Math.floor(usable * treeR));
  const ctxW  = inFocus ? 0 : Math.max(20, Math.floor(usable * ctxR));
  const diffW = inFocus ? size.w : Math.max(30, usable - treeW - ctxW);
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

  // Load full file content when diffToggle === 2
  const currentDiffPath = useMemo(() => {
    if (!activeFile) return null;
    return diffs.get(activeFile)?.path ?? null;
  }, [activeFile, diffs]);

  useEffect(() => {
    if (diffToggle !== 2 || !currentDiffPath || !activeFile) {
      setFullFileLines(null);
      return;
    }
    const repoName = fileToRepo.get(activeFile);
    if (!repoName) { setFullFileLines(null); return; }
    let cancelled = false;
    const repoDir = join(rootDir, repoName);
    const child = spawn('git', ['show', `HEAD:${currentDiffPath}`], { cwd: repoDir });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', () => {});
    child.on('close', (code) => {
      if (cancelled) return;
      if (code !== 0) {
        setFullFileLines([{ n: 1, c: '(file not available at HEAD)', t: 'ctx' as const }]);
        return;
      }
      const raw = output.split('\n');
      if (raw.length > 0 && raw[raw.length - 1] === '') raw.pop();
      setFullFileLines(raw.map((c, i) => ({ n: i + 1, c, t: 'ctx' as const })));
    });
    return () => { cancelled = true; child.kill(); };
  }, [diffToggle, activeFile, currentDiffPath, rootDir, fileToRepo]);

  // Current diff + context
  const currentDiff = activeFile ? diffs.get(activeFile) ?? null : null;
  const unifiedRows = useMemo(
    () => currentDiff ? buildUnifiedRows(currentDiff.rows) : [],
    [currentDiff],
  );
  const activeDiffRows = effectiveMode === 'unified' ? unifiedRows : (currentDiff?.rows ?? []);

  // Per-method review status: true = all flaggable lines flagged
  const methodReviewStatus = useMemo(() => {
    if (!activeFile) return new Map<string, boolean>();
    return computeMethodReviewStatus(activeDiffRows, activeFile, lineReviews);
  }, [activeDiffRows, activeFile, lineReviews]);

  // Diff toggle: 0=hide reviewed methods, 1=all blocks expanded, 2=full file view
  // Always filter out hunkHeaders — method info shown on right margin instead
  const navDiffRows = useMemo((): DiffRow[] => {
    const base = diffToggle === 0
      ? activeDiffRows.filter(row => row.type !== 'hunkHeader' && !methodReviewStatus.get(row.method))
      : activeDiffRows.filter(row => row.type !== 'hunkHeader');
    return base;
  }, [diffToggle, activeDiffRows, methodReviewStatus]);

  // Track which rows are the first line of a method block (for right-margin annotation)
  const methodStartRows = useMemo(() => {
    const starts = new Set<number>();
    let prev = '';
    for (let i = 0; i < navDiffRows.length; i++) {
      if (navDiffRows[i].method !== prev) {
        starts.add(i);
        prev = navDiffRows[i].method;
      }
    }
    return starts;
  }, [navDiffRows]);

  // Clamp diffCursor when switching files or mode
  const fullFileLineCount = fullFileLines?.length ?? 0;
  const effectiveDiffLen = diffToggle === 2 && fullFileLineCount > 0 ? fullFileLineCount : navDiffRows.length;
  const safeDiffCursor = Math.min(diffCursor, Math.max(0, effectiveDiffLen - 1));
  useEffect(() => {
    if (safeDiffCursor !== diffCursor && effectiveDiffLen > 0) setDiffCursor(safeDiffCursor);
  }, [safeDiffCursor, diffCursor, effectiveDiffLen]);

  // Current method name: from diff cursor for both diff (panel 1) and context (panel 2).
  // In context panel, diffCursor updates when navigating CHANGES but stays locked
  // when navigating DEPENDS ON / USED BY — so deps don't shuffle while traversing.
  const currentMethodName = useMemo(() => {
    if (panel === 1 || panel === 2) return navDiffRows[safeDiffCursor]?.method ?? null;
    return null;
  }, [panel, safeDiffCursor, navDiffRows]);

  // Method map data — built lazily only when map is open
  const methodMapData = useMemo(() => {
    if (!showMap || !selectedFile) return null;
    const diff = diffs.get(selectedFile);
    const repoName = fileToRepo.get(selectedFile);
    if (!diff || !repoName) return null;
    const graph = data.repoGraph.get(repoName);
    if (!graph) return null;
    const repo = data.repos.find(r => r.name === repoName);
    if (!repo) return null;
    return buildMethodMapData(diff.path, currentMethodName, graph, repo.files, diffs);
  }, [showMap, selectedFile, currentMethodName, data, diffs, fileToRepo]);

  const ctx = useMemo((): ContextData | null => {
    if ((panel === 1 || panel === 2) && activeFile) {
      if (currentMethodName) {
        return getMethodContext(activeFile, currentMethodName, data, diffs, lineReviews);
      }
      return getFileContext(activeFile, data, diffs, lineReviews);
    }
    const item = flatTree[safeIdx];
    if (!item) return null;
    if (item.node.id && diffs.has(item.node.id)) return getFileContext(item.node.id, data, diffs, lineReviews);
    if (item.node.type === 'repo') return getRepoContext(item.node.name, data, diffs, lineReviews);
    if (item.isFolder) return getFolderContext(item.node.name, data, diffs, lineReviews);
    return null;
  }, [safeIdx, flatTree, data, diffs, lineReviews, panel, activeFile, currentMethodName]);

  const ctxTotalItems = useMemo(() => {
    if (!ctx) return 0;
    const filtered = ctx.chunks.filter(c => c.crit >= minCrit);
    const imports = ctx.imports ?? [];
    const usedBy = (ctx.usedBy ?? []).filter(u => u.fileId && diffs.has(u.fileId!));
    return filtered.length + imports.length + usedBy.length;
  }, [ctx, minCrit, diffs]);

  // Auto-sync ctxIdx with current method when diff panel is active
  useEffect(() => {
    if (panel !== 1 || !ctx) return;
    const curRow = navDiffRows[safeDiffCursor];
    if (!curRow) return;
    const filtered = ctx.chunks.filter(c => c.crit >= minCrit);
    const idx = filtered.findIndex(c => c.method === curRow.method);
    if (idx >= 0) setCtxIdx(idx);
  }, [panel, safeDiffCursor, navDiffRows, ctx, minCrit]);

  const branches = data.repos.map(r => r.branch).filter(b => b !== 'develop' && b !== 'main');
  const branchLabel = branches[0] ?? 'HEAD';

  // Mouse scroll — per-panel, disabled when overlays/input are active
  const mouseDisabled = !!(showHelp || showMap || showComments || resetPrompt || inputMode || searchQuery !== null);
  useMouseScroll({
    panelWidths: [treeW, diffW, ctxW],
    disabled: mouseDisabled,
    treeMax: Math.max(0, flatTree.length - 1),
    diffRowCount: effectiveDiffLen,
    diffViewportH: Math.max(1, bodyH - 3),
    ctxMax: Math.max(0, ctxTotalItems - 1),
    setTreeIdx, setDiffScroll, setCtxIdx,
  });

  useNavigation(
    { panel, treeIdx: safeIdx, selectedFile, diffScroll, diffCursor: safeDiffCursor, ctxIdx, minCrit, collapsed, inputMode, searchQuery, showHelp, explorerToggle, diffToggle, focusMode, resetPrompt, showMap, mapNodeIdx, showComments, commentIdx },
    { setPanel, setTreeIdx, setSelectedFile, setDiffScroll, setDiffCursor, setCtxIdx, setMinCrit, setLineFlag, setLineFlagBatch, setBatchMsg: handleBatchMsg, setCollapsed, setInputMode, setSearchQuery, setShowHelp, setExplorerToggle, setDiffToggle, setFocusMode, setResetPrompt, setShowMap, setMapNodeIdx, setShowComments, setCommentIdx, onExport: handleExport, onOpenNotes: handleOpenNotes, onToggleDiffMode: handleToggleDiffMode, onToggleAIScoring: handleToggleAIScoring, onResetReview: handleResetReview, onRescan: triggerRescan, historyPush: history.push, historyGoBack: history.goBack, historyGoForward: history.goForward },
    { flatTree, diffRows: navDiffRows, diffs, ctx, bodyH, lineReviews, fileProgress, methodMapData, commentData, methodReviewStatus, fullFileLineCount },
  );

  // Visible slices
  const visibleTree = flatTree.slice(treeScroll, treeScroll + treeVisibleH);
  const halfDiff = Math.floor((diffW - 3) / 2);
  const visibleDiffRows = navDiffRows.slice(diffScroll, diffScroll + bodyH - 3);

  // Diff panel label — breadcrumb with repo context
  const modeTag = effectiveMode === 'unified' ? 'unified' : 'sbs';
  const diffLabel = useMemo(() => {
    if (!currentDiff) return 'DIFF';
    const repo = activeFile ? fileToRepo.get(activeFile) : null;
    const isMulti = data.repos.length > 1;
    const prefix = isMulti && repo ? `${repo} \u203A ` : '';
    const toggleTag = diffToggle === 0 ? '' : diffToggle === 1 ? ' all' : ' file';
    const fullLabel = `${prefix}${currentDiff.path} (${modeTag}${toggleTag})`;
    const maxLabelW = diffW - 4;
    return fullLabel.length > maxLabelW
      ? '\u2026' + fullLabel.slice(fullLabel.length - maxLabelW + 1)
      : fullLabel;
  }, [currentDiff, activeFile, fileToRepo, data.repos.length, modeTag, diffToggle, diffW]);

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

      {/* 3 Panels */}
      <Box flexDirection="row" height={bodyH}>
        {/* LEFT: Explorer */}
        {!inFocus && (
          <Border label={explorerLabel} color={panel === 0 ? C.accent : C.border} width={treeW} height={bodyH}>
            <Box flexDirection="column" overflow="hidden">
              {flatTree.length === 0 && explorerToggle === 0 ? (
                <Text color={C.dim}> All reviewed. t for all files.</Text>
              ) : (
                <>
                  {visibleTree.map((item, i) => (
                    <TreeRow
                      key={item.id}
                      item={item}
                      isSelected={item.node.id === selectedFile}
                      isFocused={panel === 0 && (treeScroll + i) === safeIdx}
                      isCollapsed={item.isFolder && collapsed.has(item.id)}
                      width={treeW - 2}
                      progress={item.node.id ? fileProgress.get(item.node.id) : folderProgress.get(item.id)}
                    />
                  ))}
                  {flatTree.length > treeVisibleH && (
                    <Text color={C.dim}> {safeIdx + 1}/{flatTree.length}</Text>
                  )}
                </>
              )}
            </Box>
          </Border>
        )}

        {/* CENTER: Diff */}
        <Border
          label={diffLabel}
          color={panel === 1 ? C.accent : C.border}
          width={diffW}
          height={bodyH}
        >
          {diffToggle === 2 && fullFileLines ? (
            <Box flexDirection="column" overflow="hidden">
              {fullFileLines.slice(diffScroll, diffScroll + bodyH - 3).map((line, i) => {
                const isCur = panel === 1 && (diffScroll + i) === safeDiffCursor;
                return (
                  <DLine key={`fl${i}`} line={line} width={diffW - 2} isCursor={isCur} syntaxTheme={syntaxTheme} />
                );
              })}
              {fullFileLineCount > bodyH - 3 && (
                <Text color={C.dim}>
                  {' \u2195 '}{diffScroll + 1}/{fullFileLineCount} ({Math.round((diffScroll / Math.max(1, fullFileLineCount - bodyH + 3)) * 100)}%)
                </Text>
              )}
            </Box>
          ) : currentDiff ? (
            <Box flexDirection="column" overflow="hidden">
              {visibleDiffRows.map((row, i) => {
                const rowIndex = diffScroll + i;
                const lineKey = row.reviewLine ? `${activeFile}:${row.reviewLine.n}` : '';
                const review = lineReviews.get(lineKey);
                const flag = row.reviewLine ? (isReviewValid(review, row.reviewLine.c) ? review?.flag : undefined) : review?.flag;
                const comments = review?.comments ?? [];
                const isCur = panel === 1 && rowIndex === safeDiffCursor;
                const isFlaggable = row.reviewLine && (row.reviewLine.t === 'add' || row.reviewLine.t === 'del');
                const isMethodStart = methodStartRows.has(rowIndex);
                const isNew = isMethodStart && row.label.startsWith('New');

                // Right margin: N + crit(4) + flag(2) = 7 chars
                const rightMargin = (
                  <>
                    {isMethodStart ? (
                      <>
                        <Text color={isNew ? C.cyan : C.dim}>{isNew ? 'N' : ' '}</Text>
                        <Text color={critColor(row.methodCrit)} bold>{row.methodCrit.toFixed(1).padStart(4)}</Text>
                      </>
                    ) : (
                      <Text>{' '.repeat(5)}</Text>
                    )}
                    {isFlaggable ? (
                      <Text color={flag ? (FLAG_COLOR[flag] ?? C.dim) : C.dim}>
                        {flag ? ` ${FLAG_ICON[flag]}` : ' \u25CB'}
                      </Text>
                    ) : (
                      <Text>{'  '}</Text>
                    )}
                  </>
                );

                if (effectiveMode === 'unified') {
                  const line = row.baseLine ?? row.reviewLine ?? null;
                  return (
                    <Box key={`d${i}`} flexDirection="column">
                      <Box>
                        <DLine line={line} width={diffW - 10} isCursor={isCur} flag={flag} syntaxTheme={syntaxTheme} />
                        {rightMargin}
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
                        <DLine line={row.baseLine ?? null} width={halfDiff} isCursor={false} syntaxTheme={syntaxTheme} />
                      </Box>
                      <Text color={C.border}>{'\u2502'}</Text>
                      <Box width={halfDiff - 8}>
                        <DLine line={row.reviewLine ?? null} width={halfDiff - 8} isCursor={isCur} flag={flag} syntaxTheme={syntaxTheme} />
                      </Box>
                      {rightMargin}
                    </Box>
                    {(comments.length > 0 || inputMode?.lineKey === lineKey) && (
                      <CommentRows comments={comments} inputMode={inputMode} lineKey={lineKey} width={diffW} />
                    )}
                  </Box>
                );
              })}
              {navDiffRows.length > bodyH - 3 && (
                <Text color={C.dim}>
                  {' \u2195 '}{diffScroll + 1}/{navDiffRows.length} ({Math.round((diffScroll / Math.max(1, navDiffRows.length - bodyH + 3)) * 100)}%)
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
        {!inFocus && (
          <Border label="CONTEXT" color={panel === 2 ? C.accent : C.border} width={ctxW} height={bodyH}>
            <ContextPanel ctx={ctx} ctxIdx={ctxIdx} isActive={panel === 2} width={ctxW} minCrit={minCrit} diffs={diffs} fileProgress={fileProgress} lineReviews={lineReviews} />
          </Border>
        )}
      </Box>

      {/* Overlays — rendered AFTER panels so they paint on top */}
      {showMap && (methodMapData
        ? <MethodMapOverlay data={methodMapData} width={size.w} height={bodyH} nodeIdx={mapNodeIdx} />
        : <Box position="absolute" marginTop={2} marginLeft={4}><Text backgroundColor="#0a1628" color={C.dim}> No dependency graph available for this file. Press m or Esc to close. </Text></Box>
      )}
      {showComments && commentData && <CommentsOverlay data={commentData} width={size.w} height={bodyH} selectedIdx={commentIdx} />}
      {showHelp && <HelpOverlay width={size.w} height={bodyH} />}

      {/* Status bar */}
      <StatusBar repoCount={data.repos.length} stats={globalStats} sideEffects={sideEffectCount} width={size.w} exportMsg={exportMsg} batchMsg={batchMsg} canGoBack={history.canGoBack} canGoForward={history.canGoForward} aiScoring={aiScoringActive} stale={stale} isScanning={isScanning} explorerToggle={explorerToggle} diffToggle={diffToggle} />
    </Box>
  );
}
