import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor, TYPE_ICON } from '../colors.js';
import type { ContextData, TuiFileDiff } from '../types.js';

interface ContextPanelProps {
  ctx: ContextData | null;
  ctxIdx: number;
  isActive: boolean;
  width: number;
  minCrit: number;
  diffs: Map<string, TuiFileDiff>;
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>;
}

export function ContextPanel({ ctx, ctxIdx, isActive, width, minCrit, diffs, fileProgress }: ContextPanelProps) {
  if (!ctx) {
    return <Text color={C.dim}>Hover a file or folder</Text>;
  }

  const filtered = ctx.chunks.filter(c => c.crit >= minCrit);
  const navImports = (ctx.imports ?? []).filter(imp => imp.fileId && diffs.has(imp.fileId));
  const allImports = ctx.imports ?? [];
  const stats = ctx.reviewStats;

  return (
    <Box flexDirection="column" overflow="hidden">
      {/* Header */}
      <Box>
        <Text color={critColor(ctx.crit)} bold>{ctx.crit.toFixed(1)}</Text>
        <Text> </Text>
        <Text color={C.white} bold>
          {ctx.name.length > width - 8
            ? ctx.name.slice(0, width - 9) + '\u2026'
            : ctx.name}
        </Text>
      </Box>
      <Text color={C.dim}>
        {ctx.summary.length > width - 4
          ? ctx.summary.slice(0, width - 5) + '\u2026'
          : ctx.summary}
      </Text>

      {/* Review stats */}
      {stats && stats.total > 0 && (
        <Box>
          <Text color={C.green}>{'\u2713 '}{stats.reviewed}/{stats.total}</Text>
          {stats.bugs > 0 && <Text color={C.red}>{' \u2717 '}{stats.bugs}</Text>}
          {stats.questions > 0 && <Text color={C.orange}>{' ? '}{stats.questions}</Text>}
          {stats.comments > 0 && <Text color={C.cyan}>{' \uD83D\uDCAC '}{stats.comments}</Text>}
        </Box>
      )}

      <Text color={C.dim}>{'\u2500'.repeat(Math.max(0, width - 4))}</Text>

      {/* Chunks */}
      <Text color={C.dim} bold>
        {' CHANGES '}({filtered.length}/{ctx.chunks.length})
      </Text>
      {filtered.map((chunk, i) => {
        const isFoc = isActive && i === ctxIdx;
        return (
          <Box key={i} flexDirection="column">
            <Box>
              <Text color={isFoc ? C.accent : C.dim}>{isFoc ? '\u25B6' : ' '}</Text>
              <Text color={critColor(chunk.crit)} bold>{chunk.crit.toFixed(1)}</Text>
              <Text> </Text>
              <Text color={isFoc ? C.white : C.bright} bold={isFoc}>
                {chunk.method.length > width - 10
                  ? chunk.method.slice(0, width - 11) + '\u2026'
                  : chunk.method}
              </Text>
            </Box>
            <Text color={C.dim}>{'   '}{chunk.label.length > width - 8
              ? chunk.label.slice(0, width - 9) + '\u2026'
              : chunk.label}</Text>
          </Box>
        );
      })}

      {/* Imports */}
      {allImports.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={C.dim}>{'\u2500'.repeat(Math.max(0, width - 4))}</Text>
          <Text color={C.dim} bold>{' IMPORTS '}({allImports.length})</Text>
          {allImports.map((imp, i) => {
            const navIdx = filtered.length + i;
            const isFoc = isActive && navIdx === ctxIdx;
            const hasLink = !!(imp.fileId && diffs.has(imp.fileId));
            const targetDiff = imp.fileId ? diffs.get(imp.fileId) : undefined;
            const typeInfo = targetDiff ? TYPE_ICON[targetDiff.type] : undefined;
            const typeIcon = typeInfo?.icon ?? (imp.type === 'inject' ? 'S' : '\u00B7');
            const typeColor = typeInfo?.color ?? C.dim;
            const progress = imp.fileId ? fileProgress.get(imp.fileId) : undefined;
            const isDone = progress === 'complete';
            return (
              <Box key={i}>
                <Text color={isFoc ? C.accent : C.dim}>{isFoc ? '\u25B6' : ' '}</Text>
                <Text color={typeColor} bold>{typeIcon}</Text>
                <Text> </Text>
                <Text color={isDone ? C.dim : isFoc ? C.white : hasLink ? C.cyan : C.dim}>
                  {imp.name.length > width - 12
                    ? imp.name.slice(0, width - 13) + '\u2026'
                    : imp.name}
                </Text>
                {progress === 'complete' && <Text color={C.green}>{' \u2713'}</Text>}
                {progress === 'partial' && <Text color={C.orange}>{' \u25D0'}</Text>}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Used by */}
      {ctx.usedBy && ctx.usedBy.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={C.dim}>{'\u2500'.repeat(Math.max(0, width - 4))}</Text>
          <Text color={C.dim} bold>{' USED BY'}</Text>
          {ctx.usedBy.map((u, i) => {
            const navIdx = filtered.length + allImports.length + i;
            const isFoc = isActive && navIdx === ctxIdx;
            const hasLink = !!(u.fileId && diffs.has(u.fileId));
            const progress = u.fileId ? fileProgress.get(u.fileId) : undefined;
            const isDone = progress === 'complete';
            return (
              <Box key={i} flexDirection="column">
                <Box>
                  <Text color={isFoc ? C.accent : C.dim}>{isFoc ? '\u25B6' : ' '}</Text>
                  <Text color={isDone ? C.dim : isFoc ? C.white : hasLink ? C.cyan : C.dim}>
                    {u.file.length > width - 7
                      ? u.file.slice(0, width - 8) + '\u2026'
                      : u.file}
                  </Text>
                  {progress === 'complete' && <Text color={C.green}>{' \u2713'}</Text>}
                  {progress === 'partial' && <Text color={C.orange}>{' \u25D0'}</Text>}
                </Box>
                <Text color={C.dim}>   {u.method.length > width - 7
                  ? u.method.slice(0, width - 8) + '\u2026'
                  : u.method}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Side-effects */}
      {ctx.sideEffects && ctx.sideEffects.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={C.dim}>{'\u2500'.repeat(Math.max(0, width - 4))}</Text>
          <Text color={C.orange} bold>{' \u26A1 SIDE-EFFECTS'}</Text>
          {ctx.sideEffects.map((se, i) => (
            <Box key={i} flexDirection="column">
              <Box>
                <Text> </Text>
                <Text color={C.orange}>
                  {se.sourceFile.length > width - 5
                    ? se.sourceFile.slice(0, width - 6) + '\u2026'
                    : se.sourceFile}
                </Text>
              </Box>
              <Text color={C.dim}>   {se.method} ({se.via})</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
