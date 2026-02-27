import { useState, useCallback, useEffect, useRef } from 'react';
import type { FocusTarget, Palette, FlatPlanet, EdgeData, GalaxyData, ReviewState } from '../types';
import { PlanetDetail } from './PlanetDetail';
import { GalaxyDetail } from './GalaxyDetail';
import { SystemDetail } from './SystemDetail';
import { EdgeDetail } from './EdgeDetail';
import { UniverseDetail } from './UniverseDetail';

interface Props {
  focus: FocusTarget | null;
  P: Palette;
  edges: EdgeData[];
  allPlanets: FlatPlanet[];
  galaxies: GalaxyData[];
  width: number;
  setWidth: (w: number) => void;
  review: ReviewState;
  onNavigate: (target: FocusTarget) => void;
  onMethodHighlight?: (h: { planetId: string; methodName: string } | null) => void;
}

export function SidePanel({ focus, P, edges, allPlanets, galaxies, width, setWidth, review, onNavigate, onMethodHighlight }: Props) {
  const [resizing, setResizing] = useState(false);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    setResizing(true);
  }, [width]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const newW = Math.max(300, Math.min(800, dragRef.current.startW - (ev.clientX - dragRef.current.startX)));
      setWidth(newW);
    };
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, setWidth]);

  return (
    <div data-clickable style={{
      width, flexShrink: 0, height: '100%',
      background: P.surface, borderLeft: `1px solid ${P.border}`,
      display: 'flex', overflow: 'hidden',
    }}>
      <div onMouseDown={handleResizeStart} style={{
        width: 4, cursor: 'col-resize', flexShrink: 0,
        background: resizing ? P.cyan : 'transparent',
        transition: 'background 0.15s',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = `${P.cyan}40`)}
        onMouseLeave={(e) => {
          if (!resizing) e.currentTarget.style.background = 'transparent';
        }}
      />
      <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        {!focus && (
          <UniverseDetail
            galaxies={galaxies} edges={edges} allPlanets={allPlanets}
            P={P} review={review} onNavigate={onNavigate} />
        )}
        {focus?.kind === 'planet' && (
          <PlanetDetail
            planet={focus.planet} P={P} review={review}
            edges={edges} allPlanets={allPlanets} onNavigate={onNavigate}
            onMethodHighlight={onMethodHighlight} />
        )}
        {focus?.kind === 'galaxy' && (
          <GalaxyDetail
            galaxy={focus.galaxy} P={P} review={review}
            edges={edges} allPlanets={allPlanets} onNavigate={onNavigate} />
        )}
        {focus?.kind === 'system' && (
          <SystemDetail
            system={focus.system} galaxy={focus.galaxy} P={P} review={review}
            edges={edges} allPlanets={allPlanets} onNavigate={onNavigate} />
        )}
        {focus?.kind === 'edge' && (
          <EdgeDetail
            edge={focus.edge} fromPlanet={focus.fromPlanet} toPlanet={focus.toPlanet}
            P={P} onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}
