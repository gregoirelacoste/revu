import { useMemo } from 'react';
import type { EdgeData } from '../types';

interface MethodHighlight {
  planetId: string;
  methodName: string;
}

interface HighlightResult {
  highlightedPlanets: Set<string>;
  highlightedEdges: Set<string>;
}

const EMPTY: HighlightResult = {
  highlightedPlanets: new Set(),
  highlightedEdges: new Set(),
};

export function useMethodHighlight(
  edges: EdgeData[],
  highlight: MethodHighlight | null,
): HighlightResult {
  return useMemo(() => {
    if (!highlight) return EMPTY;

    const { planetId, methodName } = highlight;
    const planets = new Set<string>([planetId]);
    const edgeKeys = new Set<string>();

    for (const e of edges) {
      const touches = e.from === planetId || e.to === planetId;
      if (!touches) continue;
      if (!e.specifiers?.includes(methodName)) continue;

      planets.add(e.from);
      planets.add(e.to);
      edgeKeys.add(`${e.from}|${e.to}`);
    }

    return { highlightedPlanets: planets, highlightedEdges: edgeKeys };
  }, [edges, highlight]);
}
