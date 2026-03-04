// ── Review Map Overlay: heat-strip cluster visualization ──
// Scoped to current file's repo. Full opaque background.

import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor, critBar, TYPE_ICON } from '../colors.js';
import type { ClusterMapData, Cluster, ClusterFile, ReviewStats, RepoClusterData } from '../types.js';

const BG = '#0a1628';

interface Props {
  data: ClusterMapData;
  width: number;
  height: number;
  clusterIdx: number;
  fileIdx: number;
  selectedFile: string | null;
}

// ── Full-width line: every rendered line fills the width with BG ──

function Line({ children, w }: { children: React.ReactNode; w: number }) {
  return (
    <Box width={w}>
      {children}
      {/* Ink stretches the last Text to fill remaining width when parent has fixed width */}
      <Text backgroundColor={BG}>{' '.repeat(w)}</Text>
    </Box>
  );
}

function BlankLine({ w }: { w: number }) {
  return <Text backgroundColor={BG}>{' '.repeat(w)}</Text>;
}

function progressIcon(p: ClusterFile['progress']): { ch: string; color: string } {
  if (p === 'complete') return { ch: '\u2713', color: C.green };
  if (p === 'partial') return { ch: '\u25D0', color: C.orange };
  return { ch: ' ', color: C.dim };
}

// ── Progress bar ──

function ProgressBar({ stats, w }: { stats: ReviewStats; w: number }) {
  const barW = Math.max(10, w - 22);
  const pct = stats.total > 0 ? stats.reviewed / stats.total : 0;
  const filled = Math.round(pct * barW);
  const pctStr = `${Math.round(pct * 100)}%`;
  const suffix = [
    stats.bugs > 0 ? `\u2717${stats.bugs}` : '',
    stats.questions > 0 ? `?${stats.questions}` : '',
    stats.comments > 0 ? `\u{1F4AC}${stats.comments}` : '',
  ].filter(Boolean).join(' ');

  return (
    <Line w={w}>
      <Text backgroundColor={BG} color={C.green}>{' '}{'\u2588'.repeat(filled)}</Text>
      <Text backgroundColor={BG} color={C.dim}>{'\u2591'.repeat(barW - filled)}</Text>
      <Text backgroundColor={BG} color={C.bright}>{' '}{pctStr}</Text>
      {suffix && <Text backgroundColor={BG} color={C.dim}>{' '}</Text>}
      {stats.bugs > 0 && <Text backgroundColor={BG} color={C.red}>{`\u2717${stats.bugs} `}</Text>}
      {stats.questions > 0 && <Text backgroundColor={BG} color={C.orange}>{`?${stats.questions} `}</Text>}
      {stats.comments > 0 && <Text backgroundColor={BG} color={C.dim}>{`\u{1F4AC}${stats.comments}`}</Text>}
    </Line>
  );
}

// ── Heat strip: colored blocks per file ──

function HeatStrip({ files, maxW, selectedIdx, isSelected }: {
  files: ClusterFile[]; maxW: number; selectedIdx: number; isSelected: boolean;
}) {
  const maxCrit = Math.max(...files.map(f => f.crit), 1);
  const rawBlocks = files.map(f => Math.max(2, Math.round(f.crit / maxCrit * 8)));
  const total = rawBlocks.reduce((s, b) => s + b, 0);
  const scale = total > maxW ? maxW / total : 1;
  const blocks = rawBlocks.map(b => Math.max(2, Math.round(b * scale)));

  return (
    <>
      <Text backgroundColor={BG}>{' '}</Text>
      {files.map((f, i) => {
        const { char, color } = critBar(f.crit);
        const isSel = isSelected && i === selectedIdx;
        return (
          <Text key={f.fileId} backgroundColor={BG} color={color} bold={isSel}>
            {char.repeat(blocks[i])}
          </Text>
        );
      })}
    </>
  );
}

// ── File labels row ──

