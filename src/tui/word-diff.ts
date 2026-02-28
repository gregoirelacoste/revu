// ── Word-level diff highlighting ──

import type { TuiDiffLine } from './types.js';

interface Token { text: string; start: number; end: number }

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  const re = /[a-zA-Z0-9_]+|[^a-zA-Z0-9_]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function lcsTokens(a: Token[], b: Token[]): Set<number>[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].text === b[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const inA = new Set<number>(), inB = new Set<number>();
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i].text === b[j].text) { inA.add(i); inB.add(j); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return [inA, inB];
}

export function computeWordDiff(oldStr: string, newStr: string): { oldRanges: [number, number][]; newRanges: [number, number][] } {
  const oldToks = tokenize(oldStr);
  const newToks = tokenize(newStr);
  const [inOld, inNew] = lcsTokens(oldToks, newToks);

  const oldRanges: [number, number][] = [];
  const newRanges: [number, number][] = [];
  for (let i = 0; i < oldToks.length; i++) {
    if (!inOld.has(i)) oldRanges.push([oldToks[i].start, oldToks[i].end]);
  }
  for (let j = 0; j < newToks.length; j++) {
    if (!inNew.has(j)) newRanges.push([newToks[j].start, newToks[j].end]);
  }
  return { oldRanges, newRanges };
}

export function injectWordDiffRanges(baseLines: TuiDiffLine[], reviewLines: TuiDiffLine[]): void {
  let bi = 0, ri = 0;
  while (bi < baseLines.length && ri < reviewLines.length) {
    // Find consecutive del block
    const delStart = bi;
    while (bi < baseLines.length && baseLines[bi].t === 'del') bi++;
    // Find consecutive add block
    const addStart = ri;
    while (ri < reviewLines.length && reviewLines[ri].t === 'add') ri++;

    const delCount = bi - delStart;
    const addCount = ri - addStart;
    const pairs = Math.min(delCount, addCount);

    for (let p = 0; p < pairs; p++) {
      const { oldRanges, newRanges } = computeWordDiff(baseLines[delStart + p].c, reviewLines[addStart + p].c);
      if (oldRanges.length > 0) baseLines[delStart + p].hiRanges = oldRanges;
      if (newRanges.length > 0) reviewLines[addStart + p].hiRanges = newRanges;
    }

    // Skip ctx lines
    while (bi < baseLines.length && baseLines[bi].t === 'ctx') bi++;
    while (ri < reviewLines.length && reviewLines[ri].t === 'ctx') ri++;
  }
}
