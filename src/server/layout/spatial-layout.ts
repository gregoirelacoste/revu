import type { GalaxyData, SystemData, PlanetData, MethodData } from '../types.js';

const GALAXY_COLORS = ['blue', 'red', 'purple', 'cyan', 'orange', 'green', 'pink'];
const GALAXY_BASE_RADIUS = 250;
const SYSTEM_MIN_RADIUS = 80;

interface LayoutInput {
  repoName: string;
  branch: string;
  directories: Map<string, LayoutPlanet[]>;
  dirAffinity?: Map<string, Map<string, number>>;
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

    const systems = layoutSystems(input.repoName, dirs, rx, input.dirAffinity);

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
  repoName: string, dirs: [string, LayoutPlanet[]][],
  galaxyRx: number, dirAffinity?: Map<string, Map<string, number>>,
): SystemData[] {
  const systems: SystemData[] = [];
  const n = dirs.length;
  const systemRadius = Math.max(galaxyRx * 0.6, 100);

  // Compute initial positions
  const positions: { x: number; y: number }[] = [];
  if (n <= 2) {
    // Simple layout for 1-2 systems
    const angleStep = n > 1 ? Math.PI : 0;
    for (let i = 0; i < n; i++) {
      const angle = angleStep * i - Math.PI / 2;
      positions.push({
        x: n > 1 ? Math.cos(angle) * systemRadius * 0.8 : 0,
        y: n > 1 ? Math.sin(angle) * systemRadius * 0.8 : 0,
      });
    }
  } else if (dirAffinity && dirAffinity.size > 0) {
    // Force-directed layout for 3+ systems with affinity data
    forceDirectedLayout(dirs, positions, systemRadius, dirAffinity);
  } else {
    // Circular fallback
    const angleStep = (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const angle = angleStep * i - Math.PI / 2;
      positions.push({
        x: Math.cos(angle) * systemRadius,
        y: Math.sin(angle) * systemRadius,
      });
    }
  }

  for (let si = 0; si < n; si++) {
    const [dirPath, planets] = dirs[si];
    const sr = Math.max(SYSTEM_MIN_RADIUS, planets.length * 38);
    const layoutPlanets = layoutPlanetsInSystem(planets, sr);

    systems.push({
      id: `s-${repoName}-${si}`, label: dirPath,
      cx: Math.round(positions[si].x), cy: Math.round(positions[si].y), r: sr,
      planets: layoutPlanets,
    });
  }
  return systems;
}

function forceDirectedLayout(
  dirs: [string, LayoutPlanet[]][],
  positions: { x: number; y: number }[],
  maxRadius: number,
  dirAffinity: Map<string, Map<string, number>>,
) {
  const n = dirs.length;
  const minDist = maxRadius * 0.35;

  // Start with circular positions
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.push({ x: Math.cos(angle) * maxRadius * 0.7, y: Math.sin(angle) * maxRadius * 0.7 });
  }

  // Build affinity matrix
  const links: { a: number; b: number; w: number }[] = [];
  for (let i = 0; i < n; i++) {
    const dirI = dirs[i][0];
    const aff = dirAffinity.get(dirI);
    if (!aff) continue;
    for (let j = i + 1; j < n; j++) {
      const w = aff.get(dirs[j][0]) ?? 0;
      if (w > 0) links.push({ a: i, b: j, w });
    }
  }

  // 40 iterations of force simulation
  for (let iter = 0; iter < 40; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));

    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const repForce = (maxRadius * maxRadius * 0.5) / (dist * dist);
        const rx = (dx / dist) * repForce;
        const ry = (dy / dist) * repForce;
        forces[i].fx -= rx;
        forces[i].fy -= ry;
        forces[j].fx += rx;
        forces[j].fy += ry;
      }
    }

    // Attraction proportional to link count
    for (const { a, b, w } of links) {
      const dx = positions[b].x - positions[a].x;
      const dy = positions[b].y - positions[a].y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const attForce = w * 0.15;
      const ax = (dx / dist) * attForce;
      const ay = (dy / dist) * attForce;
      forces[a].fx += ax;
      forces[a].fy += ay;
      forces[b].fx -= ax;
      forces[b].fy -= ay;
    }

    // Apply forces with cooling
    const cool = 1 - iter / 50;
    for (let i = 0; i < n; i++) {
      positions[i].x += forces[i].fx * cool;
      positions[i].y += forces[i].fy * cool;
    }

    // Enforce minimum distance
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist > 0) {
          const push = (minDist - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          positions[i].x -= nx * push;
          positions[i].y -= ny * push;
          positions[j].x += nx * push;
          positions[j].y += ny * push;
        }
      }
    }
  }

  // Re-scale to fit within galaxy bounds
  let maxOff = 0;
  for (const p of positions) {
    const off = Math.sqrt(p.x * p.x + p.y * p.y);
    if (off > maxOff) maxOff = off;
  }
  if (maxOff > maxRadius * 0.85) {
    const scale = (maxRadius * 0.85) / maxOff;
    for (const p of positions) {
      p.x *= scale;
      p.y *= scale;
    }
  }
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
