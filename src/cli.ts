import { resolve } from 'node:path';
import React from 'react';
import { render } from 'ink';
import { scan } from './core/engine.js';
import { App } from './tui/App.js';
import { buildFileDiffs } from './tui/data.js';
import { loadAllReviews } from './export/load-reviews.js';
import { exportMarkdown } from './export/markdown-exporter.js';
import { writeExport } from './export/write-export.js';

const args = process.argv.slice(2);
const exportMode = args.includes('--export');
const positional = args.filter(a => !a.startsWith('--'));

const ROOT_DIR = resolve(positional[0] ?? process.cwd());
const BASE_BRANCH = positional[1] ?? 'develop';

console.log(`\x1b[36m◈ REVU v2\x1b[0m scanning ${ROOT_DIR} (base: ${BASE_BRANCH})`);

const result = await scan(ROOT_DIR, BASE_BRANCH);

const fileCount = result.repos.reduce((n, r) => n + r.files.length, 0);
console.log(`\x1b[32m✓\x1b[0m ${result.repos.length} repo(s), ${fileCount} file(s), ${result.links.length} link(s)`);

if (exportMode) {
  const diffs = buildFileDiffs(result);
  const reviews = await loadAllReviews(ROOT_DIR, result);
  const exported = exportMarkdown(result, diffs, reviews);
  for (const [repoName, { markdown, branch }] of exported) {
    const path = await writeExport(ROOT_DIR, repoName, branch, markdown);
    console.log(`\x1b[32m✓\x1b[0m Exported ${repoName} → ${path}`);
  }
  process.exit(0);
} else {
  const rescan = () => scan(ROOT_DIR, BASE_BRANCH);
  render(React.createElement(App, { initialData: result, rootDir: ROOT_DIR, rescan }));
}
