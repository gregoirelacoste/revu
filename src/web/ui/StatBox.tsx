import type { Palette } from '../types';
import { MONO } from '../theme/colors';

interface Props {
  label: string;
  value: string;
  color: string;
  P: Palette;
}

export function StatBox({ label, value, color, P }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, fontFamily: MONO }}>{value}</div>
      <div style={{ fontSize: 7, color: P.dim, fontFamily: MONO, letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
