import React from 'react';
import { Box, Text } from 'ink';
import { C } from '../colors.js';
import type { ReviewStats } from '../types.js';

interface StatusBarProps {
  repoCount: number;
  stats: ReviewStats;
  sideEffects: number;
  width: number;
  exportMsg?: string | null;
  batchMsg?: string | null;
  canGoBack?: boolean;
  canGoForward?: boolean;
  aiScoring?: boolean;
  stale?: boolean;
  isScanning?: boolean;
}

const HINTS = 'Tab:\u21E5 \u2191\u2193:nav {/}:hunk c:ok x:bug ?:flag s:mode [/]:crit /:search n:next r:reload h:help q:quit';

export function StatusBar({ repoCount, stats, sideEffects, width, exportMsg, batchMsg, canGoBack, canGoForward, aiScoring, stale, isScanning }: StatusBarProps) {
  const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;

  const repoStr = ` ${repoCount} repo(s) `;
  const statsStr = ` \u2713 ${stats.reviewed}/${stats.total} (${pct}%)`;
  const bugsStr = stats.bugs > 0 ? ` \u2717 ${stats.bugs}` : '';
  const questStr = stats.questions > 0 ? ` ? ${stats.questions}` : '';
  const commentStr = stats.comments > 0 ? ` \uD83D\uDCAC ${stats.comments}` : '';
  const sideEffStr = sideEffects > 0 ? ` \u26A1 ${sideEffects}` : '';
  const histStr = (canGoBack || canGoForward) ? ` ${canGoBack ? '\u25C0' : '\u25C1'}${canGoForward ? '\u25B6' : '\u25B7'}` : '';
  const exportStr = exportMsg ? ` \u2714 ${exportMsg}` : '';
  const batchStr = batchMsg ? ` \u26A1 ${batchMsg}` : '';
  const aiStr = aiScoring ? ' [AI]' : '';
  const liveStr = isScanning ? ' scanning\u2026' : ' [LIVE]';
  const staleStr = stale ? ' \u26A0stale' : '';
  const sep = ' \u2502 ';

  // Right section: batchMsg replaces hints when active, exportMsg replaces stats
  const rightSection = batchMsg ? batchStr : HINTS;
  const leftStats = exportMsg
    ? exportStr
    : statsStr + bugsStr + questStr + commentStr + sideEffStr + histStr + aiStr + liveStr + staleStr;

  const usedWidth = repoStr.length + leftStats.length + sep.length + rightSection.length;
  const fillLen = Math.max(0, width - usedWidth);

  return (
    <Box height={1} width={width}>
      <Text backgroundColor={C.accent} color="#ffffff">{repoStr}</Text>
      {exportMsg ? (
        <Text backgroundColor="#3c3c3c" color={C.green} bold>{exportStr}</Text>
      ) : (
        <>
          <Text backgroundColor="#3c3c3c" color={C.green}>{statsStr}</Text>
          {stats.bugs > 0 && <Text backgroundColor="#3c3c3c" color={C.red}>{bugsStr}</Text>}
          {stats.questions > 0 && <Text backgroundColor="#3c3c3c" color={C.orange}>{questStr}</Text>}
          {stats.comments > 0 && <Text backgroundColor="#3c3c3c" color={C.cyan}>{commentStr}</Text>}
          {sideEffects > 0 && <Text backgroundColor="#3c3c3c" color={C.orange}>{sideEffStr}</Text>}
          {(canGoBack || canGoForward) && <Text backgroundColor="#3c3c3c" color={C.cyan}>{histStr}</Text>}
          {aiScoring && <Text backgroundColor="#3c3c3c" color={C.cyan} bold>{aiStr}</Text>}
          <Text backgroundColor="#3c3c3c" color={isScanning ? C.cyan : C.green}>{liveStr}</Text>
          {stale && <Text backgroundColor="#3c3c3c" color={C.orange}>{staleStr}</Text>}
        </>
      )}
      <Text backgroundColor="#3c3c3c" color={C.dim}>{sep}</Text>
      {batchMsg ? (
        <Text backgroundColor="#3c3c3c" color={C.green} bold>{batchStr}</Text>
      ) : (
        <Text backgroundColor="#3c3c3c" color={C.dim}>{HINTS}</Text>
      )}
      <Text backgroundColor="#3c3c3c" color={C.dim}>{'\u2500'.repeat(fillLen)}</Text>
    </Box>
  );
}
