import React from 'react';
import { Box, Text } from 'ink';
import { C, TYPE_ICON } from '../colors.js';
import type { MethodMapData, MethodMapNode } from '../method-map-data.js';
import { getMapNavNodes } from '../method-map-data.js';

const BG = '#0a1628';
const SEP = ' \u2502 '; // ' │ '

interface Props {
  data: MethodMapData;
  width: number;
  height: number;
  nodeIdx: number;
}

// Pad/truncate string to exact length
function rpad(s: string, len: number): string {
  if (s.length >= len) return s.slice(0, len);
  return s + ' '.repeat(len - s.length);
}

function typeTag(fileType: string): string {
  return TYPE_ICON[fileType]?.icon ?? fileType.slice(0, 4);
}

function nodeNameLine(node: MethodMapNode, colW: number, isCurrent: boolean): string {
  const prefix = isCurrent ? '\u25B6 ' : '  ';
  const maxLen = colW - 2;
  const name = node.fileName.length > maxLen
    ? node.fileName.slice(0, maxLen - 1) + '\u2026'
    : node.fileName;
  return rpad(prefix + name, colW);
}

function nodeDetailLine(node: MethodMapNode, colW: number): string {
  const critStr = node.crit !== undefined ? ` ${node.crit.toFixed(1)}` : '';
  const edgeMark = node.edgeType === 'inject' ? ' \u25C6' : '';
  return rpad(`  ${typeTag(node.fileType)}${critStr}${edgeMark}`, colW);
}

interface TriRow {
  left: string; lc: string; lb?: boolean;
  mid: string;  mc: string; mb?: boolean;
  right: string; rc: string; rb?: boolean;
}

function Row({ r, colW, focusColW, totalW }: { r: TriRow; colW: number; focusColW: number; totalW: number }) {
  const used = 1 + colW + SEP.length + focusColW + SEP.length + colW;
  const fill = ' '.repeat(Math.max(0, totalW - used));
  return (
    <Box>
      <Text backgroundColor={BG}>{' '}</Text>
      <Text backgroundColor={BG} color={r.lc} bold={r.lb}>{r.left}</Text>
      <Text backgroundColor={BG} color={C.border}>{SEP}</Text>
      <Text backgroundColor={BG} color={r.mc} bold={r.mb}>{r.mid}</Text>
      <Text backgroundColor={BG} color={C.border}>{SEP}</Text>
      <Text backgroundColor={BG} color={r.rc} bold={r.rb}>{r.right}</Text>
      <Text backgroundColor={BG}>{fill}</Text>
    </Box>
  );
}

