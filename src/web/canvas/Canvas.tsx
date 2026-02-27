import { useMemo, useCallback, useEffect } from 'react';
import type { GalaxyData, EdgeData, Palette, FocusTarget, FlatPlanet } from '../types';
import { flattenPlanets, planetMap as buildPlanetMap } from '../utils/geometry';
import { useCamera } from '../hooks/useCamera';
import { useBlastRadius } from '../interactions/useBlastRadius';
import { Galaxy } from './Galaxy';
import { EdgeLayer } from './EdgeLayer';
import { Planet } from './Planet';

interface CanvasProps {
  galaxies: GalaxyData[];
  edges: EdgeData[];
  P: Palette;
  focus: FocusTarget | null;
  setFocus: (target: FocusTarget | null) => void;
  onCanvasClick: () => void;
  setZoomOutFn: (fn: () => void) => void;
  archivedIds: Set<string>;
  highlightedPlanets: Set<string>;
  highlightedEdges: Set<string>;
}

export function Canvas({
  galaxies, edges, P,
  focus, setFocus, onCanvasClick, setZoomOutFn, archivedIds,
  highlightedPlanets, highlightedEdges,
}: CanvasProps) {
  const { ref, cam, drag, spaceHeld, didDragRef, handlers, zoomTo, zoomOut } = useCamera();

  useEffect(() => {
    setZoomOutFn(() => { zoomOut(); });
  }, [setZoomOutFn, zoomOut]);

  const allPlanets = useMemo(() => flattenPlanets(galaxies), [galaxies]);
  const pMap = useMemo(() => buildPlanetMap(allPlanets), [allPlanets]);

  const focusedGalaxyId = focus?.kind === 'galaxy' ? focus.id : null;
  const focusedSystemId = focus?.kind === 'system' ? focus.id : null;
  const hasSelection = focus !== null;

  const { connected, l1, l2, edgeSet } = useBlastRadius(edges, focus, allPlanets);

  const handlePlanetClick = useCallback((planetId: string) => {
    const planet = allPlanets.find(p => p.id === planetId);
    if (!planet) return;
    zoomTo(planet);
    setFocus({ kind: 'planet', id: planet.id, planet });
  }, [allPlanets, zoomTo, setFocus]);

  const handleGalaxyClick = useCallback((galaxy: GalaxyData) => {
    setFocus({ kind: 'galaxy', id: galaxy.id, galaxy });
  }, [setFocus]);

  const handleSystemClick = useCallback((system: GalaxyData['systems'][0], galaxy: GalaxyData) => {
    setFocus({ kind: 'system', id: system.id, system, galaxy });
  }, [setFocus]);

  const handleEdgeClick = useCallback((edge: EdgeData) => {
    const fromPlanet = allPlanets.find(p => p.id === edge.from);
    const toPlanet = allPlanets.find(p => p.id === edge.to);
    if (!fromPlanet || !toPlanet) return;
    setFocus({
      kind: 'edge', id: `${edge.from}|${edge.to}`,
      edge, fromPlanet, toPlanet,
    });
  }, [allPlanets, setFocus]);

  const handleBgClick = useCallback((e: React.MouseEvent) => {
    if (spaceHeld) return;
    if (didDragRef.current) { didDragRef.current = false; return; }
    if (!(e.target as HTMLElement).closest('[data-clickable]')) {
      onCanvasClick();
    }
  }, [onCanvasClick, spaceHeld, didDragRef]);

  return (
    <div ref={ref} style={{
      flex: 1, overflow: 'hidden',
      cursor: drag ? 'grabbing' : spaceHeld ? 'grab' : 'default', position: 'relative',
    }} {...handlers} onClick={handleBgClick}>
      <div style={{
        position: 'absolute',
        transform: `translate(${cam.x}px,${cam.y}px) scale(${cam.s})`,
        transformOrigin: '0 0', willChange: 'transform',
      }}>
        {galaxies.map(g => (
          <Galaxy key={g.id} galaxy={g} P={P}
            isFocused={focusedGalaxyId === g.id}
            focusedSystemId={focusedSystemId}
            onGalaxyClick={handleGalaxyClick}
            onSystemClick={handleSystemClick} />
        ))}

        <EdgeLayer edges={edges} planetMap={pMap} P={P}
          hasSelection={hasSelection} edgeSet={edgeSet}
          highlightedEdges={highlightedEdges}
          onEdgeClick={handleEdgeClick} zoomLevel={cam.s} />

        {allPlanets.map(planet => (
          <Planet key={planet.id} planet={planet} P={P}
            isFocused={focus?.kind === 'planet' && focus.id === planet.id}
            isVisible={!hasSelection || connected.has(planet.id)}
            isBlastL1={l1.has(planet.id)}
            isBlastL2={l2.has(planet.id)}
            isArchived={archivedIds.has(planet.id)}
            isMethodHighlighted={highlightedPlanets.has(planet.id)}
            hasSelection={hasSelection}
            zoomLevel={cam.s}
            isPanning={spaceHeld}
            onClick={handlePlanetClick} />
        ))}
      </div>
    </div>
  );
}
