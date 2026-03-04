// ── Export review results as Markdown (AI-ready format) ──

import type { ScanResult, RepoEntry, FileEntry } from '../core/engine.js';
import type { MethodData, RevuConfig, ScoringContext, FileScoringBreakdown } from '../core/types.js';
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
  scoringCtx?: ScoringContext,
): string {
  const now = new Date().toISOString();
  const pct = globalStats.total > 0 ? Math.round((globalStats.reviewed / globalStats.total) * 100) : 0;

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
  ];

  if (scoringCtx) {
    lines.push(
      '',
      `## Scoring (${scoringCtx.scorerVersion} \u2014 config ${scoringCtx.configHash})`,
      '',
      '**Formula**: `changeCrit \u00D7 graphAmplifier \u00D7 (1 + compoundBonus) \u00D7 attenuations`',
      '',
      '| Factor | Description | Range |',
      '|--------|-------------|-------|',
      '| changeCrit | Content analysis of changed lines (top-heavy mean) | 0-10 |',
      '| graphAmplifier | Structural importance from dependency graph | 0.5-2.0 |',
      '| compoundBonus | Signature+deps, propagation, cascade, DTO, endpoints | 0-0.7 |',
      '| fmtDiscount | Formatting-only attenuation | 0.1-1.0 |',
      '| testDiscount | Spec file present \u2192 0.85 | 0.85-1.0 |',
    );
  } else {
    const w = config.scoring.weights;
    lines.push(`- **Scoring weights**: fileType=${w.fileType}, changeVolume=${w.changeVolume}, dependencies=${w.dependencies}, securityContext=${w.securityContext}`);
  }

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

    for (const method of changed.sort((a, b) => b.crit - a.crit || a.name.localeCompare(b.name))) {
      for (const d of method.diff) {
        const lr = lineReviews.get(`${file.id}:${d.ln}`);
        if (lr && (lr.flag === 'bug' || lr.flag === 'question' || lr.comments.length > 0)) {
          const type = lr.flag === 'bug' ? 'BUG' : lr.flag === 'question' ? '?' : 'OK';
          const comment = lr.comments.length > 0
            ? lr.comments.map(c => {
                const ts = c.time ? ` [${new Date(c.time).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}]` : '';
                return `${c.text}${ts}`;
              }).join('; ')
            : `Flagged ${lr.flag}`;
          findings.push({
            index: findings.length + 1,
            type,
            file: `${file.name}${file.ext}`,
            line: d.ln,
            method: method.name,
            crit: method.crit,
            comment,
          });
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
): string {
  if (method.status === 'unch') return '';

  const lines: string[] = [];
  const methodFlags: string[] = [];
  const methodComments: Array<{ flag: string; text: string; time: string }> = [];

  for (const d of method.diff) {
    const lr = lineReviews.get(`${fileId}:${d.ln}`);
    if (lr) {
      if (lr.flag === 'bug') methodFlags.push('BUG');
      if (lr.flag === 'question') methodFlags.push('?');
      for (const c of lr.comments) {
        methodComments.push({ flag: lr.flag, text: c.text, time: c.time });
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
    const ts = mc.time ? ` _[${new Date(mc.time).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}]_` : '';
    lines.push(`> **${label}** : ${mc.text}${ts}`);
  }

  return lines.join('\n');
}

// ── File rendering ──

function renderBreakdownLine(b: FileScoringBreakdown): string {
  const parts: string[] = [];
  parts.push(`> **Score**: ${b.changeCrit.toFixed(1)} \u00D7 ${b.graphAmplifier.toFixed(2)} \u00D7 (1+${b.compoundBonus.toFixed(2)}) \u00D7 ${b.fmtDiscount.toFixed(1)} \u00D7 ${b.testDiscount.toFixed(2)} = **${b.finalScore.toFixed(1)}**`);

  const cats = Object.entries(b.lineCategories)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  parts.push(`> **Lines**: ${b.lineCount} changed \u2014 ${cats}`);

  if (b.graphSignals) {
    const g = b.graphSignals;
    parts.push(`> **Graph**: importance=${g.graphImportance.toFixed(2)}, callerCrit=${g.callerCritWeight.toFixed(2)}, entryProx=${g.entryProximity.toFixed(2)}, exclusivity=${g.exclusivity.toFixed(2)}`);
  }

  return parts.join('\n');
}

function renderFile(
  file: FileEntry, diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
  scoringCtx?: ScoringContext,
): string {
  const lines: string[] = [];
  const diff = diffs.get(file.id);
  const stats = diff ? computeFileReviewStats(file.id, diff, lineReviews) : { total: 0, reviewed: 0, bugs: 0, questions: 0, comments: 0 };
  const status = fileStatus(stats);
  const hasSideEffect = allMethods(file).some(m => m.impacted);
  const emoji = hasSideEffect ? '\u26A1' : critEmoji(file.crit);

  lines.push(`### ${emoji} ${file.name}${file.ext} (${file.crit.toFixed(1)}) \u2014 ${hasSideEffect ? 'side-effect, ' : ''}${status}`);

  const breakdown = scoringCtx?.files[file.path];
  if (breakdown) {
    lines.push(renderBreakdownLine(breakdown));
  }

  if (hasSideEffect && status === 'unreviewed') {
    const impactedMethods = allMethods(file).filter(m => m.impacted);
    if (impactedMethods.length > 0) {
      lines.push(`${impactedMethods.map(m => `${m.name}()`).join(', ')} consumes methods whose signature changed.`);
    }
  }

  const changed = allMethods(file).filter(m => m.status !== 'unch');
  for (const method of changed.sort((a, b) => b.crit - a.crit || a.name.localeCompare(b.name))) {
    const content = renderMethod(method, file.id, lineReviews);
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
  scoringCtx?: ScoringContext,
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

  if (scoringCtx) {
    lines.push(`5. **Challenge Scoring** \u2014 For each file, compare the automated score with your assessment. Score formula version: ${scoringCtx.scorerVersion} (config hash: ${scoringCtx.configHash}). If you disagree with a score, explain what the scorer missed or over-weighted.`);
  }

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
  scoringCtx?: ScoringContext,
): string {
  const parts: string[] = [];
  const globalStats = computeGlobalReviewStats(diffs, lineReviews);

  // Header
  parts.push(renderHeader(repo, globalStats, config, scoringCtx));

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
    parts.push('', renderFile(file, diffs, lineReviews, scoringCtx), '', '---');
  }

  // Side-effects
  const sideEffects = renderSideEffects(repo);
  if (sideEffects) parts.push(sideEffects);

  // AI Review Request
  parts.push(renderAISection(repo, diffs, lineReviews, scoringCtx));

  return parts.join('\n');
}

// ── Light export: compact findings + mini-diffs ──

function renderLightRepo(
  repo: RepoEntry, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): string {
  const globalStats = computeGlobalReviewStats(diffs, lineReviews);
  const pct = globalStats.total > 0 ? Math.round((globalStats.reviewed / globalStats.total) * 100) : 0;

  const parts: string[] = [
    `# Review Comments \u2014 ${repo.name}`,
    '',
    `- **Branch**: ${repo.branch}`,
    `- **SHA**: ${repo.headSha}`,
    `- **Progress**: ${globalStats.reviewed}/${globalStats.total} lines (${pct}%) \u2014 ${globalStats.bugs} bugs, ${globalStats.questions} questions, ${globalStats.comments} comments`,
  ];

  const findings = collectFindings(repo, diffs, lineReviews);
  if (findings.length === 0) {
    parts.push('', 'No findings yet.');
    return parts.join('\n');
  }

  // Findings table
  parts.push('', '## Findings', '', '| # | Type | File | Method | Crit | Comment |', '|---|------|------|--------|------|---------|');
  for (const f of findings) {
    parts.push(`| ${f.index} | ${f.type} | ${f.file} | ${f.method} | ${f.crit.toFixed(1)} | ${f.comment} |`);
  }

  // Details: group findings by file+method, extract mini-diffs
  parts.push('', '## Details');
  const grouped = groupFindingsByMethod(findings, repo);
  for (const group of grouped) {
    parts.push('', `### ${group.file} \u00B7 ${group.method} (${group.crit.toFixed(1)})`, '');
    for (const f of group.findings) {
      const label = FLAG_LABEL[f.flag] ?? f.flag;
      parts.push(`> **${label}** : ${f.comment}`);
    }
    if (group.miniDiff.length > 0) {
      parts.push('', '```diff');
      for (const line of group.miniDiff) parts.push(line);
      parts.push('```');
    }
  }

  // AI prompt
  parts.push(
    '', '---', '',
    'Analyze these findings:',
    '1. Validate each BUG \u2014 confirm or reject',
    '2. Answer each Question',
    '3. Suggest minimal fixes',
  );

  return parts.join('\n');
}

interface GroupedFinding {
  file: string;
  method: string;
  crit: number;
  findings: Array<{ flag: string; comment: string; line: number }>;
  miniDiff: string[];
}

function groupFindingsByMethod(
  findings: Finding[], repo: RepoEntry,
): GroupedFinding[] {
  // Group findings by file+method
  const map = new Map<string, GroupedFinding>();

  for (const f of findings) {
    const key = `${f.file}::${f.method}`;
    let group = map.get(key);
    if (!group) {
      group = { file: f.file, method: f.method, crit: f.crit, findings: [], miniDiff: [] };
      map.set(key, group);
    }
    group.findings.push({ flag: f.type, comment: f.comment, line: f.line });
  }

  // For each group, extract a mini-diff from method data
  for (const group of map.values()) {
    const file = repo.files.find(f => `${f.name}${f.ext}` === group.file);
    if (!file) continue;

    const method = allMethods(file).find(m => m.name === group.method);
    if (!method || method.status === 'del' || method.diff.length === 0) continue;

    // Build reviewable lines with their git line numbers
    const reviewLines: Array<{ num: number; prefix: string; content: string }> = [];
    for (const d of method.diff) {
      const prefix = d.t === 'a' ? '+' : d.t === 'd' ? '-' : ' ';
      reviewLines.push({ num: d.ln, prefix, content: d.c });
    }

    // Find flagged line indices and extract context window
    const flaggedNums = new Set(group.findings.map(f => f.line));
    const includedIndices = new Set<number>();
    const CTX = 2;
    for (let i = 0; i < reviewLines.length; i++) {
      if (flaggedNums.has(reviewLines[i].num) && reviewLines[i].prefix !== ' ') {
        for (let j = Math.max(0, i - CTX); j <= Math.min(reviewLines.length - 1, i + CTX); j++) {
          includedIndices.add(j);
        }
      }
    }

    if (includedIndices.size === 0) {
      // Fallback: include first few lines
      for (let i = 0; i < Math.min(5, reviewLines.length); i++) includedIndices.add(i);
    }

    const sorted = [...includedIndices].sort((a, b) => a - b);
    let prevIdx = -2;
    for (const idx of sorted) {
      if (idx > prevIdx + 1 && prevIdx >= 0) group.miniDiff.push('  ...');
      const rl = reviewLines[idx];
      const marker = flaggedNums.has(rl.num) && rl.prefix === '+' ? '  // \u2190 flagged' : '';
      group.miniDiff.push(`${rl.prefix} ${rl.content}${marker}`);
      prevIdx = idx;
    }
  }

  return [...map.values()];
}

// ── Public API ──

export function exportMarkdown(
  result: ScanResult, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): Map<string, { markdown: string; branch: string }> {
  const output = new Map<string, { markdown: string; branch: string }>();
  for (const repo of result.repos) {
    const md = renderRepo(repo, diffs, lineReviews, result.config, result.scoringContext);
    output.set(repo.name, { markdown: md, branch: repo.branch });
  }
  return output;
}

export function exportLightMarkdown(
  result: ScanResult, diffs: Map<string, TuiFileDiff>, lineReviews: Map<string, LineReview>,
): Map<string, { markdown: string; branch: string }> {
  const output = new Map<string, { markdown: string; branch: string }>();
  for (const repo of result.repos) {
    const md = renderLightRepo(repo, diffs, lineReviews);
    output.set(repo.name, { markdown: md, branch: repo.branch });
  }
  return output;
}
