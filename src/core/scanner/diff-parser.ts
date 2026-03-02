import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { FileDiff, DiffHunk, DiffLine } from '../types.js';

const exec = promisify(execFile);

export async function computeDiff(
  repoPath: string, baseBranch: string, includeWorkingTree = true,
): Promise<FileDiff[]> {
  try {
    const diffRef = includeWorkingTree ? baseBranch : `${baseBranch}...HEAD`;
    const { stdout } = await exec(
      'git', ['diff', diffRef, '--unified=3', '--no-color'],
      { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 },
    );
    return parseDiff(stdout);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`\x1b[33m⚠\x1b[0m git diff failed for ${repoPath} (base: ${baseBranch}): ${msg}`);
    return [];
  }
}

export async function getFileAtBranch(repoPath: string, branch: string, filePath: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['show', `${branch}:${filePath}`], { cwd: repoPath, maxBuffer: 5 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

function parseDiff(raw: string): FileDiff[] {
  const files: FileDiff[] = [];
  const fileChunks = raw.split(/^diff --git /m).slice(1);

  for (const chunk of fileChunks) {
    const lines = chunk.split('\n');
    const pathMatch = lines[0]?.match(/b\/(.+)$/);
    if (!pathMatch) continue;

    const path = pathMatch[1];
    if (!isRelevantFile(path)) continue;

    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (hunkMatch) {
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldCount: parseInt(hunkMatch[2] ?? '1'),
          newStart: parseInt(hunkMatch[3]),
          newCount: parseInt(hunkMatch[4] ?? '1'),
          lines: [],
        };
        hunks.push(currentHunk);
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        const dl: DiffLine = { type: 'add', content: line.slice(1) };
        currentHunk.lines.push(dl);
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const dl: DiffLine = { type: 'del', content: line.slice(1) };
        currentHunk.lines.push(dl);
        deletions++;
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({ type: 'context', content: line.slice(1) });
      }
    }

    files.push({ path, additions, deletions, hunks });
  }

  return files;
}

const EXCLUDED_PATTERNS = [
  /node_modules/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.map$/,
  /\.min\.(js|css)$/,
];

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov',
]);

function isRelevantFile(path: string): boolean {
  if (EXCLUDED_PATTERNS.some(p => p.test(path))) return false;
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return false;
  return true;
}
