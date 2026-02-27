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

interface DirNode {
  path: string;
  shortLabel: string;
  planets: LayoutPlanet[];
  children: DirNode[];
}

// ── Build dir tree ──

function buildDirTree(dirs: [string, LayoutPlanet[]][]): DirNode[] {
  const dirMap = new Map(dirs.map(([p, planets]) => [p, planets]));
  const nodeMap = new Map<string, DirNode>();
  const roots: DirNode[] = [];

  // Sort by segment count ascending so parents are processed first
  const sortedPaths = [...dirMap.keys()].sort(
    (a, b) => a.split('/').length - b.split('/').length,
  );

  for (const path of sortedPaths) {
    const node: DirNode = {
      path,
      shortLabel: path.split('/').pop() ?? path,
      planets: dirMap.get(path) ?? [],
      children: [],
    };
    nodeMap.set(path, node);

    // Find longest prefix parent
    const parent = findParent(path, nodeMap);
    if (parent) {
      node.shortLabel = path.split('/').pop() ?? path;
      parent.children.push(node);
    } else {
      node.shortLabel = path; // Root keeps full path
      roots.push(node);
    }
  }

  // Create virtual intermediate nodes if needed
  // e.g. a/b/c and a/b/d exist but a/b doesn't → create virtual a/b
  ensureIntermediateNodes(roots, nodeMap);

  return roots;
}

function findParent(path: string, nodeMap: Map<string, DirNode>): DirNode | null {
  const segments = path.split('/');
  // Try progressively shorter prefixes
  for (let len = segments.length - 1; len >= 1; len--) {
    const candidate = segments.slice(0, len).join('/');
    const node = nodeMap.get(candidate);
    if (node) return node;
  }
  return null;
}

function ensureIntermediateNodes(roots: DirNode[], nodeMap: Map<string, DirNode>) {
  // Collect all sibling groups that share a common prefix not in nodeMap
  const allNodes = [...nodeMap.values()];
  for (const node of allNodes) {
    regroupChildren(node, nodeMap);
  }
  // Also regroup roots
  regroupRootSiblings(roots, nodeMap);
}

function regroupChildren(parent: DirNode, nodeMap: Map<string, DirNode>) {
  if (parent.children.length < 2) return;

  // Group children by their next-level prefix relative to parent
  const groups = new Map<string, DirNode[]>();
  for (const child of parent.children) {
    const rel = child.path.slice(parent.path.length + 1);
    const firstSeg = rel.split('/')[0];
    const groupKey = `${parent.path}/${firstSeg}`;
    if (groupKey === child.path) {
      // Direct child, no intermediate needed
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(child);
    } else {
      // Needs intermediate node
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(child);
    }
  }

  // Create virtual nodes for groups with multiple children or deep children
  const newChildren: DirNode[] = [];
  for (const [groupPath, members] of groups) {
    if (members.length === 1 && members[0].path === groupPath) {
      // Direct child, keep as is
      newChildren.push(members[0]);
    } else if (!nodeMap.has(groupPath)) {
      // Create virtual intermediate node
      const virtual: DirNode = {
        path: groupPath,
        shortLabel: groupPath.split('/').pop() ?? groupPath,
        planets: [],
        children: members,
      };
      nodeMap.set(groupPath, virtual);
      // Update children's shortLabel
      for (const m of members) {
        m.shortLabel = m.path.split('/').pop() ?? m.path;
      }
      newChildren.push(virtual);
    } else {
      // Node already exists, re-parent
      const existing = nodeMap.get(groupPath)!;
      for (const m of members) {
        if (m.path !== groupPath && !existing.children.includes(m)) {
          existing.children.push(m);
        }
      }
      if (!newChildren.includes(existing)) newChildren.push(existing);
    }
  }

  if (newChildren.length !== parent.children.length || newChildren.some((c, i) => c !== parent.children[i])) {
    parent.children = newChildren;
  }
}

