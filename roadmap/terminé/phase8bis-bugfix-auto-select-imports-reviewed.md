# Phase 8bis — Bugfix Explorer + Auto-select + IMPORTS panel + Review Visibility

## Contexte

Retours utilisateur post-phase 8. Quatre sujets distincts : un bug d'affichage, un irritant UX majeur, et deux features complémentaires qui transforment le context panel en outil de navigation cross-file.

---

## 1. Bug : la ligne sous le curseur disparait dans l'Explorer

### Symptome

Dans le panel Explorer (gauche), la ligne immédiatement sous le curseur (le `▶`) disparait visuellement. Le curseur semble "manger" la ligne suivante.

### Diagnostic probable

Le rendu de l'Explorer utilise `visibleTree` découpé par `treeScroll` et `treeVisibleH`. Le calcul de `treeVisibleH` dans App.tsx :

```typescript
const treeVisibleH = Math.max(1, bodyH - 4);
```

Le `- 4` est trop agressif. Il réserve 4 lignes (border top, border bottom, label, position counter), mais le compteur de position (`{safeIdx + 1}/{flatTree.length}`) n'est affiché que conditionnellement quand `flatTree.length > treeVisibleH`. Le composant `<Border>` consomme 2 lignes (top + bottom). Le label est dans le border top. Donc on réserve 1 ligne de trop.

De plus, `<Box flexDirection="column" overflow="hidden">` dans le Border tronque silencieusement les lignes qui dépassent. Si `treeVisibleH` est trop grand d'1 unité, la dernière ligne visible se retrouve "sous" le border bottom et est clippée — ce qui donne l'impression que la ligne sous le curseur disparait (elle est en fait la dernière du slice, cachée par overflow).

### Avocat du diable

> "C'est peut-etre un bug Ink, pas notre code. Ink 5 a des problemes connus avec overflow."

Possible, mais le fait que ce soit spécifiquement la ligne sous le curseur (et pas une ligne random en bas) pointe vers notre calcul de scroll/visible. Si c'était un bug Ink, la ligne coupée serait toujours la derniere, independamment du curseur. Or le scroll centre le curseur, donc la "derniere ligne visible" est toujours ~1 ligne sous le curseur.

> "Et si le compteur de position `1/42` prend 1 ligne de trop ?"

Exact. Quand il y a plus de fichiers que `treeVisibleH`, le compteur s'affiche et prend 1 ligne. Mais `treeVisibleH` ne tient pas compte de cette ligne conditionnelle. Resultat : on affiche `treeVisibleH` lignes d'arbre + 1 ligne de compteur, le tout dans un espace de `treeVisibleH` lignes effectivement disponibles. La derniere ligne d'arbre est poussee hors zone.

### Correction

**Fichier** : `src/tui/App.tsx`

1. Calculer `treeVisibleH` en tenant compte du compteur :

```typescript
const hasScrollIndicator = flatTree.length > (bodyH - 3);
const treeVisibleH = Math.max(1, bodyH - 3 - (hasScrollIndicator ? 1 : 0));
```

Le `- 3` correspond a : 2 (border top/bottom du composant Border) + 1 (marge de securite pour le rendu Ink). Le `- 1` additionnel si le scroll indicator est affiche.

2. Verifier que le slice `visibleTree` ne depasse pas l'espace reel :

```typescript
const visibleTree = flatTree.slice(treeScroll, treeScroll + treeVisibleH);
```

Pas de changement ici, le slice est deja correct si `treeVisibleH` est correct.

### Verification

- Naviguer dans l'explorer avec 20+ fichiers. La ligne sous le curseur doit toujours etre visible.
- Tester avec un arbre court (< treeVisibleH) : pas de compteur, toutes les lignes visibles.
- Tester avec un arbre long : compteur present, la derniere ligne d'arbre visible ne doit pas etre tronquee.

---

## 2. Auto-select : afficher le diff et le contexte sans Tab

### Probleme

Quand on navigue dans l'Explorer avec les fleches, le panel Diff (centre) et le panel Context (droite) ne changent pas tant qu'on n'appuie pas Enter ou qu'on ne Tab vers le diff. Le workflow actuel force : naviguer vers un fichier → Enter → Tab pour review.

Le brief dit : le fichier selectionne doit se mettre a jour quand le curseur bouge dans l'explorer. Le diff et le contexte suivent.

### Avocat du diable

> "Si on auto-select a chaque deplacement, on perd la notion de 'fichier en cours de review'. L'utilisateur scroll dans l'explorer pour chercher un fichier, et pendant ce temps le diff change a chaque ligne — c'est distrayant et ca ralentit le rendu."

