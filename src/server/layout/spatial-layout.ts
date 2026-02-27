import type { GalaxyData, SystemData, PlanetData, MethodData } from '../types.js';

const GALAXY_COLORS = ['blue', 'red', 'purple', 'cyan', 'orange', 'green', 'pink'];
const GALAXY_BASE_RADIUS = 250;
const SYSTEM_MIN_RADIUS = 80;

interface LayoutInput {
  repoName: string;
  branch: string;
  directories: Map<string, LayoutPlanet[]>;
}

interface LayoutPlanet {
  id: string;
  name: string;
  ext: string;
  type: string;
  crit: number;
  add: number;
  del: number;
  tested: boolean;
  sideEffect?: boolean;
  methods: MethodData[];
  constants: MethodData[];
}

export function computeLayout(inputs: LayoutInput[]): { galaxies: GalaxyData[] } {
  const galaxies: GalaxyData[] = [];
  const n = inputs.length;
  if (n === 0) return { galaxies };

  // Build galaxy sizes first
  const sizes = inputs.map(input => {
    const dirs = Array.from(input.directories.entries());
    const totalPlanets = dirs.reduce((s, [, ps]) => s + ps.length, 0);
    const rx = GALAXY_BASE_RADIUS + totalPlanets * 10;
    const ry = GALAXY_BASE_RADIUS + totalPlanets * 12;
    return { rx, ry, dirs, totalPlanets };
  });

  // Compute galaxy positions spread in 2D (not linear)
  const positions = computeGalaxyPositions(sizes.map(s => ({ rx: s.rx, ry: s.ry })));

  for (let gi = 0; gi < n; gi++) {
    const input = inputs[gi];
    const { rx, ry, dirs } = sizes[gi];
    const { cx, cy } = positions[gi];
    const color = GALAXY_COLORS[gi % GALAXY_COLORS.length];

    const systems = layoutSystems(input.repoName, dirs, rx);

    galaxies.push({
      id: `g-${input.repoName}`, label: input.repoName,
      branch: input.branch, color, cx, cy, rx, ry, systems,
    });
  }

  return { galaxies };
}

function computeGalaxyPositions(sizes: { rx: number; ry: number }[]): { cx: number; cy: number }[] {
  const n = sizes.length;
  if (n === 1) return [{ cx: 500, cy: 400 }];

  // Spread galaxies in a circular layout with generous spacing
  const padding = 200;
  const maxR = Math.max(...sizes.map(s => Math.max(s.rx, s.ry)));
  const layoutRadius = n <= 3 ? maxR + padding : maxR * 1.2 + padding;
  const centerX = 800;
  const centerY = 600;

  return sizes.map((_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      cx: Math.round(centerX + Math.cos(angle) * layoutRadius),
      cy: Math.round(centerY + Math.sin(angle) * layoutRadius),
    };
  });
}

function layoutSystems(
  repoName: string, dirs: [string, LayoutPlanet[]][], galaxyRx: number,
): SystemData[] {
  const systems: SystemData[] = [];
  const angleStep = dirs.length > 1 ? (2 * Math.PI) / dirs.length : 0;
  const systemRadius = Math.max(galaxyRx * 0.45, 100);

  for (let si = 0; si < dirs.length; si++) {
    const [dirPath, planets] = dirs[si];
    const angle = angleStep * si - Math.PI / 2;
    const scx = dirs.length > 1 ? Math.cos(angle) * systemRadius : 0;
    const scy = dirs.length > 1 ? Math.sin(angle) * systemRadius : 0;
    const sr = Math.max(SYSTEM_MIN_RADIUS, planets.length * 38);

    const layoutPlanets = layoutPlanetsInSystem(planets, sr);

    systems.push({
      id: `s-${repoName}-${si}`, label: dirPath,
      cx: Math.round(scx), cy: Math.round(scy), r: sr,
      planets: layoutPlanets,
    });
  }
  return systems;
}

function layoutPlanetsInSystem(planets: LayoutPlanet[], systemRadius: number): PlanetData[] {
  const sorted = [...planets].sort((a, b) => b.crit - a.crit);
  return sorted.map((p, pi) => {
    const pAngle = sorted.length > 1
      ? (2 * Math.PI * pi) / sorted.length - Math.PI / 2
      : 0;
    const pRadius = sorted.length > 1 ? systemRadius * 0.5 : 0;

    return {
      id: p.id, name: p.name, ext: p.ext,
      type: p.type as PlanetData['type'],
      crit: p.crit, add: p.add, del: p.del,
      tested: p.tested, sideEffect: p.sideEffect,
      ox: Math.round(Math.cos(pAngle) * pRadius),
      oy: Math.round(Math.sin(pAngle) * pRadius),
      methods: p.methods, constants: p.constants,
    };
  });
}
