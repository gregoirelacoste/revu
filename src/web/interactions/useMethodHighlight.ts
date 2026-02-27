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

    // "imports (N changed)" summary → highlight all import/type edges from this planet
    const isImportSummary = methodName.startsWith('imports (');

    for (const e of edges) {
      const touches = e.from === planetId || e.to === planetId;
      if (!touches) continue;

      let matches = false;

      if (isImportSummary) {
        // Highlight all import/type edges touching this planet
        matches = e.linkType === 'import' || e.linkType === 'type' || e.linkType === 'inject';
      } else {
        // Match by specifiers (exact name)
        if (e.specifiers?.includes(methodName)) matches = true;
        // Match import:source constants → check if edge label contains the name
        if (!matches && methodName.startsWith('import:') && e.label?.includes(methodName.slice(7))) matches = true;
        // Match by name appearing in edge label (covers injection, type references)
        if (!matches && e.label?.includes(methodName)) matches = true;
      }

      if (!matches) continue;

      planets.add(e.from);
      planets.add(e.to);
      edgeKeys.add(`${e.from}|${e.to}`);
    }

    return { highlightedPlanets: planets, highlightedEdges: edgeKeys };
  }, [edges, highlight]);
}
