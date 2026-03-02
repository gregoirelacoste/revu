// ── Review Map overlay v2 — spatial graph + detail strip ──

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { C, critColor, TYPE_ICON } from '../colors.js';
import { buildSpatialGrid, type Cell } from '../map-layout.js';
import type { ClusterMapData, ClusterFile } from '../cluster-data.js';
import type { ReviewStats } from '../types.js';

export interface ReviewMapOverlayProps {
  clusterData: ClusterMapData;
  stats: ReviewStats;
  width: number;
  height: number;
  clusterIdx: number;
  fileIdx: number;
  mapFocus: 'graph' | 'detail';
}

// Render a grid row as colored Text spans
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

// ── Detail strip: files of selected cluster ──

function FileChip({ f, selected, maxW }: { f: ClusterFile; selected: boolean; maxW: number }) {
  const ti = TYPE_ICON[f.type] ?? TYPE_ICON.unknown;
  const pi = f.progress === 'complete' ? '\u2713' : f.progress === 'partial' ? '\u25D0' : ' ';
  const pc = f.progress === 'complete' ? C.green : f.progress === 'partial' ? C.orange : C.dim;
  const shortName = f.name.replace(/\.[^.]+$/, '');
  const nameW = maxW - 8;
  const nm = shortName.length > nameW ? shortName.slice(0, nameW - 1) + '\u2026' : shortName;
  const sel = selected ? C.accent : undefined;

  return (
    <Box>
      <Text color={sel} bold={selected}>{selected ? '\u25B8' : ' '}</Text>
      <Text color={ti.color} bold>{ti.icon}</Text>
      <Text> </Text>
      <Text color={sel ?? C.text}>{nm}</Text>
      <Text> </Text>
      <Text color={critColor(f.crit)} bold>{f.crit.toFixed(1)}</Text>
      <Text> </Text>
      <Text color={pc}>{pi}</Text>
    </Box>
  );
}

