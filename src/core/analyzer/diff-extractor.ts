// ── Diff extraction and method/constant data builders ──

import { computeMethodCriticality } from '../scoring/criticality.js';
import type {
  ParsedFile, FileDiff, MethodData, DiffLineType,
  MethodStatus, ScoringConfig,
} from '../types.js';

type OldAst = { methods: { name: string; signature: string }[]; constants: { name: string }[] } | null;

export function buildMethodData(
  pf: ParsedFile, diff: FileDiff, oldAst: OldAst,
  fileCrit: number, scoring: ScoringConfig,
): MethodData[] {
  const result: MethodData[] = pf.methods.map(m => {
    const oldMethod = oldAst?.methods.find(om => om.name === m.name);
    const isNew = !oldMethod;
    const sigChanged = !isNew && oldMethod.signature !== m.signature;
    const rawDiff = extractMethodDiff(m.startLine, m.endLine, diff);
    const formatOnly = !isNew && isFormattingOnly(rawDiff);
    const methodDiff = formatOnly ? [] : rawDiff;
    const status: MethodStatus = isNew ? 'new' : methodDiff.length > 0 ? 'mod' : 'unch';
    const crit = computeMethodCriticality(scoring, fileCrit, 1, 1, sigChanged, pf.path);

    return {
      name: m.name, status, crit, usages: 1, tested: false,
      sigChanged, httpVerb: m.httpVerb, diff: methodDiff,
    };
  });

  if (oldAst?.methods) {
    const newNames = new Set(pf.methods.map(m => m.name));
    for (const om of oldAst.methods) {
      if (!newNames.has(om.name)) {
        const delDiff = extractDeletedBlockDiff(om.name, diff);
        if (delDiff.length === 0) continue;
        result.push({
          name: om.name, status: 'del',
          crit: Math.round(fileCrit * 0.8 * 10) / 10,
          usages: 0, tested: false, sigChanged: false, diff: delDiff,
        });
      }
    }
  }

  return result;
}

export function buildConstantData(
  pf: ParsedFile, diff: FileDiff, oldAst: OldAst, fileCrit: number,
): MethodData[] {
  const result = pf.constants.map(c => {
    const rawDiff = extractMethodDiff(c.startLine, c.endLine, diff);
    if (rawDiff.length === 0 || isFormattingOnly(rawDiff)) return null;
    return {
      name: c.name, status: 'new' as MethodStatus,
      crit: Math.round(fileCrit * 0.6 * 10) / 10,
      usages: 1, tested: false, sigChanged: false,
      isType: c.isType, diff: rawDiff,
    };
  }).filter(Boolean) as MethodData[];

  if (oldAst?.constants) {
    const newNames = new Set(pf.constants.map(c => c.name));
    for (const oc of oldAst.constants) {
      if (!newNames.has(oc.name)) {
        const delDiff = extractDeletedBlockDiff(oc.name, diff);
        if (delDiff.length === 0) continue;
        result.push({
          name: oc.name, status: 'del',
          crit: Math.round(fileCrit * 0.5 * 10) / 10,
          usages: 0, tested: false, sigChanged: false, diff: delDiff,
        });
      }
    }
  }

  return result;
}

// ── Formatting filter ──

function normalizeLine(s: string): string {
  return s.trim().replace(/\s+/g, ' ').replace(/[;,]$/g, '').replace(/'/g, '"');
}

function isFormattingOnly(diff: Array<{ t: DiffLineType; c: string }>): boolean {
  if (diff.length === 0) return true;
  const adds = diff.filter(d => d.t === 'a').map(d => normalizeLine(d.c));
  const dels = diff.filter(d => d.t === 'd').map(d => normalizeLine(d.c));
  if (adds.length === 0 && dels.length === 0) return true;
  if (adds.length !== dels.length) return false;
  const sortedAdds = [...adds].sort();
  const sortedDels = [...dels].sort();
  return sortedAdds.every((a, i) => a === sortedDels[i]);
}

// ── Diff line extraction ──

function extractDeletedBlockDiff(
  name: string, diff: FileDiff,
): Array<{ t: DiffLineType; c: string }> {
  const result: Array<{ t: DiffLineType; c: string }> = [];
  for (const hunk of diff.hunks) {
    const delBlock: string[] = [];
    for (const line of hunk.lines) {
      if (line.type === 'del') {
        delBlock.push(line.content);
      } else {
        if (delBlock.some(l => l.includes(name))) {
          for (const dl of delBlock) result.push({ t: 'd', c: dl });
        }
        delBlock.length = 0;
      }
    }
    if (delBlock.some(l => l.includes(name))) {
      for (const dl of delBlock) result.push({ t: 'd', c: dl });
    }
  }
  return result;
}

function extractMethodDiff(
  startLine: number, endLine: number, diff: FileDiff,
): Array<{ t: DiffLineType; c: string }> {
  const result: Array<{ t: DiffLineType; c: string }> = [];
  for (const hunk of diff.hunks) {
    let newLine = hunk.newStart;
    for (const line of hunk.lines) {
      if (line.type === 'del') {
        if (newLine >= startLine && newLine <= endLine) {
          result.push({ t: 'd', c: line.content });
        }
        continue;
      }
      if (newLine >= startLine && newLine <= endLine) {
        if (line.type === 'add') result.push({ t: 'a', c: line.content });
        else if (line.type === 'context') result.push({ t: 'c', c: line.content });
      }
      newLine++;
    }
  }
  return result;
}
