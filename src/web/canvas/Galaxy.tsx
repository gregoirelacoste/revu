import { useCallback } from 'react';
import type { GalaxyData, SystemData, Palette } from '../types';
import { MONO, SANS } from '../theme/colors';
import { System } from './System';

interface GalaxyProps {
  galaxy: GalaxyData;
  P: Palette;
  isFocused: boolean;
  focusedSystemId: string | null;
  onGalaxyClick: (g: GalaxyData) => void;
  onSystemClick: (s: SystemData, g: GalaxyData) => void;
}

export function Galaxy({
  galaxy: g, P, isFocused, focusedSystemId,
  onGalaxyClick, onSystemClick,
}: GalaxyProps) {
  const c = P[g.color as keyof Palette] as string;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onGalaxyClick(g);
  }, [g, onGalaxyClick]);

  const handleSystemClick = useCallback((s: SystemData) => {
    onSystemClick(s, g);
  }, [g, onSystemClick]);

  return (
    <div>
      {/* Ellipse */}
      <div data-clickable onClick={handleClick} style={{
        position: 'absolute', left: g.cx - g.rx, top: g.cy - g.ry,
        width: g.rx * 2, height: g.ry * 2, borderRadius: '50%',
        background: isFocused
          ? `${c}0c`
          : `radial-gradient(ellipse at center, ${c}${P.gBg}, transparent)`,
        border: `${isFocused ? 2 : 1.5}px solid ${c}${isFocused ? '30' : P.gBo}`,
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }} />
      {/* Label - more visible */}
      <div style={{
        position: 'absolute', left: g.cx - g.rx + 18, top: g.cy - g.ry + 12,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: 19, fontWeight: 900, fontFamily: SANS, color: `${c}cc`,
          letterSpacing: 2, textTransform: 'uppercase',
          textShadow: `0 0 20px ${c}50`,
        }}>
          {g.label}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500, fontFamily: MONO, color: `${c}55`,
          marginTop: 2,
        }}>
          {g.branch}
        </div>
      </div>
      {/* Systems */}
      {g.systems.map(s => (
        <System key={s.id} system={s} galaxy={g} P={P}
          isFocused={focusedSystemId === s.id}
          onSystemClick={handleSystemClick} />
      ))}
    </div>
  );
}
