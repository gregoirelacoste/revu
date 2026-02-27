import { useMemo } from 'react';
import type { EdgeData, FocusTarget, FlatPlanet } from '../types';

interface BlastResult {
  connected: Set<string>;
  l1: Set<string>;
  l2: Set<string>;
  edgeSet: Set<string>;
}

const EMPTY: BlastResult = {
  connected: new Set(), l1: new Set(), l2: new Set(), edgeSet: new Set(),
};

export function useBlastRadius(
  edges: EdgeData[],
  focus: FocusTarget | null,
  allPlanets: FlatPlanet[],
): BlastResult {
  return useMemo(() => {
    if (!focus) return EMPTY;

    const seedIds = getSeedIds(focus, allPlanets);
    if (seedIds.length === 0) return EMPTY;

    const seedSet = new Set(seedIds);
    const connected = new Set(seedIds);
    const edgeSet = new Set<string>();
    const downstream = new Map<string, string[]>();

    for (const e of edges) {
      if (!downstream.has(e.from)) downstream.set(e.from, []);
      downstream.get(e.from)!.push(e.to);

      if (seedSet.has(e.from) || seedSet.has(e.to)) {
        connected.add(e.from);
        connected.add(e.to);
        edgeSet.add(`${e.from}|${e.to}`);
      }
    }

    const l1 = new Set<string>();
    for (const id of seedIds) {
      for (const next of downstream.get(id) ?? []) l1.add(next);
    }

    const l2 = new Set<string>();
    for (const id of l1) {
      for (const next of downstream.get(id) ?? []) {
        if (!seedSet.has(next) && !l1.has(next)) l2.add(next);
      }
    }

    return { connected, l1, l2, edgeSet };
  }, [edges, focus, allPlanets]);
}

function getSeedIds(focus: FocusTarget, allPlanets: FlatPlanet[]): string[] {
  switch (focus.kind) {
    case 'planet': return [focus.id];
    case 'edge': return [focus.edge.from, focus.edge.to];
    case 'system':
      return allPlanets
        .filter(p => p.system.id === focus.system.id)
        .map(p => p.id);
    case 'galaxy':
      return allPlanets
        .filter(p => p.galaxy.id === focus.galaxy.id)
        .map(p => p.id);
  }
}