function BlankRow({ totalW }: { totalW: number }) {
  return <Text backgroundColor={BG}>{' '.repeat(totalW)}</Text>;
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

  // Layout: 1(margin) + colW + 3(sep) + focusColW + 3(sep) + colW = width
  const colW = Math.max(16, Math.floor((width - 8) / 3));
  const focusColW = Math.max(14, width - 1 - colW * 2 - SEP.length * 2);

  const maxRows = Math.max(1, upNodes.length, downNodes.length);
  const maxVisible = Math.min(maxRows, height - 9);

  // Header
  const title = `METHOD MAP \u00B7 ${data.focus.fileName}${data.focusMethod ? ` \u00B7 ${data.focusMethod}` : ''}`;
  const hStr = title.length > width - 4 ? '\u2026' + title.slice(title.length - (width - 5)) : title;
  const hFill = ' '.repeat(Math.max(0, width - hStr.length - 2));

  const curNode = navNodes[nodeIdx];
  const canJump = !!curNode?.fileId;

  // Focus card: up to 3 lines (name, optionally method, type)
  const focusLines: Array<{ text: string; color: string; bold?: boolean }> = [];
  focusLines.push({ text: rpad(`\u25CF ${data.focus.fileName}`, focusColW), color: C.accent, bold: true });
  if (data.focusMethod) {
    focusLines.push({ text: rpad(` \u0192 ${data.focusMethod}`, focusColW), color: C.purple });
  }
  const focusCritStr = data.focus.crit !== undefined ? ` ${data.focus.crit.toFixed(1)}` : '';
  focusLines.push({ text: rpad(` ${typeTag(data.focus.fileType)}${focusCritStr}`, focusColW), color: C.blue });

  // Separator
  const sepStr = ' ' + '\u2500'.repeat(colW) + '\u2500\u253C\u2500' + '\u2500'.repeat(focusColW) + '\u2500\u253C\u2500' + '\u2500'.repeat(colW);

  // Footer
  const footerParts = [
    navNodes.length > 0 ? ' \u2191\u2193:navigate  ' : ' ',
    canJump ? 'Enter:jump  ' : '',
    'm/Esc:close',
    navNodes.length > 0 ? `  [${nodeIdx + 1}/${navNodes.length}]` : '  [no deps]',
  ];

  return (
    <Box flexDirection="column" position="absolute" marginTop={0} marginLeft={0} width={width}>
      {/* Header bar */}
      <Box>
        <Text backgroundColor={C.accent} color="#ffffff" bold>{` ${hStr} `}</Text>
        <Text backgroundColor={BG}>{hFill}</Text>
      </Box>

      {/* Blank line */}
      <BlankRow totalW={width} />

      {/* Column headers */}
      <Row
        r={{
          left: rpad(`USED BY (${upNodes.length})`, colW),
          lc: C.dim,
          mid: rpad('  FOCUS', focusColW),
          mc: C.accent,
          mb: true,
          right: rpad(`USES (${downNodes.length})`, colW),
          rc: C.dim,
        }}
        colW={colW} focusColW={focusColW} totalW={width}
      />

      {/* Horizontal separator */}
      <Text backgroundColor={BG} color={C.border}>{rpad(sepStr, width)}</Text>

      {/* Content rows — each node = 2 display lines (name + detail) */}
      {Array.from({ length: Math.max(1, maxVisible) }, (_, rowIdx) => {
        const upNode = upNodes[rowIdx];
        const downNode = downNodes[rowIdx];
        const upGIdx = upOffset + rowIdx;
        const downGIdx = downOffset + rowIdx;
        const upCur = !!upNode && upGIdx === nodeIdx;
        const downCur = !!downNode && downGIdx === nodeIdx;

        // Depth-2 separator: dim '···' when we hit the boundary
        const upIsSep = !upNode && rowIdx === upD1.length && upD2.length > 0;
        const downIsSep = !downNode && rowIdx === downD1.length && downD2.length > 0;

        const leftName = upNode
          ? nodeNameLine(upNode, colW, upCur)
          : upIsSep ? rpad(' \u00B7\u00B7\u00B7', colW) : rpad('', colW);
        const leftDetail = upNode ? nodeDetailLine(upNode, colW) : rpad('', colW);
        const rightName = downNode
          ? nodeNameLine(downNode, colW, downCur)
          : downIsSep ? rpad(' \u00B7\u00B7\u00B7', colW) : rpad('', colW);
        const rightDetail = downNode ? nodeDetailLine(downNode, colW) : rpad('', colW);

        const lnc = upNode ? (upCur ? C.accent : (upNode.isChanged ? C.orange : C.text)) : C.border;
        const ldc = upCur ? C.cyan : C.dim;
        const rnc = downNode ? (downCur ? C.accent : (downNode.isChanged ? C.orange : C.text)) : C.border;
        const rdc = downCur ? C.cyan : C.dim;

        // Depth-2 nodes slightly dimmer
        const isUpD2 = upNode && upD1.length > 0 && rowIdx >= upD1.length;
        const isDownD2 = downNode && downD1.length > 0 && rowIdx >= downD1.length;

        const focusNameLine = focusLines[rowIdx * 2] ?? null;
        const focusDetailLine = focusLines[rowIdx * 2 + 1] ?? null;

        return (
          <React.Fragment key={rowIdx}>
            {/* Name line */}
            <Row
              r={{
                left: leftName,
                lc: isUpD2 && !upCur ? C.dim : lnc,
                lb: upCur,
                mid: focusNameLine ? focusNameLine.text : rpad('', focusColW),
                mc: focusNameLine?.color ?? C.dim,
                mb: focusNameLine?.bold,
                right: rightName,
                rc: isDownD2 && !downCur ? C.dim : rnc,
                rb: downCur,
              }}
              colW={colW} focusColW={focusColW} totalW={width}
            />
            {/* Detail line */}
            <Row
              r={{
                left: leftDetail,
                lc: isUpD2 && !upCur ? '#333333' : ldc,
                mid: focusDetailLine ? focusDetailLine.text : rpad('', focusColW),
                mc: focusDetailLine?.color ?? C.dim,
                right: rightDetail,
                rc: isDownD2 && !downCur ? '#333333' : rdc,
              }}
              colW={colW} focusColW={focusColW} totalW={width}
            />
          </React.Fragment>
        );
      })}

      {/* Empty state */}
      {upNodes.length === 0 && downNodes.length === 0 && (
        <Text backgroundColor={BG} color={C.dim}>{rpad('  No file-level dependencies found in repo graph.', width)}</Text>
      )}

      {/* Blank */}
      <BlankRow totalW={width} />

      {/* Footer */}
      <Text backgroundColor={BG} color={C.dim}>{rpad(footerParts.join(''), width)}</Text>
    </Box>
  );
}
