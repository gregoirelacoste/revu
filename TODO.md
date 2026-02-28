# REVU v2 — Prochaines étapes

## Etat actuel

Le core pipeline (scan → parse → analyze → score) est complet et stable.
Le TUI 3 panneaux (Ink) est fonctionnel avec navigation clavier, diff side-by-side, et review persistence basique.

Lancer : `npx tsx src/cli.ts ..`

---

## Phase 1 — Bugs & polish (priorité haute)

- [ ] **Auto-select premier fichier** : le panneau DIFF est vide au démarrage, l'auto-select via useEffect ne semble pas fonctionner en situation réelle. Investiguer et fixer.
- [ ] **Troncature texte** : les lignes longues débordent des panneaux. Tronquer proprement avec `…` selon la largeur disponible.
- [ ] **Alignement colonnes** : le score de criticité dans l'Explorer n'est pas aligné à droite (il suit le nom du fichier).
- [ ] **Numéros de ligne dans le diff** : le brief spécifie des numéros de ligne alignés côté base et côté review. Actuellement absents.

---

## Phase 2 — Fonctionnalités manquantes du brief (MVP)

### Explorer (panneau gauche)

- [ ] **Indicateurs review par fichier** : afficher `✓` (tout reviewé), `◐` (partiel), rien (pas commencé), `⚡` (side-effect) devant chaque fichier/dossier
- [ ] **Fichiers reviewés atténués** : couleur dim pour les fichiers entièrement checkés
- [ ] **Shift+Tab** : panel précédent (actuellement seul Tab fonctionne, fait le cycle dans un sens)
- [ ] **Alt+B** : sélecteur de branche sur un repo
- [ ] **Recherche fichier fuzzy** : touche `/` pour chercher un fichier par nom

### Diff (panneau central)

- [ ] **Hunks triés par criticité décroissante** : actuellement triés par ordre d'apparition dans le fichier
- [ ] **Contraste progressif** : intensité visuelle proportionnelle à la criticité (fond intense ≥7, moyen 5-7, subtil 2.5-5, dim <2.5). Feature clé du brief.
- [ ] **Saut entre hunks** : touches `{` et `}` pour sauter au hunk précédent/suivant
- [ ] **Flag bug** : touche `x` pour marquer une ligne comme bug (✗)
- [ ] **Flag question** : touche `?` pour marquer comme question
- [ ] **Commentaires inline** : touche `m` pour ouvrir un input sous la ligne, avec timestamps et empilement
- [ ] **Lignes de signature (isSig)** : bordure gauche épaisse, bold, score toujours affiché, toujours visibles même si sous le seuil de criticité
- [ ] **Curseur de ligne** : actuellement le scroll est par viewport, pas de curseur sur une ligne spécifique. Le brief veut un curseur ligne par ligne pour pouvoir `c`/`x`/`?`/`m` sur n'importe quelle ligne.

### Context (panneau droit)

- [ ] **Mode Review Summary** (focus repo) : stats globales, chunks critiques triés, side-effects, flags posés
- [ ] **Mode Dossier** amélioré : stats du dossier (nb fichiers, signatures changées, +/- lignes)
- [ ] **Mode Fichier** amélioré : progression review (X/Y lignes), section FLAGS avec commentaires
- [ ] **Mode Ligne** : quand le curseur est sur une ligne contenant un appel identifiable, afficher la cible, sa signature, ses dépendances, appelants
- [ ] **Navigation Enter dans Context** : sauter au fichier/ligne correspondant (partiellement implémenté)

### Barre de statut

- [ ] **Stats complètes** : `✓ 18/34 (53%)  ✗ 2 bugs  ? 1 question  💬 5 comments` (actuellement juste `✓ N`)

---

## Phase 3 — Side-effects detection

- [ ] **Détecter les fichiers impactés** : fichiers non modifiés qui consomment une méthode dont la signature a changé
- [ ] **Afficher le flag ⚡** dans l'Explorer et le Context
- [ ] **Section SIDE-EFFECTS** dans le Review Summary

---

## Phase 4 — Navigation avancée

- [ ] **Historique de navigation** : `Alt+←` / `Alt+→` (back/forward comme dans un navigateur)
- [ ] **Alt+S** : sauter au Review Summary (focus repo)
- [ ] **Alt+C** : sélecteur de seuil de criticité (prompt numérique)

---

## Phase 5 — Persistence v2

Le format de review actuel est basique (Set de clés `fileId:lineNum`). Le brief définit un format riche :

- [ ] **Format JSON v2** : flags par ligne (ok/bug/question), commentaires avec auteur et timestamp, stats agrégées, statut par fichier (partial/complete/not_started)
- [ ] **Fichier nommé par repo+branche** : `.revu/reviews/{repo}_{branch}.json`
- [ ] **Auto-save** après chaque action (actuellement debounced 500ms — OK)

---

## Phase 6 — Export

- [ ] **Export Markdown** : touche `Alt+E` ou `npx revu --export`
- [ ] **Format** : par fichier, par méthode, avec diff inline, flags, commentaires, side-effects
- [ ] **Sortie** : `.revu/exports/{repo}_{branch}_{date}.md`
- [ ] **Objectif** : utilisable comme input pour Claude Code CLI, ou comme commentaire de PR

---

## Phase 7 — Config complète

- [ ] **`lineCriticality`** : multiplicateurs par type de ligne (signatureChange: 2.0, returnTypeChange: 1.8, etc.). Partiellement implémenté dans le scoring mais pas exploité à fond.
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

## Fichiers clés à modifier

| Fichier | Prochaines modifs |
|---------|-------------------|
| `src/tui/App.tsx` | Auto-select fix, curseur diff, stats barre de statut |
| `src/tui/hooks/useNavigation.ts` | `{` `}` hunks, `x` `?` `m` flags, `Shift+Tab`, `Alt+*` |
| `src/tui/components/DLine.tsx` | Contraste progressif, numéros de ligne, lignes isSig |
| `src/tui/components/TreeRow.tsx` | Indicateurs review (✓◐⚡), dim fichiers reviewés |
| `src/tui/components/ContextPanel.tsx` | 4 modes (repo/dossier/fichier/ligne), stats |
| `src/tui/context.ts` | Enrichir les 4 modes de contexte |
| `src/tui/data.ts` | Tri hunks par criticité |
| `src/tui/hooks/useReview.ts` | Format v2 (flags, commentaires, stats) |
| `src/core/engine.ts` | Side-effects detection |
| `src/core/analyzer/link-detector.ts` | Side-effects : croiser liens avec signatures changées |
