import React from 'react';
import { Box, Text } from 'ink';
import { C, critColor, TYPE_ICON } from '../colors.js';
import type { FlatItem } from '../types.js';

interface TreeRowProps {
  item: FlatItem;
  isSelected: boolean;
  isFocused: boolean;
  isCollapsed?: boolean;
}

export function TreeRow({ item, isSelected, isFocused, isCollapsed }: TreeRowProps) {
  const ic = TYPE_ICON[item.node.type] ?? TYPE_ICON.folder;
  const cc = critColor(item.node.crit);
  const indent = '  '.repeat(item.depth);

  let icon: string;
  if (item.node.type === 'repo') {
    icon = '\u25C8';
  } else if (item.isFolder) {
    icon = isCollapsed ? '\u25B8' : '\u25BE';
  } else {
    icon = ic.icon;
  }

  return (
    <Box>
      <Text color={isFocused ? C.accent : undefined}>
        {isFocused ? '\u25B6' : ' '}
      </Text>
      <Text dimColor>{indent}</Text>
      <Text color={ic.color} bold>{icon}</Text>
      <Text> </Text>
      <Text
        color={isSelected ? C.white : C.text}
        bold={isSelected}
        underline={isSelected}
      >
        {item.node.name}
      </Text>
      {item.node.sideEffect && <Text color={C.orange}> {'\u26A1'}</Text>}
      {item.node.branch && <Text color={C.dim}> {item.node.branch}</Text>}
      <Text> </Text>
      <Text color={cc} bold>
        {item.node.crit.toFixed(1)}
      </Text>
    </Box>
  );
}
