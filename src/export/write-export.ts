// ── Write markdown export to .revu/{branch}/exports/{suffix}/ ──

import { writeFile, mkdir, readdir, rename, rmdir } from 'node:fs/promises';
import { join } from 'node:path';

function sanitize(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
}

export async function writeExport(
  rootDir: string, repoName: string, branch: string, markdown: string,
  suffix = 'review',
): Promise<string> {
  const sanitized = sanitize(branch);
  const exportDir = join(rootDir, '.revu', sanitized, 'exports', suffix);
  await mkdir(exportDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${repoName}_${date}.md`;
  const filePath = join(exportDir, fileName);

  await writeFile(filePath, markdown, 'utf-8');
  return filePath;
}

/** Migrate old .revu/exports/{branch}/{type}/* → .revu/{branch}/exports/{type}/* */
export async function migrateExports(rootDir: string): Promise<void> {
  const oldExportsDir = join(rootDir, '.revu', 'exports');
  let branches: string[];
  try {
    branches = await readdir(oldExportsDir);
  } catch {
    return; // no old exports directory
  }

  // Old structure: .revu/exports/{branch}/{type}/*.md
  // Skip if the directory contains non-directory entries (already flat files = ancient format)
  for (const branchDir of branches) {
    const branchPath = join(oldExportsDir, branchDir);
    let types: string[];
    try {
      types = await readdir(branchPath);
    } catch {
      continue;
    }

    for (const typeDir of types) {
      const typePath = join(branchPath, typeDir);
      let files: string[];
      try {
        files = await readdir(typePath);
      } catch {
        continue;
      }

      if (files.length === 0) continue;

      const newDir = join(rootDir, '.revu', branchDir, 'exports', typeDir);
      await mkdir(newDir, { recursive: true });

      for (const file of files) {
        await rename(join(typePath, file), join(newDir, file)).catch(() => {});
      }

      // Remove old type dir if empty
      try {
        const rem = await readdir(typePath);
        if (rem.length === 0) await rmdir(typePath);
      } catch {}
    }

    // Remove old branch dir if empty
    try {
      const rem = await readdir(branchPath);
      if (rem.length === 0) await rmdir(branchPath);
    } catch {}
  }

  // Remove old exports dir if empty
  try {
    const rem = await readdir(oldExportsDir);
    if (rem.length === 0) await rmdir(oldExportsDir);
  } catch {}
}
