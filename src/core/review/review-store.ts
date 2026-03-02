import { readFile, writeFile, mkdir, readdir, rename, rmdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import type { ReviewData } from '../types.js';

export class ReviewStore {
  private revuDir: string;

  constructor(rootDir: string) {
    this.revuDir = join(rootDir, '.revu');
  }

  async load(repo: string, branch: string): Promise<ReviewData | null> {
    const path = this.filePath(repo, branch);
    try {
      const raw = await readFile(path, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async save(repo: string, branch: string, data: ReviewData): Promise<void> {
    const dir = join(this.revuDir, this.sanitize(branch), 'reviews');
    await mkdir(dir, { recursive: true });
    const path = this.filePath(repo, branch);
    data.updatedAt = new Date().toISOString();
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Migrate old flat .revu/reviews/{repo}_{branch}.json → .revu/{branch}/reviews/{repo}.json */
  async migrate(): Promise<void> {
    const oldDir = join(this.revuDir, 'reviews');
    let files: string[];
    try {
      files = await readdir(oldDir);
    } catch {
      return; // no old directory — nothing to migrate
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length === 0) {
      await rmdir(oldDir).catch(() => {});
      return;
    }

    for (const file of jsonFiles) {
      const oldPath = join(oldDir, file);
      try {
        const raw = await readFile(oldPath, 'utf-8');
        const review: ReviewData = JSON.parse(raw);
        const repo = review.repo ?? basename(file, '.json');
        const branch = review.branch;
        if (!branch) continue;

        const newDir = join(this.revuDir, this.sanitize(branch), 'reviews');
        await mkdir(newDir, { recursive: true });
        await rename(oldPath, join(newDir, `${repo}.json`));
      } catch {
        // skip malformed files
      }
    }

    // Remove old directory if empty
    try {
      const remaining = await readdir(oldDir);
      if (remaining.length === 0) await rmdir(oldDir);
    } catch {}
  }

  private filePath(repo: string, branch: string): string {
    return join(this.revuDir, this.sanitize(branch), 'reviews', `${repo}.json`);
  }

  private sanitize(branch: string): string {
    return branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  }
}
