// ── External editor integration ──

import { spawnSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { enableMouseTracking, disableMouseTracking } from './hooks/useMouseScroll.js';

function getEditor(): string {
  return process.env.VISUAL || process.env.EDITOR || 'nvim';
}

/**
 * Opens a file in the user's $EDITOR (blocking).
 * Disables raw mode, switches to alternate screen, spawns editor,
 * then restores everything for Ink to resume.
 */
export function openEditor(filePath: string): void {
  const editor = getEditor();
  disableMouseTracking();              // must be before raw mode off
  process.stdin.setRawMode?.(false);
  process.stdout.write('\x1B[?1049h'); // enter alternate screen
  spawnSync(editor, [filePath], { stdio: 'inherit' });
  process.stdout.write('\x1B[?1049l'); // leave alternate screen
  process.stdin.setRawMode?.(true);
  enableMouseTracking();               // must be after raw mode on
}

/**
 * Ensures `.revu/{branch}/notes.md` exists, creating it with a header if absent.
 * Returns the absolute path.
 */
export async function ensureNotesFile(rootDir: string, branch: string): Promise<string> {
  const sanitized = branch.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-');
  const notesPath = join(rootDir, '.revu', sanitized, 'notes.md');
  await mkdir(dirname(notesPath), { recursive: true });
  try {
    await writeFile(notesPath, `# Review Notes — ${branch}\n\n`, { flag: 'wx' });
  } catch {
    // file already exists — that's fine
  }
  return notesPath;
}
