// ── Write markdown export to .revu/exports/ ──

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeExport(
  rootDir: string, repoName: string, branch: string, markdown: string,
): Promise<string> {
  const exportDir = join(rootDir, '.revu', 'exports');
  await mkdir(exportDir, { recursive: true });

  const sanitized = branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${repoName}_${sanitized}_${date}.md`;
  const filePath = join(exportDir, fileName);

  await writeFile(filePath, markdown, 'utf-8');
  return filePath;
}
