export interface DiffToken { text: string; changed: boolean }

export function wordDiff(oldLine: string, newLine: string): { old: DiffToken[]; new: DiffToken[] } {
  const oWords = oldLine.split(/(\s+)/);
  const nWords = newLine.split(/(\s+)/);
  const result = { old: [] as DiffToken[], new: [] as DiffToken[] };
  const maxLen = Math.max(oWords.length, nWords.length);

  for (let i = 0; i < maxLen; i++) {
    const ow = oWords[i] ?? '';
    const nw = nWords[i] ?? '';
    if (ow === nw) {
      result.old.push({ text: ow, changed: false });
      result.new.push({ text: nw, changed: false });
    } else {
      if (ow) result.old.push({ text: ow, changed: true });
      if (nw) result.new.push({ text: nw, changed: true });
    }
  }

  return result;
}
