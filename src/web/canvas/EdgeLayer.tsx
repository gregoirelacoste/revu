import type { EdgeData, Palette, FlatPlanet } from '../types';
import { Edge } from './Edge';

interface Props {
  edges: EdgeData[];
  planetMap: Map<string, FlatPlanet>;
  P: Palette;
  hasSelection: boolean;
  edgeSet: Set<string>;
  highlightedEdges: Set<string>;
  onEdgeClick: (edge: EdgeData) => void;
  zoomLevel: number;
}

const SVG_OFFSET = 2000;

export function EdgeLayer({ edges, planetMap, P, hasSelection, edgeSet, highlightedEdges, onEdgeClick, zoomLevel }: Props) {
  return (
    <svg style={{
      position: 'absolute', top: -SVG_OFFSET, left: -SVG_OFFSET,
      width: 8000, height: 6000,
      pointerEvents: 'none',
      zIndex: 3,
    }}>
      <defs>
        {(['red', 'cyan', 'dim', 'orange'] as const).map(k => (
          <marker key={k} id={`arrow-${k}`} viewBox="0 0 8 6"
            refX={7} refY={3} markerWidth={5} markerHeight={4} orient="auto">
            <polygon points="0 0, 8 3, 0 6"
              fill={P[k === 'dim' ? 'dim' : k] as string} />
          </marker>
        ))}
      </defs>
      {edges.map(edge => {
        const from = planetMap.get(edge.from);
        const to = planetMap.get(edge.to);
        if (!from || !to) return null;

        const edgeKey = `${edge.from}|${edge.to}`;
        const isBlastVisible = hasSelection && edgeSet.has(edgeKey);
        const isHighlighted = highlightedEdges.has(edgeKey);
        const isAmbient = !isBlastVisible && !isHighlighted &&
          (edge.cross || edge.critical || edge.sigChanged);

        return (
          <Edge key={edgeKey} edge={edge} from={from} to={to} P={P}
            visible={isBlastVisible || isHighlighted}
            ambient={isAmbient}
            highlighted={isHighlighted}
            zoomLevel={zoomLevel} offset={SVG_OFFSET}
            onClick={onEdgeClick} />
        );
      })}
    </svg>
  );
}
