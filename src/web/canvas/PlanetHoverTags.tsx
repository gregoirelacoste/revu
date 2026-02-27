import type { MethodData, Palette } from '../types';
import { MONO } from '../theme/colors';

interface Props {
  items: MethodData[];
  tested: boolean;
  baseR: number;
  P: Palette;
}

export function PlanetHoverTags({ items, tested, baseR, P }: Props) {
  const newFn = items.filter(m => m.status === 'new' && !m.isType).length;
  const modFn = items.filter(m => m.status === 'mod').length;
  const sigC = items.filter(m => m.sigChanged).length;

  return (
    <div style={{
      position: 'absolute', top: baseR * 2 + 4, left: baseR - 80, width: 160,
      background: `${P.surface}ee`, border: `1px solid ${P.border}`, borderRadius: 6,
      padding: '4px 6px', backdropFilter: 'blur(6px)', pointerEvents: 'none',
      display: 'flex', flexWrap: 'wrap', gap: 3,
    }}>
      {newFn > 0 && <Tag text={`+${newFn} fn`} color={P.green} P={P} />}
      {modFn > 0 && <Tag text={`~${modFn} mod`} color={P.orange} P={P} />}
      {sigC > 0 && <Tag text={`⚠ ${sigC} sig`} color={P.red} P={P} />}
      {!tested && <Tag text="untested" color={P.red} P={P} />}
    </div>
  );
}

function Tag({ text, color, P }: { text: string; color: string; P: Palette }) {
  return (
    <span style={{
      fontSize: 7, fontFamily: MONO, color,
      background: `${color}10`, padding: '0 4px', borderRadius: 3,
    }}>{text}</span>
  );
}
