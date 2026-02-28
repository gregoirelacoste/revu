# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Revu

TUI-based code review tool for multi-service architectures. Designed for terminal use with Ink (React for terminals). Target: 3-panel layout (Explorer / Diff / Context). Philosophy: "review without reading, reading secondarily."

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

1. **Scanner** (`scanner/repo-scanner.ts`) — walks root dir for `.git` repos, gets current branch, filters out main/develop/master
2. **Diff Parser** (`scanner/diff-parser.ts`) — runs `git diff base...HEAD --unified=3`, parses unified diff into hunks/lines
3. **AST Parser** (`analyzer/ast-parser.ts`) — parses changed `.ts` files with `@typescript-eslint/typescript-estree`, extracts methods, constants, imports, injections
4. **File Classifier** (`analyzer/file-classifier.ts`) — pattern-based classification (`.service.ts` → service, `.controller.ts` → controller, etc.)
5. **Link Detector** (`analyzer/link-detector.ts`) — detects imports, NestJS injections, HTTP endpoints; deduplicates by from+to+type
6. **Criticality Scorer** (`scoring/criticality.ts`) — weighted scoring (type 0.3, changes 0.3, deps 0.2, security keywords 0.2), scale 0–10
7. **Engine** (`engine.ts`) — orchestrates steps 1-6, returns `ScanResult { repos[], links[], allFiles[] }`

Review persistence: `review/review-store.ts` — saves/loads JSON to `.revu/reviews/`

### TUI (src/tui/) — In Progress

Will use Ink ^5.1.0 for terminal rendering. Target: 3-panel layout (Explorer / Diff / Context).
Reference POC: `v2/POC/revu-tui/`

### Shared Types

`src/core/types.ts` is the source of truth. Key types: `FileEntry`, `RepoEntry`, `ScanResult` (from engine.ts), `DetectedLink`, `ParsedFile`, `MethodData`, `ReviewData`.

## Key Conventions

- File extensions determine classification: `.service.ts`, `.controller.ts`, `.dto.ts`, `.guard.ts`, `.module.ts`, etc.
- Links between files are typed: `import`, `inject`, `http`, `grpc`, `type`, `side-effect`
- Criticality is a 0–10 float controlling visual weight
- Review flags: `ok`, `bug`, `test`, `question`
- Method status: `new`, `mod`, `unch`, `del`
- Diff lines encoded as `{ t: 'a'|'d'|'c', c: string }` (add/delete/context)

## Environment

- CLI entry: `src/cli.ts` — takes optional root directory + base branch arguments
- Product spec v2: `v2/revu-brief-tui-v2.md`
- POC reference: `v2/POC/revu-tui/`

# currentDate
Today's date is 2026-02-28.
