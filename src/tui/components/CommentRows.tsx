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

export function CommentRows({ comments, inputMode, lineKey, width }: CommentRowsProps) {
  const maxText = Math.max(10, width - 8);
  const isInputHere = inputMode?.lineKey === lineKey;

  return (
    <>
      {comments.map((c, i) => (
        <Box key={`cmt${i}`}>
          <Text color={C.dim}>{' \u2506 '}</Text>
          <Text color={C.purple}>{'\u25C6 '}</Text>
          <Text color={C.text}>{c.text.length > maxText ? c.text.slice(0, maxText - 1) + '\u2026' : c.text}</Text>
        </Box>
      ))}
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
