// ── Focus Mode: file dependency map with box layout ──

import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor, TYPE_ICON } from '../colors.js';
import type { MethodMapData, MethodMapNode } from '../method-map-data.js';
import { getMapNavNodes } from '../method-map-data.js';

const BG = '#0a1628';

interface Props {
  data: MethodMapData;
  width: number;
  height: number;
  nodeIdx: number;
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

function typeTag(fileType: string): string {
  return TYPE_ICON[fileType]?.icon ?? fileType.slice(0, 4);
}

function typeColor(fileType: string): string {
  return TYPE_ICON[fileType]?.color ?? C.dim;
}

// ── Small node box (upstream/downstream) ──
function NodeBox({ node, isCur, boxW }: { node: MethodMapNode; isCur: boolean; boxW: number }) {
  const innerW = boxW - 2;
  const borderColor = isCur ? C.accent : C.border;
  const nameMax = innerW - 6;
  const name = node.fileName.length > nameMax ? node.fileName.slice(0, nameMax - 1) + '\u2026' : node.fileName;
  const critStr = node.crit !== undefined ? node.crit.toFixed(1) : '';
  const edgeMark = node.edgeType === 'inject' ? '\u25C6' : '';
  const changedMark = node.isChanged ? '\u25CF' : '';

  return (
    <Box flexDirection="column">
      <Text backgroundColor={BG} color={borderColor}>
        {'\u250C'}{'\u2500'.repeat(innerW)}{'\u2510'}
      </Text>
      <Box>
        <Text backgroundColor={BG} color={borderColor}>{'\u2502'}</Text>
        <Text backgroundColor={BG} color={isCur ? C.accent : typeColor(node.fileType)} bold={isCur}>
          {isCur ? '\u25B6' : typeTag(node.fileType)}
        </Text>
        <Text backgroundColor={BG} color={isCur ? C.white : (node.isChanged ? C.orange : C.text)} bold={isCur}>
          {' '}{pad(name, nameMax)}
        </Text>
        <Text backgroundColor={BG} color={borderColor}>{'\u2502'}</Text>
      </Box>
      <Box>
        <Text backgroundColor={BG} color={borderColor}>{'\u2502'}</Text>
        <Text backgroundColor={BG} color={node.isChanged ? C.orange : C.dim}>{changedMark ? ` ${changedMark}` : '  '}</Text>
        <Text backgroundColor={BG} color={critColor(node.crit ?? 0)}>{critStr.padStart(4)}</Text>
        <Text backgroundColor={BG} color={C.purple}>{edgeMark ? ` ${edgeMark}` : '  '}</Text>
        <Text backgroundColor={BG}>{' '.repeat(Math.max(0, innerW - 8))}</Text>
        <Text backgroundColor={BG} color={borderColor}>{'\u2502'}</Text>
      </Box>
      <Text backgroundColor={BG} color={borderColor}>
        {'\u2514'}{'\u2500'.repeat(innerW)}{'\u2518'}
      </Text>
    </Box>
  );
}

// ── Focus node (center, large box) ──
function FocusBox({ data, focusColW }: { data: MethodMapData; focusColW: number }) {
  const innerW = focusColW - 2;
  const nameMax = innerW - 2;
  const name = data.focus.fileName.length > nameMax
    ? data.focus.fileName.slice(0, nameMax - 1) + '\u2026'
    : data.focus.fileName;
  const critStr = data.focus.crit !== undefined ? data.focus.crit.toFixed(1) : '';

  return (
    <Box flexDirection="column">
      <Text backgroundColor={BG} color={C.accent}>
        {'\u250C'}{'\u2500'.repeat(innerW)}{'\u2510'}
      </Text>
      <Box>
        <Text backgroundColor={BG} color={C.accent}>{'\u2502'}</Text>
        <Text backgroundColor={BG} color={C.accent} bold>{' \u25CF '}{pad(name, innerW - 3)}</Text>
        <Text backgroundColor={BG} color={C.accent}>{'\u2502'}</Text>
      </Box>
      {data.focusMethod && (
        <Box>
          <Text backgroundColor={BG} color={C.accent}>{'\u2502'}</Text>
          <Text backgroundColor={BG} color={C.purple}>{' \u0192 '}{pad(data.focusMethod, innerW - 3)}</Text>
          <Text backgroundColor={BG} color={C.accent}>{'\u2502'}</Text>
        </Box>
      )}
      <Box>
        <Text backgroundColor={BG} color={C.accent}>{'\u2502'}</Text>
        <Text backgroundColor={BG} color={typeColor(data.focus.fileType)}>{' '}{typeTag(data.focus.fileType)}</Text>
        <Text backgroundColor={BG} color={critColor(data.focus.crit ?? 0)}>{' '}{critStr}</Text>
        <Text backgroundColor={BG}>{' '.repeat(Math.max(0, innerW - critStr.length - 4))}</Text>
        <Text backgroundColor={BG} color={C.accent}>{'\u2502'}</Text>
      </Box>
      <Text backgroundColor={BG} color={C.accent}>
        {'\u2514'}{'\u2500'.repeat(innerW)}{'\u2518'}
      </Text>
    </Box>
  );
}

// ── Arrow connectors ──
function Arrow({ dir, inject, w }: { dir: 'left' | 'right'; inject: boolean; w: number }) {
  const arrowW = Math.max(3, w);
  if (dir === 'left') {
    const line = '\u2500'.repeat(arrowW - 1);
    return (
      <Text backgroundColor={BG} color={inject ? C.purple : C.border}>
        {inject ? '\u25C6' : ' '}{line}{'\u25B6'}
      </Text>
    );
  }
  const line = '\u2500'.repeat(arrowW - 1);
  return (
    <Text backgroundColor={BG} color={inject ? C.purple : C.border}>
      {'\u25C0'}{line}{inject ? '\u25C6' : ' '}
    </Text>
  );
}

export function MethodMapOverlay({ data, width, height, nodeIdx }: Props) {
  const navNodes = getMapNavNodes(data);
  const upD1 = data.upstream[0] ?? [];
  const upD2 = data.upstream[1] ?? [];
  const downD1 = data.downstream[0] ?? [];
  const downD2 = data.downstream[1] ?? [];
  const upNodes = [...upD1, ...upD2];
  const downNodes = [...downD1, ...downD2];

  const upOffset = 0;
  const downOffset = upNodes.length;

  // Layout: colW(side) + arrowW + focusColW + arrowW + colW(side)
  const arrowW = 4;
  const colW = Math.max(18, Math.floor((width - arrowW * 2 - 2) / 3));
  const focusColW = Math.max(16, width - colW * 2 - arrowW * 2 - 2);

  const maxRows = Math.max(1, upNodes.length, downNodes.length);
  const maxVisible = Math.min(maxRows, Math.floor((height - 6) / 4));

  // Header
  const title = `FOCUS \u00B7 ${data.focus.fileName}${data.focusMethod ? ` \u00B7 ${data.focusMethod}` : ''} \u00B7 ${(data.focus.crit ?? 0).toFixed(1)}`;
  const hStr = title.length > width - 4 ? '\u2026' + title.slice(title.length - (width - 5)) : title;
  const hFill = ' '.repeat(Math.max(0, width - hStr.length - 2));

  const curNode = navNodes[nodeIdx];
  const canJump = !!curNode?.fileId;

  // Footer
  const footerParts = [
    navNodes.length > 0 ? ' \u2191\u2193:select  ' : ' ',
    canJump ? 'Enter:jump  ' : '',
    'Tab:overview  Esc:close',
    navNodes.length > 0 ? `  [${nodeIdx + 1}/${navNodes.length}]` : '  [no deps]',
  ];

  // Build content lines, then fill remaining height
  const contentLines: React.ReactNode[] = [];

  // Header
  contentLines.push(
    <Box key="hdr" width={width}>
      <Text backgroundColor={C.accent} color="#ffffff" bold>{` ${hStr} `}</Text>
      <Text backgroundColor={BG}>{hFill}</Text>
    </Box>
  );

  // Column headers
  contentLines.push(
    <Box key="cols" width={width}>
      <Text backgroundColor={BG} color={C.dim}>{pad(` USED BY (${upNodes.length})`, colW)}</Text>
      <Text backgroundColor={BG}>{' '.repeat(arrowW)}</Text>
      <Text backgroundColor={BG} color={C.accent} bold>{pad(' FOCUS', focusColW)}</Text>
      <Text backgroundColor={BG}>{' '.repeat(arrowW)}</Text>
      <Text backgroundColor={BG} color={C.dim}>{pad(` USES (${downNodes.length})`, colW)}</Text>
    </Box>
  );

  // Content rows
  for (let rowIdx = 0; rowIdx < Math.max(1, maxVisible); rowIdx++) {
    const upNode = upNodes[rowIdx];
    const downNode = downNodes[rowIdx];
    const upCur = !!upNode && (upOffset + rowIdx) === nodeIdx;
    const downCur = !!downNode && (downOffset + rowIdx) === nodeIdx;
    const showFocus = rowIdx === 0;

    contentLines.push(
      <Box key={`r${rowIdx}`} flexDirection="row" alignItems="center" width={width}>
        <Box width={colW}>
          {upNode ? <NodeBox node={upNode} isCur={upCur} boxW={colW} /> : <Text backgroundColor={BG}>{' '.repeat(colW)}</Text>}
        </Box>
        <Box width={arrowW} justifyContent="center">
          {upNode ? <Arrow dir="left" inject={upNode.edgeType === 'inject'} w={arrowW} /> : <Text backgroundColor={BG}>{' '.repeat(arrowW)}</Text>}
        </Box>
        <Box width={focusColW}>
          {showFocus ? <FocusBox data={data} focusColW={focusColW} /> : <Text backgroundColor={BG}>{' '.repeat(focusColW)}</Text>}
        </Box>
        <Box width={arrowW} justifyContent="center">
          {downNode ? <Arrow dir="right" inject={downNode.edgeType === 'inject'} w={arrowW} /> : <Text backgroundColor={BG}>{' '.repeat(arrowW)}</Text>}
        </Box>
        <Box width={colW}>
          {downNode ? <NodeBox node={downNode} isCur={downCur} boxW={colW} /> : <Text backgroundColor={BG}>{' '.repeat(colW)}</Text>}
        </Box>
      </Box>
    );
  }

  // Empty state
  if (upNodes.length === 0 && downNodes.length === 0) {
    contentLines.push(<Text key="empty" backgroundColor={BG} color={C.dim}>{pad('  No file-level dependencies found in repo graph.', width)}</Text>);
  }

  // Footer
  contentLines.push(<Text key="foot" backgroundColor={BG} color={C.dim}>{pad(footerParts.join(''), width)}</Text>);

  // Fill remaining height for opaque background
  for (let i = contentLines.length; i < height; i++) {
    contentLines.push(<Text key={`bg${i}`} backgroundColor={BG}>{' '.repeat(width)}</Text>);
  }

  return (
    <Box flexDirection="column" position="absolute" marginTop={0} marginLeft={0} width={width} height={height}>
      {contentLines}
    </Box>
  );
}
