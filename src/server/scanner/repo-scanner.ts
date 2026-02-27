import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { RepoInfo } from '../types.js';

const exec = promisify(execFile);

async function isGitRepo(dir: string): Promise<boolean> {
  try {
    const s = await stat(join(dir, '.git'));
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function getCurrentBranch(repoPath: string): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['branch', '--show-current'], { cwd: repoPath });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

const IGNORED_BRANCHES = new Set(['master', 'main', 'develop']);

export async function scanRepos(rootDir: string, baseBranch = 'develop'): Promise<RepoInfo[]> {
  const entries = await readdir(rootDir);
  const repos: RepoInfo[] = [];

  for (const entry of entries) {
    const fullPath = join(rootDir, entry);
    const s = await stat(fullPath).catch(() => null);
    if (!s?.isDirectory()) continue;
    if (!await isGitRepo(fullPath)) continue;

    const branch = await getCurrentBranch(fullPath);
    if (!branch || IGNORED_BRANCHES.has(branch)) continue;

    repos.push({
      name: entry,
      path: fullPath,
      currentBranch: branch,
      baseBranch,
    });
  }

  return repos.sort((a, b) => a.name.localeCompare(b.name));
}
