# REVU — Terminal Code Review

3-panel code review tool that runs in your terminal.

```
┌─ EXPLORER ─────┐┌─ DIFF ─────────────────────────┐┌─ CONTEXT ───────┐
│ ◈ certificall  ││── getQuotas (Sig changed) 6.2  ││ 5.8 consumption/│
│   ▸ src/cons…  ││ 43 - Promise<QuotaDto[]>       ││                 │
│   ▶ C ctrl  5.5││ 43 + Promise<QuotaStatsDto> ○  ││ CHANGES (4/6)   │
│     S svc   6.8││ 45 - return company.quotas;    ││ 6.8 getQuotas   │
│     ▸ dto/     ││ 46 + return { quotas, usage }; ││ 5.5 getStats    │
│   ▸ src/bill…  ││                                ││                 │
│     S bill ⚡4.5││                                ││ USED BY         │
│                ││                                ││  billing.svc.ts │
└────────────────┘└────────────────────────────────┘└─────────────────┘
```

## Install & Run

```bash
cd my-project/
npm install
npx tsx src/index.tsx
```

## Controls

| Key | Action |
|-----|--------|
| `Tab` | Switch panel (explorer → diff → context) |
| `↑` `↓` | Navigate (tree items / diff scroll / context chunks) |
| `Enter` | Select file / navigate to chunk |
| `c` | Toggle ✓ check on current diff line |
| `[` `]` | Lower / raise criticality threshold |
| `q` | Quit |

## Panels

**Explorer (left)** — File tree showing only modified files. Each file has a type badge (C=Controller, S=Service, D=DTO…) and a criticality score. Navigate with arrow keys, press Enter to open diff.

**Diff (center)** — Side-by-side: `develop` on left, current branch on right. Hunks grouped by method with criticality scores. Word-level highlighting on changed tokens (inverse text). Critical lines (high crit score) shown with score on right margin. Press `c` to mark line as reviewed.

**Context (right)** — Changes dynamically based on what you're looking at in the explorer. Shows all modified code chunks sorted by criticality, with threshold filtering via `[`/`]`. Click a chunk to jump to it. Shows "USED BY" section listing files that depend on the selected code.

## Criticality

Threshold slider via `[` and `]` keys. Chunks below threshold are hidden from context panel. Helps focus on what matters — skip lint changes and comments, go straight to signature changes and security-critical code.