function FileLabels({ files, maxW, selectedIdx, isSelected }: {
  files: ClusterFile[]; maxW: number; selectedIdx: number; isSelected: boolean;
}) {
  const perFile = Math.max(6, Math.floor(maxW / files.length));
  const maxNameW = perFile - 6;

  return (
    <>
      <Text backgroundColor={BG}>{' '}</Text>
      {files.map((f, i) => {
        const icon = TYPE_ICON[f.type]?.icon ?? '?';
        const isSel = isSelected && i === selectedIdx;
        const prog = progressIcon(f.progress);
        const prefix = isSel ? '\u25B6' : icon;
        const name = f.name.length > maxNameW ? f.name.slice(0, maxNameW - 1) + '\u2026' : f.name;
        return (
          <React.Fragment key={f.fileId}>
            <Text backgroundColor={BG} color={isSel ? C.accent : (TYPE_ICON[f.type]?.color ?? C.dim)} bold={isSel}>
              {prefix}
            </Text>
            <Text backgroundColor={BG} color={isSel ? C.white : C.text} bold={isSel}>
              {' '}{name}
            </Text>
            <Text backgroundColor={BG} color={critColor(f.crit)}>{' '}{f.crit.toFixed(1)}</Text>
            <Text backgroundColor={BG} color={prog.color}>{prog.ch}</Text>
            <Text backgroundColor={BG}>{' '}</Text>
          </React.Fragment>
        );
      })}
    </>
  );
}

// ── Cluster box ──

function ClusterBox({ cluster, isSelected, selectedFileIdx, w }: {
  cluster: Cluster; isSelected: boolean; selectedFileIdx: number; w: number;
}) {
  const borderColor = isSelected ? C.accent : C.border;
  const bugsStr = cluster.totalBugs > 0 ? ` \u2717${cluster.totalBugs}` : '';
  const headerLabel = ` ${cluster.name}${bugsStr} `;
  const innerW = w - 4;
  const lineW = Math.max(0, innerW - headerLabel.length);

  return (
    <Box flexDirection="column">
      <Line w={w}>
        <Text backgroundColor={BG} color={borderColor}>{' \u250C '}</Text>
        <Text backgroundColor={BG} color={isSelected ? C.white : C.bright} bold>{headerLabel}</Text>
        <Text backgroundColor={BG} color={borderColor}>{'\u2500'.repeat(lineW)}{'\u2510'}</Text>
      </Line>
      <Line w={w}>
        <Text backgroundColor={BG} color={borderColor}>{' \u2502'}</Text>
        <HeatStrip files={cluster.files} maxW={innerW} selectedIdx={selectedFileIdx} isSelected={isSelected} />
        <Text backgroundColor={BG} color={borderColor}>{'\u2502'}</Text>
      </Line>
      <Line w={w}>
        <Text backgroundColor={BG} color={borderColor}>{' \u2502'}</Text>
        <FileLabels files={cluster.files} maxW={innerW} selectedIdx={selectedFileIdx} isSelected={isSelected} />
        <Text backgroundColor={BG} color={borderColor}>{'\u2502'}</Text>
      </Line>
      <Line w={w}>
        <Text backgroundColor={BG} color={borderColor}>{' \u2514'}{'\u2500'.repeat(innerW)}{'\u2518'}</Text>
      </Line>
    </Box>
  );
}

// ── Standalone files (single-line compact) ──

function Standalone({ files, w }: { files: ClusterFile[]; w: number }) {
  if (files.length === 0) return null;
  return (
    <Line w={w}>
      <Text backgroundColor={BG} color={C.dim}>{' Standalone: '}</Text>
      {files.map(f => {
        const prog = progressIcon(f.progress);
        return (
          <React.Fragment key={f.fileId}>
            <Text backgroundColor={BG} color={critBar(f.crit).color}>{'\u2591'}</Text>
            <Text backgroundColor={BG} color={C.text}>{' '}{f.name}</Text>
            <Text backgroundColor={BG} color={C.dim}>{' ('}</Text>
            <Text backgroundColor={BG} color={critColor(f.crit)}>{f.crit.toFixed(1)}</Text>
            <Text backgroundColor={BG} color={prog.color}>{prog.ch}</Text>
            <Text backgroundColor={BG} color={C.dim}>{')'}</Text>
            <Text backgroundColor={BG}>{' '}</Text>
          </React.Fragment>
        );
      })}
    </Line>
  );
}

