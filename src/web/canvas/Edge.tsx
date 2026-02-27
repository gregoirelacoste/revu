import { useCallback } from 'react';
import type { EdgeData, Palette, FlatPlanet } from '../types';
import { MONO } from '../theme/colors';

interface EdgeProps {
  edge: EdgeData;
  from: FlatPlanet;
  to: FlatPlanet;
  P: Palette;
  visible: boolean;
  zoomLevel: number;
  offset: number;
  onClick: (edge: EdgeData) => void;
}

function edgeThickness(edge: EdgeData): number {
  if (edge.sigChanged) return 4.0;
  if (edge.riskCrit >= 7.5) return 3.5;
  if (edge.riskCrit >= 7) return 2.5;
  if (edge.riskCrit >= 5) return 1.8;
  return 1.0;
}

function edgeOpacity(edge: EdgeData): number {
  if (edge.critical || edge.sigChanged) return 0.9;
  if (edge.cross) return 0.7;
  return 0.55;
}

export function Edge({ edge, from, to, P, visible, zoomLevel, offset, onClick }: EdgeProps) {
  const x1 = from.ax + offset;
  const y1 = from.ay + offset;
  const x2 = to.ax + offset;
  const y2 = to.ay + offset;

  const ck = edge.sigChanged ? 'orange' : edge.critical ? 'red' : edge.cross ? 'cyan' : 'dim';
  const color = P[ck as keyof Palette] as string;
  const op = visible ? edgeOpacity(edge) : 0;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bend = Math.min(dist * 0.22, 55) * (edge.cross ? 1 : 0.4);
  const qx = (x1 + x2) / 2 + nx * bend;
  const qy = (y1 + y2) / 2 + ny * bend;
  const lx = (x1 + qx) / 2;
  const ly = (y1 + qy) / 2;
  const thickness = edgeThickness(edge);
  const path = `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(edge);
  }, [edge, onClick]);

  return (
    <g data-clickable opacity={op} style={{ transition: 'opacity 0.25s', cursor: visible ? 'pointer' : 'default' }}>
      {/* Glow for critical/sigChanged */}
      {(edge.critical || edge.sigChanged) && visible && (
        <path d={path} fill="none" stroke={color} strokeWidth={14}
          opacity={0.06} style={{ filter: 'blur(8px)' }} />
      )}

      {/* Main path */}
      <path d={path} fill="none" stroke={color}
        strokeWidth={thickness}
        strokeDasharray={edge.dashed ? '5,4' : 'none'}
        markerEnd={`url(#arrow-${ck})`} />

      {/* Invisible hit-area for click */}
      {visible && (
        <path d={path} fill="none" stroke="transparent" strokeWidth={12}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onClick={handleClick} />
      )}

      {/* Label */}
      {visible && zoomLevel >= 0.4 && (
        <g onClick={handleClick} style={{ cursor: 'pointer' }}>
          <rect
            x={lx - edge.label.length * 2.2 - 3} y={ly - 6}
            width={edge.label.length * 4.4 + 6} height={11} rx={3}
            fill={P.lBg} stroke={`${color}20`} strokeWidth={0.5} opacity={0.9} />
          <text x={lx} y={ly + 2} textAnchor="middle" fill={color}
            fontSize={5.5} fontFamily={MONO} fontWeight={600}>
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}
