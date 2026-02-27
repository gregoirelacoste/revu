import { useMemo, useCallback, useEffect, useState } from 'react';
import type { GalaxyData, EdgeData, Palette, FocusTarget, FlatPlanet, SystemData } from '../types';
import { flattenPlanets, planetMap as buildPlanetMap, findSystemAncestry } from '../utils/geometry';
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
  setZoomToFn: (fn: (target: FocusTarget) => void) => void;
  archivedIds: Set<string>;
  highlightedPlanets: Set<string>;
  highlightedEdges: Set<string>;
}

const EMPTY_SET = new Set<string>();

export function Canvas({
  galaxies, edges, P,
  focus, setFocus, onCanvasClick, setZoomOutFn, setZoomToFn, archivedIds,
  highlightedPlanets, highlightedEdges,
}: CanvasProps) {
  const { ref, cam, drag, spaceHeld, didDragRef, handlers, zoomTo, zoomToPoint, zoomOut, SYSTEM_SCALE, GALAXY_SCALE } = useCamera();

  useEffect(() => {
    setZoomOutFn(() => { zoomOut(); });
  }, [setZoomOutFn, zoomOut]);

  const allPlanets = useMemo(() => flattenPlanets(galaxies), [galaxies]);
  const pMap = useMemo(() => buildPlanetMap(allPlanets), [allPlanets]);

  const focusedGalaxyId = focus?.kind === 'galaxy' ? focus.id : null;
  const focusedSystemId = focus?.kind === 'system' ? focus.id : null;
  const hasSelection = focus !== null;

  const { connected, l1, l2, edgeSet } = useBlastRadius(edges, focus, allPlanets);

  // ── Hover tracking ──
  const [hoveredPlanetId, setHoveredPlanetId] = useState<string | null>(null);
  const [hoveredSystemId, setHoveredSystemId] = useState<string | null>(null);

  // ── Compute highlighted system/galaxy IDs from hover + focus ──
  const { highlightedSystemIds, highlightedGalaxyIds } = useMemo(() => {
    const sysIds = new Set<string>();
    const galIds = new Set<string>();

    // From hover
    if (hoveredPlanetId) {
      const planet = allPlanets.find(p => p.id === hoveredPlanetId);
      if (planet) {
        galIds.add(planet.galaxy.id);
        for (const s of planet.galaxy.systems) {
          const ancestry = findSystemAncestry([s], planet.system.id);
          if (ancestry.size > 0) { for (const id of ancestry) sysIds.add(id); break; }
        }
      }
    } else if (hoveredSystemId) {
      for (const g of galaxies) {
        const ancestry = findSystemAncestry(g.systems, hoveredSystemId);
        if (ancestry.size > 0) {
          galIds.add(g.id);
          for (const id of ancestry) sysIds.add(id);
          break;
        }
      }
    }

    // From focus
    if (focus?.kind === 'planet') {
      const p = focus.planet;
      galIds.add(p.galaxy.id);
      for (const s of p.galaxy.systems) {
        const ancestry = findSystemAncestry([s], p.system.id);
        if (ancestry.size > 0) { for (const id of ancestry) sysIds.add(id); break; }
      }
    } else if (focus?.kind === 'system') {
      galIds.add(focus.galaxy.id);
      const ancestry = findSystemAncestry(focus.galaxy.systems, focus.system.id);
      for (const id of ancestry) sysIds.add(id);
    } else if (focus?.kind === 'galaxy') {
      galIds.add(focus.galaxy.id);
    }

    return { highlightedSystemIds: sysIds, highlightedGalaxyIds: galIds };
  }, [hoveredPlanetId, hoveredSystemId, focus, allPlanets, galaxies]);

  const zoomToTarget = useCallback((target: FocusTarget) => {
    if (target.kind === 'planet') {
      zoomTo(target.planet);
    } else if (target.kind === 'system') {
      zoomToPoint(target.absCx, target.absCy, SYSTEM_SCALE);
    } else if (target.kind === 'galaxy') {
      zoomToPoint(target.galaxy.cx, target.galaxy.cy, GALAXY_SCALE);
    } else if (target.kind === 'edge') {
      const mx = (target.fromPlanet.ax + target.toPlanet.ax) / 2;
      const my = (target.fromPlanet.ay + target.toPlanet.ay) / 2;
      zoomToPoint(mx, my, SYSTEM_SCALE);
    }
  }, [zoomTo, zoomToPoint, SYSTEM_SCALE, GALAXY_SCALE]);

  useEffect(() => {
    setZoomToFn((target: FocusTarget) => { zoomToTarget(target); });
  }, [setZoomToFn, zoomToTarget]);

  const handlePlanetClick = useCallback((planetId: string) => {
    const planet = allPlanets.find(p => p.id === planetId);
    if (!planet) return;
    setFocus({ kind: 'planet', id: planet.id, planet });
  }, [allPlanets, setFocus]);

  const handleGalaxyClick = useCallback((galaxy: GalaxyData) => {
    setFocus({ kind: 'galaxy', id: galaxy.id, galaxy });
  }, [setFocus]);

  const handleSystemClick = useCallback((system: SystemData, galaxy: GalaxyData, absCx: number, absCy: number) => {
    setFocus({ kind: 'system', id: system.id, system, galaxy, absCx, absCy });
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

  const handlePlanetHover = useCallback((id: string | null) => {
    setHoveredPlanetId(id);
  }, []);

  const handleSystemHover = useCallback((id: string | null) => {
    setHoveredSystemId(id);
  }, []);

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
            isHighlighted={highlightedGalaxyIds.has(g.id)}
            focusedSystemId={focusedSystemId}
            highlightedSystemIds={highlightedSystemIds}
            onGalaxyClick={handleGalaxyClick}
            onSystemClick={handleSystemClick}
            onSystemHover={handleSystemHover} />
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
            onClick={handlePlanetClick}
            onHover={handlePlanetHover} />
        ))}
      </div>
    </div>
  );
}
