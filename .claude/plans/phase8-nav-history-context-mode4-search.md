# Phase 8 — Navigation History + Context Mode 4 + USED BY Navigation + Fuzzy Search

## Contexte

Après les phases 1-7bis (pipeline, scoring, TUI 3-panels, review flags, unified diff, responsive sizing), il reste des features clés du brief non implémentées. Cette phase couvre les 3 features à plus haute valeur + un bonus.

### Ce qui manque (brief sections 2-4)

| Feature | Brief | Complexité | Valeur |
|---------|-------|------------|--------|
| **Context Mode 4 : ligne** | §3.3 | Haute | Haute — coeur de "review without reading" |
| **Navigation history (Alt+←/→)** | §4 | Moyenne | Haute — indispensable pour naviguer entre fichiers |
| **Fuzzy file search (/)** | §4 | Moyenne | Moyenne — accélère la navigation sur gros repos |
| USED BY file selection | §3.2 | Faible | Moyenne — compléter l'interactivité du context panel |
| Alt+S (jump to summary) | §4 | Faible | Faible — déjà accessible en naviguant au repo node |
| Alt+B (branch selector) | §2 | Haute | Faible — rarement utilisé, git checkout suffit |
| Alt+C (crit prompt) | §4 | Faible | Faible — [/] couvre le besoin |

---

## 1. USED BY Navigation (depuis le context panel)

**Problème** : les items USED BY dans le context panel sont affichés mais pas interactifs. On ne peut pas naviguer vers le fichier qui "use" le fichier courant.

### 1a. Ajouter `fileId` à `UsedByEntry`

**Fichier** : `src/tui/types.ts`

```typescript
export interface UsedByEntry {
  file: string;
  method: string;
  what: string;
  fileId?: string;  // NEW — set if the source file exists in the scan
}
```

**Fichier** : `src/tui/data.ts` — `buildUsedByMap()`

Construire un `pathToId: Map<string, string>` à partir de `result.repos`, puis enrichir chaque `UsedByEntry` :

```typescript
function buildUsedByMap(result: ScanResult): Map<string, UsedByEntry[]> {
  const pathToId = new Map<string, string>();
  for (const repo of result.repos) {
    for (const file of repo.files) pathToId.set(file.path, file.id);
  }

  const map = new Map<string, UsedByEntry[]>();
  for (const link of result.links) {
    const entries = map.get(link.toFile) ?? [];
    entries.push({
      file: link.fromFile.split('/').pop() ?? link.fromFile,
      method: link.methodName ?? link.label,
      what: `${link.type}: ${link.label}`,
      fileId: pathToId.get(link.fromFile),  // resolve path → fileId
    });
    map.set(link.toFile, entries);
  }
  // ... existing dedup logic unchanged
  return map;
}
```

### 1b. Étendre `ctxIdx` pour couvrir les usedBy items

**Fichier** : `src/tui/hooks/useNavigation.ts` — `handleContextPanel()`

Actuellement `ctxIdx` navigue seulement dans `filtered` (chunks avec crit >= minCrit). Étendre le range pour inclure les usedBy :

```typescript
function handleContextPanel(...) {
  const filtered = ctx.chunks.filter(c => c.crit >= minCrit);
  const usedBy = ctx.usedBy?.filter(u => u.fileId && diffs.has(u.fileId)) ?? [];
  const totalItems = filtered.length + usedBy.length;

  if (key.upArrow) { setCtxIdx(i => Math.max(0, i - 1)); return true; }
  if (key.downArrow) { setCtxIdx(i => Math.min(totalItems - 1, i + 1)); return true; }

  if (key.return) {
    if (ctxIdx < filtered.length && filtered[ctxIdx]) {
      // Existing chunk navigation (unchanged)
      ...
    } else {
      // USED BY navigation
      const ubIdx = ctxIdx - filtered.length;
      const ub = usedBy[ubIdx];
      if (ub?.fileId && diffs.has(ub.fileId)) {
        setSelectedFile(ub.fileId);
        setDiffCursor(() => 0);
        setDiffScroll(() => 0);
        setPanel(() => 1);
      }
    }
  }
}
```

### 1c. Rendre les USED BY items focusables dans le ContextPanel

**Fichier** : `src/tui/components/ContextPanel.tsx`

Passer `ctxIdx` et `chunksCount` (nombre de chunks filtrés) pour savoir si un usedBy item est focused. Ajouter `diffs` en prop pour filtrer les items navigables.

```typescript
// Dans le rendu USED BY :
{ctx.usedBy?.map((u, i) => {
  const navIdx = filtered.length + i;  // index dans la liste combinée
  const isFoc = isActive && navIdx === ctxIdx;
  const hasLink = u.fileId && diffs.has(u.fileId);
  return (
    <Box key={i}>
      <Text color={isFoc ? C.accent : ' '}>{isFoc ? '▶' : ' '}</Text>
      <Text color={hasLink ? C.cyan : C.dim}>{u.file}</Text>
    </Box>
  );
})}
```

