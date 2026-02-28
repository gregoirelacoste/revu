# REVU v2 — Prochaines étapes

## Etat actuel

Le core pipeline (scan → parse → analyze → score) est complet et stable.
Le TUI 3 panneaux (Ink) est fonctionnel avec navigation clavier, diff side-by-side, curseur ligne,
flags review (ok/bug/question), contraste progressif, indicateurs explorer, et review persistence v2.

Lancer : `npx tsx src/cli.ts ..`

---

## Phase 1 — Bugs & polish (terminée)

- [x] **Auto-select premier fichier** : fix useEffect + setTreeIdx pour sync focus
- [x] **Troncature texte** : `…` dans TreeRow, DLine, ContextPanel (noms, code, labels, usedBy)
- [x] **Alignement colonnes** : score aligné à droite avec padding dynamique dans TreeRow
- [x] **Numéros de ligne dans le diff** : compteurs base/review indépendants dans data.ts

---

## Phase 2 — Fonctionnalités MVP (terminée)

### Explorer (panneau gauche)

- [x] **Indicateurs review par fichier** : `✓` (tout reviewé), `◐` (partiel) devant chaque fichier
- [x] **Fichiers reviewés atténués** : couleur dim pour les fichiers entièrement checkés
- [x] **Shift+Tab** : panel précédent (cycle dans les deux sens)

### Diff (panneau central)

- [x] **Hunks triés par criticité décroissante**
- [x] **Contraste progressif** : fond via `critBg()`, texte ≥7 white bold, ≥5 bright, ≥2.5 text, <2.5 dim
- [x] **Curseur de ligne** : `▌` accent, navigation ↑↓, PgUp/PgDn avec auto-scroll
- [x] **Saut entre hunks** : `{` et `}` pour hunk précédent/suivant
- [x] **Flag ok** : touche `c` (toggle)
- [x] **Flag bug** : touche `x` (toggle)
- [x] **Flag question** : touche `?` (toggle)
- [x] **Lignes de signature (isSig)** : bordure `┃` accent, bold, score toujours affiché

### Context (panneau droit)

- [x] **Stats review** : section `✓ reviewed/total ✗ bugs ? questions 💬 comments`
- [x] **Mode Dossier** enrichi : nb fichiers, +add -del, sig count, reviewStats
- [x] **Mode Fichier** enrichi : progression review (X/Y lignes, pourcentage), usedBy
- [x] **Mode Repo** enrichi : stats globales agrégées
- [x] **Navigation Enter** : sauter du Context au hunk correspondant dans le Diff

### Barre de statut

- [x] **Stats complètes** : `✓ reviewed/total (pct%) ✗ bugs ? questions 💬 comments` + hints clavier
- [x] **Composant extrait** : StatusBar.tsx avec padding dynamique

### Persistence v2

- [x] **useReview v2** : `Map<string, LineReview>` avec flag + comments par ligne
- [x] **Format JSON v2** : flags par ligne, commentaires avec timestamps, backward-compatible
- [x] **Sauvegarde debounced** : 500ms, par repo+branche

---

## Phase 3 — Features reportées

- [ ] **Alt+B** : sélecteur de branche sur un repo (widget picker UI)
- [ ] **Recherche fichier fuzzy** : touche `/` pour chercher par nom (widget input + filter)
- [ ] **Commentaires inline** : touche `m` pour ouvrir un input sous la ligne (nécessite ink-text-input ou custom)
- [ ] **Mode Ligne** dans Context : quand le curseur est sur un appel, afficher la cible, signature, dépendances (cross-ref AST)

---

## Phase 4 — Side-effects detection

- [ ] **Détecter les fichiers impactés** : fichiers non modifiés qui consomment une méthode dont la signature a changé
- [ ] **Afficher le flag ⚡** dans l'Explorer et le Context
- [ ] **Section SIDE-EFFECTS** dans le Review Summary

---

## Phase 5 — Navigation avancée

- [ ] **Historique de navigation** : `Alt+←` / `Alt+→` (back/forward)
- [ ] **Alt+S** : sauter au Review Summary (focus repo)
- [ ] **Alt+C** : sélecteur de seuil de criticité (prompt numérique)

---

## Phase 6 — Export

- [ ] **Export Markdown** : touche `Alt+E` ou `npx revu --export`
- [ ] **Format** : par fichier, par méthode, avec diff inline, flags, commentaires, side-effects
- [ ] **Sortie** : `.revu/exports/{repo}_{branch}_{date}.md`
- [ ] **Objectif** : utilisable comme input pour Claude Code CLI, ou comme commentaire de PR

---

## Phase 7 — Config complète

- [ ] **`lineCriticality`** : multiplicateurs par type de ligne (partiellement implémenté dans le scoring)
- [ ] **`rules.alwaysShow`** : certains changements toujours visibles quel que soit le seuil
- [ ] **`rules.sideEffectDetection`** : toggle on/off
- [ ] **`rules.minCritForDisplay`** : seuil par défaut au démarrage

---

## Phase 8 — Post-MVP (roadmap)

- [ ] Mouse tracking (hover = update contexte)
- [ ] Resize dynamique (déjà partiellement via useTermSize)
- [ ] Claude Code integration (review automatisée)
- [ ] Export vers GitHub/GitLab PR comments
- [ ] Watch mode (refresh automatique)
- [ ] Support multi-langages

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
