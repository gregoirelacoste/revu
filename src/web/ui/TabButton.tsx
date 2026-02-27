import type { Palette } from '../types';
import { MONO } from '../theme/colors';

interface Props {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  P: Palette;
}

export function TabButton({ label, count, active, onClick, P }: Props) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '6px 0', fontSize: 8, fontFamily: MONO, fontWeight: 700,
      background: active ? `${P.cyan}08` : 'transparent',
      border: 'none', borderBottom: active ? `2px solid ${P.cyan}` : '2px solid transparent',
      color: active ? P.cyan : P.dim,
      cursor: 'pointer', letterSpacing: 0.5,
    }}>
      {label} ({count})
    </button>
  );
}