Ajouter `diffs: Map<string, TuiFileDiff>` et `filteredCount: number` aux props du ContextPanel.

---

## 2. Navigation History (Alt+← / Alt+→)

**Problème** : quand on navigue entre fichiers (Enter dans l'explorer, Enter sur un chunk du context), il n'y a pas moyen de revenir au fichier précédent.

### 2a. Hook `useNavHistory`

**Nouveau fichier** : `src/tui/hooks/useNavHistory.ts` (~35 lignes)

```typescript
import { useState, useCallback } from 'react';

interface NavPos { fileId: string; cursor: number; }

export function useNavHistory() {
  const [back, setBack] = useState<NavPos[]>([]);
  const [fwd, setFwd] = useState<NavPos[]>([]);

  const push = useCallback((pos: NavPos) => {
    setBack(s => [...s, pos]);
    setFwd([]);
  }, []);

  const goBack = useCallback((current: NavPos): NavPos | null => {
    if (back.length === 0) return null;
    const prev = back[back.length - 1];
    setBack(s => s.slice(0, -1));
    setFwd(s => [...s, current]);
    return prev;
  }, [back]);

  const goForward = useCallback((current: NavPos): NavPos | null => {
    if (fwd.length === 0) return null;
    const next = fwd[fwd.length - 1];
    setFwd(s => s.slice(0, -1));
    setBack(s => [...s, current]);
    return next;
  }, [fwd]);

  return { push, goBack, goForward, canGoBack: back.length > 0, canGoForward: fwd.length > 0 };
}
```

### 2b. Intégration dans App.tsx

- Instancier `useNavHistory()`
- Passer `history.push` et `history.goBack`/`history.goForward` à `useNavigation` via `NavSetters`

### 2c. Intégration dans useNavigation

**Fichier** : `src/tui/hooks/useNavigation.ts`

1. **Push sur chaque changement de fichier** : dans `handleTreePanel` (Enter/→ sur file), `handleContextPanel` (Enter sur chunk/usedBy), ajouter un `push({ fileId: state.selectedFile, cursor: state.diffCursor })` **avant** de changer le fichier.

2. **Alt+← / Alt+→** : dans le handler global (après Tab, avant panel dispatch) :

```typescript
if (key.meta && key.leftArrow) {
  const current = { fileId: state.selectedFile!, cursor: state.diffCursor };
  const prev = setters.goBack(current);
  if (prev) {
    setters.setSelectedFile(prev.fileId);
    setters.setDiffCursor(() => prev.cursor);
    setters.setDiffScroll(() => Math.max(0, prev.cursor - Math.floor(context.bodyH / 2)));
  }
  return;
}
// Idem pour Alt+→ avec goForward
```

### 2d. Indicateur dans la StatusBar

**Fichier** : `src/tui/components/StatusBar.tsx`

Ajouter un petit indicateur `◀ ▶` quand l'historique est disponible. Passer `canGoBack`/`canGoForward` en props.

---

## 3. Context Mode 4 : focus ligne dans le diff

**Problème** : le context panel montre toujours le contexte du fichier sélectionné, quelle que soit la ligne courante dans le diff. Quand on review du code, le contexte le plus utile est : "qu'est-ce que cette ligne appelle/référence ?"

### 3a. Fonction `getLineContext()` dans context.ts

**Fichier** : `src/tui/context.ts`

```typescript
export function getLineContext(
  filePath: string,
  lineContent: string,
  result: ScanResult,
  diffs: Map<string, TuiFileDiff>,
): ContextData | null {
  // 1. Get outgoing links from this file
  const outLinks = result.links.filter(l => l.fromFile === filePath);

  // 2. Match specifiers against line content
  for (const link of outLinks) {
    for (const spec of link.specifiers ?? []) {
      if (!lineContent.includes(spec)) continue;

      // 3. Build TARGET context
      const targetDiff = [...diffs.values()].find(d => d.path === link.toFile);
      const chunks: ChunkInfo[] = targetDiff
        ? targetDiff.rows.filter(r => r.type === 'hunkHeader')
            .map(r => ({ file: targetDiff.name, method: r.method, crit: r.methodCrit, label: r.label }))
        : [];

      // 4. Build CALLED BY (reverse lookup: who else imports this target?)
      const calledBy = result.links
        .filter(l => l.toFile === link.toFile && l.fromFile !== filePath)
        .map(l => ({
          file: l.fromFile.split('/').pop() ?? l.fromFile,
          method: l.methodName ?? l.label,
          what: `${l.type}: ${l.label}`,
        }));

      const targetName = link.toFile.split('/').pop() ?? link.toFile;
      return {
        name: `${spec}`,
        crit: link.riskCrit,
        summary: `from ${targetName}`,
        chunks,
        usedBy: calledBy.length > 0 ? calledBy : undefined,
      };
    }
  }
  return null;  // No match → caller falls back to file context
}
```

### 3b. Basculement auto dans App.tsx

**Fichier** : `src/tui/App.tsx` — modifier le `useMemo` de `ctx` :

```typescript
const ctx = useMemo((): ContextData | null => {
  // Mode 4: diff panel active → try line-level context
  if (panel === 1 && selectedFile && currentDiff) {
    const curRow = activeDiffRows[safeDiffCursor];
    if (curRow?.type === 'diffRow') {
      const line = curRow.reviewLine ?? curRow.baseLine;
      if (line) {
        const lineCtx = getLineContext(currentDiff.path, line.c, data, diffs);
        if (lineCtx) return lineCtx;
      }
    }
    // Fallback: file context
    return getFileContext(selectedFile, data, diffs, lineReviews);
  }

  // Mode 3: explorer-driven (unchanged)
  const item = flatTree[safeIdx];
  ...
}, [panel, safeIdx, safeDiffCursor, ...]);
```

Le context panel bascule automatiquement :
- **panel 0 ou 2** : Mode 3 (file/folder/repo context, basé sur treeIdx)
- **panel 1** : Mode 4 (line context si match trouvé, sinon fallback Mode 3)

### 3c. Pas de changement dans ContextPanel.tsx

Le composant reçoit déjà un `ContextData` générique. Il affichera les chunks (méthodes modifiées du fichier TARGET) et les usedBy (CALLED BY). La structure est la même — seul le contenu change.

---

## 4. Fuzzy File Search (/) — bonus

**Problème** : sur un gros monorepo avec 50+ fichiers modifiés, trouver un fichier spécifique nécessite de scroller tout l'arbre.

### 4a. État de recherche dans App.tsx

```typescript
const [searchQuery, setSearchQuery] = useState<string | null>(null);
const [searchIdx, setSearchIdx] = useState(0);
```

### 4b. Handler dans useNavigation

Quand `input === '/' && !state.inputMode && !state.searchQuery` → activer le mode recherche.

En mode recherche, capturer toutes les touches :
- Caractères → append au query
- Backspace → supprimer dernier char
- ↑/↓ → naviguer dans les résultats
- Enter → sélectionner le fichier, fermer la recherche
- Esc → fermer sans sélectionner

### 4c. Rendu de l'overlay

Remplacer la title bar par un input de recherche quand `searchQuery !== null` :

```
◈ SEARCH: auth_        ▼ 3 results
```

Et dans l'explorer, ne montrer que les fichiers matchant (filtrage de `flatTree` par substring sur `node.name`).

### 4d. Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `src/tui/App.tsx` | State searchQuery/searchIdx, conditional title bar, filtered tree |
| `src/tui/hooks/useNavigation.ts` | Search mode input handling |
| `src/tui/types.ts` | (optionnel) SearchState type |

---

## Fichiers impactés (récapitulatif)

| Fichier | Changements |
|---------|-----------|
| `src/tui/types.ts` | `UsedByEntry.fileId` |
| `src/tui/data.ts` | `buildUsedByMap()` — resolve path→fileId |
| `src/tui/context.ts` | Nouvelle `getLineContext()` |
| `src/tui/App.tsx` | ctx useMemo (Mode 4), history hook, search state, ContextPanel props |
| `src/tui/hooks/useNavigation.ts` | Alt+←/→ handlers, push history, USED BY Enter, search mode, `/` key |
| `src/tui/hooks/useNavHistory.ts` | **NOUVEAU** — hook navigation history (~35 lignes) |
| `src/tui/components/ContextPanel.tsx` | Focus indicator sur USED BY items, props filteredCount/diffs |
| `src/tui/components/StatusBar.tsx` | Indicateur ◀ ▶ history |

---

## Ordre d'implémentation

1. **UsedByEntry + fileId** (types.ts, data.ts) — base pour USED BY navigation
2. **USED BY navigation** (useNavigation.ts, ContextPanel.tsx) — dépend de 1
3. **Navigation History** (useNavHistory.ts, useNavigation.ts, App.tsx, StatusBar.tsx) — indépendant
4. **Context Mode 4** (context.ts, App.tsx) — indépendant
5. **Fuzzy Search** (useNavigation.ts, App.tsx) — bonus, indépendant

---

## Vérification

1. `npx tsc -p tsconfig.node.json --noEmit`
2. `npm run dev` — tests visuels :
   - **USED BY** : Tab vers Context, ↓ jusqu'aux items USED BY, Enter → navigue vers le fichier
   - **History** : Enter sur un fichier, Enter sur un autre, Alt+← → retour au premier, Alt+→ → retour au second
   - **Mode 4** : dans le diff, positionner le curseur sur une ligne qui appelle un service → le context panel affiche le TARGET + CALLED BY
   - **Search** : appuyer `/`, taper un nom → l'explorer filtre, Enter → navigue
3. Vérifier que les USED BY items sans diff sont affichés en dim (non navigables)
4. Vérifier que le Mode 4 fallback correctement en Mode 3 quand pas de match sur la ligne
