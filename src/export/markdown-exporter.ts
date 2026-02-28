// ── Export review results as Markdown ──

import type { ScanResult, RepoEntry, FileEntry } from '../core/engine.js';
import type { DetectedLink, MethodData } from '../core/types.js';
import type { TuiFileDiff, ReviewStats } from '../tui/types.js';
import type { LineReview } from '../tui/hooks/useReview.js';
import { allMethods } from '../core/analyzer/side-effects.js';
import { computeFileReviewStats, computeGlobalReviewStats } from '../tui/review-stats.js';

const FLAG_LABEL: Record<string, string> = { ok: 'OK', bug: 'Bug', question: 'Question' };

function critEmoji(crit: number): string {
  if (crit >= 7) return '\u{1F534}';
  if (crit >= 4) return '\u{1F7E1}';
  if (crit >= 2) return '\u{1F535}';
  return '\u{1F7E2}';
}

function fileStatus(stats: ReviewStats): string {
  if (stats.total === 0) return 'sans diff';
  if (stats.reviewed === 0) return 'non review\u00e9';
  if (stats.reviewed >= stats.total) return 'complet';
  return 'partiel';
}

function methodLabel(m: MethodData): string {
  if (m.status === 'new') return m.httpVerb ? `New ${m.httpVerb} endpoint` : 'New';
  if (m.status === 'del') return 'Deleted';
  if (m.sigChanged) return 'Signature changed';
  if (m.isType) return 'Type modified';
  return 'Modified';
}

function flagSuffix(lineReviews: Map<string, LineReview>, fileId: string, method: MethodData): string {
  const flags: string[] = [];
  for (const [key, lr] of lineReviews) {
    if (!key.startsWith(`${fileId}:`)) continue;
    if (lr.flag === 'bug') flags.push('BUG');
    else if (lr.flag === 'question') flags.push('?');
  }
  // Deduplicate
  const unique = [...new Set(flags)];
  return unique.length > 0 ? ` \u2717 ${unique.join(', ')}` : '';
}

function renderMethod(
  method: MethodData, fileId: string, lineReviews: Map<string, LineReview>,
): string {
  if (method.status === 'unch') return '';
  const lines: string[] = [];

  // Collect flags on this method's diff lines
  const methodFlags: string[] = [];
  const methodComments: Array<{ flag: string; text: string }> = [];
  let lineNum = 0;
  for (const d of method.diff) {
    if (d.t === 'a' || d.t === 'c') lineNum++;
    if (d.t === 'a' || d.t === 'd') {
      const lr = lineReviews.get(`${fileId}:${lineNum}`);
      if (lr) {
        if (lr.flag === 'bug') methodFlags.push('BUG');
        if (lr.flag === 'question') methodFlags.push('?');
        for (const c of lr.comments) {
          methodComments.push({ flag: lr.flag, text: c.text });
        }
      }
    }
  }
  const uniqueFlags = [...new Set(methodFlags)];
  const flagStr = uniqueFlags.length > 0 ? ` \u2717 ${uniqueFlags.join(', ')}` : '';

  lines.push(`#### ${method.name} \u2014 ${methodLabel(method)} (${method.crit.toFixed(1)})${flagStr}`);

  // Diff block
  const diffLines = method.diff.filter(d => d.t !== 'c' || method.diff.length <= 8);
  if (diffLines.length > 0) {
    lines.push('```diff');
    for (const d of diffLines) {
      const prefix = d.t === 'a' ? '+' : d.t === 'd' ? '-' : ' ';
      lines.push(`${prefix} ${d.c}`);
    }
    lines.push('```');
  }

  // Comments
  for (const mc of methodComments) {
    const label = FLAG_LABEL[mc.flag] ?? mc.flag;
    lines.push(`> **${label}** : ${mc.text}`);
  }

  return lines.join('\n');
}

function renderFile(
  file: FileEntry, repo: RepoEntry, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): string {
  const lines: string[] = [];
  const diff = diffs.get(file.id);
  const stats = diff ? computeFileReviewStats(file.id, diff, lineReviews) : { total: 0, reviewed: 0, bugs: 0, questions: 0, comments: 0 };
  const status = fileStatus(stats);
  const hasSideEffect = allMethods(file).some(m => m.impacted);
  const emoji = hasSideEffect ? '\u26A1' : critEmoji(file.crit);

  lines.push(`### ${emoji} ${file.name}${file.ext} (${file.crit.toFixed(1)}) \u2014 ${hasSideEffect ? 'side-effect, ' : ''}${status}`);

  if (hasSideEffect && status === 'non review\u00e9') {
    const impactedMethods = allMethods(file).filter(m => m.impacted);
    if (impactedMethods.length > 0) {
      lines.push(`${impactedMethods.map(m => `${m.name}()`).join(', ')} consomme des m\u00e9thodes dont la signature a chang\u00e9.`);
    }
  }

  const changed = allMethods(file).filter(m => m.status !== 'unch');
  for (const method of changed.sort((a, b) => b.crit - a.crit)) {
    const rendered = renderMethod(method, file.id, lineReviews);
    if (rendered) lines.push('', rendered);
  }

  return lines.join('\n');
}

function renderRepo(
  repo: RepoEntry, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): string {
  const lines: string[] = [];
  const globalStats = computeGlobalReviewStats(diffs, lineReviews);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const pct = globalStats.total > 0 ? Math.round((globalStats.reviewed / globalStats.total) * 100) : 0;

  lines.push(`# Code Review \u2014 ${repo.name}`);
  lines.push(`## ${repo.branch} \u2194 develop`);
  lines.push(`**Date** : ${dateStr}`);
  lines.push(`**Progression** : ${globalStats.reviewed}/${globalStats.total} lignes (${pct}%)`);
  lines.push(`**Bugs** : ${globalStats.bugs} \u00b7 **Questions** : ${globalStats.questions} \u00b7 **Comments** : ${globalStats.comments}`);
  lines.push('', '---');

  const sorted = [...repo.files].sort((a, b) => b.crit - a.crit);
  for (const file of sorted) {
    const hasDiff = allMethods(file).some(m => m.status !== 'unch');
    const hasSideEffect = allMethods(file).some(m => m.impacted);
    if (!hasDiff && !hasSideEffect) continue;
    lines.push('', renderFile(file, repo, diffs, lineReviews), '', '---');
  }

  return lines.join('\n');
}

export function exportMarkdown(
  result: ScanResult, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): Map<string, { markdown: string; branch: string }> {
  const output = new Map<string, { markdown: string; branch: string }>();
  for (const repo of result.repos) {
    const md = renderRepo(repo, diffs, lineReviews);
    output.set(repo.name, { markdown: md, branch: repo.branch });
  }
  return output;
}
