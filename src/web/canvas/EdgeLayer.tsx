import type { EdgeData, Palette, FlatPlanet } from '../types';
import { Edge } from './Edge';

interface Props {
  edges: EdgeData[];
  planetMap: Map<string, FlatPlanet>;
  P: Palette;
  hasSelection: boolean;
  edgeSet: Set<string>;
  onEdgeClick: (edge: EdgeData) => void;
  zoomLevel: number;
}

const SVG_OFFSET = 600;

export function EdgeLayer({ edges, planetMap, P, hasSelection, edgeSet, onEdgeClick, zoomLevel }: Props) {
  return (
    <svg style={{
      position: 'absolute', top: -SVG_OFFSET, left: -SVG_OFFSET,
      width: 4000, height: 3000,
      pointerEvents: hasSelection ? 'auto' : 'none',
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
        const isVisible = hasSelection && edgeSet.has(edgeKey);

        return (
          <Edge key={edgeKey} edge={edge} from={from} to={to} P={P}
            visible={isVisible} zoomLevel={zoomLevel} offset={SVG_OFFSET}
            onClick={onEdgeClick} />
        );
      })}
    </svg>
  );
}
