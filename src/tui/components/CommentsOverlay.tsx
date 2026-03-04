// ── Comments overlay — lists bugs, questions & comments grouped by method ──

import React from 'react';
import { Box, Text } from 'ink';
import { C, FLAG_ICON, FLAG_COLOR } from '../colors.js';
import type { CommentListData } from '../comment-data.js';

export interface CommentsOverlayProps {
  data: CommentListData;
  width: number;
  height: number;
  selectedIdx: number;
}

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch { return ''; }
}

export function CommentsOverlay({ data, width, height, selectedIdx }: CommentsOverlayProps) {
  const boxW = Math.min(72, width - 4);
  const padX = Math.max(0, Math.floor((width - boxW) / 2));
  const innerW = boxW - 2;

  // Each entry = 1 line (header) + 1 line per comment → compute total lines
  const entryHeights = data.entries.map(e => 1 + Math.min(e.comments.length, 2));
  const totalLines = entryHeights.reduce((s, h) => s + h, 0);

  // Reserve: title(1) + summary(1) + sep(1) + footer(3) = 6
  const maxVisible = Math.max(3, height - 6);

  // Scroll: find the start entry so selectedIdx is visible
  let visibleLines = 0;
  let scrollStart = 0;
  // First pass: compute cumulative line offset for selectedIdx
  let selectedOffset = 0;
  for (let i = 0; i < selectedIdx && i < data.entries.length; i++) selectedOffset += entryHeights[i];

  // Adjust scroll start so selected entry fits
  if (totalLines <= maxVisible) {
    scrollStart = 0;
  } else {
    // Start roughly so selectedIdx is centered
    let target = selectedOffset - Math.floor(maxVisible / 2);
    target = Math.max(0, Math.min(target, totalLines - maxVisible));
    let cumul = 0;
    for (let i = 0; i < data.entries.length; i++) {
      if (cumul >= target) { scrollStart = i; break; }
      cumul += entryHeights[i];
    }
  }

  // Collect entries that fit in maxVisible lines
  const visible: Array<{ entry: typeof data.entries[0]; globalIdx: number }> = [];
  visibleLines = 0;
  for (let i = scrollStart; i < data.entries.length && visibleLines < maxVisible; i++) {
    visible.push({ entry: data.entries[i], globalIdx: i });
    visibleLines += entryHeights[i];
  }

  const contentH = Math.min(totalLines, maxVisible) + 5; // entries + chrome
  const padY = Math.max(0, Math.floor((height - contentH) / 2));
  const count = data.entries.length;

  return (
    <Box flexDirection="column" position="absolute" marginLeft={0} marginTop={0} width={width} height={height}>
      {/* Vertical centering spacer */}
      {padY > 0 && <Box height={padY} />}
      <Box flexDirection="column" marginLeft={padX} width={boxW}>
      {/* Title */}
      <Box>
        <Text color={C.accent} bold>{'\u250C\u2500 '}</Text>
        <Text color={C.white} bold>{`COMMENTS \u00B7 ${count}`}</Text>
        <Text color={C.accent} bold>{' '}</Text>
        <Text color={C.red} bold>{`\u2717${data.totalBugs}`}</Text>
        <Text> </Text>
        <Text color={C.orange} bold>{`?${data.totalQuestions}`}</Text>
        <Text> </Text>
        <Text color={C.dim}>{`${data.totalComments}c`}</Text>
        <Text color={C.accent} bold>{` ${'\u2500'.repeat(Math.max(0, boxW - count.toString().length - data.totalBugs.toString().length - data.totalQuestions.toString().length - data.totalComments.toString().length - 24))}\u2510`}</Text>
      </Box>

      {/* Sep */}
      <Box>
        <Text color={C.accent}>{'\u251C' + '\u2500'.repeat(boxW - 2) + '\u2524'}</Text>
      </Box>

      {/* Entries or empty */}
      {data.entries.length === 0 ? (
        <Box>
          <Text color={C.accent}>{'\u2502'}</Text>
          <Text color={C.dim}>{' No comments yet. Use c/x/? to flag, n to comment.'.padEnd(innerW)}</Text>
          <Text color={C.accent}>{'\u2502'}</Text>
        </Box>
      ) : (
        visible.map(({ entry, globalIdx }) => {
          const isSel = globalIdx === selectedIdx;
          const icon = FLAG_ICON[entry.flag] ?? ' ';
          const color = FLAG_COLOR[entry.flag] ?? C.dim;
          const cursor = isSel ? '\u25B8' : ' ';

          const label = `${entry.fileName} \u00B7 ${entry.method}`;
          const maxLabel = innerW - 6;
          const trimmed = label.length > maxLabel ? label.slice(0, maxLabel - 1) + '\u2026' : label;

          // Show max 2 comments inline
          const shownComments = entry.comments.slice(0, 2);

          return (
            <Box key={`${entry.fileId}::${entry.method}`} flexDirection="column">
              <Box>
                <Text color={C.accent}>{'\u2502'}</Text>
                <Text color={isSel ? C.accent : C.dim}>{` ${cursor} `}</Text>
                <Text color={color} bold>{icon}</Text>
                <Text color={isSel ? C.white : C.bright}>{` ${trimmed}`}</Text>
                <Text>{' '.repeat(Math.max(1, innerW - trimmed.length - 6))}</Text>
                <Text color={C.accent}>{'\u2502'}</Text>
              </Box>
              {shownComments.map((ct, ci) => {
                const timeStr = ct.time ? formatShortTime(ct.time) : '';
                const timeSuffix = timeStr ? ` ${timeStr}` : '';
                const maxTxt = innerW - 7 - timeSuffix.length;
                const t = ct.text.length > maxTxt ? ct.text.slice(0, maxTxt - 1) + '\u2026' : ct.text;
                return (
                  <Box key={ci}>
                    <Text color={C.accent}>{'\u2502'}</Text>
                    <Text color={C.dim}>{`     \u2514 ${t}`}</Text>
                    {timeStr && <Text color={C.dim}>{` ${timeStr}`}</Text>}
                    <Text>{' '.repeat(Math.max(1, innerW - t.length - 8 - timeSuffix.length))}</Text>
                    <Text color={C.accent}>{'\u2502'}</Text>
                  </Box>
                );
              })}
            </Box>
          );
        })
      )}

      {/* Footer */}
      <Box>
        <Text color={C.accent}>{'\u251C' + '\u2500'.repeat(boxW - 2) + '\u2524'}</Text>
      </Box>
      <Box>
        <Text color={C.accent}>{'\u2502'}</Text>
        <Text color={C.dim}>{' \u2191\u2193:nav  Enter:jump  Esc/l:close'}</Text>
        <Text>{' '.repeat(Math.max(1, innerW - 33))}</Text>
        <Text color={C.accent}>{'\u2502'}</Text>
      </Box>
      <Box>
        <Text color={C.accent} bold>{'\u2514' + '\u2500'.repeat(boxW - 2) + '\u2518'}</Text>
      </Box>
      </Box>
    </Box>
  );
}
