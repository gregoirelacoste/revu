import React from 'react';
import { Box, Text } from 'ink';
import { C, critBar } from '../colors.js';
import type { TuiDiffLine } from '../types.js';

interface DLineProps {
  line: TuiDiffLine | null;
  width: number;
  minCrit: number;
  isCursor?: boolean;
  flag?: string;
}

export function DLine({ line, width, minCrit, isCursor, flag }: DLineProps) {
  if (!line) return <Text color={C.dim}>{' '.repeat(Math.max(0, width))}</Text>;

  const isAdd = line.t === 'add';
  const isDel = line.t === 'del';
  const lineCrit = line.crit ?? 0;
  const isChanged = isAdd || isDel;

  const isReviewed = !!flag;

  // Crit bar — hidden when reviewed
  const bar = !isReviewed && isChanged && lineCrit > 0 ? critBar(lineCrit) : { char: ' ', color: C.dim };

  const prefix = isAdd ? '+' : isDel ? '-' : ' ';
  // Prefix color — dimmed when reviewed
  const prefixColor = isReviewed ? C.dim : isAdd ? C.green : isDel ? C.red : C.dim;
  const textColor = isReviewed
    ? C.dim
    : line.isSig
      ? C.white
      : isChanged
        ? C.white
        : C.dim;

  // Cursor prefix
  const cursorChar = isCursor ? '\u258C' : line.isSig ? '\u2503' : ' ';
  const cursorColor = isCursor ? C.accent : line.isSig ? C.accent : C.dim;

  const lineNum = String(line.n).padStart(3, ' ');
  const maxCodeLen = Math.max(10, width - 8);
  const isTruncated = line.c.length > maxCodeLen;
  const code = isTruncated ? line.c.slice(0, maxCodeLen - 1) + '\u2026' : line.c;

  return (
    <Box>
      <Text color={bar.color}>{bar.char}</Text>
      <Text color={cursorColor} bold={isCursor || line.isSig}>{cursorChar}</Text>
      <Text color={C.dim}>{lineNum} </Text>
      <Text color={prefixColor} bold>{prefix}</Text>
      <Text> </Text>
      {!isReviewed && line.hiRanges && line.hiRanges.length > 0 ? (
        renderHighlighted(line.c, line.hiRanges, C.dim, isAdd ? C.green : C.red, maxCodeLen)
      ) : (
        <Text color={textColor} bold={!isReviewed && (line.isSig || (isChanged && lineCrit >= 7))} dimColor={isReviewed}>{code}</Text>
      )}
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
  const needsTrunc = text.length > maxWidth;
  const clipped = needsTrunc ? text.slice(0, maxWidth - 1) : text;
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
  if (needsTrunc) {
    parts.push(<Text key="trunc" color={baseColor}>{'\u2026'}</Text>);
  }
  return <>{parts}</>;
}
