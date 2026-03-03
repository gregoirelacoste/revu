import React from 'react';
import { Box, Text } from 'ink';
import { C, critBar } from '../colors.js';
import { tokenizeLine, type SyntaxTheme } from '../syntax.js';
import type { TuiDiffLine } from '../types.js';

interface DLineProps {
  line: TuiDiffLine | null;
  width: number;
  isCursor?: boolean;
  flag?: string;
  syntaxTheme?: SyntaxTheme | null;
}

export function DLine({ line, width, isCursor, flag, syntaxTheme }: DLineProps) {
  if (!line) return <Text color={C.dim}>{' '.repeat(Math.max(0, width))}</Text>;

  const isAdd = line.t === 'add';
  const isDel = line.t === 'del';
  const lineCrit = line.crit ?? 0;
  const isChanged = isAdd || isDel;
  const isReviewed = !!flag;

  // Col 0 (1 char): crit indicator or review dot
  // Reviewed+changed → faint · (signals "was changed, now reviewed")
  // Unreviewed+changed → crit bar (risk level)
  // Context → space
  const indicator = isReviewed && isChanged
    ? { char: '\u00B7', color: '#888888' }
    : isChanged && lineCrit > 0
      ? critBar(lineCrit)
      : { char: ' ', color: C.dim };

  const prefix = isAdd ? '+' : isDel ? '-' : ' ';
  const prefixColor = isReviewed ? '#888888' : isAdd ? C.green : isDel ? C.red : C.dim;
  const textColor = isReviewed ? '#888888' : isChanged ? C.white : C.dim;

  // Col 1 (1 char): cursor (▌) or isSig marker (┃) — distinct colors
  // cursor = accent (blue), isSig = purple → visually different
  const cursorChar = isCursor ? '\u258C' : line.isSig ? '\u2503' : ' ';
  const cursorColor = isCursor ? C.accent : line.isSig ? C.purple : C.dim;

  // Background tint for add/del/isSig when not reviewed
  // isSig overrides add (blue > green) — structural signal
  const bg: string | undefined = isReviewed
    ? undefined
    : line.isSig
      ? C.sigBg
      : isAdd
        ? C.addBg
        : isDel
          ? C.delBg
          : undefined;

  const lineNum = String(line.n).padStart(3, ' ');
  const maxCodeLen = Math.max(10, width - 8);
  const isTruncated = line.c.length > maxCodeLen;
  // Pad code to fill width so background extends across the full line
  const rawCode = isTruncated ? line.c.slice(0, maxCodeLen - 1) + '\u2026' : line.c;
  const code = rawCode.padEnd(maxCodeLen, ' ');

  return (
    <Box>
      <Text color={indicator.color} backgroundColor={bg}>{indicator.char}</Text>
      <Text color={cursorColor} bold={isCursor} backgroundColor={bg}>{cursorChar}</Text>
      <Text color={C.dim} backgroundColor={bg}>{lineNum} </Text>
      <Text color={prefixColor} bold backgroundColor={bg}>{prefix}</Text>
      <Text backgroundColor={bg}> </Text>
      {!isReviewed && line.hiRanges && line.hiRanges.length > 0 ? (
        renderHighlighted(line.c, line.hiRanges, textColor, isAdd ? C.green : C.red, maxCodeLen, bg)
      ) : !isReviewed && syntaxTheme ? (
        renderSyntax(line.c, maxCodeLen, bg, syntaxTheme, textColor, !!line.isSig)
      ) : (
        <Text color={textColor} bold={!isReviewed && line.isSig} backgroundColor={bg}>{code}</Text>
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
  bg: string | undefined,
): React.ReactNode {
  const needsTrunc = text.length > maxWidth;
  const clipped = needsTrunc ? text.slice(0, maxWidth - 1) : text;
  const parts: React.ReactNode[] = [];
  let pos = 0;

  for (const [start, end] of ranges) {
    if (start > pos) {
      parts.push(<Text key={`b${pos}`} color={baseColor} backgroundColor={bg}>{clipped.slice(pos, Math.min(start, clipped.length))}</Text>);
    }
    const hiStart = Math.max(pos, start);
    const hiEnd = Math.min(end, clipped.length);
    if (hiStart < hiEnd) {
      parts.push(<Text key={`h${hiStart}`} color={hiColor} bold underline backgroundColor={bg}>{clipped.slice(hiStart, hiEnd)}</Text>);
    }
    pos = end;
  }
  if (pos < clipped.length) {
    parts.push(<Text key={`e${pos}`} color={baseColor} backgroundColor={bg}>{clipped.slice(pos)}</Text>);
  }
  if (needsTrunc) {
    parts.push(<Text key="trunc" color={baseColor} backgroundColor={bg}>{'\u2026'}</Text>);
  } else if (clipped.length < maxWidth) {
    parts.push(<Text key="pad" backgroundColor={bg}>{' '.repeat(maxWidth - clipped.length)}</Text>);
  }
  return <>{parts}</>;
}

function renderSyntax(
  text: string, maxWidth: number, bg: string | undefined,
  theme: SyntaxTheme, fallback: string, isSig: boolean,
): React.ReactNode {
  const needsTrunc = text.length > maxWidth;
  const clipped = needsTrunc ? text.slice(0, maxWidth - 1) : text;
  const tokens = tokenizeLine(clipped);
  const parts: React.ReactNode[] = tokens.map((tok, i) => {
    const color = theme[tok.type] || fallback;
    return <Text key={i} color={color} bold={isSig} backgroundColor={bg}>{tok.text}</Text>;
  });
  if (needsTrunc) {
    parts.push(<Text key="t" color={fallback} backgroundColor={bg}>{'\u2026'}</Text>);
  } else if (clipped.length < maxWidth) {
    parts.push(<Text key="p" backgroundColor={bg}>{' '.repeat(maxWidth - clipped.length)}</Text>);
  }
  return <>{parts}</>;
}
