import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";

// ─── COLORS ──────────────────────────────────────
const C = {
  bg: "#1e1e1e",
  border: "#3c3c3c",
  dim: "#555555",
  text: "#aaaaaa",
  bright: "#cccccc",
  white: "#eeeeee",
  green: "#4ec9b0",
  red: "#f14c4c",
  orange: "#cca700",
  blue: "#569cd6",
  purple: "#c586c0",
  cyan: "#9cdcfe",
  accent: "#007acc",
};

const crit = (v: number) =>
  v >= 7 ? C.red : v >= 4.5 ? C.orange : v >= 2.5 ? C.blue : C.green;

// ─── DATA ────────────────────────────────────────

interface TreeItem {
  name: string;
  type: string;
  crit: number;
  id?: string;
  branch?: string;
  sideEffect?: boolean;
  children?: TreeItem[];
}

const TREE: TreeItem[] = [
  {
    name: "certificall-api",
    type: "repo",
    branch: "feature/CER-247",
    crit: 6.2,
    children: [
      {
        name: "src/consumption",
        type: "folder",
        crit: 5.8,
        children: [
          { name: "consumption.controller.ts", type: "controller", crit: 5.5, id: "ctrl" },
          { name: "consumption.service.ts", type: "service", crit: 6.8, id: "svc" },
          { name: "consumption.service.spec.ts", type: "spec", crit: 1.2, id: "spec" },
          {
            name: "dto/",
            type: "folder",
            crit: 2.8,
            children: [
              { name: "stats.dto.ts", type: "dto", crit: 3.0, id: "dto" },
              { name: "stats-query.dto.ts", type: "dto", crit: 1.8, id: "dtoq" },
            ],
          },
        ],
      },
      {
        name: "src/billing",
        type: "folder",
        crit: 4.5,
        children: [
          {
            name: "billing.service.ts",
            type: "service",
            crit: 4.5,
            id: "billing",
            sideEffect: true,
          },
        ],
      },
    ],
  },
];

// Flatten tree for keyboard nav
interface FlatItem {
  node: TreeItem;
  depth: number;
  id: string;
  isFolder: boolean;
}

function flattenTree(items: TreeItem[], depth = 0): FlatItem[] {
  const result: FlatItem[] = [];
  for (const item of items) {
    const isFolder = item.type === "folder" || item.type === "repo";
    result.push({ node: item, depth, id: item.id || item.name, isFolder });
    if (isFolder && item.children) {
      result.push(...flattenTree(item.children, depth + 1));
    }
  }
  return result;
}

const FLAT_TREE = flattenTree(TREE);

// Type icons
const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  controller: { icon: "C", color: C.green },
  service: { icon: "S", color: C.blue },
  module: { icon: "M", color: C.purple },
  component: { icon: "Co", color: C.red },
  dto: { icon: "D", color: C.cyan },
  guard: { icon: "G", color: C.orange },
  spec: { icon: "T", color: C.green },
  folder: { icon: "▸", color: C.orange },
  repo: { icon: "◈", color: C.cyan },
};

// ─── DIFF DATA ───────────────────────────────────

interface DiffLine {
  n: number;
  c: string;
  t: "ctx" | "add" | "del";
  crit?: number;
  isSig?: boolean;
  hiRanges?: [number, number][];
}

interface Hunk {
  method: string;
  crit: number;
  label: string;
  base: DiffLine[];
  review: DiffLine[];
}

interface FileDiff {
  name: string;
  path: string;
  type: string;
  crit: number;
  hunks: Hunk[];
  usedBy: { file: string; method: string; what: string }[];
}

