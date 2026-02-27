import { useCallback } from 'react';
import type { EdgeData, Palette, FlatPlanet } from '../types';
import { MONO } from '../theme/colors';

interface EdgeProps {
  edge: EdgeData;
  from: FlatPlanet;
  to: FlatPlanet;
  P: Palette;
  visible: boolean;
  ambient?: boolean;
  highlighted: boolean;
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

export function Edge({ edge, from, to, P, visible, ambient, highlighted, zoomLevel, offset, onClick }: EdgeProps) {
  const x1 = from.ax + offset;
  const y1 = from.ay + offset;
  const x2 = to.ax + offset;
  const y2 = to.ay + offset;

  const shown = visible || highlighted || ambient;
  const ck = highlighted ? 'cyan' : edge.sigChanged ? 'orange' : edge.critical ? 'red' : edge.cross ? 'cyan' : 'dim';
  const color = P[ck as keyof Palette] as string;
  const op = highlighted ? 1.0 : visible ? edgeOpacity(edge) : ambient ? 0.18 : 0;

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
  const thickness = highlighted ? Math.max(edgeThickness(edge), 2.5) : edgeThickness(edge);
  const path = `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick(edge);
  }, [edge, onClick]);

  return (
    <g data-clickable opacity={op} style={{ transition: 'opacity 0.25s', cursor: shown ? 'pointer' : 'default' }}>
      {/* Glow */}
      {((edge.critical || edge.sigChanged) && shown || highlighted) && (
        <path d={path} fill="none" stroke={color}
          strokeWidth={highlighted ? 18 : 14}
          opacity={highlighted ? 0.1 : 0.06}
          style={{ filter: `blur(${highlighted ? 10 : 8}px)` }} />
      )}

      {/* Main path */}
      <path d={path} fill="none" stroke={color}
        strokeWidth={thickness}
        strokeDasharray={edge.dashed && !highlighted ? '5,4' : 'none'}
        markerEnd={`url(#arrow-${ck})`} />

      {/* Invisible hit-area for click */}
      {shown && (
        <path d={path} fill="none" stroke="transparent" strokeWidth={12}
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
          onClick={handleClick} />
      )}

      {/* Label */}
      {shown && zoomLevel >= 0.4 && (
        <g onClick={handleClick} style={{ cursor: 'pointer', pointerEvents: 'auto' }}>
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
