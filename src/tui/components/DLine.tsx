import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor } from '../colors.js';
import type { TuiDiffLine } from '../types.js';

interface DLineProps {
  line: TuiDiffLine | null;
  width: number;
  minCrit: number;
  showCrit: boolean;
}

export function DLine({ line, width, minCrit, showCrit }: DLineProps) {
  if (!line) return <Text color={C.dim}>{' '.repeat(Math.max(0, width))}</Text>;

  const isAdd = line.t === 'add';
  const isDel = line.t === 'del';
  const lineCrit = line.crit ?? 0;
  const aboveThreshold = lineCrit >= minCrit;

  const prefix = isAdd ? '+' : isDel ? '-' : ' ';
  const prefixColor = isAdd ? C.green : isDel ? C.red : C.dim;

  const textColor = line.isSig
    ? C.white
    : isAdd || isDel
      ? aboveThreshold && lineCrit >= 5 ? C.bright : C.text
      : C.dim;

  const lineNum = String(line.n).padStart(3, ' ');
  const code = line.c.slice(0, Math.max(10, width - 12));
  const critStr = showCrit && (isAdd || isDel) && lineCrit >= minCrit && lineCrit > 0
    ? ` ${lineCrit.toFixed(1)}`
    : '';

  return (
    <Box>
      <Text color={C.dim}>{lineNum} </Text>
      <Text color={prefixColor} bold>{prefix}</Text>
      <Text> </Text>
      {line.hiRanges && line.hiRanges.length > 0 ? (
        <Text>
          {renderHighlighted(line.c, line.hiRanges, textColor, isAdd ? C.green : C.red, width - 12)}
        </Text>
      ) : (
        <Text color={textColor} bold={line.isSig}>{code}</Text>
      )}
      {critStr && <Text color={critColor(lineCrit)} bold>{critStr}</Text>}
    </Box>
  );
}

function renderHighlighted(
  text: string,
  ranges: [number, number][],
  baseColor: string,
  hiColor: string,
  maxWidth: number,
): React.ReactNode {
  const clipped = text.slice(0, maxWidth);
  const parts: React.ReactNode[] = [];
  let pos = 0;

  for (const [start, end] of ranges) {
    if (start > pos) {
      parts.push(<Text key={`b${pos}`} color={baseColor}>{clipped.slice(pos, Math.min(start, clipped.length))}</Text>);
    }
    const hiStart = Math.max(pos, start);
    const hiEnd = Math.min(end, clipped.length);
    if (hiStart < hiEnd) {
      parts.push(<Text key={`h${hiStart}`} color={hiColor} bold inverse>{clipped.slice(hiStart, hiEnd)}</Text>);
    }
    pos = end;
  }
  if (pos < clipped.length) {
    parts.push(<Text key={`e${pos}`} color={baseColor}>{clipped.slice(pos)}</Text>);
  }
  return <>{parts}</>;
}
