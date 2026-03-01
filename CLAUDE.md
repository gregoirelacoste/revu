# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Revu

TUI-based code review tool for multi-service architectures. Designed for terminal use with Ink (React for terminals). Target: 3-panel layout (Explorer / Diff / Context). Philosophy: "review without reading, reading secondarily."

Scoring is **config-driven** via `.revu/config.json` at the project root. Each project can define its own criticality weights, file type scores, security keywords, and line-level multipliers. Default config is generated if absent.

## Commands

```bash
npm run dev              # tsx watch src/cli.ts .. (auto-reload)
npm run build            # tsc → dist/
npm start                # node dist/cli.js [rootDir] [baseBranch]
```

No test or lint scripts configured yet.

## Architecture

TypeScript CLI app using Ink (React TUI framework). ES modules throughout. Strict TypeScript.

### Core Pipeline (src/core/)

The scan engine (`core/engine.ts`) orchestrates the full analysis:

1. **Config Loader** (`scoring/config.ts`) — loads `.revu/config.json`, deep-merges with defaults
2. **Scanner** (`scanner/repo-scanner.ts`) — walks root dir for `.git` repos, gets current branch, filters out main/develop/master
3. **Diff Parser** (`scanner/diff-parser.ts`) — runs `git diff base...HEAD --unified=3`, parses unified diff into hunks/lines
4. **AST Parser** (`analyzer/ast-parser.ts`) — parses changed `.ts/.tsx` files with `@typescript-eslint/typescript-estree`, extracts methods, constants, imports, injections
5. **File Classifier** (`analyzer/file-classifier.ts`) — pattern-based classification (`.service.ts` → service, `.controller.ts` → controller, `.resolver.ts` → service, etc.)
6. **Link Detector** (`analyzer/link-detector.ts`) — detects imports, NestJS injections; keyed by file path for correct riskCrit lookup
7. **Diff Extractor** (`analyzer/diff-extractor.ts`) — builds method/constant diff data, compares old vs new AST, detects formatting-only changes
8. **Criticality Scorer** (`scoring/criticality.ts`) — config-driven weighted scoring (file type, change volume, dependencies, security context), scale 0–10
9. **Engine** (`engine.ts`) — orchestrates steps 1-8, enriches with real dependency counts post-link-detection, returns `ScanResult`

Review persistence: `review/review-store.ts` — saves/loads JSON to `.revu/reviews/`

### Scoring System

Scoring is the heart of REVU. All weights come from `.revu/config.json`:

```
score_file = (typeWeight × w.fileType + changeWeight × w.changeVolume + depWeight × w.dependencies + securityWeight × w.securityContext) × 10
```

- `typeWeight`: from `config.scoring.fileTypes[fileType]`
- `changeWeight`: `min(1, (add + del) / 200)`
- `depWeight`: `min(1, inboundLinks / 10)` — computed from real link detection
- `securityWeight`: from `config.scoring.securityKeywords` matched against file path

Method criticality factors in: file score (40%), usage count (30%), signature change (20%), security context (10%).

Line-level multipliers (`config.scoring.lineCriticality`) will modulate per-line intensity in the TUI.

### TUI (src/tui/)

Ink ^5.1.0 (React for terminals). 3-panel layout: Explorer / Diff / Context.

- **App.tsx** — root component, wires state + 3 panels + status bar
- **data.ts** — transforms `ScanResult` → TUI tree (TreeItem/FlatItem) + diff rows
- **context.ts** — derives context panel data from current selection (file/folder/repo)
- **colors.ts** — palette + `critColor()` + `TYPE_ICON` map
- **types.ts** — TUI-specific types (TreeItem, FlatItem, DiffRow, TuiDiffLine, ContextData)
- **components/** — Border, TreeRow, DLine, ContextPanel, HelpOverlay, TutorialOverlay
- **hooks/** — useTermSize, useNavigation, useReview, useInputMode, useReviewProgress, useNavHistory

### Shared Types

`src/core/types.ts` is the source of truth. Key types:
- Config: `RevuConfig`, `ScoringConfig`, `ScoringWeights`, `LineCritMultipliers`, `SecurityKeywords`
- Engine output: `FileEntry`, `RepoEntry`, `ScanResult` (from engine.ts)
- Pipeline: `DetectedLink`, `ParsedFile`, `MethodData`
- Review: `ReviewData`, `FileReview`, `MethodReview`, `ScoringOverride`

## Key Conventions

- File extensions determine classification: `.service.ts`, `.controller.ts`, `.dto.ts`, `.guard.ts`, `.module.ts`, `.resolver.ts`, `.middleware.ts`, `.filter.ts`, `.strategy.ts`, etc.
- Links between files are typed: `import`, `inject`, `type` (more link types planned)
- Criticality is a 0–10 float driven by project config
- Review flags: `ok`, `bug`, `question`
- Method status: `new`, `mod`, `unch`, `del`
- Diff lines encoded as `{ t: 'a'|'d'|'c', c: string }` (add/delete/context)
- `fileCritMap` is keyed by file **path** (not generated ID) to ensure correct riskCrit on links

## Key Shortcuts

- `t` — Tutorial overlay (paginated guided tour)
- `h` — Keyboard shortcuts reference
- `c/x/?` — Flag as ok/bug/question (line, hunk, file, or folder scope)
- `n` — Add comment (diff) or next unreviewed file (explorer)
- `Alt+E` — Export AI-ready markdown
- `Alt+A` — Toggle AI scoring override
- `Alt+R` — Reset review (r=flags, a=AI, A=all)
- `[/]` — Adjust minimum criticality filter

## Review Persistence

- Reviews stored in `.revu/reviews/{repo}_{branch}.json`
- ReviewData v3 with `headSha` for staleness detection
- `ScoringOverride` stored inside ReviewData (not separate file)
- Branch-scoped: different branches are fully independent
- `saveReviews` preserves `createdAt` and `scoringOverride` across saves

## Environment

- CLI entry: `src/cli.ts` — takes optional root directory + base branch arguments
- Product spec v2: `v2/revu-brief-tui-v2.md`
- POC reference: `v2/POC/revu-tui/`
- Export: `src/export/markdown-exporter.ts` — AI-ready markdown with findings table
