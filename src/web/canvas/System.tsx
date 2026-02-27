import { useCallback, useState } from 'react';
import type { SystemData, GalaxyData, Palette } from '../types';
import { MONO } from '../theme/colors';

interface SystemProps {
  system: SystemData;
  galaxy: GalaxyData;
  P: Palette;
  isFocused: boolean;
  onSystemClick: (s: SystemData) => void;
}

export function System({ system: s, galaxy: g, P, isFocused, onSystemClick }: SystemProps) {
  const c = P[g.color as keyof Palette] as string;
  const sx = g.cx + s.cx;
  const sy = g.cy + s.cy;
  const [hov, setHov] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSystemClick(s);
  }, [s, onSystemClick]);

  return (
    <div>
      <div data-clickable onClick={handleClick}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{
          position: 'absolute', left: sx - s.r, top: sy - s.r,
          width: s.r * 2, height: s.r * 2, borderRadius: '50%',
          background: `${c}${isFocused ? '0a' : P.sBg}`,
          border: `${isFocused ? 2 : 1}px dashed ${c}${isFocused ? '35' : hov ? '25' : P.sBo}`,
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }} />
      <div style={{
        position: 'absolute', left: sx - s.r + 8, top: sy - s.r + 6,
        fontSize: hov || isFocused ? 11 : 9, fontFamily: MONO, fontWeight: 600,
        color: hov || isFocused ? `${c}bb` : `${c}44`,
        background: hov || isFocused ? `${P.lBg}dd` : 'transparent',
        padding: hov || isFocused ? '2px 7px' : '0', borderRadius: 4,
        pointerEvents: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
        zIndex: hov || isFocused ? 5 : 0,
        border: hov || isFocused ? `1px solid ${c}18` : '1px solid transparent',
      }}>{s.label}</div>
    </div>
  );
}
