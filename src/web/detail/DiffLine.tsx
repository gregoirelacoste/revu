import type { DiffEntry, Palette } from '../types';
import { wordDiff } from '../utils/wordDiff';

interface Props {
  line: DiffEntry;
  pairedLine: DiffEntry | null;
  P: Palette;
}

export function DiffLine({ line, pairedLine, P }: Props) {
  const bg = { a: P.diffAddBg, d: P.diffDelBg, c: 'transparent' };
  const cl = { a: P.green, d: P.red, c: P.dim };
  const px = { a: '+', d: '-', c: ' ' };

  let tokens = null;
  if (pairedLine && line.t !== 'c') {
    const wd = wordDiff(
      line.t === 'd' ? line.c : pairedLine.c,
      line.t === 'a' ? line.c : pairedLine.c,
    );
    tokens = line.t === 'd' ? wd.old : wd.new;
  }

  return (
    <div style={{
      display: 'flex', background: bg[line.t],
      borderLeft: line.t === 'a' ? `2px solid ${P.green}40`
        : line.t === 'd' ? `2px solid ${P.red}40`
        : '2px solid transparent',
    }}>
      <span style={{
        width: 14, textAlign: 'center', color: cl[line.t],
        fontWeight: 700, flexShrink: 0, fontSize: 8, lineHeight: '17px',
      }}>{px[line.t]}</span>
      <span style={{ whiteSpace: 'pre', paddingRight: 6, lineHeight: '17px' }}>
        {tokens ? tokens.map((tk, i) => (
          <span key={i} style={{
            color: tk.changed
              ? (line.t === 'd' ? P.red : P.green)
              : (line.t === 'c' ? P.dim : P.bright),
            background: tk.changed
              ? (line.t === 'd' ? P.diffDelHi : P.diffAddHi)
              : 'transparent',
            borderRadius: tk.changed ? 2 : 0,
            fontWeight: tk.changed ? 700 : 400,
          }}>{tk.text}</span>
        )) : (
          <span style={{ color: line.t === 'c' ? P.dim : P.bright }}>{line.c}</span>
        )}
      </span>
    </div>
  );
}
