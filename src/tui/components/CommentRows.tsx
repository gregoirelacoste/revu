// ── Inline comment rows + input prompt ──

import React from 'react';
import { Box, Text } from 'ink';
import { C } from '../colors.js';
import type { LineComment } from '../types.js';
import type { InputMode } from '../hooks/useInputMode.js';

interface CommentRowsProps {
  comments: LineComment[];
  inputMode: InputMode | null;
  lineKey: string;
  width: number;
}

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch { return ''; }
}

export function CommentRows({ comments, inputMode, lineKey, width }: CommentRowsProps) {
  const maxText = Math.max(10, width - 8);
  const isInputHere = inputMode?.lineKey === lineKey;

  return (
    <>
      {comments.map((c, i) => {
        const timeStr = c.time ? formatShortTime(c.time) : '';
        const availW = timeStr ? maxText - timeStr.length - 1 : maxText;
        const txt = c.text.length > availW ? c.text.slice(0, availW - 1) + '\u2026' : c.text;
        return (
          <Box key={`cmt${i}`}>
            <Text color={C.dim}>{' \u2506 '}</Text>
            <Text color={C.purple}>{'\u25C6 '}</Text>
            <Text color={C.text}>{txt}</Text>
            {timeStr && <Text color={C.dim}>{` ${timeStr}`}</Text>}
          </Box>
        );
      })}
      {isInputHere && (
        <Box>
          <Text color={C.dim}>{' \u2506 '}</Text>
          <Text color={C.accent} bold>{'> '}</Text>
          <Text color={C.bright}>{inputMode!.draft}</Text>
          <Text color={C.accent} bold>{'\u2588'}</Text>
          <Text color={C.dim}>{' Enter/Esc'}</Text>
        </Box>
      )}
    </>
  );
}
