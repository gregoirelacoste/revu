# Phase 7 : Unified Diff + Crit Bar

## Contexte

Le diff side-by-side est inutilisable sur terminal standard : **26 chars par côté sur 120 cols** (14 chars de code utile après gutter). Le progressive contrast `critBg()` est cassé : plage hex de 10% (#1e→#37), imperceptible sur la plupart des terminaux.

**Objectif** : unified diff par défaut + crit bar en marge gauche. Deux changements urgents, cohérents avec la philosophie "review without reading".

---

## Décisions d'architecture (issues du challenge)

### Pas de nouveau type `UnifiedRow`

Le brief original proposait un type `UnifiedRow` + un champ `unifiedRows` sur `TuiFileDiff`. Ce type est redondant avec `DiffRow` (mêmes champs + un `side`).

**Approche retenue** : une fonction `buildUnifiedRows(rows: DiffRow[]): DiffRow[]` qui réordonne les `DiffRow` existants en format unified (del groupés avant add, context émis une seule fois). Le type `DiffRow` est réutilisé tel quel — on distingue base/review via `baseLine` / `reviewLine` comme avant.

Avantage : zéro nouveau type, `TuiFileDiff` inchangé, `review-stats.ts` fonctionne sans modification (il continue à lire `rows`).

### Navigation minimale

Le mode diff (`diffMode`) et son toggle restent dans `App.tsx`. La navigation reçoit :
- Le tableau de lignes actif via `diffRows` (déjà existant dans `NavContext`), que App calcule selon le mode
- Un callback `onToggleDiffMode?: () => void` dans `NavSetters` (même pattern que `onExport`)

Zéro nouveau champ dans `NavState` ou `NavContext`.

### Touche de toggle : `s` restreinte au panel diff

`s` en global risque des toggles accidentels depuis le tree panel. La touche est gérée uniquement dans `handleDiffPanel`, comme `c`/`x`/`?`.

### Seuil side-by-side : 140 cols

160 est trop restrictif (rare en split-screen). 140 cols = 70 chars par côté = utilisable.

### Flags en unified : seules les lignes `add` sont flaggables

Cohérent avec le side-by-side. En unified, on flag via `reviewLine.n` sur les lignes dont `reviewLine.t === 'add'`. Les lignes `del` et `ctx` ne sont pas flaggables.

---

## Changements

### 1. Types (`src/tui/types.ts`)

- Ajouter `DiffMode = 'unified' | 'side-by-side'`
- Pas de nouveau type `UnifiedRow`
- `TuiFileDiff` inchangé

### 2. Colors (`src/tui/colors.ts`)

- **Supprimer** `critBg()`
- **Ajouter** `critBar(crit: number): { char: string; color: string }` :
  ```
  crit >= 7   → █ rouge
  crit >= 4.5 → ▓ orange
  crit >= 2.5 → ▒ bleu
  crit >= 0.5 → ░ vert
  sinon       → ' ' dim
  ```

### 3. DLine (`src/tui/components/DLine.tsx`)

- Remplacer import `critBg` → `critBar`
- Supprimer `backgroundColor` de tous les `<Text>`
- Ajouter `<Text color={bar.color}>{bar.char}</Text>` en premier dans le rendu (avant le cursor char)
- `maxCodeLen` : `width - 13` (1 char de plus pour la barre)

### 4. Data (`src/tui/data.ts`)

- **Exporter** `buildUnifiedRows(rows: DiffRow[]): DiffRow[]`
  - Parcourt les `DiffRow` existants dans l'ordre
  - `hunkHeader` : émis tel quel
  - Au sein de chaque hunk, accumule les del/add séparément :
    - Émet d'abord tous les del (comme `DiffRow` avec `baseLine` seul, `reviewLine: null`)
    - Puis tous les add (comme `DiffRow` avec `reviewLine` seul, `baseLine: null`)
  - Context lines : émises une seule fois (via `reviewLine`)
  - Préserve `hiRanges`, `crit`, `isSig` des lignes source
- **Ne pas** appeler dans `buildFileDiffs()` — c'est `App.tsx` qui appelle `buildUnifiedRows` au moment du rendu selon le mode

### 5. Navigation (`src/tui/hooks/useNavigation.ts`)

- Ajouter `onToggleDiffMode?: () => void` dans `NavSetters`
- Dans `handleDiffPanel` : touche `s` → `setters.onToggleDiffMode?.()`
- Le reste inchangé : `diffRows` dans NavContext est déjà le tableau actif (App choisit lequel passer)
- Flags `c`/`x`/`?` : logique existante inchangée (fonctionne sur `curRow.reviewLine` qui existe dans les deux modes)
- `n` (inline comment) : même logique, fonctionne car `reviewLine` est présent sur les lignes add/ctx en unified

### 6. App.tsx (`src/tui/App.tsx`)

- State : `const [diffMode, setDiffMode] = useState<DiffMode>('unified')`
- Computed :
  - `canSideBySide = size.w >= 140`
  - `effectiveMode = diffMode === 'side-by-side' && canSideBySide ? 'side-by-side' : 'unified'`
  - `activeDiffRows = effectiveMode === 'unified' ? unifiedRows : currentDiff?.rows ?? []`
  - `unifiedRows = useMemo(() => currentDiff ? buildUnifiedRows(currentDiff.rows) : [], [currentDiff])`
- `halfDiff` : calculé seulement si effectiveMode === 'side-by-side'
- Clamp `diffCursor` sur `activeDiffRows.length`
- Callback `handleToggleDiffMode` : toggle, reset cursor/scroll à 0
- Wiring navigation : passer `diffRows: activeDiffRows` et `onToggleDiffMode: handleToggleDiffMode`
- Rendu du diff panel : brancher sur `effectiveMode`
  - **Unified** : boucle sur `activeDiffRows`, `DLine` en pleine largeur (`diffW - 6`), flag icon en fin de ligne
  - **Side-by-side** : code existant inchangé
- Label du panel : afficher `(unified)` ou `(sbs)` après le nom de fichier
- `review-stats` : continue à lire `currentDiff.rows` (le tableau original), pas `activeDiffRows`

### 7. StatusBar (`src/tui/components/StatusBar.tsx`)

- Ajouter `s:mode` dans les hints clavier

### 8. Tests (`src/tui/data.test.ts`)

- Tests `buildUnifiedRows` :
  - hunkHeaders préservés
  - context lines non dupliquées (une seule `DiffRow` avec `reviewLine`, pas deux)
  - del avant add dans un hunk (ordre unified)
  - lignes avec `hiRanges` préservées
  - méthode `del` (deleted) : toutes les lignes en baseLine uniquement

---

## Fichiers non impactés

- `context.ts` — lit `ScanResult`, pas les diff rows
- `review-stats.ts` — lit `currentDiff.rows` (le tableau original paired), jamais `activeDiffRows`
- `useReview.ts` — gère le Map, pas de notion de mode diff
- `useReviewProgress.ts` — utilise `diffs` (la Map complète), inchangé
- `Border.tsx`, `TreeRow.tsx`, `ContextPanel.tsx`, `CommentRows.tsx` — aucun lien avec le mode diff
- `src/export/*` — utilise `diffs` et `lineReviews`, pas de notion de mode

---

## Ordre d'exécution

1. `types.ts` — `DiffMode`
2. `colors.ts` — `critBar`, supprimer `critBg`
3. `DLine.tsx` — crit bar visuelle, supprimer backgroundColor
4. `data.ts` — `buildUnifiedRows`
5. `data.test.ts` — tests unified
6. `useNavigation.ts` — `onToggleDiffMode` callback + touche `s` dans diff panel
7. `App.tsx` — state + mode computation + rendu branché + wiring
8. `StatusBar.tsx` — hints

## Vérification

1. `npx tsc -p tsconfig.node.json --noEmit` — compilation
2. `npx vitest run` — tous les tests passent (existants + nouveaux)
3. `npm run dev` — lancer le TUI sur le repo courant
4. Vérifier visuellement :
   - Le diff s'affiche en **unified par défaut** avec pleine largeur
   - La crit bar `░▒▓█` apparait en marge gauche avec les bonnes couleurs
   - Les flags `c`/`x`/`?` fonctionnent sur les lignes add (review)
   - Les lignes del et ctx ne sont pas flaggables (cohérent avec side-by-side)
   - La navigation `{`/`}` saute entre hunks
   - `s` toggle vers side-by-side **uniquement depuis le panel diff** (si terminal >= 140 cols)
   - Sous 140 cols, `s` est no-op (force unified)
   - Le cursor et scroll fonctionnent dans les deux modes
   - Les review stats dans la status bar restent correctes dans les deux modes
5. `npm test` — tous les tests passent
