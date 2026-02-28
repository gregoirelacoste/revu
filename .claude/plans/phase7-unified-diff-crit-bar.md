# Phase 7 : Unified Diff + Crit Bar

## Contexte

Le diff side-by-side est inutilisable sur terminal standard : **26 chars par côté sur 120 cols** (14 chars de code utile après gutter). Le progressive contrast `critBg()` est cassé : plage hex de 10% (#1e→#37), imperceptible sur la plupart des terminaux.

**Objectif** : unified diff par défaut + crit bar en marge gauche. Deux changements urgents, cohérents avec la philosophie "review without reading".

---

## Changements

### 1. Types (`src/tui/types.ts`)

- Ajouter `DiffMode = 'unified' | 'side-by-side'`
- Ajouter `UnifiedRow` :
  ```typescript
  interface UnifiedRow {
    type: 'hunkHeader' | 'diffLine';
    method: string;
    methodCrit: number;
    label: string;
    line?: TuiDiffLine;
    side?: 'base' | 'review';
  }
  ```
- Ajouter `unifiedRows: UnifiedRow[]` à `TuiFileDiff`

### 2. Colors (`src/tui/colors.ts`)

- **Supprimer** `critBg()`
- **Ajouter** `critBar()` :
  ```
  crit >= 7   → █ rouge
  crit >= 4.5 → ▓ orange
  crit >= 2.5 → ▒ bleu
  crit >= 0.5 → ░ vert
  sinon       → espace
  ```

### 3. DLine (`src/tui/components/DLine.tsx`)

- Remplacer import `critBg` → `critBar`
- Supprimer `backgroundColor` de tous les `<Text>`
- Ajouter `<Text color={bar.color}>{bar.char}</Text>` en premier dans le rendu
- Ajuster `maxCodeLen` : `width - 13` (1 char de plus pour la barre)

### 4. Data (`src/tui/data.ts`)

- Ajouter `buildUnifiedFromPaired(pairedRows: DiffRow[]): UnifiedRow[]`
  - Parcourt les DiffRow existants
  - Context lines : émises une seule fois (depuis reviewLine)
  - Del lines accumulées puis add lines (ordre unified standard)
  - `side: 'base'` pour les del, `side: 'review'` pour les add/ctx
  - Préserve `hiRanges` des lignes déjà calculées
- Appeler dans `buildFileDiffs()` après construction des `rows`

### 5. Navigation (`src/tui/hooks/useNavigation.ts`)

- Ajouter `diffMode` au state, `setDiffMode` aux setters
- Ajouter `unifiedRows`, `canSideBySide` au context
- Touche `s` (global) : toggle unified/side-by-side + reset cursor à 0
- Cursor max : basé sur `unifiedRows.length` ou `diffRows.length` selon le mode
- Hunk nav `{`/`}` : fonctionne sur le tableau actif (les deux ont `type: 'hunkHeader'`)
- Flag `c`/`x`/`?` : brancher selon le mode
  - Unified : check `side === 'review'` + `line.n` pour le lineKey
  - Side-by-side : logique existante inchangée

### 6. App.tsx (`src/tui/App.tsx`)

- State : `const [diffMode, setDiffMode] = useState<DiffMode>('unified')`
- Computed : `canSideBySide = size.w >= 160`, `effectiveMode`
- `halfDiff` : calculé seulement si side-by-side
- Clamp `diffCursor` sur le tableau actif (`unifiedRows` ou `rows`)
- Rendu du diff panel : brancher sur `effectiveMode`
  - Unified : boucle sur `unifiedRows`, DLine en pleine largeur (`diffW - 6`)
  - Side-by-side : code existant inchangé
- Label du panel : afficher le mode (`unified` / `sbs`)
- Wiring navigation : passer `unifiedRows`, `canSideBySide`, `diffMode`, `setDiffMode`

### 7. StatusBar (`src/tui/components/StatusBar.tsx`)

- Ajouter `s:mode` dans les hints clavier

### 8. Tests (`src/tui/data.test.ts`)

- Tests `buildUnifiedFromPaired` :
  - hunkHeaders présents
  - context lines non dupliquées
  - del avant add dans un hunk
  - `side` correctement assigné
  - `hiRanges` préservés

---

## Fichiers non impactés

`context.ts`, `review-stats.ts`, `useReview.ts`, `Border.tsx`, `TreeRow.tsx`, `ContextPanel.tsx` — tous lisent depuis `rows` (inchangé).

---

## Ordre d'exécution

1. `types.ts` — nouveaux types
2. `colors.ts` — critBar, supprimer critBg
3. `DLine.tsx` — crit bar visuelle
4. `data.ts` — buildUnifiedFromPaired
5. `data.test.ts` — tests unified
6. `useNavigation.ts` — mode toggle + branches
7. `App.tsx` — state + rendu + wiring
8. `StatusBar.tsx` — hints

## Vérification

1. `npx tsc -p tsconfig.node.json --noEmit` — compilation
2. `npm run dev` — lancer le TUI sur le repo courant
3. Vérifier visuellement :
   - Le diff s'affiche en unified avec pleine largeur
   - La crit bar `░▒▓█` apparait en marge gauche avec les bonnes couleurs
   - Les flags `c`/`x`/`?` fonctionnent sur les lignes review
   - La navigation `{`/`}` saute entre hunks
   - `s` toggle vers side-by-side (si terminal >= 160 cols)
   - Le cursor et scroll fonctionnent dans les deux modes
4. `npm test` — tests data.test.ts passent
