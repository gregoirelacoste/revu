// ── TUI-specific types ──

// ── Review flags ──

export type LineFlag = 'ok' | 'bug' | 'question';
export interface LineComment { text: string; time: string; }
export interface ReviewStats { total: number; reviewed: number; bugs: number; questions: number; comments: number; }

// ── Explorer tree ──

export interface TreeItem {
  name: string;
  type: string;
  crit: number;
  id?: string;
  branch?: string;
  sideEffect?: boolean;
  children?: TreeItem[];
}

export interface FlatItem {
  node: TreeItem;
  depth: number;
  id: string;
  isFolder: boolean;
}

// ── Diff panel ──

export interface DiffRow {
  type: 'hunkHeader' | 'diffRow';
  method: string;
  methodCrit: number;
  label: string;
  baseLine?: TuiDiffLine | null;
  reviewLine?: TuiDiffLine | null;
}

export interface TuiDiffLine {
  n: number;
  c: string;
  t: 'ctx' | 'add' | 'del';
  crit?: number;
  isSig?: boolean;
  hiRanges?: [number, number][];
}

export interface TuiFileDiff {
  name: string;
  path: string;
  type: string;
  crit: number;
  rows: DiffRow[];
  usedBy: UsedByEntry[];
}

export interface UsedByEntry {
  file: string;
  method: string;
  what: string;
}

// ── Side-effects ──

export interface SideEffect {
  sourceFile: string;
  method: string;
  via: string;
}

// ── Context panel ──

export interface ChunkInfo {
  file: string;
  method: string;
  crit: number;
  label: string;
  fileId?: string;
}

export interface ContextData {
  name: string;
  crit: number;
  summary: string;
  chunks: ChunkInfo[];
  usedBy?: UsedByEntry[];
  sideEffects?: SideEffect[];
  reviewStats?: ReviewStats;
}
