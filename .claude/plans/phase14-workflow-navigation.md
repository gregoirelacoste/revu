# Phase 14 — Workflow & Navigation rapide

## Objectif

Reduire le nombre de keystrokes pour les actions de review les plus frequentes. Chaque raccourci gagne quelques secondes, mais multiplies par des centaines de fichiers par session, ca s'additionne vite. L'objectif est que le reviewer reste en flow sans friction.

---

## Step 1 — `Escape` dans le diff = retour Explorer

**Probleme** : Depuis le diff panel, revenir a l'Explorer necessite Tab+Tab (passer par Context) ou Shift+Tab. Le reflexe naturel "Escape = retour a la liste" n'est pas implemente.

**Condition** : Uniquement quand `inputMode === null` (pas pendant une saisie de commentaire ou de recherche).

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/hooks/useNavigation.ts` | Dans `handleDiffPanel()`, ajouter : si `key.escape && inputMode === null` → `setPanel(0)` |

**Effort** : 5 min

---

## Step 2 — `N` (majuscule) dans le diff = flag ok + next unreviewed

**Probleme** : Le workflow "j'ai lu ce fichier, c'est ok, suivant" depuis le diff panel prend 3 keystrokes avec changement de panel : Tab → `n` → Enter.

**Comportement** :
1. Batch-flag toutes les lignes du fichier courant comme `ok` (meme logique que `c` au niveau fichier)
2. Chercher le prochain fichier non-reviewed dans `flatTree`
3. Le selectionner et ouvrir son diff
4. Rester dans le diff panel (panel 1)

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/hooks/useNavigation.ts` | Dans `handleDiffPanel()`, ajouter le cas `input === 'N'` (shift) : appeler `getAllFileLines()` du fichier courant, batch-flag ok, puis logique de `findNextUnreviewed()` + selection |

**Effort** : 30 min

---

## Step 3 — `N` (majuscule) dans un hunk = sauter au prochain hunk non-review

**Probleme** : `}` saute au prochain hunk header, meme si ce hunk est deja entierement review. Le reviewer re-scanne visuellement des hunks deja valides.

**Donnees existantes** : La logique `chunkProgress()` dans `ContextPanel.tsx` sait deja si un hunk est completement review. Il faut la rendre accessible dans `useNavigation.ts`.

**Comportement** :
1. Depuis n'importe quelle ligne du diff, trouver le prochain hunk header dont les lignes ne sont pas toutes flaggees
2. Y deplacer le curseur
3. Si tous les hunks restants sont review → ne rien faire (ou flash un message)

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/hooks/useNavigation.ts` | Extraire la logique de detection "hunk non-review" (iterer les diffRows entre deux headers, verifier les lineReviews). Dans `handleDiffPanel()`, `}` reste "next hunk", ajouter un nouveau raccourci pour "next unreviewed hunk" |

**Note** : Le `N` majuscule du Step 2 est au niveau fichier (flag + next file). Pour eviter la collision, utiliser `}` pour next hunk et garder `N` pour le file-level. Alternative : `Shift+}` ou `]` pour next unreviewed hunk.

**Effort** : 30 min

---

## Step 4 — `Enter` sur une ligne import = jump au fichier

**Probleme** : Si le curseur est sur une ligne `import { ... } from './auth.service'`, le reviewer doit passer par le Context panel pour naviguer vers ce fichier. C'est 4+ keystrokes.

**Comportement** :
1. Detecter que la ligne courante commence par `import` (regex simple sur `diffRow.c`)
2. Extraire le path d'import
3. Chercher le fichier correspondant dans `diffs`
4. Si trouve : push dans l'historique, selectionner ce fichier, ouvrir son diff
5. Si pas trouve (fichier non modifie) : ne rien faire ou flash "not in diff"

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/hooks/useNavigation.ts` | Dans `handleDiffPanel()`, au cas `key.return` : verifier si la ligne courante est un import. Si oui, resoudre le path, chercher dans `flatTree`, naviguer. Sinon, comportement actuel. |

**Effort** : 30 min

---

## Step 5 — Historique avec scroll exact

**Probleme** : Alt+← restaure le fichier et le curseur, mais le scroll est estime (`cursor - bodyH/2`). Si le reviewer avait scrolle independamment du curseur, la position est fausse.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/hooks/useNavHistory.ts` | Ajouter `scroll: number` a `NavPos`. Mettre a jour `push()` pour accepter et stocker le scroll. |
| `src/tui/hooks/useNavigation.ts` | Passer `diffScroll` a `historyPush()` dans `handleTreePanel` et `handleContextPanel`. Restaurer `setDiffScroll(() => prev.scroll)` au lieu de l'estimation. |

**Effort** : 15 min

---

## Step 6 — Navigation rapide dans le Review Map

**Probleme** : La navigation dans le Review Map overlay est lineaire (up/down un par un). Avec 30+ fichiers, atteindre le fichier #20 prend 19 keystrokes.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/hooks/useNavigation.ts` | Dans `handleMapOverlay()`, ajouter : `g` → premier, `G` → dernier, PageUp/PageDown → ±5 items, digits `1-9` → jump a 10%-90% de la liste |

**Effort** : 15 min

---

## Step 7 — Afficher le compteur de methodes formatting-only filtrees

Ce step est partage avec Phase 13 Step 8. Si Phase 13 est implementee avant, ce step est deja fait.

Sinon : dans le diff panel, quand un fichier a des methodes `unch` filtrees, afficher un indicateur en haut du diff : `+3 methods formatting-only (hidden)`.

**Effort** : 15 min (si pas deja fait en Phase 13)

---

## Ordre d'implementation

| Step | Quoi | Effort | Impact |
|---|---|---|---|
| 1 | Escape = retour Explorer | 5 min | Moyen — reflexe naturel |
| 2 | N = flag ok + next file (diff panel) | 30 min | Haut — accelere le flow principal |
| 3 | Next unreviewed hunk | 30 min | Haut — evite re-scan de hunks valides |
| 4 | Enter sur import = jump fichier | 30 min | Haut — navigation directe |
| 5 | Scroll exact dans historique | 15 min | Moyen — precision du retour |
| 6 | Nav rapide Review Map | 15 min | Bas — usage moins frequent |

**Total** : ~2h05

---

## Fichiers touches

| Fichier | Steps |
|---|---|
| `src/tui/hooks/useNavigation.ts` | 1, 2, 3, 4, 5, 6 |
| `src/tui/hooks/useNavHistory.ts` | 5 |
| `src/tui/components/HelpOverlay.tsx` | 1, 2, 3, 4 (documenter les nouveaux raccourcis) |
| `src/tui/components/TutorialOverlay.tsx` | 2 (mentionner le workflow rapide) |

---

## Nouveaux raccourcis (resume)

| Touche | Panel | Action |
|---|---|---|
| `Escape` | Diff | Retour Explorer (si pas en mode saisie) |
| `N` | Diff | Flag ok tout le fichier + next unreviewed |
| `]` ou `Shift+}` | Diff | Sauter au prochain hunk non-review |
| `Enter` (sur import) | Diff | Jump au fichier importe |
| `g` / `G` | Map | Premier / dernier fichier |
| `PageUp` / `PageDown` | Map | ±5 fichiers |