function DetailStrip({
  cd, clusterIdx, fileIdx, width, maxLines, focusDetail,
}: {
  cd: ClusterMapData; clusterIdx: number; fileIdx: number;
  width: number; maxLines: number; focusDetail: boolean;
}) {
  const cluster = cd.clusters[clusterIdx];
  if (!cluster) return <Text color={C.dim}>No cluster selected</Text>;

  const iw = width - 4;
  const title = `${cluster.name} \u00B7 ${cluster.files.length} files`;
  const titlePad = Math.max(0, iw - title.length - 4);

  // Group files by repo
  const byRepo = new Map<string, ClusterFile[]>();
  for (const f of cluster.files) {
    if (!byRepo.has(f.repo)) byRepo.set(f.repo, []);
    byRepo.get(f.repo)!.push(f);
  }
  const repos = [...byRepo.keys()].sort();
  const multiRepo = repos.length > 1;

  if (!focusDetail) {
    // Compact strip: single line of file chips
    const chipW = Math.max(16, Math.floor(iw / Math.min(6, cluster.files.length)));
    return (
      <Box flexDirection="column">
        <Text color={C.accent}>{'\u2500\u2500 '}<Text bold>{title}</Text>{' ' + '\u2500'.repeat(titlePad)}</Text>
        <Box flexWrap="wrap">
          {cluster.files.slice(0, Math.floor(iw / chipW) * Math.max(1, maxLines - 1)).map((f, i) => (
            <Box key={f.fileId} width={chipW}>
              <FileChip f={f} selected={false} maxW={chipW} />
            </Box>
          ))}
          {cluster.files.length > Math.floor(iw / chipW) * Math.max(1, maxLines - 1) && (
            <Text color={C.dim}> +{cluster.files.length - Math.floor(iw / chipW) * Math.max(1, maxLines - 1)}</Text>
          )}
        </Box>
      </Box>
    );
  }

  // Expanded detail: full file list grouped by repo
  const chipW = Math.max(18, Math.floor(iw / Math.min(4, cluster.files.length)));
  let globalFileIdx = 0;

  return (
    <Box flexDirection="column">
      <Text color={C.accent}>{'\u2500\u2500 '}<Text bold>{title}</Text>{multiRepo ? ` \u00B7 ${repos.join(', ')}` : ''}{' ' + '\u2500'.repeat(Math.max(0, titlePad - (multiRepo ? repos.join(', ').length + 3 : 0)))}</Text>
      {repos.map(repo => {
        const files = byRepo.get(repo)!;
        return (
          <Box key={repo} flexDirection="column">
            {multiRepo && (
              <Text color={C.dim}>{` \u2500\u2500 ${repo} (${files.length}f) ` + '\u2500'.repeat(Math.max(0, iw - repo.length - 12))}</Text>
            )}
            <Box flexWrap="wrap">
              {files.map(f => {
                const idx = globalFileIdx++;
                return (
                  <Box key={f.fileId} width={chipW}>
                    <FileChip f={f} selected={focusDetail && idx === fileIdx} maxW={chipW} />
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
      {/* Cross-links summary */}
      {cd.crossLinks.filter(l => l.fromCluster === clusterIdx || l.toCluster === clusterIdx).length > 0 && (
        <Box>
          <Text color={C.dim}>{' LINKS \u2192 '}</Text>
          {cd.crossLinks
            .filter(l => l.fromCluster === clusterIdx || l.toCluster === clusterIdx)
            .slice(0, 4)
            .map((l, i) => {
              const otherIdx = l.fromCluster === clusterIdx ? l.toCluster : l.fromCluster;
              const other = cd.clusters[otherIdx];
              return (
                <Text key={i} color={l.crossRepo ? C.orange : C.cyan}>
                  {other?.name ?? '?'} ({l.type}{l.crossRepo ? ' \u2726' : ''}){i < 3 ? '  ' : ''}
                </Text>
              );
            })}
        </Box>
      )}
    </Box>
  );
}

// ── Main overlay ──

export function ReviewMapOverlay({
  clusterData: cd, stats, width, height, clusterIdx, fileIdx, mapFocus,
}: ReviewMapOverlayProps) {
  const iw = width - 2;

  // Graph/detail split
  const graphH = mapFocus === 'detail'
    ? Math.max(4, Math.floor(height * 0.35))
    : Math.max(3, height - 6);
  const detailH = height - graphH - 2; // -2 for title + footer

  const grid = useMemo(
    () => buildSpatialGrid(cd, iw, graphH, clusterIdx),
    [cd, iw, graphH, clusterIdx],
  );

  // Dashboard bar
  const pct = stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;
  const barLen = Math.min(20, Math.floor(iw * 0.2));
  const filled = Math.round(barLen * pct / 100);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
  const dash = ` ${pct}%  \u2713${stats.reviewed} \u2717${stats.bugs} ?${stats.questions}  ${cd.repoCount} repo \u00B7 ${cd.totalFiles} files`;
  const dashPad = Math.max(0, iw - bar.length - 1 - dash.length);

  const footer = mapFocus === 'detail'
    ? '\u2514\u2500 \u2191\u2193:file  Enter:jump diff  Esc:graph  n:next  m:close '
    : '\u2514\u2500 \u2191\u2193:cluster  Enter:detail  n:next  m:close ';
  const footerPad = Math.max(0, width - footer.length - 1);

  return (
    <Box flexDirection="column" position="absolute" marginLeft={0} marginTop={0} width={width}>
      {/* Title */}
      <Text color={C.accent} bold>{'\u250C\u2500 FEATURE MAP \u2500\u2500 ' + bar}</Text>

      {/* Dashboard */}
      <Box>
        <Text color={C.accent}>{'\u2502'}</Text>
        <Text color={pct >= 80 ? C.green : pct >= 40 ? C.orange : C.red}>{` ${bar}`}</Text>
        <Text color={C.bright}>{dash}</Text>
        <Text>{' '.repeat(dashPad)}</Text>
        <Text color={C.accent}>{'\u2502'}</Text>
      </Box>

      {/* Spatial graph */}
      {grid.map((row, i) => (
        <Box key={i}>
          <Text color={C.accent}>{'\u2502'}</Text>
          <GridRow cells={row} />
          <Text color={C.accent}>{'\u2502'}</Text>
        </Box>
      ))}

      {/* Detail strip */}
      {detailH > 0 && (
        <Box flexDirection="column" paddingLeft={1}>
          <DetailStrip
            cd={cd}
            clusterIdx={clusterIdx}
            fileIdx={fileIdx}
            width={iw}
            maxLines={detailH}
            focusDetail={mapFocus === 'detail'}
          />
        </Box>
      )}

      {/* Footer */}
      <Text color={C.accent} bold>{footer + '\u2500'.repeat(footerPad) + '\u2518'}</Text>
    </Box>
  );
}
