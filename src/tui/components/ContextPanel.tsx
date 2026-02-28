import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor } from '../colors.js';
import type { ContextData } from '../types.js';

interface ContextPanelProps {
  ctx: ContextData | null;
  ctxIdx: number;
  isActive: boolean;
  width: number;
  minCrit: number;
}

export function ContextPanel({ ctx, ctxIdx, isActive, width, minCrit }: ContextPanelProps) {
  if (!ctx) {
    return <Text color={C.dim}>Hover a file or folder</Text>;
  }

  const filtered = ctx.chunks.filter(c => c.crit >= minCrit);

  return (
    <Box flexDirection="column" overflow="hidden">
      {/* Header */}
      <Box>
        <Text color={critColor(ctx.crit)} bold>{ctx.crit.toFixed(1)}</Text>
        <Text> </Text>
        <Text color={C.white} bold>{ctx.name}</Text>
      </Box>
      <Text color={C.dim}>{ctx.summary}</Text>
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
                {chunk.method}
              </Text>
            </Box>
            <Text color={C.dim}>{'   '}{chunk.label.slice(0, width - 8)}</Text>
          </Box>
        );
      })}

      {/* Used by */}
      {ctx.usedBy && ctx.usedBy.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={C.dim}>{'\u2500'.repeat(Math.max(0, width - 4))}</Text>
          <Text color={C.dim} bold>{' USED BY'}</Text>
          {ctx.usedBy.map((u, i) => (
            <Box key={i} flexDirection="column">
              <Box>
                <Text> </Text>
                <Text color={C.cyan}>{u.file}</Text>
              </Box>
              <Text color={C.dim}>   {u.method}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