const DIFFS: Record<string, FileDiff> = {
  ctrl: {
    name: "consumption.controller.ts",
    path: "src/consumption/consumption.controller.ts",
    type: "controller",
    crit: 5.5,
    hunks: [
      {
        method: "getStats",
        crit: 5.5,
        label: "New endpoint GET /stats",
        base: [
          { n: 24, c: "  @ApiTags('consumption')", t: "ctx" },
          { n: 25, c: "  export class ConsumptionController {", t: "ctx" },
          { n: 26, c: "    constructor(private svc: ConsumptionService) {}", t: "ctx" },
          { n: 27, c: "", t: "ctx" },
        ],
        review: [
          { n: 24, c: "  @ApiTags('consumption')", t: "ctx" },
          { n: 25, c: "  export class ConsumptionController {", t: "ctx" },
          { n: 26, c: "    constructor(private svc: ConsumptionService) {}", t: "ctx" },
          { n: 27, c: "", t: "ctx" },
          { n: 28, c: "    @Get('stats')", t: "add", crit: 2.0 },
          { n: 29, c: "    @UseGuards(AdminGuard)", t: "add", crit: 3.5 },
          { n: 30, c: "    async getStats(@Query() q: StatsQueryDto): Promise<StatsResponseDto> {", t: "add", crit: 5.5, isSig: true },
          { n: 31, c: "      return this.svc.computeStats(q);", t: "add", crit: 4.0 },
          { n: 32, c: "    }", t: "add", crit: 0.5 },
        ],
      },
      {
        method: "getQuotas",
        crit: 6.2,
        label: "Sig changed — return type modified",
        base: [
          { n: 42, c: "    @Get('quotas/:id')", t: "ctx" },
          { n: 43, c: "    async getQuotas(@Param('id') id: string): Promise<QuotaDto[]> {", t: "del", crit: 6.2, isSig: true, hiRanges: [[49, 67]] },
          { n: 44, c: "      const company = await this.companyRepo.findOne(id);", t: "ctx" },
          { n: 45, c: "      return company.quotas;", t: "del", crit: 5.0, hiRanges: [[13, 27]] },
          { n: 46, c: "    }", t: "ctx" },
        ],
        review: [
          { n: 42, c: "    @Get('quotas/:id')", t: "ctx" },
          { n: 43, c: "    async getQuotas(@Param('id') id: string): Promise<QuotaStatsDto> {", t: "add", crit: 6.2, isSig: true, hiRanges: [[49, 69]] },
          { n: 44, c: "      const company = await this.companyRepo.findOne(id);", t: "ctx" },
          { n: 45, c: "      const usage = await this.svc.getUsage(id);", t: "add", crit: 4.5 },
          { n: 46, c: "      return { quotas: company.quotas, usage };", t: "add", crit: 5.8, hiRanges: [[13, 46]] },
          { n: 47, c: "    }", t: "ctx" },
        ],
      },
    ],
    usedBy: [
      { file: "consumption.service.ts", method: "computeStats", what: "called by getStats" },
      { file: "billing.service.ts", method: "syncQuotas", what: "consumes getQuotas" },
    ],
  },
  svc: {
    name: "consumption.service.ts",
    path: "src/consumption/consumption.service.ts",
    type: "service",
    crit: 6.8,
    hunks: [
      {
        method: "getQuotas",
        crit: 6.8,
        label: "Sig + return changed — impacts billing",
        base: [
          { n: 78, c: "    async getQuotas(companyId: string): Promise<QuotaDto[]> {", t: "del", crit: 6.8, isSig: true, hiRanges: [[36, 60]] },
          { n: 79, c: "      const company = await this.companyRepo.findOne(companyId);", t: "ctx" },
          { n: 80, c: "      return company.quotas;", t: "del", crit: 5.0, hiRanges: [[13, 27]] },
          { n: 81, c: "    }", t: "ctx" },
        ],
        review: [
          { n: 78, c: "    async getQuotas(companyId: string, period?: DateRange): Promise<QuotaStatsDto> {", t: "add", crit: 6.8, isSig: true, hiRanges: [[36, 82]] },
          { n: 79, c: "      const company = await this.companyRepo.findOne(companyId);", t: "ctx" },
          { n: 80, c: "      const usage = await this.computeUsage(company, period);", t: "add", crit: 4.5 },
          { n: 81, c: "      return { quotas: company.quotas, usage };", t: "add", crit: 5.8, hiRanges: [[13, 46]] },
          { n: 82, c: "    }", t: "ctx" },
        ],
      },
      {
        method: "computeStats",
        crit: 5.2,
        label: "New method — aggregates stats",
        base: [],
        review: [
          { n: 95, c: "    async computeStats(q: StatsQueryDto): Promise<StatsResponseDto> {", t: "add", crit: 5.2, isSig: true },
          { n: 96, c: "      const companies = await this.getFilteredCompanies(q);", t: "add", crit: 3.0 },
          { n: 97, c: "      const scores = await Promise.all(", t: "add", crit: 3.5 },
          { n: 98, c: "        companies.map(c => this.trustSvc.calculateScore(c.lastPhotoId))", t: "add", crit: 7.0 },
          { n: 99, c: "      );", t: "add", crit: 0.5 },
          { n: 100, c: "      return this.aggregateStats(companies, scores);", t: "add", crit: 3.0 },
          { n: 101, c: "    }", t: "add", crit: 0.5 },
        ],
      },
    ],
    usedBy: [
      { file: "consumption.controller.ts", method: "getStats", what: "injects computeStats" },
      { file: "billing.service.ts", method: "syncQuotas", what: "consumes getQuotas" },
    ],
  },
  billing: {
    name: "billing.service.ts",
    path: "src/billing/billing.service.ts",
    type: "service",
    crit: 4.5,
    hunks: [
      {
        method: "syncQuotas",
        crit: 4.5,
        label: "⚡ Side-effect — consumes changed getQuotas()",
        base: [
          { n: 34, c: "    async syncQuotas(companyId: string) {", t: "ctx" },
          { n: 35, c: "      const quotas = await this.consumptionSvc.getQuotas(companyId);", t: "ctx", crit: 4.5 },
          { n: 36, c: "      // quotas is now QuotaStatsDto, not QuotaDto[]", t: "ctx" },
          { n: 37, c: "      await this.updateBilling(quotas);", t: "ctx", crit: 4.5 },
          { n: 38, c: "    }", t: "ctx" },
        ],
        review: [
          { n: 34, c: "    async syncQuotas(companyId: string) {", t: "ctx" },
          { n: 35, c: "      const quotas = await this.consumptionSvc.getQuotas(companyId);", t: "ctx", crit: 4.5 },
          { n: 36, c: "      // ⚠ quotas return type changed: QuotaDto[] → QuotaStatsDto", t: "ctx" },
          { n: 37, c: "      await this.updateBilling(quotas);", t: "ctx", crit: 4.5 },
          { n: 38, c: "    }", t: "ctx" },
        ],
      },
    ],
    usedBy: [],
  },
};

