# REVU v2 — Roadmap

## Etat actuel

Core pipeline (scan → parse → analyze → score) complet et stable.
TUI 3 panneaux (Ink) avec navigation clavier, diff unified + side-by-side,
curseur ligne, flags review, review persistence v3, live diff reload,
scoring v2 (graph-based + content signals), et feature map v2 (cluster spatial).

Lancer : `npm run dev`

---

## Phases terminees

> Details dans `roadmap/terminé/`

| Phase | Description | Statut |
|-------|-------------|--------|
| 1 | Bugs & polish | Done |
| 2 | Fonctionnalites MVP | Done |
| 4 | Side-effects detection | Done |
| 5 | Export Markdown | Done |
| 6 | Unified diff + word diff | Done |
| 7 | Classifier etendu + UX | Done |
| 8 | Features interactives | Done |
| 9 | AI scoring + review lifecycle | Done |
| 10 | Live diff reload | Done |
| 11 | Review Map v1 (radial) | Done |
| 11b | Review Map v2 (cluster spatial) | Done |
| 12 | Scoring v2 (graph + content signals) | Done |

---

## Phases en cours / a venir

### Phase 3 — Tests & qualite

- [ ] Installer vitest, script `npm test`
- [ ] Tests data.ts, file-classifier.ts, context.ts, criticality.ts
- [ ] ESLint minimal

### Phase 12.2 — Scoring IA

> Plan : `roadmap/terminé/phase12-scoring-v2.md` (section Axe 2)

- [ ] ai-scorer.ts (prompt, appel API, fusion)
- [ ] Config AI dans .revu/config.json
- [ ] Integration TUI (indicateur AI, rescore)

### Phase 13 — Enrichissement du contexte

> Plan : `roadmap/phase13-context-enrichment.md`

- [ ] Ancienne/nouvelle signature quand sigChanged
- [ ] Path HTTP dans le header de hunk
- [ ] Indicateur tested: false
- [ ] Nombre de callers dans le header de hunk
- [ ] Badges decorateurs securite
- [ ] Cross-repo sur les liens DEPENDS ON
- [ ] Compteur methodes formatting-only

### Phase 14 — Workflow & navigation rapide

> Plan : `roadmap/phase14-workflow-navigation.md`

- [ ] Escape dans le diff = retour Explorer
- [ ] N = flag ok + next file (diff panel)
- [ ] Next unreviewed hunk
- [ ] Enter sur import = jump au fichier

### Phase 15 — Smart filtering

> Plan : `roadmap/phase15-smart-filtering.md`

- [ ] Search enrichie avec prefixes (>7, @service, !, ~, *)
- [ ] minCrit dim dans l'Explorer et le diff
- [ ] Section STABLE DEPS dans Context

---

## Backlog

> Idees et ameliorations collectees : `roadmap/backlog/améliorations.md`

---

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src/tui/App.tsx` | Root component, state + 3 panels + overlays |
| `src/tui/hooks/useNavigation.ts` | Keyboard input, handlers per-panel + map |
| `src/tui/hooks/useReview.ts` | Review persistence v3 (line-level flags + comments) |
| `src/tui/hooks/useFileWatcher.ts` | Live diff reload (fs.watch + debounce) |
| `src/tui/cluster-data.ts` | Feature map clustering (BFS components) |
| `src/tui/map-layout.ts` | Spatial zone layout engine for feature map |
| `src/tui/components/ReviewMapOverlay.tsx` | Feature map overlay (graph + detail strip) |
| `src/tui/components/DLine.tsx` | Diff line rendering |
| `src/tui/components/TreeRow.tsx` | Explorer row (progress indicators) |
| `src/tui/components/ContextPanel.tsx` | Context panel (chunks, stats, usedBy) |
| `src/tui/components/StatusBar.tsx` | Status bar (review stats + hints) |
| `src/tui/context.ts` | Context builders (file/folder/repo) |
| `src/tui/data.ts` | ScanResult → TUI tree + diff rows |
| `src/tui/colors.ts` | Palette, critColor, TYPE_ICON |
| `src/tui/types.ts` | TUI-specific types |
| `src/core/engine.ts` | Core scan orchestrator |
| `src/core/scoring/criticality.ts` | File + method criticality v2 (3-layer) |
| `src/core/scoring/content-signals.ts` | Content-aware signal functions |
| `src/core/scoring/graph-signals.ts` | Graph-based scoring signals |
| `src/core/scoring/config.ts` | Config loader + defaults |
| `src/core/analyzer/diff-extractor.ts` | Method/constant diff builders |
| `src/core/analyzer/link-detector.ts` | Cross-file dependency detection |
| `src/core/analyzer/ast-parser.ts` | TypeScript AST extraction |
| `src/core/analyzer/file-classifier.ts` | File type detection |
| `src/core/analyzer/repo-graph.ts` | Full-repo graph for scoring |
| `src/export/markdown-exporter.ts` | AI-ready markdown export |
