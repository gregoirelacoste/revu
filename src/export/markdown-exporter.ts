// ── Export review results as Markdown (AI-ready format) ──

import type { ScanResult, RepoEntry, FileEntry } from '../core/engine.js';
import type { MethodData, RevuConfig } from '../core/types.js';
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
  if (stats.total === 0) return 'no diff';
  if (stats.reviewed === 0) return 'unreviewed';
  if (stats.reviewed >= stats.total) return 'complete';
  return 'partial';
}

function methodLabel(m: MethodData): string {
  if (m.status === 'new') return m.httpVerb ? `New ${m.httpVerb} endpoint` : 'New';
  if (m.status === 'del') return 'Deleted';
  if (m.sigChanged) return 'Signature changed';
  if (m.isType) return 'Type modified';
  return 'Modified';
}

// ── Header ──

function renderHeader(
  repo: RepoEntry, globalStats: ReviewStats, config: RevuConfig,
): string {
  const now = new Date().toISOString();
  const pct = globalStats.total > 0 ? Math.round((globalStats.reviewed / globalStats.total) * 100) : 0;
  const w = config.scoring.weights;

  const lines = [
    `# Code Review \u2014 ${repo.name}`,
    '',
    `- **Branch**: ${repo.branch}`,
    `- **Base**: ${repo.baseBranch}`,
    `- **SHA**: ${repo.headSha}`,
    `- **Date**: ${now}`,
    `- **Files changed**: ${repo.files.length}`,
    `- **Review progress**: ${globalStats.reviewed}/${globalStats.total} lines (${pct}%)`,
    `- **Findings**: ${globalStats.bugs} bugs, ${globalStats.questions} questions, ${globalStats.comments} comments`,
    `- **Scoring weights**: fileType=${w.fileType}, changeVolume=${w.changeVolume}, dependencies=${w.dependencies}, securityContext=${w.securityContext}`,
  ];
  return lines.join('\n');
}

// ── Findings table ──

interface Finding {
  index: number;
  type: string;
  file: string;
  line: number;
  method: string;
  crit: number;
  comment: string;
}

function collectFindings(
  repo: RepoEntry, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...repo.files].sort((a, b) => b.crit - a.crit || a.path.localeCompare(b.path));

  for (const file of sorted) {
    const changed = allMethods(file).filter(m => m.status !== 'unch');
    let globalReviewLineNum = 0;

    for (const method of changed.sort((a, b) => b.crit - a.crit || a.name.localeCompare(b.name))) {
      if (method.status === 'del') continue;

      for (const d of method.diff) {
        if (d.t === 'a' || d.t === 'c') {
          globalReviewLineNum++;
          const lr = lineReviews.get(`${file.id}:${globalReviewLineNum}`);
          if (lr && (lr.flag === 'bug' || lr.flag === 'question' || lr.comments.length > 0)) {
            const type = lr.flag === 'bug' ? 'BUG' : lr.flag === 'question' ? '?' : 'OK';
            const comment = lr.comments.length > 0
              ? lr.comments.map(c => c.text).join('; ')
              : `Flagged ${lr.flag}`;
            findings.push({
              index: findings.length + 1,
              type,
              file: `${file.name}${file.ext}`,
              line: globalReviewLineNum,
              method: method.name,
              crit: method.crit,
              comment,
            });
          }
        }
      }
    }
  }
  return findings;
}

function renderFindingsTable(findings: Finding[]): string {
  if (findings.length === 0) return '';

  const lines = [
    '',
    '## Findings Summary',
    '',
    '| # | Type | File | Line | Method | Crit | Comment |',
    '|---|------|------|------|--------|------|---------|',
  ];
  for (const f of findings) {
    lines.push(`| ${f.index} | ${f.type} | ${f.file} | ${f.line} | ${f.method} | ${f.crit.toFixed(1)} | ${f.comment} |`);
  }
  return lines.join('\n');
}

// ── Method rendering ──

