import type { FlatPlanet, GalaxyData, SystemData, PlanetData, ScanResponse } from '../types';

export function flattenPlanets(galaxies: GalaxyData[]): FlatPlanet[] {
  const result: FlatPlanet[] = [];
  for (const g of galaxies) {
    collectPlanets(g, g.systems, g.cx, g.cy, result);
  }
  return result;
}

function collectPlanets(
  g: GalaxyData, systems: SystemData[],
  baseX: number, baseY: number, out: FlatPlanet[],
) {
  for (const s of systems) {
    const sx = baseX + s.cx;
    const sy = baseY + s.cy;
    for (const p of s.planets) {
      out.push({ ...p, galaxy: g, system: s, ax: sx + p.ox, ay: sy + p.oy });
    }
    if (s.children?.length) {
      collectPlanets(g, s.children, sx, sy, out);
    }
  }
}

export function planetMap(planets: FlatPlanet[]): Map<string, FlatPlanet> {
  return new Map(planets.map(p => [p.id, p]));
}

export function baseRadius(crit: number): number {
  return 24 + (crit / 10) * 14;
}

export function collectSystemIds(system: SystemData): Set<string> {
  const ids = new Set<string>([system.id]);
  if (system.children) {
    for (const child of system.children) {
      for (const id of collectSystemIds(child)) ids.add(id);
    }
  }
  return ids;
}

/** Walk the system tree to find ancestors of targetId (including itself). */
export function findSystemAncestry(systems: SystemData[], targetId: string): Set<string> {
  const result = new Set<string>();
  walkAncestry(systems, targetId, result);
  return result;
}

function walkAncestry(systems: SystemData[], targetId: string, path: Set<string>): boolean {
  for (const s of systems) {
    if (s.id === targetId) {
      path.add(s.id);
      return true;
    }
    if (s.children?.length && walkAncestry(s.children, targetId, path)) {
      path.add(s.id);
      return true;
    }
  }
  return false;
}

/** Find next unreviewed planet by proximity: same system > same galaxy > any */
export function findNextPlanet(
  allPlanets: FlatPlanet[],
  currentId: string,
  archivedIds: Set<string>,
): FlatPlanet | null {
  const current = allPlanets.find(p => p.id === currentId);
  if (!current) return null;

  const unreviewed = (list: FlatPlanet[]) =>
    list.filter(p => p.id !== currentId && !archivedIds.has(p.id))
      .sort((a, b) => b.crit - a.crit);

  const sameSystem = unreviewed(allPlanets.filter(p => p.system.id === current.system.id));
  if (sameSystem.length > 0) return sameSystem[0];

  const sameGalaxy = unreviewed(allPlanets.filter(p => p.galaxy.id === current.galaxy.id));
  if (sameGalaxy.length > 0) return sameGalaxy[0];

  const any = unreviewed(allPlanets);
  return any[0] ?? null;
}
