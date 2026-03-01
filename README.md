# REVU

Terminal-based code review tool for multi-service architectures. Prioritizes what matters most through criticality scoring.

> "Review without reading, reading secondarily."

## Features

- **3-panel TUI** — Explorer / Diff / Context, responsive layout
- **Criticality scoring** — Files and methods scored 0–10 based on file type, change volume, dependencies, and security context
- **Line-level review** — Flag lines as OK, Bug, or Question; add comments
- **Batch flagging** — Flag entire files, folders, or hunks in one keystroke
- **AI-ready export** — Structured markdown with findings table, clean diffs, and AI prompts (Alt+E)
- **AI scoring** — Optional AI-proposed criticality weights (Alt+A)
- **Review persistence** — Flags and comments saved per branch in `.revu/reviews/`
- **Side-effect detection** — Highlights methods consuming changed signatures
- **Config-driven** — Project-specific scoring via `.revu/config.json`

## Quick Start

```bash
# Install dependencies
npm install

# Run on a directory containing git repos
npm run dev -- /path/to/repos

# Or specify base branch
npm run dev -- /path/to/repos develop

# Build and run
npm run build
npm start -- /path/to/repos
```

REVU scans all git repositories under the given directory, computes diffs against the base branch, and opens the review TUI.

## Layout

```
┌─ EXPLORER ──────┬─ DIFF ──────────────────────┬─ CONTEXT ─────┐
│ ◈ repo-name     │ ── methodName (7.2)          │ CHANGES       │
│  ▸ src/         │ + added line                  │  methodA 8.1  │
│    S service.ts │ - removed line                │  methodB 3.2  │
│    C ctrl.ts    │   context line                │ IMPORTS       │
│    D dto.ts     │ ── otherMethod (3.1)          │  ./utils.ts   │
│                 │   context line                │ USED BY       │
│                 │ + new line              ✓     │  billing.ts   │
└─────────────────┴──────────────────────────────┴───────────────┘
 1 repo(s)  ✓ 12/28 (43%)  ✗ 2  ? 1                    h:help q:quit
```

## Keyboard Shortcuts

### General
| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Switch panel |
| `[` / `]` | Adjust minimum criticality filter |
| `q` | Quit |
| `h` | Keyboard shortcuts reference |
| `t` | Tutorial (guided tour) |
| `/` | Fuzzy search (explorer) |

### Explorer
| Key | Action |
|-----|--------|
| `↑↓` | Navigate files |
| `←→` | Collapse/expand or open file |
| `Enter` | Open file in diff panel |
| `PgUp/PgDn` | Page up/down |
| `g` / `G` | Jump to top/bottom |
| `c` / `x` / `?` | Batch flag file/folder (safe) |
| `n` | Next unreviewed file |

### Diff
| Key | Action |
|-----|--------|
| `↑↓` | Navigate lines |
| `PgUp/PgDn` | Page up/down |
| `g` / `G` | Jump to top/bottom |
| `{` / `}` | Previous/next hunk |
| `c` / `x` / `?` | Flag line or hunk |
| `n` | Add comment |
| `s` | Toggle unified/side-by-side |

### System
| Key | Action |
|-----|--------|
| `Alt+E` | Export markdown (AI-ready) |
| `Alt+A` | Toggle AI scoring |
| `Alt+R` | Reset review |
| `Alt+←/→` | Navigation history back/forward |

## Criticality Scoring

Every file and method receives a criticality score from 0 to 10:

| Score | Color | Meaning |
|-------|-------|---------|
| 7–10 | Red | Critical — security, auth, core services |
| 4.5–7 | Orange | Important — business logic, APIs |
| 2.5–4.5 | Blue | Normal — standard changes |
| 0–2.5 | Green | Low — DTOs, configs, tests |

**File score** = weighted sum of:
- File type (service > controller > dto)
- Change volume (additions + deletions)
- Dependencies (how many files import this one)
- Security context (auth, crypto, payment keywords)

**Method score** cascades from file score (40%), usage count (30%), signature change (20%), and security context (10%).

Weights are configurable in `.revu/config.json`.

## Review Workflow

1. **Scan** — Open REVU, files sorted by criticality
2. **Triage** — Use `[/]` to set minimum criticality threshold
3. **Review** — Navigate hunks with `{/}`, flag lines with `c/x/?`
4. **Batch** — From Explorer, flag entire files/folders as OK
5. **Comment** — Press `n` on flagged lines to add notes
6. **Export** — `Alt+E` generates AI-ready markdown
7. **AI Analysis** — Feed export to Claude or other AI for validation

## AI Integration

### Export (Alt+E)

Generates a structured markdown file containing:
- Review metadata (branch, SHA, progress, scoring weights)
- Findings summary table (bugs, questions with file/line refs)
- Clean unified diffs per method
- Side-effects table
- AI review request prompt with unreviewed high-crit files

### AI Scoring (Alt+A)

Optional AI-proposed criticality weights stored in the review:
- Category overrides (e.g., services 1.5x, DTOs 0.5x)
- File-level overrides with justification
- Toggle on/off, original scores preserved

## Review Lifecycle

- **Branch-scoped** — Each branch has its own review state
- **Persistent** — Saved automatically to `.revu/reviews/`
- **Staleness detection** — Status bar shows `⚠stale` when HEAD changes
- **Reset** — `Alt+R` then `r` (flags), `a` (AI), `A` (all)

## Configuration

REVU auto-generates `.revu/config.json` on first run. Key settings:

```json
{
  "scoring": {
    "weights": {
      "fileType": 0.25,
      "changeVolume": 0.25,
      "dependencies": 0.25,
      "securityContext": 0.25
    },
    "fileTypes": {
      "service": 0.9,
      "controller": 0.75,
      "guard": 0.85,
      "dto": 0.3,
      "spec": 0.1
    }
  },
  "rules": {
    "sideEffectDetection": true
  }
}
```

## Architecture

```
src/
├── cli.ts                    # Entry point
├── core/
│   ├── engine.ts             # Orchestrator
│   ├── types.ts              # Shared types
│   ├── scanner/              # Git diff parsing
│   ├── analyzer/             # AST, links, side-effects
│   ├── scoring/              # Criticality computation
│   └── review/               # Review persistence
├── tui/
│   ├── App.tsx               # Root component
│   ├── data.ts               # ScanResult → TUI tree
│   ├── context.ts            # Context panel data
│   ├── hooks/                # useNavigation, useReview, etc.
│   └── components/           # Border, TreeRow, DLine, etc.
└── export/
    └── markdown-exporter.ts  # AI-ready export
```

## Development

```bash
npm run dev              # tsx watch (auto-reload)
npm run build            # tsc → dist/
npm start                # node dist/cli.js [rootDir] [baseBranch]
```
