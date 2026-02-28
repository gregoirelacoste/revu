import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor, critBg, FLAG_ICON, FLAG_COLOR } from '../colors.js';
import type { TuiDiffLine } from '../types.js';

interface DLineProps {
  line: TuiDiffLine | null;
  width: number;
  minCrit: number;
  showCrit: boolean;
  isCursor?: boolean;
  flag?: string;
}

export function DLine({ line, width, minCrit, showCrit, isCursor, flag }: DLineProps) {
  if (!line) return <Text color={C.dim}>{' '.repeat(Math.max(0, width))}</Text>;

  const isAdd = line.t === 'add';
  const isDel = line.t === 'del';
  const lineCrit = line.crit ?? 0;
  const isChanged = isAdd || isDel;

  // Progressive contrast
  const bgColor = isChanged && lineCrit > 0 ? critBg(lineCrit, isAdd ? 'add' : 'del') : undefined;

  const prefix = isAdd ? '+' : isDel ? '-' : ' ';
  const prefixColor = isAdd ? C.green : isDel ? C.red : C.dim;

  // Text color based on criticality
  const textColor = line.isSig
    ? C.white
    : isChanged
      ? lineCrit >= 7 ? C.white : lineCrit >= 5 ? C.bright : lineCrit >= 2.5 ? C.text : C.dim
      : C.dim;

  // Cursor prefix
  const cursorChar = isCursor ? '\u258C' : line.isSig ? '\u2503' : ' ';
  const cursorColor = isCursor ? C.accent : line.isSig ? C.accent : C.dim;

  const lineNum = String(line.n).padStart(3, ' ');
  const maxCodeLen = Math.max(10, width - 12);
  const isTruncated = line.c.length > maxCodeLen;
  const code = isTruncated ? line.c.slice(0, maxCodeLen - 1) + '\u2026' : line.c;
  const critStr = showCrit && isChanged && lineCrit >= minCrit && lineCrit > 0
    ? ` ${lineCrit.toFixed(1)}`
    : '';

  return (
    <Box>
      <Text color={cursorColor} bold={isCursor || line.isSig}>{cursorChar}</Text>
      <Text color={C.dim}>{lineNum} </Text>
      <Text color={prefixColor} bold>{prefix}</Text>
      <Text> </Text>
      {line.hiRanges && line.hiRanges.length > 0 ? (
        <Text backgroundColor={bgColor}>
          {renderHighlighted(line.c, line.hiRanges, textColor, isAdd ? C.green : C.red, width - 13)}
        </Text>
      ) : (
        <Text color={textColor} bold={line.isSig || (isChanged && lineCrit >= 7)} backgroundColor={bgColor}>{code}</Text>
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
