# Plan : 4 features + réorganisation `interactions/`

## Contexte

4 améliorations UX + réorganisation du code d'interaction :
1. Panel résumé "Universe" quand rien n'est sélectionné
2. Highlight canvas au clic sur une méthode dans le panel droit
3. Sélection d'un edge grise tout sauf la paire concernée
4. Navigation back/forward avec Alt+Gauche/Droite (historique 20 actions)
5. Dossier `interactions/` pour regrouper blast radius, focus history, method highlight

---

## Step 1 : Edge selection isole la paire

**Fichier** : `src/web/hooks/useBlastRadius.ts`

Ajouter un early return après `if (!focus) return EMPTY;` :
```typescript
if (focus.kind === 'edge') {
  return {
    connected: new Set([focus.edge.from, focus.edge.to]),
    l1: new Set<string>(),
    l2: new Set<string>(),
    edgeSet: new Set([`${focus.edge.from}|${focus.edge.to}`]),
  };
}
```

Résultat : seuls les 2 endpoints et l'edge restent visibles, tout le reste à 0.04 opacité.

---

## Step 2 : Navigation history Alt+Left/Right

**Nouveau** : `src/web/hooks/useFocusHistory.ts`
- `stack: (FocusTarget | null)[]` init `[null]`, cap 20
- `cursor: number`, `navigatingRef` pour éviter que back/forward push
- `push(target)` tronque forward + ajoute
- `back()` / `forward()` déplacent le cursor
- `useEffect` keydown : `Alt+ArrowLeft` / `Alt+ArrowRight` (skip inputs/textareas)
- Expose `{ focus, setFocus, back, forward, canGoBack, canGoForward }`

**Fichier** : `src/web/App.tsx`
- Remplacer `useState<FocusTarget | null>(null)` par `useFocusHistory()`
- Passer `canGoBack`, `canGoForward`, `onBack`, `onForward` au Header

**Fichier** : `src/web/ui/Header.tsx`
- Ajouter props `canGoBack`, `canGoForward`, `onBack`, `onForward`
- Boutons ◀ / ▶ conditionnels avec `title="Alt+←"` / `title="Alt+→"`

---

## Step 3 : Panel résumé Universe

**Nouveau** : `src/web/detail/UniverseDetail.tsx`

Contenu affiché quand `focus === null` :
- Header : "UNIVERSE / Review Overview" + "{n} repos · {n} modules · {n} files"
- StatBox grid 3x2 : Files, Changes, Avg Crit, Max Crit, Cross links, Untested
- Barre de progression review (reviewed/total, barre visuelle)
- TOP CRITICAL (5 fichiers, cliquables → navigate)
- GALAXIES list (cliquables, avg crit, files count, branch)

Réutilise : `StatBox`, `hoverBg`, `critPc`, `MONO`/`SANS`.

**Fichier** : `src/web/detail/SidePanel.tsx`
- `focus` passe de `FocusTarget` à `FocusTarget | null`
- Ajouter prop `galaxies: GalaxyData[]`
- Cas `{!focus && <UniverseDetail ... />}`

**Fichier** : `src/web/App.tsx`
- Retirer le conditionnel `{focus && (` autour de SidePanel → toujours rendre
- Passer `galaxies={data.galaxies}`

---

## Step 4 : Method click → highlight canvas

**Nouveau** : `src/web/hooks/useMethodHighlight.ts`
- Input : `highlight: { planetId: string; methodName: string } | null` + `edges: EdgeData[]`
- Parcourt les edges dont `specifiers` contient `methodName` touchant `planetId`
- Retourne `{ highlightedPlanets: Set<string>, highlightedEdges: Set<string> }`

**Fichier** : `src/web/App.tsx`
- State `highlightMethod` + `setHighlightMethod`
- `useMethodHighlight(data.edges, highlightMethod)`
- Wrapper `handleSetFocus` qui clear `highlightMethod` au changement de focus
- Passer `highlightedPlanets` + `highlightedEdges` au Canvas
- Passer `onMethodHighlight` au SidePanel

**Fichier** : `src/web/canvas/Canvas.tsx`
- Props `highlightedPlanets: Set<string>`, `highlightedEdges: Set<string>`
- `isMethodHighlighted={highlightedPlanets.has(planet.id)}` sur Planet
- `highlightedEdges` sur EdgeLayer

**Fichier** : `src/web/canvas/Planet.tsx`
- Prop `isMethodHighlighted: boolean`
- Anneau cyan (`border: 2px solid ${P.cyan}80` + `boxShadow: 0 0 14px ${P.cyan}35`) quand true

**Fichier** : `src/web/canvas/EdgeLayer.tsx`
- Prop `highlightedEdges: Set<string>`
- Calcul `isHighlighted` par edge, forward à Edge

**Fichier** : `src/web/canvas/Edge.tsx`
- Prop `highlighted: boolean`
- Opacité : `highlighted ? 1.0 : visible ? edgeOpacity(edge) : 0`
- Couleur override `P.cyan` quand highlighted

**Fichier** : `src/web/detail/SidePanel.tsx` → forward `onMethodHighlight` à PlanetDetail
**Fichier** : `src/web/detail/PlanetDetail.tsx` → forward `onMethodClick` à MethodRow
**Fichier** : `src/web/detail/MethodRow.tsx`
- Prop `onMethodClick: (name: string) => void`
- Au clic : `onMethodClick(isExpanded ? '' : item.name)` + `onToggle()`

---

## Step 5 : Réorganisation `interactions/`

**Nouveau dossier** : `src/web/interactions/`

Déplacements :
| Depuis | Vers |
|--------|------|
| `hooks/useBlastRadius.ts` | `interactions/useBlastRadius.ts` |
| `hooks/useFocusHistory.ts` | `interactions/useFocusHistory.ts` |
| `hooks/useMethodHighlight.ts` | `interactions/useMethodHighlight.ts` |

Restent dans `hooks/` : `useCamera.ts` (mécanique caméra), `useReview.ts` (persistance)

MAJ imports : `Canvas.tsx`, `App.tsx`

---

## Vérification

1. `npx tsc -p tsconfig.web.json --noEmit` → 0 erreurs
2. `npx vite build` → build OK
3. Tests manuels :
   - Chargement → panel résumé avec stats, progress, top critical, galaxies
   - Clic galaxie → panel change, `Alt+←` revient au résumé, `Alt+→` re-forward
   - Boutons ◀ ▶ dans header
   - Clic edge → seuls 2 endpoints + 1 edge visibles, reste grisé
   - Focus planète → clic méthode → anneaux cyan sur planètes liées, edges cyan
   - Re-clic (collapse) → highlight disparait
