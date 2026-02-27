import { useCallback, useState } from 'react';
import type { SystemData, GalaxyData, Palette } from '../types';
import { MONO } from '../theme/colors';

interface SystemProps {
  system: SystemData;
  galaxy: GalaxyData;
  P: Palette;
  isFocused: boolean;
  focusedSystemId: string | null;
  highlightedSystemIds: Set<string>;
  parentOffset: { x: number; y: number };
  onSystemClick: (s: SystemData, absCx: number, absCy: number) => void;
  onSystemHover?: (id: string | null) => void;
  depth?: number;
}

export function System({
  system: s, galaxy: g, P, isFocused, focusedSystemId, highlightedSystemIds,
  parentOffset, onSystemClick, onSystemHover, depth = 0,
}: SystemProps) {
  const c = P[g.color as keyof Palette] as string;
  const sx = parentOffset.x + s.cx;
  const sy = parentOffset.y + s.cy;
  const [hov, setHov] = useState(false);

  const isHighlighted = highlightedSystemIds.has(s.id);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSystemClick(s, sx, sy);
  }, [s, sx, sy, onSystemClick]);

  const handleEnter = useCallback(() => {
    setHov(true);
    onSystemHover?.(s.id);
  }, [s.id, onSystemHover]);

  const handleLeave = useCallback(() => {
    setHov(false);
    onSystemHover?.(null);
  }, [onSystemHover]);

  const borderWidth = Math.max(1, 1.5 - depth * 0.3);
  const bgOpacity = depth > 0 ? '08' : isFocused ? '0a' : P.sBg;
  const labelVisible = hov || isFocused || isHighlighted;

  return (
    <div>
      <div data-clickable onClick={handleClick}
        onMouseEnter={handleEnter} onMouseLeave={handleLeave}
        style={{
          position: 'absolute', left: sx - s.r, top: sy - s.r,
          width: s.r * 2, height: s.r * 2, borderRadius: '50%',
          background: `${c}${bgOpacity}`,
          border: `${isFocused ? 2 : borderWidth}px dashed ${c}${isFocused ? '35' : hov ? '25' : P.sBo}`,
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }} />
      <div style={{
        position: 'absolute', left: sx - s.r + 8, top: sy - s.r + 6,
        fontSize: labelVisible ? 11 : 9, fontFamily: MONO,
        fontWeight: isHighlighted ? 900 : 600,
        color: labelVisible ? `${c}bb` : `${c}44`,
        background: labelVisible ? `${P.lBg}dd` : 'transparent',
        padding: labelVisible ? '2px 7px' : '0', borderRadius: 4,
        pointerEvents: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap',
        zIndex: labelVisible ? 5 : 0,
        border: labelVisible ? `1px solid ${c}18` : '1px solid transparent',
      }}>{s.label}</div>

      {s.children?.map(child => (
        <System key={child.id} system={child} galaxy={g} P={P}
          isFocused={focusedSystemId === child.id}
          focusedSystemId={focusedSystemId}
          highlightedSystemIds={highlightedSystemIds}
          parentOffset={{ x: sx, y: sy }}
          onSystemClick={onSystemClick}
          onSystemHover={onSystemHover}
          depth={depth + 1} />
      ))}
    </div>
  );
}