Vrai. Mais c'est exactement le comportement de VS Code : le fichier dans l'explorateur preview automatiquement, et si on veut "fixer" un fichier on double-click. On adopte le meme pattern :
- **Navigation dans l'Explorer** (fleches) = preview du fichier sous le curseur (diff + context se mettent a jour)
- **Enter** = fixer le fichier + focus le diff panel
- Le fichier "fixe" est celui avec le souligne/bold dans l'arbre (`isSelected`)

> "Et la performance ? Si on change le diff a chaque keystroke, on recalcule les unified rows a chaque fleche."

Les unified rows sont deja memoises avec `useMemo` sur `currentDiff`. Le seul cout est le lookup dans la `Map<string, TuiFileDiff>` — O(1). Le `useMemo` de `ctx` est deja recalcule a chaque changement de `safeIdx`, donc pas de regression.

> "Mais du coup `selectedFile` n'est plus le fichier 'fixe', c'est le fichier sous le curseur. On perd la distinction."

Non. On garde `selectedFile` tel quel. On ajoute un `previewFile` derive de `treeIdx` :

```
previewFile = flatTree[treeIdx] est un fichier avec diff → son id
             sinon → null
```

Le diff affiche `previewFile ?? selectedFile`. Le context suit la meme logique. Enter fixe `selectedFile = previewFile`.

### Implementation

**Fichier** : `src/tui/App.tsx`

1. Ajouter un `previewFile` derive :

```typescript
const previewFile = useMemo(() => {
  if (panel !== 0) return null; // preview uniquement quand l'explorer a le focus
  const item = flatTree[safeIdx];
  if (item && !item.isFolder && item.node.id && diffs.has(item.node.id)) return item.node.id;
  return null;
}, [panel, safeIdx, flatTree, diffs]);

const activeFile = previewFile ?? selectedFile;
```

2. Utiliser `activeFile` au lieu de `selectedFile` pour le diff et le contexte :

```typescript
const currentDiff = activeFile ? diffs.get(activeFile) ?? null : null;
```

3. Le `ctx` utilise deja `flatTree[safeIdx]` quand on est dans le panel 0, donc pas de changement.

4. **Enter** dans l'explorer reste inchange : il fixe `selectedFile` et Tab vers le diff.

5. Quand on quitte l'explorer (Tab), `previewFile` devient `null` et on retombe sur `selectedFile`.

### Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `src/tui/App.tsx` | `previewFile` memo, `activeFile`, `currentDiff` utilise `activeFile` |

---

## 3. Panel Context : IMPORTS — services et dependances du fichier courant

### Probleme actuel

Le context panel affiche :
- **CHANGES** : les hunks du fichier (methodes modifiees)
- **USED BY** : qui utilise ce fichier
- **SIDE-EFFECTS** : quels fichiers impactes

Ce qui **manque** : les **imports et injections** du fichier courant. Quand je review `case.controller.ts`, je veux voir qu'il injecte `CaseService`, `AuthGuard`, `ValidationPipe` et pouvoir naviguer vers ces fichiers. C'est l'axe "qu'est-ce que ce fichier consomme" (vs "qui consomme ce fichier" = USED BY).

### Avocat du diable

> "Les imports sont deja visibles dans le diff ! Pourquoi les dupliquer dans le context panel ?"

