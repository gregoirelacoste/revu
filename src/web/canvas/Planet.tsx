import { useMemo, useCallback, useState } from 'react';
import type { FlatPlanet, Palette } from '../types';
import type { PlanetShape } from '../theme/colors';
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

function shapeRadius(shape: PlanetShape): string {
  if (shape === 'circle') return '50%';
  if (shape === 'square') return '6px';
  return '4px'; // diamond uses transform
}

export function Planet({
  planet, P, isFocused, isVisible, isBlastL1, isBlastL2,
  isArchived, isMethodHighlighted, hasSelection, zoomLevel, isPanning, onClick,
}: PlanetProps) {
  const [isHovered, setIsHovered] = useState(false);
  const bR = baseRadius(planet.crit);
  const badge = BADGE_ICONS[planet.type] ?? { i: '?', c: 'dim', shape: 'circle' as PlanetShape };
  const shape = badge.shape;
  const ck = critColor(planet.crit);
  const critCol = P[ck as keyof Palette] as string;
  const typeCol = P[badge.c as keyof Palette] as string;

  const opacity = computeOpacity(isArchived, hasSelection, isVisible, isFocused, isBlastL1, isBlastL2);

  const items = useMemo(() =>
    [...(planet.methods ?? []), ...(planet.constants ?? [])]
      .filter(m => m.status !== 'unch' || m.impacted)
      .sort((a, b) => b.crit - a.crit),
    [planet.methods, planet.constants],
  );

  const blastBorder = isBlastL1 ? `${P.orange}60` : isBlastL2 ? `${P.orange}25` : null;
  const isDiamond = shape === 'diamond';
  const borderRad = shapeRadius(shape);
  const outerSize = bR * 2;
  // Diamond needs a slightly larger hit area since visual is rotated
  const hitSize = isDiamond ? outerSize * 1.1 : outerSize;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPanning) return;
    e.stopPropagation();
    onClick(planet.id);
  }, [planet.id, onClick, isPanning]);

  return (
    <div data-clickable style={{
      position: 'absolute',
      left: planet.ax - hitSize / 2,
      top: planet.ay - hitSize / 2,
      width: hitSize, height: hitSize,
      pointerEvents: isPanning ? 'none' : 'auto',
      opacity,
      transition: 'opacity 0.25s',
      zIndex: isFocused ? 20 : isHovered ? 10 : 1,
      filter: isArchived ? 'saturate(0.2)' : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>

      {/* Blast radius ring */}
      {blastBorder && !isHovered && (
        <div style={{
          position: 'absolute',
          left: (hitSize - outerSize) / 2 - 4,
          top: (hitSize - outerSize) / 2 - 4,
          width: outerSize + 8, height: outerSize + 8,
          borderRadius: borderRad,
          border: `2px solid ${blastBorder}`,
          transform: isDiamond ? 'rotate(45deg)' : 'none',
          pointerEvents: 'none',
        }} />
      )}

      {/* Method highlight ring */}
      {isMethodHighlighted && (
        <div style={{
          position: 'absolute',
          left: (hitSize - outerSize) / 2 - 4,
          top: (hitSize - outerSize) / 2 - 4,
          width: outerSize + 8, height: outerSize + 8,
          borderRadius: borderRad,
          border: `2px solid ${P.cyan}80`,
          boxShadow: `0 0 14px ${P.cyan}35`,
          transform: isDiamond ? 'rotate(45deg)' : 'none',
          pointerEvents: 'none',
        }} />
      )}

      {/* Shape body */}
      <div onClick={handleClick} style={{
        width: outerSize, height: outerSize,
        borderRadius: borderRad,
        transform: isDiamond ? 'rotate(45deg)' : 'none',
        background: isFocused ? `${typeCol}14` : isHovered ? P.cardHov : P.card,
        border: `1.5px ${planet.sideEffect ? 'dashed' : 'solid'} ${isFocused ? `${typeCol}55` : isHovered ? `${typeCol}35` : `${typeCol}22`}`,
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        boxShadow: (isHovered || isFocused)
          ? `0 0 20px ${typeCol}18, inset 0 0 30px ${typeCol}06`
          : `0 1px 3px ${P.sh}`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        {/* Type color accent bar at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 3, background: `${typeCol}55`,
        }} />
      </div>

      {/* Inner content (counter-rotated for diamond) */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* Type badge */}
        <div style={{
          position: 'absolute', top: isDiamond ? 4 : 2,
          left: '50%', transform: 'translateX(-50%)',
          padding: '1px 4px', borderRadius: 3,
          background: `${typeCol}18`, border: `1px solid ${typeCol}35`,
          fontSize: 5.5, fontWeight: 800, color: typeCol, fontFamily: MONO,
          letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{badge.i}</div>

        {/* Test indicator */}
        {planet.tested !== undefined && (
          <div style={{
            position: 'absolute', top: isDiamond ? 4 : 1,
            right: isDiamond ? hitSize / 2 - bR + 4 : bR - 9,
            width: 7, height: 7, borderRadius: '50%',
            background: planet.tested ? P.green : `${P.red}88`,
            border: `1px solid ${planet.tested ? P.green : P.red}44`,
          }} />
        )}

        {/* Archived badge */}
        {isArchived && (
          <div style={{
            position: 'absolute', bottom: isDiamond ? 4 : 0,
            right: isDiamond ? hitSize / 2 - bR + 4 : bR - 9,
            width: 10, height: 10, borderRadius: '50%',
            background: P.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 6, color: P.bg, fontWeight: 900,
          }}>&#10003;</div>
        )}

        {/* Crit score */}
        <span style={{
          fontSize: 11 + (planet.crit / 10) * 7, fontWeight: 900, fontFamily: MONO,
          color: critCol, lineHeight: 1, marginTop: 4,
          textShadow: planet.crit >= 7 ? `0 0 10px ${critCol}44` : 'none',
        }}>{planet.crit.toFixed(1)}</span>

        {/* Name */}
        <span style={{
          fontSize: 7, fontWeight: 600, color: P.bright, fontFamily: SANS,
          textAlign: 'center', padding: '1px 4px', lineHeight: 1.15,
          maxWidth: outerSize - 8, wordBreak: 'break-word',
        }}>{planet.name}</span>
      </div>

      {/* Hover tags */}
      {isHovered && !isFocused && items.length > 0 && (
        <PlanetHoverTags items={items} tested={planet.tested} baseR={bR} P={P} />
      )}

    </div>
  );
}