// Context data
interface ChunkInfo {
  file: string;
  method: string;
  crit: number;
  label: string;
  fileId?: string;
}

interface ContextData {
  name: string;
  crit: number;
  summary: string;
  chunks: ChunkInfo[];
  usedBy?: { file: string; method: string; what: string }[];
}

function getContext(id: string): ContextData | null {
  // File context
  const diff = DIFFS[id];
  if (diff) {
    return {
      name: diff.name,
      crit: diff.crit,
      summary: `${diff.hunks.length} hunks · ${diff.path}`,
      chunks: diff.hunks.map((h) => ({
        file: diff.name,
        method: h.method,
        crit: h.crit,
        label: h.label,
        fileId: id,
      })),
      usedBy: diff.usedBy,
    };
  }
  // Folder context
  if (id === "src/consumption") {
    return {
      name: "src/consumption",
      crit: 5.8,
      summary: "4 files · 2 sig changed · +190 lines",
      chunks: [
        { file: "controller.ts", method: "getStats", crit: 5.5, label: "New GET /stats", fileId: "ctrl" },
        { file: "controller.ts", method: "getQuotas", crit: 6.2, label: "Sig changed", fileId: "ctrl" },
        { file: "service.ts", method: "getQuotas", crit: 6.8, label: "Sig + return changed", fileId: "svc" },
        { file: "service.ts", method: "computeStats", crit: 5.2, label: "New aggregation", fileId: "svc" },
        { file: "stats.dto.ts", method: "StatsResponseDto", crit: 3.0, label: "New return type", fileId: "dto" },
        { file: "spec.ts", method: "describe", crit: 1.2, label: "Tests added", fileId: "spec" },
      ],
    };
  }
  if (id === "src/billing") {
    return {
      name: "src/billing",
      crit: 4.5,
      summary: "1 file impacted · 0 direct changes · side-effect",
      chunks: [
        { file: "billing.service.ts", method: "syncQuotas", crit: 4.5, label: "⚡ Consumes changed getQuotas()", fileId: "billing" },
      ],
    };
  }
  return null;
}