Parce que le diff montre les imports **modifies**. Les imports stables (qui n'ont pas change) sont absents du diff. Or, pour comprendre un fichier, je dois savoir quels services il utilise, meme s'ils n'ont pas change. C'est justement le coeur de "review without reading" : montrer le contexte sans devoir lire le code.

> "Ca va surcharger le context panel. Deja on a CHANGES + USED BY + SIDE-EFFECTS."

On ajoute une section **IMPORTS** entre CHANGES et USED BY. On ne montre que les imports qui resolvent vers un fichier du scan (pas `lodash`, pas `@nestjs/common`). Ca sera typiquement 2-6 items, pas 50. Et chaque item est navigable : Enter pour aller au fichier.

> "Comment on sait quels imports 'resolvent vers un fichier du scan' ?"

La pipeline `link-detector` a deja cette info. `result.links` contient tous les liens `fromFile → toFile` avec le type (`import`, `inject`). On filtre les liens sortants du fichier courant.

### Design

Nouvelle section dans `ContextData` :

```typescript
export interface ImportEntry {
  name: string;        // specifier name (ex: "CaseService")
  sourceFile: string;  // display name (ex: "case.service.ts")
  type: 'import' | 'inject';
  fileId?: string;     // navigable if set
}
```

```typescript
export interface ContextData {
  // ... existants
  imports?: ImportEntry[];
}
```

### Implementation

**Fichier** : `src/tui/types.ts`

Ajouter `ImportEntry` et l'ajouter a `ContextData`.

**Fichier** : `src/tui/context.ts` — `getFileContext()`

Enrichir le contexte avec les imports sortants :

```typescript
// Outgoing links: what does this file import/inject?
const filePath = diff.path;
const outLinks = result.links.filter(l => l.fromFile === filePath);
const imports: ImportEntry[] = [];

for (const link of outLinks) {
  const targetName = link.toFile.split('/').pop() ?? link.toFile;
  // Resolve fileId from pathToId (need to build or pass)
  const targetFileId = findFileIdByPath(link.toFile, result);
  for (const spec of link.specifiers ?? [link.label]) {
    imports.push({
      name: spec,
      sourceFile: targetName,
      type: link.type === 'inject' ? 'inject' : 'import',
      fileId: targetFileId,
    });
  }
}
```

Helper `findFileIdByPath` :

```typescript
function findFileIdByPath(path: string, result: ScanResult): string | undefined {
  for (const repo of result.repos) {
    for (const file of repo.files) {
      if (file.path === path) return file.id;
    }
  }
  return undefined;
}
```

**Fichier** : `src/tui/components/ContextPanel.tsx`

Ajouter une section IMPORTS entre CHANGES et USED BY :

```
──────────────
 IMPORTS (3)
  S CaseService        → case.service.ts  ✓
  G AuthGuard          → auth.guard.ts
  D CreateCaseDto      → create-case.dto.ts  ◐
──────────────
```

Chaque item :
- Prefixe avec l'icone du type de fichier cible (S=service, G=guard, D=dto...)
- Nom du specifier
- `→` nom du fichier source
- **Indicateur de review** : `✓` (complete), `◐` (partial), rien (pas review)
- Couleur : navigable (cyan si fileId + diff present), dim sinon
- Focusable quand le panel Context est actif

**Fichier** : `src/tui/hooks/useNavigation.ts` — `handleContextPanel()`

Etendre le range de `ctxIdx` pour couvrir chunks + imports + usedBy :

```
totalItems = filtered.length + navImports.length + navUsedBy.length
```

Navigation avec Enter sur un import → meme logique que USED BY : navigate vers le fileId.

### Order de navigation dans le context panel

```
CHANGES    (ctxIdx 0..N-1)         — hunks du fichier courant
IMPORTS    (ctxIdx N..N+M-1)       — dependances sortantes
USED BY    (ctxIdx N+M..N+M+P-1)   — dependances entrantes
```

### Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `src/tui/types.ts` | `ImportEntry`, `ContextData.imports` |
| `src/tui/context.ts` | `getFileContext()` enrichi avec imports, `findFileIdByPath()` |
| `src/tui/components/ContextPanel.tsx` | Section IMPORTS, focus, navigation |
| `src/tui/hooks/useNavigation.ts` | `handleContextPanel()` — range etendu pour imports |

---

## 4. Indicateur visuel "deja review" dans le context panel

### Probleme

Quand je vois `CaseService` dans IMPORTS ou `auth.guard.ts` dans USED BY, je n'ai aucun moyen de savoir si j'ai deja review ce fichier. Je dois naviguer vers lui pour verifier, puis revenir. Ca casse le flow.

### Pourquoi c'est central

C'est le coeur de REVU : **review without reading**. Le scoring me dit *quoi* regarder. Les liens me disent *ou* regarder. Mais l'indicateur de review me dit *est-ce que c'est deja fait*. Sans ca, je navigue en aveugle et je review potentiellement deux fois le meme fichier. Pire : quand je vois dans le context panel qu'un fichier reference `CaseService`, je veux savoir immediatement si je l'ai deja review. Si oui, je peux passer. Si non, je sais que je dois y aller.

### Avocat du diable

> "On a deja les indicateurs ✓ et ◐ dans l'Explorer. Ca suffit non ?"

Non, parce que l'Explorer montre l'arbre de fichiers. Quand je suis dans le diff panel en train de reviewer une methode, le context panel me montre les dependances. Je ne vois pas l'Explorer (surtout en layout panel=1 ou l'explorer est reduit a 15%). L'info de review doit etre la ou mon regard est : dans le context panel.

> "Ca va etre redondant avec les indicateurs de l'explorer."

Pas redondant : complementaire. L'explorer donne la vue macro ("quels fichiers j'ai review"). Le context panel donne la vue contextuelle ("les fichiers lies a ce que je review en ce moment sont-ils deja couverts").

