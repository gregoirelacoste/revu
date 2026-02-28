import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor, TYPE_ICON } from '../colors.js';
import type { FlatItem } from '../types.js';

interface TreeRowProps {
  item: FlatItem;
  isSelected: boolean;
  isFocused: boolean;
  isCollapsed?: boolean;
  width: number;
  progress?: 'none' | 'partial' | 'complete';
}

export function TreeRow({ item, isSelected, isFocused, isCollapsed, width, progress }: TreeRowProps) {
  const ic = TYPE_ICON[item.node.type] ?? TYPE_ICON.folder;
  const cc = critColor(item.node.crit);
  const indent = '  '.repeat(item.depth);
  const isComplete = progress === 'complete';

  let icon: string;
  if (item.node.type === 'repo') {
    icon = '\u25C8';
  } else if (item.isFolder) {
    icon = isCollapsed ? '\u25B8' : '\u25BE';
  } else {
    icon = ic.icon;
  }

  // Progress indicator
  const progressChar = progress === 'complete' ? '\u2713' : progress === 'partial' ? '\u25D0' : ' ';
  const progressColor = progress === 'complete' ? C.green : progress === 'partial' ? C.orange : C.dim;

  const scoreStr = item.node.crit.toFixed(1);
  const sideEffectLen = item.node.sideEffect ? 2 : 0;
  const branchLen = item.node.branch ? item.node.branch.length + 1 : 0;
  const prefixLen = 1 + indent.length + 1 + 1; // focus + indent + icon + space
  const progressLen = progress !== undefined ? 2 : 0; // char + space
  const fixedLen = prefixLen + progressLen + sideEffectLen + branchLen + 1 + scoreStr.length;
  const maxNameLen = Math.max(4, width - fixedLen);
  const displayName = item.node.name.length > maxNameLen
    ? item.node.name.slice(0, maxNameLen - 1) + '\u2026'
    : item.node.name;

  const nameLen = displayName.length;
  const usedWidth = prefixLen + progressLen + nameLen + sideEffectLen + branchLen;
  const padding = Math.max(1, width - usedWidth - scoreStr.length);

  return (
    <Box>
      <Text color={isFocused ? C.accent : undefined}>
        {isFocused ? '\u25B6' : ' '}
      </Text>
      <Text dimColor>{indent}</Text>
      <Text color={ic.color} bold>{icon}</Text>
      <Text> </Text>
      {progress !== undefined && (
        <Text color={progressColor}>{progressChar} </Text>
      )}
      <Text
        color={isComplete ? C.dim : isSelected ? C.white : C.text}
        bold={isSelected && !isComplete}
        underline={isSelected && !isComplete}
        dimColor={isComplete}
      >
        {displayName}
      </Text>
      {item.node.sideEffect && <Text color={C.orange}> {'\u26A1'}</Text>}
      {item.node.branch && <Text color={C.dim}> {item.node.branch}</Text>}
      <Text>{' '.repeat(padding)}</Text>
      <Text color={cc} bold>
        {scoreStr}
      </Text>
    </Box>
  );
}
