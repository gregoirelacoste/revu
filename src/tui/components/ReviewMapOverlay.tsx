// ── Review Map overlay — radial mind map of the review ──

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { C } from '../colors.js';
import { buildMapData } from '../map-data.js';
import { buildMapGrid, type Cell } from '../map-layout.js';
import type { ScanResult } from '../../core/engine.js';
import type { TuiFileDiff, ReviewStats } from '../types.js';
import type { LineReview } from '../hooks/useReview.js';

interface ReviewMapOverlayProps {
  data: ScanResult;
  diffs: Map<string, TuiFileDiff>;
  lineReviews: Map<string, LineReview>;
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>;
  stats: ReviewStats;
  width: number;
  height: number;
  mapIdx: number;
}

// Render a grid row as colored Text spans (group adjacent same-style cells)
function GridRow({ cells }: { cells: Cell[] }) {
  if (cells.length === 0) return <Text>{' '}</Text>;
  const spans: Array<{ text: string; fg?: string; bold?: boolean }> = [];
  for (const cell of cells) {
    const last = spans[spans.length - 1];
    if (last && last.fg === cell.fg && (last.bold ?? false) === (cell.bold ?? false)) {
      last.text += cell.ch;
    } else {
      spans.push({ text: cell.ch, fg: cell.fg, bold: cell.bold });
    }
  }
  return (
    <Box>
      {spans.map((s, i) => <Text key={i} color={s.fg} bold={s.bold}>{s.text}</Text>)}
    </Box>
  );
}

export function ReviewMapOverlay({
  data, diffs, lineReviews, fileProgress, stats, width, height, mapIdx,
}: ReviewMapOverlayProps) {
  const mapData = useMemo(
    () => buildMapData(data, diffs, lineReviews, fileProgress),
    [data, diffs, lineReviews, fileProgress],
  );

  const iw = width - 2; // inner width (between │ borders)
  const gridH = Math.max(3, height - 3); // reserve: title + dashboard + footer

  const grid = useMemo(
    () => buildMapGrid(mapData, iw, gridH, mapIdx),
    [mapData, iw, gridH, mapIdx],
  );

  // Dashboard bar
  const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
  const barLen = Math.min(20, Math.floor(iw * 0.2));
  const filled = Math.round(barLen * pct / 100);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
  const dash = ` ${pct}%  \u2713${stats.reviewed} \u2717${stats.bugs} ?${stats.questions}  ${mapData.repoOrder.length} repo \u00B7 ${mapData.nodes.length} files`;
  const dashPad = Math.max(0, iw - bar.length - 1 - dash.length);

  return (
    <Box flexDirection="column" position="absolute" marginLeft={0} marginTop={0} width={width}>
      {/* Title */}
      <Text color={C.accent} bold>{'\u250C\u2500 REVIEW MAP ' + '\u2500'.repeat(Math.max(0, width - 15)) + '\u2510'}</Text>

      {/* Dashboard */}
      <Box>
        <Text color={C.accent}>{'\u2502'}</Text>
        <Text color={pct >= 80 ? C.green : pct >= 40 ? C.orange : C.red}>{` ${bar}`}</Text>
        <Text color={C.bright}>{dash}</Text>
        <Text>{' '.repeat(dashPad)}</Text>
        <Text color={C.accent}>{'\u2502'}</Text>
      </Box>

      {/* Radial grid */}
      {grid.map((row, i) => (
        <Box key={i}>
          <Text color={C.accent}>{'\u2502'}</Text>
          <GridRow cells={row} />
          <Text color={C.accent}>{'\u2502'}</Text>
        </Box>
      ))}

      {/* Footer */}
      <Text color={C.accent} bold>{'\u2514\u2500 \u2191\u2193nav Enter:jump n:next m:close ' + '\u2500'.repeat(Math.max(0, width - 40)) + '\u2518'}</Text>
    </Box>
  );
}
