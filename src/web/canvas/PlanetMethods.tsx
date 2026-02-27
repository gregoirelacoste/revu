import type { MethodData, Palette } from '../types';
import { MONO, critColor } from '../theme/colors';

interface Props {
  items: MethodData[];
  baseR: number;
  zoomLevel: number;
  P: Palette;
}

export function PlanetMethods({ items, baseR, zoomLevel, P }: Props) {
  const count = zoomLevel >= 1.4 ? 6 : 3;
  return (
    <div style={{ marginTop: 4, width: baseR * 2, pointerEvents: 'none' }}>
      {items.slice(0, count).map(it => {
        const mc = P[critColor(it.crit) as keyof Palette] as string;
        return (
          <div key={it.name} style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '0 2px', fontSize: 6, fontFamily: MONO,
          }}>
            <span style={{
              color: it.status === 'new' ? P.green : it.status === 'mod' ? P.orange : P.dim,
              fontWeight: 800, width: 5,
            }}>
              {it.status === 'new' ? '+' : it.status === 'mod' ? '~' : '·'}
            </span>
            <span style={{
              flex: 1, color: P.text, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{it.name}</span>
            {it.sigChanged && <span style={{ color: P.red, fontSize: 5 }}>⚠</span>}
            {it.tested === false && it.crit >= 5 && (
              <span style={{ fontSize: 5, color: P.red }}>○</span>
            )}
            <span style={{ color: mc, fontWeight: 700, fontSize: 5.5 }}>
              {it.crit.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
