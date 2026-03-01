# REVU v2 — Plan de developpement

## Etat actuel

Le core pipeline (scan → parse → analyze → score) est complet et stable.
Le TUI 3 panneaux (Ink) est fonctionnel avec navigation clavier, diff unified + side-by-side,
curseur ligne, flags review (ok/bug/question), contraste progressif, indicateurs explorer,
review persistence v3, live diff reload, et review map.

Lancer : `npm run dev`

---

## Phase 1 — Bugs & polish ✅

- [x] Auto-select premier fichier
- [x] Troncature texte
- [x] Alignement colonnes (score a droite)
- [x] Numeros de ligne dans le diff

## Phase 2 — Fonctionnalites MVP ✅

- [x] Indicateurs review par fichier, fichiers reviewes attenues
- [x] Shift+Tab, curseur de ligne, saut entre hunks
- [x] Flags c/x/? (toggle), lignes de signature
- [x] Contraste progressif, hunks tries par criticite
- [x] Context panel enrichi (file/folder/repo stats, Enter → hunk)
- [x] Status bar (review stats + hints)
- [x] useReview v2 (line-level flags + comments, JSON v2, debounced save)

## Phase 3 — Tests & qualite

- [ ] Installer vitest, script `npm test`
- [ ] Tests data.ts, file-classifier.ts, context.ts, review-stats.ts, criticality.ts
- [ ] ESLint minimal

## Phase 4 — Side-effects detection ✅

- [x] Detection des fichiers impactes via DetectedLink + sigChanged
- [x] Flag dans l'Explorer
- [x] Section SIDE-EFFECTS dans Context
- [x] Compteur dans la StatusBar

## Phase 5 — Export Markdown ✅

- [x] Alt+E : export AI-ready markdown
- [x] Format par repo → fichier → hunks avec diff, flags, commentaires
- [x] Side-effects inclus
- [x] Stats globales
- [x] Sortie `.revu/exports/`

## Phase 6 — Unified diff + word diff ✅

- [x] Mode unified (defaut) + side-by-side (touche s, min 140 cols)
- [x] Word-level diff highlighting (tokens changes surlignés)
- [x] Crit bar dans les hunk headers

## Phase 7 — Classifier etendu + UX ✅

- [x] File classifier etendu (json, yaml, sql, graphql, etc.)
- [x] TYPE_ICON pour chaque type
- [x] Touche n : next unreviewed file
- [x] Batch flagging (fichier/dossier/hunk scope)

## Phase 8 — Features interactives ✅

- [x] Commentaires inline (touche n dans le diff)
- [x] Recherche fuzzy (touche /)
- [x] Navigation historique (Alt+←/→)
- [x] Mode Ligne dans Context (cross-ref AST + DetectedLinks)

## Phase 9 — AI scoring + review lifecycle ✅

- [x] AI scoring override (Alt+A) avec ScoringOverride dans ReviewData
- [x] Staleness detection (headSha comparison)
- [x] Reset review (Alt+R → r/a/A/Esc)
- [x] Tutorial overlay (touche t, 6 pages)
- [x] HelpOverlay (touche h)

## Phase 10 — Live diff reload ✅

- [x] fs.watch recursive sur les repos
- [x] Debounce 500ms + coalescing
- [x] Preservation d'etat (selectedFile, curseur, flags)
- [x] Indicateur [LIVE] / scanning... dans la StatusBar
- [x] Touche r : reload manuel

## Phase 11 — Review Map ✅

- [x] Radial mind map (hub & spokes) avec drawCard/drawEdge
- [x] Dashboard bar (progress, stats, repo/file counts)
- [x] Navigation touche m, fleches, Enter pour jump
- [x] Criticite visuelle (couleur + bar) par noeud

## Phase 12 — Scoring v2 🔄

> Plan detaille : `.claude/plans/phase12-scoring-v2.md`

### Axe 1 — Scoring statistique ✅ (2025-03-01)

