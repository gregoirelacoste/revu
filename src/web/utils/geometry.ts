import type { FlatPlanet, GalaxyData, SystemData, PlanetData, ScanResponse } from '../types';

export function flattenPlanets(galaxies: GalaxyData[]): FlatPlanet[] {
  return galaxies.flatMap(g =>
    g.systems.flatMap(s =>
      s.planets.map(p => ({
        ...p,
        galaxy: g,
        system: s,
        ax: g.cx + s.cx + p.ox,
        ay: g.cy + s.cy + p.oy,
      })),
    ),
  );
}

export function planetMap(planets: FlatPlanet[]): Map<string, FlatPlanet> {
  return new Map(planets.map(p => [p.id, p]));
}

export function baseRadius(crit: number): number {
  return 24 + (crit / 10) * 14;
}
