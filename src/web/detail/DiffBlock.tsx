import type { DiffEntry, Palette } from '../types';
import { MONO } from '../theme/colors';
import { DiffLine } from './DiffLine';

interface Props {
  diff: DiffEntry[];
  P: Palette;
}

export function DiffBlock({ diff, P }: Props) {
  // Pair del/add lines for word-level diff
  const paired: Record<number, number> = {};
  let i = 0;
  while (i < diff.length) {
    if (diff[i].t === 'd' && i + 1 < diff.length && diff[i + 1].t === 'a') {
      paired[i] = i + 1;
      paired[i + 1] = i;
      i += 2;
    } else {
      i++;
    }
  }

  return (
    <div style={{
      borderRadius: 5, overflow: 'hidden',
      border: `1px solid ${P.border}`,
      fontSize: 9.5, fontFamily: MONO, marginBottom: 6,
    }}>
      {diff.map((line, idx) => (
        <DiffLine key={idx} line={line}
          pairedLine={paired[idx] !== undefined ? diff[paired[idx]] : null}
          P={P} />
      ))}
    </div>
  );
}