function renderMethod(
  method: MethodData, fileId: string, lineReviews: Map<string, LineReview>,
  globalReviewLineNum: number,
): { content: string; nextReviewLine: number } {
  if (method.status === 'unch') return { content: '', nextReviewLine: globalReviewLineNum };

  const lines: string[] = [];
  const methodFlags: string[] = [];
  const methodComments: Array<{ flag: string; text: string }> = [];

  // Mirror buildDiffRows logic for counter advancement
  if (method.status !== 'del') {
    for (const d of method.diff) {
      if (d.t === 'a' || d.t === 'c') {
        globalReviewLineNum++;
        const lr = lineReviews.get(`${fileId}:${globalReviewLineNum}`);
        if (lr) {
          if (lr.flag === 'bug') methodFlags.push('BUG');
          if (lr.flag === 'question') methodFlags.push('?');
          for (const c of lr.comments) {
            methodComments.push({ flag: lr.flag, text: c.text });
          }
        }
      }
    }
  }

  const uniqueFlags = [...new Set(methodFlags)];
  const flagStr = uniqueFlags.length > 0 ? ` \u2717 ${uniqueFlags.join(', ')}` : '';

  lines.push(`#### ${method.name} \u2014 ${methodLabel(method)} (${method.crit.toFixed(1)})${flagStr}`);

  // Diff block — keep all lines including context
  if (method.diff.length > 0) {
    lines.push('```diff');
    for (const d of method.diff) {
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

  return { content: lines.join('\n'), nextReviewLine: globalReviewLineNum };
}

// ── File rendering ──

function renderFile(
  file: FileEntry, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
): string {
  const lines: string[] = [];
  const diff = diffs.get(file.id);
  const stats = diff ? computeFileReviewStats(file.id, diff, lineReviews) : { total: 0, reviewed: 0, bugs: 0, questions: 0, comments: 0 };
  const status = fileStatus(stats);
  const hasSideEffect = allMethods(file).some(m => m.impacted);
  const emoji = hasSideEffect ? '\u26A1' : critEmoji(file.crit);

  lines.push(`### ${emoji} ${file.name}${file.ext} (${file.crit.toFixed(1)}) \u2014 ${hasSideEffect ? 'side-effect, ' : ''}${status}`);

  if (hasSideEffect && status === 'unreviewed') {
    const impactedMethods = allMethods(file).filter(m => m.impacted);
    if (impactedMethods.length > 0) {
      lines.push(`${impactedMethods.map(m => `${m.name}()`).join(', ')} consumes methods whose signature changed.`);
    }
  }

  const changed = allMethods(file).filter(m => m.status !== 'unch');
  let globalReviewLineNum = 0;
  for (const method of changed.sort((a, b) => b.crit - a.crit || a.name.localeCompare(b.name))) {
    const { content, nextReviewLine } = renderMethod(method, file.id, lineReviews, globalReviewLineNum);
    globalReviewLineNum = nextReviewLine;
    if (content) lines.push('', content);
  }

  return lines.join('\n');
}

// ── Side-effects section ──

function renderSideEffects(repo: RepoEntry): string {
  const rows: Array<{ sourceFile: string; method: string; impactedBy: string }> = [];

  for (const file of repo.files) {
    for (const m of allMethods(file)) {
      if (!m.impacted) continue;
      rows.push({
        sourceFile: `${file.name}${file.ext}`,
        method: `${m.name}()`,
        impactedBy: `${file.dir}/${file.name}${file.ext}`,
      });
    }
  }

  if (rows.length === 0) return '';

  const lines = [
    '',
    '## Side-Effects',
    '',
    '| File | Method | Impact |',
    '|------|--------|--------|',
  ];
  for (const r of rows) {
    lines.push(`| ${r.sourceFile} | ${r.method} | Signature dependency changed |`);
  }
  return lines.join('\n');
}

// ── AI Review Request section ──

function renderAISection(
  repo: RepoEntry, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): string {
  const lines = [
    '',
    '## AI Review Request',
    '',
    'Analyze this code review and provide:',
    '1. **Validate Findings** \u2014 For each BUG, confirm or reject with reasoning',
    '2. **Answer Questions** \u2014 For each ?, provide code-level analysis',
    '3. **Missed Issues** \u2014 Identify critical issues in unreviewed files',
    '4. **Propose Fixes** \u2014 For confirmed bugs, propose minimal fixes',
  ];

  // List unreviewed high-crit files
  const unreviewed: Array<{ name: string; crit: number }> = [];
  for (const file of repo.files) {
    const diff = diffs.get(file.id);
    if (!diff) continue;
    const stats = computeFileReviewStats(file.id, diff, lineReviews);
    if (stats.total > 0 && stats.reviewed === 0 && file.crit >= 3) {
      unreviewed.push({ name: `${file.name}${file.ext}`, crit: file.crit });
    }
  }

  if (unreviewed.length > 0) {
    unreviewed.sort((a, b) => b.crit - a.crit);
    lines.push('', '### Unreviewed high-criticality files');
    for (const u of unreviewed) {
      lines.push(`- ${u.name} (${u.crit.toFixed(1)})`);
    }
  }

  return lines.join('\n');
}

// ── Repo rendering ──

function renderRepo(
  repo: RepoEntry, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>, config: RevuConfig,
): string {
  const parts: string[] = [];
  const globalStats = computeGlobalReviewStats(diffs, lineReviews);

  // Header
  parts.push(renderHeader(repo, globalStats, config));

  // Findings table
  const findings = collectFindings(repo, diffs, lineReviews);
  const findingsTable = renderFindingsTable(findings);
  if (findingsTable) parts.push(findingsTable);

  parts.push('', '---');

  // Files
  const sorted = [...repo.files].sort((a, b) => b.crit - a.crit || a.path.localeCompare(b.path));
  for (const file of sorted) {
    const hasDiff = allMethods(file).some(m => m.status !== 'unch');
    const hasSideEffect = allMethods(file).some(m => m.impacted);
    if (!hasDiff && !hasSideEffect) continue;
    parts.push('', renderFile(file, diffs, lineReviews), '', '---');
  }

  // Side-effects
  const sideEffects = renderSideEffects(repo);
  if (sideEffects) parts.push(sideEffects);

  // AI Review Request
  parts.push(renderAISection(repo, diffs, lineReviews));

  return parts.join('\n');
}

// ── Public API ──

export function exportMarkdown(
  result: ScanResult, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): Map<string, { markdown: string; branch: string }> {
  const output = new Map<string, { markdown: string; branch: string }>();
  for (const repo of result.repos) {
    const md = renderRepo(repo, diffs, lineReviews, result.config);
    output.set(repo.name, { markdown: md, branch: repo.branch });
  }
  return output;
}