// ─── HOOK: Terminal size ─────────────────────────
function useTermSize() {
  const { stdout } = useStdout();
  const [size, setSize] = useState({ w: stdout?.columns || 120, h: stdout?.rows || 40 });
  useEffect(() => {
    const onResize = () => {
      if (stdout) setSize({ w: stdout.columns, h: stdout.rows });
    };
    stdout?.on("resize", onResize);
    return () => { stdout?.off("resize", onResize); };
  }, [stdout]);
  return size;
}

// ─── COMPONENTS ──────────────────────────────────

function Border({ label, color, width, height, children }: {
  label?: string; color: string; width: number | string; height: number | string; children: React.ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="single"
      borderColor={color}
      overflow="hidden"
    >
      {label && (
        <Box marginLeft={1}>
          <Text color={color} bold> {label} </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

// ─── Tree Item Row ───────────────────────────────
function TreeRow({ item, isSelected, isFocused }: {
  item: FlatItem; isSelected: boolean; isFocused: boolean;
}) {
  const ic = TYPE_ICON[item.node.type] || TYPE_ICON.folder;
  const cc = crit(item.node.crit);
  const indent = "  ".repeat(item.depth);

  return (
    <Box>
      <Text color={isFocused ? C.accent : undefined}>
        {isFocused ? "▶" : " "}
      </Text>
      <Text dimColor>{indent}</Text>
      <Text color={ic.color} bold>{item.isFolder ? (item.node.type === "repo" ? "◈" : "▸") : ic.icon}</Text>
      <Text> </Text>
      <Text
        color={isSelected ? C.white : C.text}
        bold={isSelected}
        underline={isSelected}
      >
        {item.node.name}
      </Text>
      {item.node.sideEffect && <Text color={C.orange}> ⚡</Text>}
      {item.node.branch && <Text color={C.dim}> {item.node.branch}</Text>}
      <Text> </Text>
      <Text color={cc} bold>
        {item.node.crit.toFixed(1)}
      </Text>
    </Box>
  );
}

// ─── Diff Rendered Line ──────────────────────────
function DLine({ line, width, minCrit, showCrit }: {
  line: DiffLine | null; width: number; minCrit: number; showCrit: boolean;
}) {
  if (!line) return <Text color={C.dim}>{" ".repeat(Math.max(0, width))}</Text>;

  const isAdd = line.t === "add";
  const isDel = line.t === "del";
  const lineCrit = line.crit || 0;
  const aboveThreshold = lineCrit >= minCrit;

  const prefix = isAdd ? "+" : isDel ? "-" : " ";
  const prefixColor = isAdd ? C.green : isDel ? C.red : C.dim;

  // Intensity: critical lines are brighter
  const textColor = line.isSig
    ? C.white
    : isAdd || isDel
      ? aboveThreshold && lineCrit >= 5
        ? C.bright
        : C.text
      : C.dim;

  const lineNum = String(line.n).padStart(3, " ");
  const code = line.c.slice(0, Math.max(10, width - 12));
  const critStr = showCrit && (isAdd || isDel) && lineCrit >= minCrit && lineCrit > 0
    ? ` ${lineCrit.toFixed(1)}`
    : "";

  return (
    <Box>
      <Text color={C.dim}>{lineNum} </Text>
      <Text color={prefixColor} bold>{prefix}</Text>
      <Text> </Text>
      {line.hiRanges && line.hiRanges.length > 0 ? (
        <Text>
          {renderHighlighted(line.c, line.hiRanges, textColor, isAdd ? C.green : C.red, width - 12)}
        </Text>
      ) : (
        <Text color={textColor} bold={line.isSig}>{code}</Text>
      )}
      {critStr && <Text color={crit(lineCrit)} bold>{critStr}</Text>}
    </Box>
  );
}

function renderHighlighted(
  text: string,
  ranges: [number, number][],
  baseColor: string,
  hiColor: string,
  maxWidth: number
): React.ReactNode {
  const clipped = text.slice(0, maxWidth);
  const parts: React.ReactNode[] = [];
  let pos = 0;

  for (const [start, end] of ranges) {
    if (start > pos) {
      parts.push(<Text key={`b${pos}`} color={baseColor}>{clipped.slice(pos, Math.min(start, clipped.length))}</Text>);
    }
    const hiStart = Math.max(pos, start);
    const hiEnd = Math.min(end, clipped.length);
    if (hiStart < hiEnd) {
      parts.push(<Text key={`h${hiStart}`} color={hiColor} bold inverse>{clipped.slice(hiStart, hiEnd)}</Text>);
    }
    pos = end;
  }
  if (pos < clipped.length) {
    parts.push(<Text key={`e${pos}`} color={baseColor}>{clipped.slice(pos)}</Text>);
  }
  return <>{parts}</>;
}

// ─── MAIN APP ────────────────────────────────────

function App() {
  const { exit } = useApp();
  const size = useTermSize();

  // State
  const [panel, setPanel] = useState(0); // 0=tree, 1=diff, 2=context
  const [treeIdx, setTreeIdx] = useState(2); // index in FLAT_TREE
  const [selectedFile, setSelectedFile] = useState("ctrl");
  const [contextId, setContextId] = useState("src/consumption");
  const [diffScroll, setDiffScroll] = useState(0);
  const [ctxScroll, setCtxScroll] = useState(0);
  const [ctxIdx, setCtxIdx] = useState(0);
  const [minCrit, setMinCrit] = useState(0);
  const [checkedLines, setCheckedLines] = useState<Set<string>>(new Set());

  // Widths
  const treeW = Math.max(30, Math.floor(size.w * 0.22));
  const ctxW = Math.max(28, Math.floor(size.w * 0.24));
  const diffW = Math.max(30, size.w - treeW - ctxW - 6); // 6 for borders
  const bodyH = size.h - 5; // title + status

  // Current diff
  const diff = DIFFS[selectedFile];
  const ctx = getContext(contextId);

  // All diff lines flattened for scrolling
  const diffLines: { type: "hunk"; hunk: Hunk }[] | { type: "base"; line: DiffLine; hunk: Hunk }[] | { type: "review"; line: DiffLine; hunk: Hunk }[] = [];
  interface DiffRow {
    type: "hunkHeader" | "diffRow";
    hunk: Hunk;
    baseLine?: DiffLine | null;
    reviewLine?: DiffLine | null;
  }
  const diffRows: DiffRow[] = [];

  if (diff) {
    for (const hunk of diff.hunks) {
      diffRows.push({ type: "hunkHeader", hunk });
      const maxLen = Math.max(hunk.base.length, hunk.review.length);
      for (let i = 0; i < maxLen; i++) {
        diffRows.push({
          type: "diffRow",
          hunk,
          baseLine: hunk.base[i] || null,
          reviewLine: hunk.review[i] || null,
        });
      }
    }
  }

  // Input handling
  useInput((input, key) => {
    // Quit
    if (input === "q") { exit(); return; }

    // Switch panels
    if (key.tab) {
      setPanel((p) => (p + 1) % 3);
      return;
    }

    // Criticality threshold
    if (input === "[") { setMinCrit((v) => Math.max(0, v - 0.5)); return; }
    if (input === "]") { setMinCrit((v) => Math.min(9, v + 0.5)); return; }

    // Panel-specific navigation
    if (panel === 0) {
      // Tree
      if (key.upArrow) setTreeIdx((i) => Math.max(0, i - 1));
      if (key.downArrow) setTreeIdx((i) => Math.min(FLAT_TREE.length - 1, i + 1));
      if (key.return || key.rightArrow) {
        const item = FLAT_TREE[treeIdx];
        if (item && !item.isFolder && item.node.id && DIFFS[item.node.id]) {
          setSelectedFile(item.node.id);
          setDiffScroll(0);
        }
        // Update context
        if (item) {
          if (item.isFolder) {
            setContextId(item.node.name);
          } else if (item.node.id) {
            setContextId(item.node.id);
          }
        }
      }
      // Also update context on hover (navigation)
      const hovItem = FLAT_TREE[treeIdx];
      if (hovItem) {
        if (hovItem.isFolder) setContextId(hovItem.node.name);
        else if (hovItem.node.id) setContextId(hovItem.node.id);
      }
    }

    if (panel === 1) {
      // Diff scroll
      if (key.upArrow) setDiffScroll((s) => Math.max(0, s - 1));
      if (key.downArrow) setDiffScroll((s) => Math.min(Math.max(0, diffRows.length - bodyH + 5), s + 1));
      if (key.pageDown) setDiffScroll((s) => Math.min(Math.max(0, diffRows.length - bodyH + 5), s + 10));
      if (key.pageUp) setDiffScroll((s) => Math.max(0, s - 10));
      // Check current line
      if (input === "c") {
        const row = diffRows[diffScroll];
        if (row?.type === "diffRow" && row.reviewLine) {
          const key = `${selectedFile}:${row.reviewLine.n}`;
          setCheckedLines((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          });
        }
      }
    }

    if (panel === 2) {
      // Context scroll
      if (key.upArrow) setCtxIdx((i) => Math.max(0, i - 1));
      if (key.downArrow && ctx) setCtxIdx((i) => Math.min(ctx.chunks.length - 1, i + 1));
      if (key.return && ctx && ctx.chunks[ctxIdx]) {
        const chunk = ctx.chunks[ctxIdx];
        if (chunk.fileId && DIFFS[chunk.fileId]) {
          setSelectedFile(chunk.fileId);
          setContextId(chunk.fileId);
          setDiffScroll(0);
          setPanel(1);
        }
      }
    }
  });

  // ─── RENDER ──────────────────────────────────────

  const halfDiff = Math.floor((diffW - 3) / 2);
  const visibleDiffRows = diffRows.slice(diffScroll, diffScroll + bodyH - 3);

  return (
    <Box flexDirection="column" width={size.w} height={size.h}>
      {/* Title bar */}
      <Box height={1} width={size.w}>
        <Text backgroundColor={C.accent} color="#ffffff" bold>
          {" ◈ REVU "}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.bright}>
          {" CER-247 · consumption-dashboard "}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>
          {"─".repeat(Math.max(0, size.w - 60))}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>
          {" crit≥"}
        </Text>
        <Text backgroundColor="#3c3c3c" color={crit(minCrit)} bold>
          {minCrit.toFixed(1)}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>
          {" [/] "}
        </Text>
      </Box>

      {/* Panels */}
      <Box flexDirection="row" height={bodyH}>

        {/* LEFT: File tree */}
        <Border
          label="EXPLORER"
          color={panel === 0 ? C.accent : C.border}
          width={treeW}
          height={bodyH}
        >
          <Box flexDirection="column" overflow="hidden">
            {FLAT_TREE.map((item, i) => (
              <TreeRow
                key={i}
                item={item}
                isSelected={item.node.id === selectedFile}
                isFocused={panel === 0 && i === treeIdx}
              />
            ))}
          </Box>
        </Border>

        {/* CENTER: Diff */}
        <Border
          label={diff ? `${diff.name} — develop ↔ CER-247` : "DIFF"}
          color={panel === 1 ? C.accent : C.border}
          width={diffW}
          height={bodyH}
        >
          {diff ? (
            <Box flexDirection="column" overflow="hidden">
              {visibleDiffRows.map((row, i) => {
                if (row.type === "hunkHeader") {
                  const hc = crit(row.hunk.crit);
                  return (
                    <Box key={`h${i}`}>
                      <Text color={hc} bold>{"──"}</Text>
                      <Text color={hc} bold> {row.hunk.method} </Text>
                      <Text color={C.dim}>({row.hunk.label})</Text>
                      <Text> </Text>
                      <Text color={hc} bold>{row.hunk.crit.toFixed(1)}</Text>
                      <Text color={C.dim}> {"─".repeat(Math.max(0, diffW - row.hunk.method.length - row.hunk.label.length - 16))}</Text>
                    </Box>
                  );
                }

                const isActive = panel === 1 && diffScroll + i === diffScroll && i === 0;
                const lineKey = row.reviewLine ? `${selectedFile}:${row.reviewLine.n}` : "";
                const checked = checkedLines.has(lineKey);

                return (
                  <Box key={`d${i}`}>
                    <Box width={halfDiff}>
                      <DLine line={row.baseLine || null} width={halfDiff} minCrit={minCrit} showCrit={false} />
                    </Box>
                    <Text color={C.border}>│</Text>
                    <Box width={halfDiff}>
                      <DLine line={row.reviewLine || null} width={halfDiff - 4} minCrit={minCrit} showCrit={true} />
                    </Box>
                    {row.reviewLine && (row.reviewLine.t === "add" || row.reviewLine.t === "del") ? (
                      <Text color={checked ? C.green : C.dim}>{checked ? " ✓" : " ○"}</Text>
                    ) : (
                      <Text>{"  "}</Text>
                    )}
                  </Box>
                );
              })}
              {diffRows.length > bodyH - 3 && (
                <Box>
                  <Text color={C.dim}>
                    {" "}↕ {diffScroll + 1}/{diffRows.length} ({Math.round((diffScroll / Math.max(1, diffRows.length - bodyH + 3)) * 100)}%)
                  </Text>
                </Box>
              )}
            </Box>
          ) : (
            <Box justifyContent="center" alignItems="center" height={bodyH - 3}>
              <Text color={C.dim}>Select a file to view diff</Text>
            </Box>
          )}
        </Border>

        {/* RIGHT: Context */}
        <Border
          label="CONTEXT"
          color={panel === 2 ? C.accent : C.border}
          width={ctxW}
          height={bodyH}
        >
          {ctx ? (
            <Box flexDirection="column" overflow="hidden">
              {/* Header */}
              <Box>
                <Text color={crit(ctx.crit)} bold>{ctx.crit.toFixed(1)}</Text>
                <Text> </Text>
                <Text color={C.white} bold>{ctx.name}</Text>
              </Box>
              <Text color={C.dim}>{ctx.summary}</Text>
              <Text color={C.dim}>{"─".repeat(ctxW - 4)}</Text>

              {/* Chunks */}
              <Text color={C.dim} bold>
                {" CHANGES "}
                ({ctx.chunks.filter((c) => c.crit >= minCrit).length}/{ctx.chunks.length})
              </Text>
              {ctx.chunks
                .filter((c) => c.crit >= minCrit)
                .map((chunk, i) => {
                  const isFoc = panel === 2 && i === ctxIdx;
                  return (
                    <Box key={i} flexDirection="column">
                      <Box>
                        <Text color={isFoc ? C.accent : C.dim}>{isFoc ? "▶" : " "}</Text>
                        <Text color={crit(chunk.crit)} bold>{chunk.crit.toFixed(1)}</Text>
                        <Text> </Text>
                        <Text color={isFoc ? C.white : C.bright} bold={isFoc}>
                          {chunk.method}
                        </Text>
                      </Box>
                      <Text color={C.dim}>{"   "}{chunk.label.slice(0, ctxW - 8)}</Text>
                    </Box>
                  );
                })}

              {/* Used by */}
              {ctx.usedBy && ctx.usedBy.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color={C.dim}>{"─".repeat(ctxW - 4)}</Text>
                  <Text color={C.dim} bold>{" USED BY"}</Text>
                  {ctx.usedBy.map((u, i) => (
                    <Box key={i} flexDirection="column">
                      <Box>
                        <Text> </Text>
                        <Text color={C.cyan}>{u.file}</Text>
                      </Box>
                      <Text color={C.dim}>   {u.method} — {u.what}</Text>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ) : (
            <Text color={C.dim}>Hover a file or folder</Text>
          )}
        </Border>
      </Box>

      {/* Status bar */}
      <Box height={1} width={size.w}>
        <Text backgroundColor={C.accent} color="#ffffff">
          {" develop ↔ feature/CER-247 "}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.bright}>
          {" "}Tab:panel  ↑↓:nav  Enter:select  c:check  [/]:crit  q:quit{" "}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.dim}>
          {"─".repeat(Math.max(0, size.w - 75))}
        </Text>
        <Text backgroundColor="#3c3c3c" color={C.green}>
          {" "}✓{checkedLines.size}{" "}
        </Text>
      </Box>
    </Box>
  );
}

render(<App />);
