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
}

export interface ReviewData {
  version: number;
  repo: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
  updatedAt: string;
  files: Record<string, FileReview>;
}
