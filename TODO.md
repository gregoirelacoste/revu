# REVU v2 — Plan de développement

## Etat actuel

Le core pipeline (scan → parse → analyze → score) est complet et stable.
Le TUI 3 panneaux (Ink) est fonctionnel avec navigation clavier, diff side-by-side, curseur ligne,
flags review (ok/bug/question), contraste progressif, indicateurs explorer, et review persistence v2.

Lancer : `npm run dev`

---

## Phase 1 — Bugs & polish (terminée)

- [x] Auto-select premier fichier
- [x] Troncature texte (`…`)
- [x] Alignement colonnes (score à droite)
- [x] Numéros de ligne dans le diff

---

## Phase 2 — Fonctionnalités MVP (terminée)

- [x] Indicateurs review par fichier (`✓`/`◐`), fichiers reviewés atténués
- [x] Shift+Tab, curseur de ligne, saut entre hunks (`{`/`}`)
- [x] Flags `c`/`x`/`?` (toggle), lignes de signature (isSig)
- [x] Contraste progressif (`critBg`), hunks triés par criticité
- [x] Context panel enrichi (file/folder/repo stats, Enter → hunk)
- [x] Status bar (review stats + hints), composant extrait
- [x] useReview v2 (line-level flags + comments, JSON v2, debounced save)

---

## Phase 3 — Filet de sécurité (prochaine)

Avant tout refactoring, sécuriser le code existant.

### Tests

- [ ] **Installer vitest** : `devDependencies`, script `npm test`
- [ ] **Tests data.ts** : `buildTree`, `flattenTree`, `buildFileDiffs` (pure functions, ~5 tests)
- [ ] **Tests file-classifier.ts** : chaque pattern + edge cases (~8 tests)
- [ ] **Tests context.ts** : `getFileContext`, `getFolderContext`, `getRepoContext` (~5 tests)
- [ ] **Tests review-stats.ts** : `computeFileReviewStats`, `computeGlobalReviewStats` (~3 tests)
- [ ] **Tests criticality.ts** : scoring boundaries, weights (~4 tests)

### Qualité

- [ ] **ESLint minimal** : `@typescript-eslint`, no-unused-vars, no-explicit-any
- [ ] **Script `npm run lint`** dans package.json

---

## Phase 4 — Side-effects detection

Killer feature différenciante de REVU. Le pipeline a déjà tout : `DetectedLink`, `sigChanged`, `enrichWithDependencies`. Il manque la jointure.

- [ ] **Détecter les fichiers impactés** : pour chaque méthode avec `sigChanged=true`, trouver les `DetectedLink` où `toFile` et `methodName` correspondent. Marquer ces fichiers comme impactés (~30 lignes dans engine.ts)
- [ ] **Flag ⚡ dans l'Explorer** : icône + couleur orange sur les fichiers impactés (TreeRow)
- [ ] **Section SIDE-EFFECTS dans Context** : quand un fichier impacté est sélectionné, afficher quelle méthode a changé, dans quel fichier source, ancienne vs nouvelle signature
- [ ] **Compteur dans la StatusBar** : `⚡ N side-effects`

---

## Phase 5 — Export Markdown

Rend REVU utilisable dans un workflow réel (PR, collègues, Claude Code).

- [ ] **`Alt+E` ou `npx revu --export`** : génère le rapport de review
- [ ] **Format** : par repo → par fichier (trié par criticité) → hunks avec diff inline, flags, commentaires
- [ ] **Side-effects inclus** : section dédiée avec fichiers impactés + signatures
- [ ] **Stats globales** : reviewed/total, bugs, questions, side-effects
- [ ] **Sortie** : `.revu/exports/{repo}_{branch}_{date}.md`
- [ ] **Objectif** : collable dans une PR GitHub/GitLab, feedable à Claude Code

---

## Phase 6 — Unified diff + verticalité

Approche **additive** : ajouter le mode unified sans casser le side-by-side existant.

### Batch 1 — Unified diff (défaut)

- [ ] **Ajouter `unifiedRows: DiffRow[]`** à `TuiFileDiff` : rows séquentiels (`-` old, `+` new, ` ` context) par hunk, pleine largeur. Le `rows` existant (side-by-side) reste intact
- [ ] **State `viewMode: 'unified' | 'split'`** dans App.tsx, touche `s` pour toggle
- [ ] **Refactor data.ts** : `buildUnifiedRows()` en plus de `buildDiffRows()`. Les hunks restent triés par criticité desc
- [ ] **DLine pleine largeur** : en mode unified, une seule `<DLine>` par row, pas de split gauche/droite. Le flag/curseur s'applique sur les lignes `+` et `-`
- [ ] **App.tsx** : `if (viewMode === 'unified')` rend le nouveau layout, sinon l'ancien
- [ ] **useNavigation** : adapter `handleDiffPanel` pour que les flags/curseur fonctionnent sur les rows unifiés (line key = `fileId:lineNum`, inchangé)
- [ ] **Highlight intra-ligne** : sur une paire `-`/`+` consécutive, surligner les mots qui ont changé (word-level diff)