// ── Main overlay ──

export function ReviewMapOverlay({ data, width, height, clusterIdx, fileIdx, selectedFile }: Props) {
  // Scope to the repo containing the selected file
  const activeRepo = selectedFile
    ? data.repos.find(r => r.clusters.some(c => c.files.some(f => f.fileId === selectedFile))
        || r.standalone.some(f => f.fileId === selectedFile))
    : data.repos[0];
  const repo = activeRepo ?? data.repos[0];
  if (!repo) return <BlankLine w={width} />;

  const branch = repo.branch ?? 'HEAD';
  const headerText = ` REVIEW MAP \u00B7 ${branch} \u00B7 ${repo.repoName}`;

  // Compute lines needed to fill height
  const contentLines: React.ReactNode[] = [];

  // 1. Header
  contentLines.push(
    <Line key="hdr" w={width}>
      <Text backgroundColor={C.accent} color="#ffffff" bold>{headerText}</Text>
      <Text backgroundColor={BG} color={C.dim}>{' '.repeat(Math.max(0, width - headerText.length - 12))}{'Esc:close '}</Text>
    </Line>
  );

  // 2. Progress bar
  contentLines.push(<ProgressBar key="prog" stats={data.globalStats} w={width} />);

  // 3. Blank separator
  contentLines.push(<BlankLine key="sep1" w={width} />);

  // 4. Repo header
  const repoHeader = ` ${repo.repoName} \u00B7 ${repo.fileCount} files \u00B7 ${repo.maxCrit.toFixed(1)} max`;
  contentLines.push(
    <Line key="repo" w={width}>
      <Text backgroundColor={BG} color={C.cyan} bold>{repoHeader}</Text>
    </Line>
  );

  // 5. Clusters
  for (let i = 0; i < repo.clusters.length; i++) {
    contentLines.push(
      <ClusterBox
        key={`cl${i}`}
        cluster={repo.clusters[i]}
        isSelected={i === clusterIdx}
        selectedFileIdx={fileIdx}
        w={width}
      />
    );
  }

  // 6. Standalone
  if (repo.standalone.length > 0) {
    contentLines.push(<Standalone key="sa" files={repo.standalone} w={width} />);
  }

  // 7. Side-effects (scoped to this repo)
  const repoSideEffects = data.sideEffects.filter(s =>
    repo.clusters.some(c => c.files.some(f => f.name === s.file.replace(/\.[^.]+$/, '')))
    || repo.standalone.some(f => f.name === s.file.replace(/\.[^.]+$/, ''))
  );
  if (repoSideEffects.length > 0) {
    contentLines.push(
      <Line key="se" w={width}>
        <Text backgroundColor={BG} color={C.orange}>
          {' \u26A1 '}{repoSideEffects.map(s => s.file).join(', ')}
          {' \u2014 consumes changed signatures'}
        </Text>
      </Line>
    );
  }

  // 8. Blank separator
  contentLines.push(<BlankLine key="sep2" w={width} />);

  // 9. Footer
  contentLines.push(
    <Line key="foot" w={width}>
      <Text backgroundColor={BG} color={C.dim}>
        {' \u2191\u2193:cluster  \u2190\u2192:file  Enter:jump  Tab:focus  n:next  Esc:close'}
      </Text>
    </Line>
  );

  // Fill remaining height with blank lines for opaque background
  const remaining = Math.max(0, height - contentLines.length);
  for (let i = 0; i < remaining; i++) {
    contentLines.push(<BlankLine key={`blank${i}`} w={width} />);
  }

  return (
    <Box flexDirection="column" position="absolute" marginTop={0} marginLeft={0} width={width} height={height}>
      {contentLines}
    </Box>
  );
}
