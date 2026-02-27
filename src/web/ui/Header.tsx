import type { Palette, FocusTarget } from '../types';
import { MONO } from '../theme/colors';

interface HeaderProps {
  P: Palette;
  dark: boolean;
  setDark: (v: boolean) => void;
  focus: FocusTarget | null;
  zoomOut: () => void;
  reviewed: number;
  total: number;
}

export function Header({ P, dark, setDark, focus, zoomOut, reviewed, total }: HeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '5px 14px',
      borderBottom: `1px solid ${P.border}`, background: P.surface,
      zIndex: 30, gap: 8,
    }}>
      <span style={{ fontWeight: 900, fontSize: 12, letterSpacing: 2, fontFamily: MONO, color: P.cyan }}>
        ◈ REVU
      </span>
      <div style={{ flex: 1 }} />
      {focus && (
        <button onClick={zoomOut} style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO,
          background: `${P.cyan}10`, border: `1px solid ${P.cyan}25`,
          color: P.cyan, cursor: 'pointer',
        }}>← univers</button>
      )}
      <span style={{ fontSize: 8, fontFamily: MONO, color: P.dim }}>
        {reviewed}/{total}
      </span>
      <button onClick={() => setDark(!dark)} style={{
        padding: '2px 8px', borderRadius: 4, fontSize: 9, fontFamily: MONO,
        background: 'transparent', border: `1px solid ${P.border}`,
        color: P.dim, cursor: 'pointer',
      }}>{dark ? '☀' : '●'}</button>
    </div>
  );
}
