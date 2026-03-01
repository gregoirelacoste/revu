// ── Shared backend types ──

export type FileType =
  | 'controller' | 'service' | 'module' | 'component' | 'guard'
  | 'dto' | 'model' | 'interceptor' | 'pipe' | 'spec'
  | 'html' | 'scss' | 'css' | 'unknown';

export type Flag = 'ok' | 'bug' | 'test' | 'question';
export type MethodStatus = 'new' | 'mod' | 'unch' | 'del';
export type DiffLineType = 'a' | 'd' | 'c';
export type LinkType = 'import' | 'inject' | 'http' | 'grpc' | 'type' | 'side-effect';

// ── Git / Scanner ──

export interface RepoInfo {
  name: string;
  path: string;
  currentBranch: string;
  baseBranch: string;
  headSha: string;
}

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

// ── AST / Analyzer ──

export interface ParsedMethod {
  name: string;
  startLine: number;
  endLine: number;
  signature: string;
  decorators: string[];
  httpVerb?: string;
  httpPath?: string;
}

export interface ParsedConstant {
  name: string;
  startLine: number;
  endLine: number;
  isType: boolean;
}

export interface ParsedImport {
  specifiers: string[];
  source: string;
  resolvedPath?: string;
}

export interface ParsedInjection {
  paramName: string;
  typeName: string;
  resolvedPath?: string;
}

export interface ParsedFile {
  path: string;
  repoName: string;
  fileType: FileType;
  methods: ParsedMethod[];
  constants: ParsedConstant[];
  imports: ParsedImport[];
  injections: ParsedInjection[];
}

// ── Links ──

export interface DetectedLink {
  fromFile: string;
  toFile: string;
  type: LinkType;
  label: string;
  methodName?: string;
  riskCrit: number;
  cross: boolean;
  specifiers?: string[];
}

// ── Scoring config (.revu/config.json) ──

export interface ScoringWeights {
  // Graph-based (source of truth)
  graphImportance: number;
  callerCritWeight: number;
  entryProximity: number;
  exclusivity: number;
  // Content-based (complementary)
  contentRisk: number;
  stability: number;
  // Legacy (kept as secondary bonus in compound layer)
  fileType: number;
  changeVolume: number;
  dependencies: number;
  securityContext: number;
  methodRisk: number;
}

export interface LineCritMultipliers {
  security: number;
  signature: number;
  errorHandling: number;
  database: number;
  controlFlow: number;
  injection: number;
  async: number;
  dataTransform: number;
  returnLogic: number;
  assignment: number;
  declaration: number;
  typeDecl: number;
  logging: number;
  import: number;
  comment: number;
  whitespace: number;
}

export interface SecurityKeywords {
  high: string[];
  medium: string[];
  low: string[];
}

export interface SecurityBonus {
  high: number;
  medium: number;
  low: number;
}

export interface ScoringConfig {
  weights: ScoringWeights;
  fileTypes: Record<string, number>;
  securityKeywords: SecurityKeywords;
  securityBonus: SecurityBonus;
  lineCriticality: LineCritMultipliers;
}

export interface RevuConfig {
  version: number;
  stack: string;
  scoring: ScoringConfig;
  rules: {
    alwaysShow: string[];
    sideEffectDetection: boolean;
    minCritForDisplay: number;
  };
}

// ── Method/Constant diff data ──

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
  diff: Array<{ t: DiffLineType; c: string }>;
}

// ── Review ──

export interface MethodReview {
  flag?: Flag;
  comments: Array<{ text: string; time: string }>;
  actions: Array<{ text: string; done: boolean }>;
}

export interface FileReview {
  flag?: Flag;
  methods: Record<string, MethodReview>;
  lines?: Record<string, { flag?: Flag; comments: Array<{ text: string; time: string }> }>;
}

export interface ReviewData {
  version: number;
  repo: string;
  branch: string;
  baseBranch: string;
  headSha?: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, FileReview>;
  scoringOverride?: ScoringOverride;
  scoringContext?: ScoringContext;
}

export interface ScoringOverride {
  version: number;
  headSha: string;
  generatedAt: string;
  generatedBy: 'ai' | 'manual';
  rationale: string;
  categoryOverrides?: Record<string, { weight: number; reason: string }>;
  fileOverrides?: Record<string, { weight: number; reason: string }>;
}

// ── Scoring breakdown (persisted in ReviewData) ──

export interface LineCategoryCount {
  security: number;
  signature: number;
  errorHandling: number;
  database: number;
  controlFlow: number;
  injection: number;
  async: number;
  dataTransform: number;
  returnLogic: number;
  assignment: number;
  declaration: number;
  typeDecl: number;
  logging: number;
  import: number;
  comment: number;
  whitespace: number;
}

export interface FileScoringBreakdown {
  changeCrit: number;
  graphAmplifier: number;
  compoundBonus: number;
  compoundDetail: {
    sigDep: number;
    propagation: number;
    cascadeDepth: number;
    dtoContract: number;
    endpointMod: number;
  };
  fmtDiscount: number;
  testDiscount: number;
  finalScore: number;
  lineCount: number;
  lineCategories: LineCategoryCount;
  topKMean: number;
  fullMean: number;
  graphSignals?: { graphImportance: number; callerCritWeight: number; entryProximity: number; exclusivity: number };
}

export interface ScoringContext {
  scorerVersion: string;
  configHash: string;
  generatedAt: string;
  files: Record<string, FileScoringBreakdown>;
}