### Batch 2 — Mode focus

- [ ] **State `focusMode: boolean`** (touche `f` pour toggle)
- [ ] **Panneau actif pleine largeur** : `width = size.w - 4`, les deux autres panneaux masqués
- [ ] **Tab/Shift+Tab** : changent de panneau comme avant (le panneau cible prend la pleine largeur)
- [ ] **Status bar** : indicateur du mode focus + quel panneau est actif

### Batch 3 — Collapse automatique des hunks

- [ ] **Hunks sous `minCrit` masqués dans le diff** : filtrer les rows dont `methodCrit < minCrit` au lieu de les afficher dim
- [ ] **Summary line** : `── 3 hunks hidden (crit < 2.5) ──` cliquable/Enter pour expand
- [ ] **Curseur adapté** : `diffCursor` indexe les rows filtrés, pas les rows complets
- [ ] **`[`/`]` met à jour le filtre** : les hunks apparaissent/disparaissent en temps réel

---

## Phase 7 — Classifier étendu + UX quick wins

### Classifier

- [ ] **Étendre file-classifier** : `json`, `yaml`, `sql`, `graphql`, `markdown`, `shell`, `docker`, `config`, `xml`, `env`, `migration` (30 min)
- [ ] **TYPE_ICON pour chaque type** : icône + couleur dans colors.ts
- [ ] **Fallback `?`** : tout fichier non reconnu garde `?` + `unknown`, apparaît quand même

### Navigation

- [ ] **Touche `n`** : jump to next unreviewed file dans l'Explorer (trivial, gros gain UX)
- [ ] **Touche `N`** : jump to next file with bugs/questions
- [ ] **Filtrage Explorer** : touche `t` pour filtrer par type de fichier (picker rapide), touche `F` pour filtrer par flag (show only bugs/questions)
- [ ] **Tri Explorer par criticité** : touche `S` pour toggle tri alphabétique ↔ criticité desc

### Feedback

- [ ] **Error banner** : si le scan échoue partiellement (repo sans branche, fichier illisible), afficher un warning dans la status bar au lieu de stderr silencieux

---

## Phase 8 — Features interactives

- [ ] **Commentaires inline** : touche `m` pour ouvrir un input sous la ligne (ink-text-input)
- [ ] **Recherche fichier fuzzy** : touche `/` pour chercher par nom (widget input + filter flatTree)
- [ ] **Alt+B** : sélecteur de branche sur un repo (picker list)
- [ ] **Mode Ligne dans Context** : quand le curseur est sur un appel, afficher la cible, signature, dépendances (cross-ref AST avec les DetectedLinks)

---

## Phase 9 — Config complète

- [ ] **`lineCriticality`** : multiplicateurs par type de ligne (partiellement implémenté)
- [ ] **`rules.alwaysShow`** : certains changements toujours visibles quel que soit le seuil
- [ ] **`rules.sideEffectDetection`** : toggle on/off
- [ ] **`rules.minCritForDisplay`** : seuil par défaut au démarrage
- [ ] **Historique de navigation** : `Alt+←` / `Alt+→` (back/forward)

---

## Phase 10 — Post-MVP (roadmap)

- [ ] Claude Code integration (review automatisée)
- [ ] Export vers GitHub/GitLab PR comments (API)
- [ ] Watch mode (refresh auto sur changements git)
- [ ] Syntax highlighting minimal (comments + strings TS uniquement, ~20 lignes regex)
- [ ] Support multi-langages (parsers AST au-delà de TypeScript)

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/tui/App.tsx` | Root component, wire state + 3 panels + status bar |
| `src/tui/hooks/useNavigation.ts` | Keyboard input, 3 handlers per-panel |
| `src/tui/hooks/useReview.ts` | Review persistence v2 (line-level flags + comments) |
| `src/tui/components/DLine.tsx` | Diff line rendering (contraste, curseur, flags, isSig) |
| `src/tui/components/TreeRow.tsx` | Explorer row (progress indicators, dim complete) |
| `src/tui/components/ContextPanel.tsx` | Context panel (chunks, stats, usedBy) |
| `src/tui/components/StatusBar.tsx` | Status bar (review stats + hints) |
| `src/tui/context.ts` | Context builders (file/folder/repo) with reviewStats |
| `src/tui/data.ts` | ScanResult → TUI tree + diff rows (hunks sorted by crit) |
| `src/tui/review-stats.ts` | Shared review stats computation (DRY) |
| `src/tui/colors.ts` | Palette, critColor, critBg, FLAG_ICON/FLAG_COLOR |
| `src/tui/types.ts` | TUI-specific types |
| `src/core/engine.ts` | Core scan orchestrator |
| `src/core/analyzer/file-classifier.ts` | File type detection from path patterns |
