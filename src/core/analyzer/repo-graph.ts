// ── Full-repo dependency graph builder ──
// Scans ALL .ts files (not just diff) to build the complete import/injection graph.
// Used by graph-based scoring to compute objective structural signals.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, normalize, basename, extname } from 'node:path';
import { parseTypeScript } from './ast-parser.js';
import { classifyFile } from './file-classifier.js';

// ── Types ──

export interface GraphNode {
  path: string;
  fileType: string;
  isEntry: boolean;
  methods: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'import' | 'inject';
  specifiers: string[];
}

export interface RepoGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge[]>;         // path → outgoing
  reverseEdges: Map<string, GraphEdge[]>;  // path → incoming
}

// Entry-point file types (controllers, resolvers expose the app to the outside)
const ENTRY_TYPES = new Set(['controller']);
const ENTRY_PATTERNS = [/\.resolver\.tsx?$/, /\.gateway\.tsx?$/, /main\.ts$/];

// Directories to skip during walk
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.revu', 'coverage', '.angular']);

// ── Main builder ──

export async function buildRepoGraph(repoPath: string): Promise<RepoGraph> {
  const tsFiles = await walkTsFiles(repoPath);
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();
  const reverseEdges = new Map<string, GraphEdge[]>();

  // Phase 1: Parse all files, build nodes
  const parsedImports = new Map<string, { imports: Array<{ specifiers: string[]; source: string }>; injections: Array<{ typeName: string }> }>();

  for (const absPath of tsFiles) {
    const relPath = absPath.slice(repoPath.length + 1).replace(/\\/g, '/');
    const code = await readFile(absPath, 'utf-8').catch(() => null);
    if (!code) continue;

    const ast = parseTypeScript(code);
    const fileType = classifyFile(relPath);
    const isEntry = ENTRY_TYPES.has(fileType) || ENTRY_PATTERNS.some(p => p.test(relPath));

    nodes.set(relPath, {
      path: relPath,
      fileType,
      isEntry,
      methods: ast.methods.map(m => m.name),
    });

    parsedImports.set(relPath, {
      imports: ast.imports,
      injections: ast.injections,
    });
  }

  // Phase 2: Resolve edges
  const classIndex = buildClassNameIndex(nodes);

  for (const [fromPath, parsed] of parsedImports) {
    const fileEdges: GraphEdge[] = [];

    // Import edges
    for (const imp of parsed.imports) {
      const toPath = resolveImportPath(fromPath, imp.source, nodes);
      if (!toPath) continue;

      const edge: GraphEdge = {
        from: fromPath,
        to: toPath,
        type: 'import',
        specifiers: imp.specifiers,
      };
      fileEdges.push(edge);

      const rev = reverseEdges.get(toPath) ?? [];
      rev.push(edge);
      reverseEdges.set(toPath, rev);
    }

    // Injection edges (NestJS constructor injection)
    for (const inj of parsed.injections) {
      const toPath = classIndex.get(inj.typeName);
      if (!toPath || toPath === fromPath) continue;

      const edge: GraphEdge = {
        from: fromPath,
        to: toPath,
        type: 'inject',
        specifiers: [inj.typeName],
      };
      fileEdges.push(edge);

      const rev = reverseEdges.get(toPath) ?? [];
      rev.push(edge);
      reverseEdges.set(toPath, rev);
    }

    if (fileEdges.length > 0) {
      edges.set(fromPath, fileEdges);
    }
  }

  return { nodes, edges, reverseEdges };
}

// ── Filesystem walk (recursive, filters .ts/.tsx, skips dirs) ──

async function walkTsFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const queue: string[] = [dir];

  while (queue.length > 0) {
    const current = queue.pop()!;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const fullPath = join(current, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) queue.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name)) continue;
      if (/\.spec\.tsx?$/.test(entry.name)) continue;
      if (/\.d\.tsx?$/.test(entry.name)) continue;
      if (/\.test\.tsx?$/.test(entry.name)) continue;

      results.push(fullPath);
    }
  }

  return results;
}

// ── Class name → file path index (for injection resolution) ──

function buildClassNameIndex(nodes: Map<string, GraphNode>): Map<string, string> {
  const index = new Map<string, string>();
  for (const [path] of nodes) {
    const name = basename(path, extname(path));
    const className = toPascalCase(name);
    index.set(className, path);
  }
  return index;
}

function toPascalCase(str: string): string {
  return str.split(/[.-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// ── Import path resolution (relative only) ──

function resolveImportPath(
  fromPath: string,
  importSource: string,
  nodes: Map<string, GraphNode>,
): string | null {
  if (!importSource.startsWith('.')) return null;

  const fromDir = dirname(fromPath);
  const resolved = normalize(join(fromDir, importSource)).replace(/\\/g, '/');
  const candidates = [
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '/index.ts',
    resolved,
  ];

  for (const c of candidates) {
    if (nodes.has(c)) return c;
  }

  return null;
}