function regroupRootSiblings(roots: DirNode[], nodeMap: Map<string, DirNode>) {
  if (roots.length < 2) return;

  // Group roots by first path segment
  const groups = new Map<string, DirNode[]>();
  for (const root of roots) {
    const firstSeg = root.path.split('/')[0];
    if (!groups.has(firstSeg)) groups.set(firstSeg, []);
    groups.get(firstSeg)!.push(root);
  }

  const newRoots: DirNode[] = [];
  for (const [prefix, members] of groups) {
    if (members.length === 1 && members[0].path === prefix) {
      newRoots.push(members[0]);
    } else if (members.length > 1) {
      // Check if there's already a root with this prefix
      const existing = members.find(m => m.path === prefix);
      if (existing) {
        // Move others as children
        for (const m of members) {
          if (m !== existing && !existing.children.includes(m)) {
            m.shortLabel = m.path.split('/').pop() ?? m.path;
            existing.children.push(m);
          }
        }
        newRoots.push(existing);
      } else {
        // Create virtual root
        const virtual: DirNode = {
          path: prefix,
          shortLabel: prefix,
          planets: [],
          children: members.map(m => ({ ...m, shortLabel: m.path.split('/').pop() ?? m.path })),
        };
        nodeMap.set(prefix, virtual);
        newRoots.push(virtual);
      }
    } else {
      newRoots.push(members[0]);
    }
  }

  roots.length = 0;
  roots.push(...newRoots);
}

// ── Node radius computation (bottom-up) ──

function computeNodeRadius(node: DirNode): number {
  if (node.children.length === 0) {
    return Math.max(SYSTEM_MIN_RADIUS, node.planets.length * 38);
  }

  const childRadii = node.children.map(c => computeNodeRadius(c));
  const childrenArea = childRadii.reduce((sum, r) => sum + Math.PI * r * r, 0);
  const ownPlanetsSpace = node.planets.length * 38;
  const computed = Math.sqrt((childrenArea + ownPlanetsSpace * 50) / Math.PI) * 1.4;
  const minFromChildren = Math.max(...childRadii) * 2.2;

  return Math.max(computed, minFromChildren, SYSTEM_MIN_RADIUS);
}

// ── Recursive system building ──

function buildSystemData(node: DirNode, repoName: string, indexPath: string): SystemData {
  const r = computeNodeRadius(node);

  let planets: PlanetData[];
  let children: SystemData[] | undefined;

  if (node.children.length > 0) {
    // Position children in inner circle
    const childCount = node.children.length;
    const innerR = r * 0.55;
    const childSystems: SystemData[] = [];

    for (let i = 0; i < childCount; i++) {
      const angle = childCount > 1
        ? (2 * Math.PI * i) / childCount - Math.PI / 2
        : 0;
      const childR = computeNodeRadius(node.children[i]);
      const dist = childCount > 1 ? Math.max(innerR - childR * 0.3, childR * 1.1) : 0;

      const child = buildSystemData(node.children[i], repoName, `${indexPath}-${i}`);
      child.cx = Math.round(Math.cos(angle) * dist);
      child.cy = Math.round(Math.sin(angle) * dist);
      childSystems.push(child);
    }
    children = childSystems;

    // Position own planets in outer ring
    const outerR = r * 0.75;
    planets = layoutPlanetsInRing(node.planets, outerR);
  } else {
    planets = layoutPlanetsInSystem(node.planets, r);
  }

  return {
    id: `s-${repoName}-${indexPath}`,
    label: node.shortLabel,
    fullPath: node.path,
    cx: 0, cy: 0, r,
    planets,
    ...(children?.length ? { children } : {}),
  };
}

