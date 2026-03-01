import React from 'react';
import { Box, Text } from 'ink';
import { C } from '../colors.js';

interface TutorialOverlayProps {
  width: number;
  height: number;
  page: number;
}

interface TutorialPage {
  title: string;
  lines: Array<{ text: string; color?: string; bold?: boolean; indent?: number }>;
}

const PAGES: TutorialPage[] = [
  {
    title: 'WHAT IS REVU?',
    lines: [
      { text: 'REVU is a terminal-based code review tool for multi-service', color: C.text },
      { text: 'architectures. It helps you review diffs intelligently by', color: C.text },
      { text: 'prioritizing what matters most.', color: C.text },
      { text: '' },
      { text: 'Core principle:', color: C.cyan, bold: true },
      { text: '"Review without reading, reading secondarily."', color: C.bright },
      { text: '' },
      { text: 'REVU scores every file and method by criticality (0\u201310)', color: C.text },
      { text: 'based on: file type, change volume, dependencies, and', color: C.text },
      { text: 'security context. High-crit items need careful review.', color: C.text },
      { text: '' },
      { text: 'Criticality colors:', color: C.cyan, bold: true },
      { text: '\u2588 7\u201310  Critical   \u2014 Security, auth, core services', color: C.red, indent: 2 },
      { text: '\u2588 4.5\u20137 Important  \u2014 Business logic, APIs', color: C.orange, indent: 2 },
      { text: '\u2588 2.5\u20134.5 Normal  \u2014 Standard changes', color: C.blue, indent: 2 },
      { text: '\u2588 0\u20132.5  Low       \u2014 DTOs, configs, tests', color: C.green, indent: 2 },
    ],
  },
  {
    title: 'THE 3 PANELS',
    lines: [
      { text: 'EXPLORER (left)', color: C.cyan, bold: true },
      { text: 'Tree view of repos \u203A folders \u203A files, sorted by crit.', color: C.text, indent: 2 },
      { text: 'Icons show file type (S=service, C=controller, D=dto...)', color: C.text, indent: 2 },
      { text: '\u2713 = fully reviewed, \u25D0 = partial, no icon = unreviewed', color: C.text, indent: 2 },
      { text: '' },
      { text: 'DIFF (center)', color: C.cyan, bold: true },
      { text: 'Unified or side-by-side diff. Methods grouped as hunks,', color: C.text, indent: 2 },
      { text: 'sorted by criticality. Flag lines with c/x/? as you go.', color: C.text, indent: 2 },
      { text: 'Hunk header shows method name and crit score.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'CONTEXT (right)', color: C.cyan, bold: true },
      { text: 'Shows metadata for the current selection:', color: C.text, indent: 2 },
      { text: '- File: changed methods, imports, dependencies', color: C.text, indent: 2 },
      { text: '- Folder/Repo: aggregated stats', color: C.text, indent: 2 },
      { text: '- Diff line: what method/file it belongs to', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Tab / Shift+Tab to switch between panels.', color: C.bright },
    ],
  },
  {
    title: 'REVIEW WORKFLOW',
    lines: [
      { text: 'Recommended steps:', color: C.cyan, bold: true },
      { text: '' },
      { text: '1. Scan the Explorer', color: C.bright, bold: true },
      { text: 'Look at the tree. High-crit files are colored red/orange.', color: C.text, indent: 3 },
      { text: 'Use n to jump to next unreviewed file.', color: C.text, indent: 3 },
      { text: '' },
      { text: '2. Review the Diff', color: C.bright, bold: true },
      { text: 'Enter/\u2192 opens a file. Navigate hunks with {/}.', color: C.text, indent: 3 },
      { text: 'Flag each line: c=ok, x=bug, ?=question.', color: C.text, indent: 3 },
      { text: 'Add comments with n.', color: C.text, indent: 3 },
      { text: '' },
      { text: '3. Batch review', color: C.bright, bold: true },
      { text: 'From Explorer: c/x/? flags ALL lines of a file/folder.', color: C.text, indent: 3 },
      { text: 'On a hunk header: flags the entire hunk.', color: C.text, indent: 3 },
      { text: 'Only unflagged lines are affected (safe to repeat).', color: C.text, indent: 3 },
      { text: '' },
      { text: '4. Export', color: C.bright, bold: true },
      { text: 'Alt+E exports a structured markdown for AI analysis.', color: C.text, indent: 3 },
    ],
  },
  {
    title: 'FLAGGING & COMMENTS',
    lines: [
      { text: 'Flags are your review markers:', color: C.cyan, bold: true },
      { text: '' },
      { text: '\u2713 c = OK', color: C.green, indent: 2, bold: true },
      { text: 'Line looks good, nothing to report.', color: C.text, indent: 4 },
      { text: '' },
      { text: '\u2717 x = BUG', color: C.red, indent: 2, bold: true },
      { text: 'Something is wrong here. Add a comment with n to explain.', color: C.text, indent: 4 },
      { text: '' },
      { text: '? = QUESTION', color: C.orange, indent: 2, bold: true },
      { text: 'Needs clarification or discussion.', color: C.text, indent: 4 },
      { text: '' },
      { text: 'Toggling: pressing the same flag again removes it.', color: C.text },
      { text: '' },
      { text: 'Comments:', color: C.cyan, bold: true },
      { text: 'Press n on a diff line to add a comment.', color: C.text, indent: 2 },
      { text: 'Type your text and press Enter to save, Esc to cancel.', color: C.text, indent: 2 },
      { text: 'Comments are shown below the flagged line.', color: C.text, indent: 2 },
    ],
  },
  {
    title: 'ADVANCED FEATURES',
    lines: [
      { text: 'Criticality filter: [ / ]', color: C.cyan, bold: true },
      { text: 'Hide low-crit methods. Only shows methods above threshold.', color: C.text, indent: 2 },
      { text: 'Shown in title bar as crit\u2265X.X', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Fuzzy search: /', color: C.cyan, bold: true },
      { text: 'Type to filter files in explorer. Enter to open, Esc to cancel.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Navigation history: Alt+\u2190/\u2192', color: C.cyan, bold: true },
      { text: 'Jump back/forward between previously viewed files.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'AI scoring: Alt+A', color: C.cyan, bold: true },
      { text: 'Toggle AI-proposed criticality weights (opt-in).', color: C.text, indent: 2 },
      { text: 'Requires a ScoringOverride in your review data.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Export: Alt+E', color: C.cyan, bold: true },
      { text: 'Generates AI-ready markdown with findings summary,', color: C.text, indent: 2 },
      { text: 'clean diffs, and prompts for AI analysis.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Reset: Alt+R', color: C.cyan, bold: true },
      { text: 'Reset review flags, AI scoring, or both.', color: C.text, indent: 2 },
    ],
  },
  {
    title: 'TIPS',
    lines: [
      { text: 'Start with high-crit files', color: C.green, bold: true },
      { text: 'They have the most impact. Use n to jump through them.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Batch-flag low-crit folders', color: C.green, bold: true },
      { text: 'Select a folder in Explorer, press c to mark all as OK.', color: C.text, indent: 2 },
      { text: 'Focus your time on what matters.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Use side-by-side mode for complex changes', color: C.green, bold: true },
      { text: 'Press s in the diff panel (requires terminal \u2265140 cols).', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Context panel follows your cursor', color: C.green, bold: true },
      { text: 'When in diff, it shows the method/file context for the', color: C.text, indent: 2 },
      { text: 'current line. Use it to understand dependencies.', color: C.text, indent: 2 },
      { text: 'Press d to jump between CHANGES and DEPENDS ON zones.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Review Map for overview', color: C.green, bold: true },
      { text: 'Press m to open the Review Map. See all files at a glance,', color: C.text, indent: 2 },
      { text: 'with crit scores, method heat blocks, and cross-repo links.', color: C.text, indent: 2 },
      { text: 'Navigate with \u2191\u2193, Enter to jump, n for next unreviewed.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Reviews persist automatically', color: C.green, bold: true },
      { text: 'Your flags and comments are saved in .revu/reviews/.', color: C.text, indent: 2 },
      { text: 'Each branch has its own review state.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Live reload', color: C.green, bold: true },
      { text: 'REVU watches your files and rescans automatically when', color: C.text, indent: 2 },
      { text: 'you save. Press r for a manual reload. [LIVE] in status bar.', color: C.text, indent: 2 },
      { text: '' },
      { text: 'Stale indicator', color: C.green, bold: true },
      { text: 'If new commits arrive, status bar shows \u26A0stale.', color: C.text, indent: 2 },
      { text: 'Your flags are preserved but may be on wrong lines.', color: C.text, indent: 2 },
    ],
  },
];

export const TUTORIAL_PAGE_COUNT = PAGES.length;

export function TutorialOverlay({ width, height, page }: TutorialOverlayProps) {
  const boxW = Math.min(68, width - 4);
  const padX = Math.max(0, Math.floor((width - boxW) / 2));
  const p = PAGES[page] ?? PAGES[0];
  const innerW = boxW - 4;

  // Compute vertical centering
  const contentLines = p.lines.length + 4; // title + border + footer
  const padY = Math.max(0, Math.floor((height - contentLines - 2) / 2));

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
        <Text color={C.white} bold>{` TUTORIAL: ${p.title}`.padEnd(boxW - 2)}</Text>
        <Text color={C.accent} bold>{'\u2502'}</Text>
      </Box>
      <Box>
        <Text color={C.accent}>{'\u251C' + '\u2500'.repeat(boxW - 2) + '\u2524'}</Text>
      </Box>
      {p.lines.map((line, i) => {
        const indent = line.indent ?? 0;
        const text = ' '.repeat(indent) + line.text;
        const pad = Math.max(0, innerW - text.length);
        return (
          <Box key={i}>
            <Text color={C.accent}>{'\u2502'}</Text>
            <Text color={line.color ?? C.text} bold={line.bold}>{` ${text}`}</Text>
            <Text>{' '.repeat(pad + 1)}</Text>
            <Text color={C.accent}>{'\u2502'}</Text>
          </Box>
        );
      })}
      <Box>
        <Text color={C.accent} bold>{'\u2514' + '\u2500'.repeat(boxW - 2) + '\u2518'}</Text>
      </Box>
      <Box>
        <Text color={C.dim}>{` \u2190/\u2192 navigate \u00B7 ${page + 1}/${PAGES.length} \u00B7 t or Esc to close`}</Text>
      </Box>
    </Box>
  );
}
