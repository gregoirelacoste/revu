import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReviewData } from '../types.js';

export class ReviewStore {
  private reviewDir: string;

  constructor(rootDir: string) {
    this.reviewDir = join(rootDir, '.revu', 'reviews');
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
    await mkdir(this.reviewDir, { recursive: true });
    const path = this.filePath(repo, branch);
    data.updatedAt = new Date().toISOString();
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }

  private filePath(repo: string, branch: string): string {
    return join(this.reviewDir, `${repo}_${this.sanitize(branch)}.json`);
  }

  private sanitize(branch: string): string {
    return branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  }
}