function layoutPlanetsInRing(planets: LayoutPlanet[], ringRadius: number): PlanetData[] {
  const sorted = [...planets].sort((a, b) => b.crit - a.crit);
  return sorted.map((p, pi) => {
    const pAngle = sorted.length > 1
      ? (2 * Math.PI * pi) / sorted.length - Math.PI / 2
      : 0;
    const pRadius = sorted.length > 1 ? ringRadius : 0;
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

// ── Total planet count (recursive) ──

function countPlanets(nodes: DirNode[]): number {
  let total = 0;
  for (const n of nodes) {
    total += n.planets.length + countPlanets(n.children);
  }
  return total;
}

// ── Effective radius of a galaxy (accounts for system overflow) ──

function computeEffectiveRadius(systems: SystemData[]): number {
  let maxExtent = 0;
  for (const s of systems) {
    const extent = Math.sqrt(s.cx * s.cx + s.cy * s.cy) + s.r;
    if (extent > maxExtent) maxExtent = extent;
  }
  return maxExtent;
}

// ── Main entry ──

export function computeLayout(inputs: LayoutInput[]): { galaxies: GalaxyData[] } {
  const n = inputs.length;
  if (n === 0) return { galaxies: [] };

  // 1. Build systems first (need actual sizes for positioning)
  const built = inputs.map(input => {
    const dirs = Array.from(input.directories.entries());
    const roots = buildDirTree(dirs);
    const totalPlanets = countPlanets(roots);
    const initialRx = GALAXY_BASE_RADIUS + totalPlanets * 10;
    const initialRy = GALAXY_BASE_RADIUS + totalPlanets * 12;
    const systems = layoutRootSystems(input.repoName, roots, initialRx, input.dirAffinity);
    return { input, totalPlanets, initialRx, initialRy, systems };
  });

  // 2. Compute effective radius and adjust galaxy bounds to encompass systems
  const ELLIPSE_PAD = 40;
  const galaxySizes = built.map(b => {
    const sysExtent = computeEffectiveRadius(b.systems);
    const rx = Math.max(b.initialRx, sysExtent + ELLIPSE_PAD);
    const ry = Math.max(b.initialRy, sysExtent + ELLIPSE_PAD);
    const effectiveR = Math.max(rx, ry);
    return { rx, ry, effectiveR };
  });

  // 3. Position galaxies with per-pair spacing
  const positions = computeGalaxyPositions(galaxySizes);

  // 4. Assemble
  return {
    galaxies: built.map((b, gi) => ({
      id: `g-${b.input.repoName}`,
      label: b.input.repoName,
      branch: b.input.branch,
      color: GALAXY_COLORS[gi % GALAXY_COLORS.length],
      cx: positions[gi].cx,
      cy: positions[gi].cy,
      rx: galaxySizes[gi].rx,
      ry: galaxySizes[gi].ry,
      systems: b.systems,
    })),
  };
}

function computeGalaxyPositions(
  sizes: { rx: number; ry: number; effectiveR: number }[],
): { cx: number; cy: number }[] {
  const n = sizes.length;
  const centerX = 800;
  const centerY = 600;
  const gap = 150;

  if (n === 1) return [{ cx: centerX, cy: centerY }];

  if (n === 2) {
    // Side by side with exact spacing
    const halfSpan = (sizes[0].effectiveR + gap + sizes[1].effectiveR) / 2;
    return [
      { cx: Math.round(centerX - halfSpan), cy: centerY },
      { cx: Math.round(centerX + halfSpan), cy: centerY },
    ];
  }

  // n >= 3 : circular layout where radius guarantees no adjacent overlap
  // chord between adjacent = 2R·sin(π/n) >= effectiveR[i] + effectiveR[j] + gap
  const sinVal = Math.sin(Math.PI / n);
  let layoutRadius = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const needed = (sizes[i].effectiveR + sizes[j].effectiveR + gap) / (2 * sinVal);
    if (needed > layoutRadius) layoutRadius = needed;
  }

  return sizes.map((_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      cx: Math.round(centerX + Math.cos(angle) * layoutRadius),
      cy: Math.round(centerY + Math.sin(angle) * layoutRadius),
    };
  });
}

function layoutRootSystems(
  repoName: string, roots: DirNode[],
  galaxyRx: number, dirAffinity?: Map<string, Map<string, number>>,
): SystemData[] {
  const n = roots.length;
  const systemRadius = Math.max(galaxyRx * 0.6, 100);

  // Compute positions for roots (same logic as before)
  const positions: { x: number; y: number }[] = [];
  if (n <= 2) {
    const angleStep = n > 1 ? Math.PI : 0;
    for (let i = 0; i < n; i++) {
      const angle = angleStep * i - Math.PI / 2;
      positions.push({
        x: n > 1 ? Math.cos(angle) * systemRadius * 0.8 : 0,
        y: n > 1 ? Math.sin(angle) * systemRadius * 0.8 : 0,
      });
    }
  } else if (dirAffinity && dirAffinity.size > 0) {
    const dirEntries: [string, LayoutPlanet[]][] = roots.map(r => [r.path, r.planets]);
    forceDirectedLayout(dirEntries, positions, systemRadius, dirAffinity);
  } else {
    const angleStep = (2 * Math.PI) / n;
    for (let i = 0; i < n; i++) {
      const angle = angleStep * i - Math.PI / 2;
      positions.push({
        x: Math.cos(angle) * systemRadius,
        y: Math.sin(angle) * systemRadius,
      });
    }
  }

  const systems: SystemData[] = [];
  for (let si = 0; si < n; si++) {
    const system = buildSystemData(roots[si], repoName, `${si}`);
    system.cx = Math.round(positions[si].x);
    system.cy = Math.round(positions[si].y);
    systems.push(system);
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

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    positions.push({ x: Math.cos(angle) * maxRadius * 0.7, y: Math.sin(angle) * maxRadius * 0.7 });
  }

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

  for (let iter = 0; iter < 40; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));

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

    const cool = 1 - iter / 50;
    for (let i = 0; i < n; i++) {
      positions[i].x += forces[i].fx * cool;
      positions[i].y += forces[i].fy * cool;
    }

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
