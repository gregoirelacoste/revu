import React from 'react';
import { Box, Text } from 'ink';
import { C } from '../colors.js';

interface HelpOverlayProps {
  width: number;
  height: number;
}

const SECTIONS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'GENERAL',
    keys: [
      ['Tab / Shift+Tab', 'Switch panel'],
      ['[ / ]', 'Adjust min criticality'],
      ['q', 'Quit'],
      ['h', 'Toggle this help'],
      ['Alt+E', 'Export markdown'],
      ['/', 'Fuzzy search (explorer)'],
    ],
  },
  {
    title: 'EXPLORER',
    keys: [
      ['\u2191\u2193', 'Navigate files'],
      ['\u2190\u2192', 'Collapse/expand or select file'],
      ['Enter', 'Open file in diff panel'],
      ['PgUp / PgDn', 'Page up/down'],
      ['g / G', 'Jump to top/bottom'],
      ['c / x / ?', 'Flag file/folder (safe)'],
      ['n', 'Next unreviewed file'],
    ],
  },
  {
    title: 'DIFF',
    keys: [
      ['\u2191\u2193', 'Navigate lines'],
      ['PgUp / PgDn', 'Page up/down'],
      ['g / G', 'Jump to top/bottom'],
      ['{ / }', 'Previous/next hunk'],
      ['c / x / ?', 'Flag line or hunk'],
      ['n', 'Add comment'],
      ['s', 'Toggle unified/sbs'],
    ],
  },
  {
    title: 'CONTEXT',
    keys: [
      ['\u2191\u2193', 'Navigate entries'],
      ['Enter', 'Jump to file/method'],
      ['c / x / ?', 'Flag method (safe)'],
    ],
  },
  {
    title: 'HISTORY',
    keys: [
      ['Alt+\u2190', 'Go back'],
      ['Alt+\u2192', 'Go forward'],
    ],
  },
];

export function HelpOverlay({ width, height }: HelpOverlayProps) {
  const boxW = Math.min(52, width - 4);
  const padX = Math.max(0, Math.floor((width - boxW) / 2));
  const totalLines = SECTIONS.reduce((s, sec) => s + 1 + sec.keys.length + 1, 0);
  const padY = Math.max(0, Math.floor((height - totalLines - 2) / 2));
  const innerW = boxW - 3;

  return (
    <Box
      flexDirection="column"
      position="absolute"
      marginLeft={padX}
      marginTop={padY}
      width={boxW}
    >
      <Box>
        <Text color={C.accent} bold>{'\u250C' + '\u2500'.repeat(boxW - 2) + '\u2510'}</Text>
      </Box>
      <Box>
        <Text color={C.accent} bold>{'\u2502'}</Text>
        <Text color={C.white} bold>{' KEYBOARD SHORTCUTS'.padEnd(boxW - 2)}</Text>
        <Text color={C.accent} bold>{'\u2502'}</Text>
      </Box>
      <Box>
        <Text color={C.accent}>{'\u251C' + '\u2500'.repeat(boxW - 2) + '\u2524'}</Text>
      </Box>
      {SECTIONS.map(sec => (
        <Box key={sec.title} flexDirection="column">
          <Box>
            <Text color={C.accent}>{'\u2502'}</Text>
            <Text color={C.orange} bold>{` ${sec.title}`.padEnd(boxW - 2)}</Text>
            <Text color={C.accent}>{'\u2502'}</Text>
          </Box>
          {sec.keys.map(([k, desc]) => {
            const keyStr = ` ${k}`;
            const descStr = desc;
            const gap = Math.max(1, innerW - keyStr.length - descStr.length);
            return (
              <Box key={k}>
                <Text color={C.accent}>{'\u2502'}</Text>
                <Text color={C.cyan}>{keyStr}</Text>
                <Text color={C.dim}>{' '.repeat(gap)}</Text>
                <Text color={C.text}>{descStr}</Text>
                <Text>{' '}</Text>
                <Text color={C.accent}>{'\u2502'}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
      <Box>
        <Text color={C.accent} bold>{'\u2514' + '\u2500'.repeat(boxW - 2) + '\u2518'}</Text>
      </Box>
      <Box>
        <Text color={C.dim}>{' Press h or Esc to close'}</Text>
      </Box>
    </Box>
  );
}
