// ── Frontend types (mirrors API response) ──

export type Flag = 'ok' | 'bug' | 'test' | 'question';
export type MethodStatus = 'new' | 'mod' | 'unch' | 'del';
export type DiffLineType = 'a' | 'd' | 'c';
export type LinkType = 'import' | 'inject' | 'http' | 'grpc' | 'type' | 'side-effect';
export type FileType = 'controller' | 'service' | 'module' | 'component' | 'guard'
  | 'dto' | 'model' | 'interceptor' | 'pipe' | 'spec'
  | 'html' | 'scss' | 'css' | 'unknown';

export interface DiffEntry { t: DiffLineType; c: string }

export interface MethodData {
  name: string;
  status: MethodStatus;
  crit: number;
  usages: number;
  tested: boolean;
  sigChanged: boolean;
  isType?: boolean;
  httpVerb?: string;
  impacted?: boolean;
  diff: DiffEntry[];
}

export interface PlanetData {
  id: string;
  name: string;
  ext: string;
  type: FileType;
  crit: number;
  add: number;
  del: number;
  tested: boolean;
  sideEffect?: boolean;
  reviewed?: boolean;
  ox: number;
  oy: number;
  methods: MethodData[];
  constants: MethodData[];
}

export interface SystemData {
  id: string;
  label: string;
  fullPath: string;
  cx: number;
  cy: number;
  r: number;
  planets: PlanetData[];
  children?: SystemData[];
}

export interface GalaxyData {
  id: string;
  label: string;
  branch: string;
  color: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  systems: SystemData[];
}

export interface EdgeData {
  from: string;
  to: string;
  label: string;
  riskCrit: number;
  cross?: boolean;
  critical?: boolean;
  dashed?: boolean;
  linkType?: LinkType;
  specifiers?: string[];
  sigChanged?: boolean;
}

export interface ScanResponse {
  galaxies: GalaxyData[];
  edges: EdgeData[];
}

// ── Computed ──

export interface FlatPlanet extends PlanetData {
  galaxy: GalaxyData;
  system: SystemData;
  ax: number;
  ay: number;
}

// ── Focus target ──

export type FocusTarget =
  | { kind: 'planet'; id: string; planet: FlatPlanet }
  | { kind: 'system'; id: string; system: SystemData; galaxy: GalaxyData; absCx: number; absCy: number }
  | { kind: 'galaxy'; id: string; galaxy: GalaxyData }
  | { kind: 'edge'; id: string; edge: EdgeData; fromPlanet: FlatPlanet; toPlanet: FlatPlanet };

// ── Review state (shared across all detail panels) ──

export interface ReviewState {
  flags: Record<string, Flag | null>;
  comments: Record<string, Array<{ text: string; t: string }>>;
  actions: Record<string, Array<{ text: string; done: boolean }>>;
  archivedIds: Set<string>;
  toggleFlag: (id: string, key: Flag) => void;
  addComment: (id: string, text: string) => void;
  addAction: (id: string, text: string) => void;
  toggleAction: (id: string, idx: number) => void;
}

// ── Theme ──

export interface Palette {
  bg: string; surface: string; card: string; cardHov: string;
  border: string; text: string; dim: string; bright: string; white: string;
  green: string; red: string; orange: string; blue: string;
  purple: string; cyan: string; pink: string; brown: string;
  gBg: string; gBo: string; sBg: string; sBo: string;
  lBg: string; sh: string;
  diffAddBg: string; diffDelBg: string; diffAddHi: string; diffDelHi: string;
}
