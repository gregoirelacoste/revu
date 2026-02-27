import { useMemo, useCallback, useState } from 'react';
import type { FlatPlanet, Palette } from '../types';
import { MONO, SANS, critColor, BADGE_ICONS } from '../theme/colors';
import { baseRadius } from '../utils/geometry';
import { PlanetHoverTags } from './PlanetHoverTags';


interface PlanetProps {
  planet: FlatPlanet;
  P: Palette;
  isFocused: boolean;
  isVisible: boolean;
  isBlastL1: boolean;
  isBlastL2: boolean;
  isArchived: boolean;
  isMethodHighlighted: boolean;
  hasSelection: boolean;
  zoomLevel: number;
  isPanning: boolean;
  onClick: (id: string) => void;
}

function computeOpacity(
  isArchived: boolean, hasSelection: boolean,
  isVisible: boolean, isFocused: boolean,
  isBlastL1: boolean, isBlastL2: boolean,
): number {
  if (isFocused) return 1;
  if (isArchived && hasSelection) return 0.03;
  if (isArchived) return 0.15;
  if (!isVisible) return 0.04;
  if (isBlastL1) return 0.85;
  if (isBlastL2) return 0.5;
  return 1;
}

export function Planet({
  planet, P, isFocused, isVisible, isBlastL1, isBlastL2,
  isArchived, isMethodHighlighted, hasSelection, zoomLevel, isPanning, onClick,
}: PlanetProps) {
  const [isHovered, setIsHovered] = useState(false);
  const bR = baseRadius(planet.crit);
  const ic = BADGE_ICONS[planet.type] ?? { i: '?', c: 'dim' };
  const ck = critColor(planet.crit);
  const color = P[ck as keyof Palette] as string;
  const iconC = P[ic.c as keyof Palette] as string;

  const opacity = computeOpacity(isArchived, hasSelection, isVisible, isFocused, isBlastL1, isBlastL2);

  const items = useMemo(() =>
    [...(planet.methods ?? []), ...(planet.constants ?? [])]
      .filter(m => m.status !== 'unch' || m.impacted)
      .sort((a, b) => b.crit - a.crit),
    [planet.methods, planet.constants],
  );

  const blastBorder = isBlastL1 ? `${P.orange}60` : isBlastL2 ? `${P.orange}25` : null;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPanning) return;
    e.stopPropagation();
    onClick(planet.id);
  }, [planet.id, onClick, isPanning]);

  return (
    <div data-clickable style={{
      position: 'absolute', left: planet.ax - bR, top: planet.ay - bR,
      pointerEvents: isPanning ? 'none' : 'auto',
      opacity,
      transition: 'opacity 0.25s',
      zIndex: isFocused ? 20 : isHovered ? 10 : 1,
      filter: isArchived ? 'saturate(0.2)' : 'none',
    }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>

      {/* Blast radius ring */}
      {blastBorder && !isHovered && (
        <div style={{
          position: 'absolute', left: -4, top: -4,
          width: bR * 2 + 8, height: bR * 2 + 8,
          borderRadius: '50%', border: `2px solid ${blastBorder}`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Method highlight ring */}
      {isMethodHighlighted && (
        <div style={{
          position: 'absolute', left: -4, top: -4,
          width: bR * 2 + 8, height: bR * 2 + 8,
          borderRadius: '50%', border: `2px solid ${P.cyan}80`,
          boxShadow: `0 0 14px ${P.cyan}35`,
          pointerEvents: 'none',
        }} />
      )}

      {/* Circle */}
      <div onClick={handleClick} style={{
        width: bR * 2, height: bR * 2, borderRadius: '50%',
        background: isFocused ? `${color}14` : isHovered ? P.cardHov : P.card,
        border: `1.5px ${planet.sideEffect ? 'dashed' : 'solid'} ${isFocused ? `${color}55` : isHovered ? `${color}35` : P.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative',
        boxShadow: (isHovered || isFocused) ? `0 0 20px ${color}12` : `0 1px 3px ${P.sh}`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        {/* Type badge */}
        <div style={{
          position: 'absolute', top: 2, left: bR - 8,
          width: 14, height: 14, borderRadius: '50%',
          background: `${iconC}18`, border: `1px solid ${iconC}35`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 6, fontWeight: 800, color: iconC, fontFamily: MONO,
        }}>{ic.i}</div>

        {/* Test indicator */}
        {planet.tested !== undefined && (
          <div style={{
            position: 'absolute', top: 1, right: bR - 9,
            width: 7, height: 7, borderRadius: '50%',
            background: planet.tested ? P.green : `${P.red}88`,
            border: `1px solid ${planet.tested ? P.green : P.red}44`,
          }} />
        )}

        {/* Archived badge */}
        {isArchived && (
          <div style={{
            position: 'absolute', bottom: 0, right: bR - 9,
            width: 10, height: 10, borderRadius: '50%',
            background: P.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 6, color: P.bg, fontWeight: 900,
          }}>&#10003;</div>
        )}

        {/* Score */}
        <span style={{
          fontSize: 11 + (planet.crit / 10) * 7, fontWeight: 900, fontFamily: MONO,
          color, lineHeight: 1,
          textShadow: planet.crit >= 7 ? `0 0 10px ${color}44` : 'none',
        }}>{planet.crit.toFixed(1)}</span>

        {/* Name */}
        <span style={{
          fontSize: 7, fontWeight: 600, color: P.bright, fontFamily: SANS,
          textAlign: 'center', padding: '1px 4px', lineHeight: 1.15,
          maxWidth: bR * 2 - 8, wordBreak: 'break-word',
        }}>{planet.name}</span>

        {/* Stats */}
        {zoomLevel >= 0.5 && (
          <span style={{ fontSize: 5.5, fontFamily: MONO, color: P.dim, marginTop: 1 }}>
            {planet.add > 0 && <span style={{ color: P.green }}>+{planet.add}</span>}
            {planet.del > 0 && <span style={{ marginLeft: 2, color: P.red }}>-{planet.del}</span>}
            {planet.sideEffect && <span style={{ color: P.orange }}> &#9889;</span>}
          </span>
        )}
      </div>

      {/* Hover tags */}
      {isHovered && !isFocused && items.length > 0 && (
        <PlanetHoverTags items={items} tested={planet.tested} baseR={bR} P={P} />
      )}

    </div>
  );
}