> "Comment on determine le statut de review ? Un fichier est 'reviewed' si toutes ses lignes sont flaggees ?"

On reutilise `fileProgress` (`useReviewProgress`) qui calcule deja `'none' | 'partial' | 'complete'` pour chaque fileId. On passe cette map au ContextPanel.

### Implementation

**Fichier** : `src/tui/components/ContextPanel.tsx`

Ajouter `fileProgress: Map<string, 'none' | 'partial' | 'complete'>` aux props.

Pour chaque item navigable (IMPORTS, USED BY, CHANGES avec fileId) :

```typescript
const progress = entry.fileId ? fileProgress.get(entry.fileId) : undefined;
const progressIcon = progress === 'complete' ? ' \u2713' : progress === 'partial' ? ' \u25D0' : '';
const progressColor = progress === 'complete' ? C.green : progress === 'partial' ? C.orange : C.dim;
```

Affichage :

```
  S CaseService    case.service.ts ✓    ← vert, fichier reviewed
  G AuthGuard      auth.guard.ts  ◐    ← orange, partiellement reviewed
  D CreateCaseDto  create-case.dto.ts   ← pas d'icone, pas reviewed
```

Les fichiers completement reviewed sont en `dimColor` pour indiquer "deja traite" — meme pattern que l'Explorer.

**Fichier** : `src/tui/App.tsx`

Passer `fileProgress` en prop au `ContextPanel` :

```typescript
<ContextPanel
  ctx={ctx} ctxIdx={ctxIdx} isActive={panel === 2}
  width={ctxW} minCrit={minCrit} diffs={diffs}
  fileProgress={fileProgress}    // NEW
/>
```

### Fichiers impactes

| Fichier | Changement |
|---------|-----------|
| `src/tui/components/ContextPanel.tsx` | Prop `fileProgress`, indicateurs sur IMPORTS/USED BY/CHANGES |
| `src/tui/App.tsx` | Passer `fileProgress` au ContextPanel |

---

## Recapitulatif des fichiers impactes

| Fichier | Changements |
|---------|-----------|
| `src/tui/App.tsx` | Fix treeVisibleH, `previewFile` memo, `activeFile`, props ContextPanel (`fileProgress`) |
| `src/tui/types.ts` | `ImportEntry`, `ContextData.imports` |
| `src/tui/context.ts` | `getFileContext()` enrichi (imports), `findFileIdByPath()` |
| `src/tui/components/ContextPanel.tsx` | Section IMPORTS, indicateurs review (✓/◐), focus etendu, props `fileProgress` |
| `src/tui/hooks/useNavigation.ts` | `handleContextPanel()` — range chunks+imports+usedBy |

---

## Ordre d'implementation

1. **Bugfix Explorer** (App.tsx) — correctif `treeVisibleH`, zero risque de regression
2. **Auto-select / preview** (App.tsx) — `previewFile` derive, `activeFile`
3. **ImportEntry type + context enrichi** (types.ts, context.ts) — fondation pour le rendering
4. **Section IMPORTS dans ContextPanel** (ContextPanel.tsx) — rendu + focus
5. **Navigation IMPORTS/USED BY etendue** (useNavigation.ts) — range `ctxIdx` etendu
6. **Indicateurs review** (ContextPanel.tsx, App.tsx) — `fileProgress` en prop, icones ✓/◐

Les etapes 3-5 forment un bloc coherent. L'etape 6 est un ajout visuel pur, sans impact sur la navigation.

---

## Verification

1. `npx tsc -p tsconfig.node.json --noEmit`
2. `npm run dev` — tests visuels :
   - **Bug explorer** : naviguer dans un arbre de 20+ fichiers, verifier que la ligne sous le curseur est toujours visible
   - **Auto-select** : fleches dans l'explorer → le diff et le contexte changent en temps reel. Enter → focus diff. Tab retour explorer → le preview reprend
   - **IMPORTS** : selectionner un `.controller.ts` ou `.service.ts` → la section IMPORTS montre les services/guards/dtos importes
   - **Navigation IMPORTS** : Tab vers Context, ↓ jusqu'aux IMPORTS, Enter → navigue vers le fichier importe
   - **Review indicators** : flagger quelques lignes d'un fichier → ◐ apparait a cote de ce fichier dans IMPORTS/USED BY d'un autre fichier. Flagger toutes les lignes → ✓ apparait. Le fichier passe en dim
3. Verifier que les imports vers des fichiers hors scan (node_modules, etc.) ne sont pas affiches
4. Verifier que le mode 4 (line context, phase 8) continue de fonctionner : quand le curseur est sur une ligne qui reference un specifier, le context panel bascule en mode ligne