- [x] 3 nouveaux weights : contentRisk, methodRisk, stability
- [x] content-signals.ts : 10 fonctions pures (regex content, method risk, stability, 5 compound bonuses, 2 attenuations)
- [x] computeFileCriticalityV2 (3 couches : base × compound × attenuation)
- [x] computeMethodCriticalityV2 (7 facteurs)
- [x] engine.ts et rescore() migres vers v2

### Axe 2 — Scoring IA

- [ ] ai-scorer.ts (prompt, appel API, fusion)
- [ ] Config AI dans .revu/config.json
- [ ] Integration TUI (indicateur AI, rescore)
- [ ] training-extractor.ts (extraction tuples depuis reviews)
- [ ] calibrator.ts (calibration poids depuis feedback humain)
- [ ] RAG bug index + enrichissement prompt

## Phase 13 — Enrichissement du contexte

> Plan detaille : `.claude/plans/phase13-context-enrichment.md`

- [ ] Afficher ancienne/nouvelle signature quand sigChanged
- [ ] Path HTTP dans le header de hunk (@Get /users/:id)
- [ ] Indicateur tested: false dans Explorer et Context
- [ ] Nombre de callers (usages) dans le header de hunk
- [ ] Badges decorateurs securite (@UseGuards, @Roles)
- [ ] Cross-repo sur les liens (DEPENDS ON)
- [ ] Label (Deleted · unused) + crit des callers dans USED BY
- [ ] Compteur de methodes formatting-only filtrees

## Phase 14 — Workflow & navigation rapide

> Plan detaille : `.claude/plans/phase14-workflow-navigation.md`

- [ ] Escape dans le diff = retour Explorer
- [ ] N = flag ok + next file (diff panel)
- [ ] Next unreviewed hunk
- [ ] Enter sur import = jump au fichier
- [ ] Scroll exact dans historique (NavPos + scroll)
- [ ] Nav rapide Review Map (g/G/PageUp/PageDown)

## Phase 15 — Smart filtering

> Plan detaille : `.claude/plans/phase15-smart-filtering.md`

- [ ] Search enrichie avec prefixes (>7, @service, !, ~, *)
- [ ] minCrit dim dans l'Explorer
- [ ] minCrit dim dans le diff
- [ ] Section STABLE DEPS dans Context

---

## Fichiers cles

| Fichier | Role |
|---------|------|
| `src/tui/App.tsx` | Root component, wire state + 3 panels + status bar |
| `src/tui/hooks/useNavigation.ts` | Keyboard input, 3 handlers per-panel |
| `src/tui/hooks/useReview.ts` | Review persistence v3 (line-level flags + comments) |
| `src/tui/hooks/useFileWatcher.ts` | Live diff reload (fs.watch + debounce) |
| `src/tui/components/DLine.tsx` | Diff line rendering (contraste, curseur, flags) |
| `src/tui/components/TreeRow.tsx` | Explorer row (progress indicators, dim complete) |
| `src/tui/components/ContextPanel.tsx` | Context panel (chunks, stats, usedBy) |
| `src/tui/components/StatusBar.tsx` | Status bar (review stats + hints) |
| `src/tui/components/ReviewMapOverlay.tsx` | Radial mind map overlay |
| `src/tui/map-layout.ts` | 2D grid layout engine for review map |
| `src/tui/map-data.ts` | ScanResult → map nodes/edges |
| `src/tui/context.ts` | Context builders (file/folder/repo) |
| `src/tui/data.ts` | ScanResult → TUI tree + diff rows |
| `src/tui/colors.ts` | Palette, critColor, critBg, FLAG_ICON/FLAG_COLOR |
| `src/tui/types.ts` | TUI-specific types |
| `src/core/engine.ts` | Core scan orchestrator |
| `src/core/scoring/criticality.ts` | File + method criticality v2 (3-layer) |
| `src/core/scoring/content-signals.ts` | 10 content-aware signal functions |
| `src/core/scoring/config.ts` | Config loader + defaults |
| `src/core/analyzer/diff-extractor.ts` | Method/constant diff builders |
| `src/core/analyzer/link-detector.ts` | Cross-file dependency detection |
| `src/core/analyzer/ast-parser.ts` | TypeScript AST extraction |
| `src/core/analyzer/file-classifier.ts` | File type detection from path |
