# Phase 10 — Live Diff Reload

## Context

REVU scanne les repos une seule fois au lancement (`cli.ts → scan() → App`). Si l'utilisateur code dans son editeur pendant qu'il review, il doit relancer REVU pour voir les nouveaux diffs. L'objectif est d'avoir un comportement type IntelliJ : le diff se met a jour en temps reel quand un fichier est sauvegarde.

**Decision** : mode working tree par defaut (`git diff baseBranch` au lieu de `git diff baseBranch...HEAD`). Le diff inclut les changements commites ET non commites vs la branche de base.

---

## Step 1 — Modifier `computeDiff` pour inclure le working tree

**Fichier** : `src/core/scanner/diff-parser.ts`

Changer la commande git diff :
```typescript
export async function computeDiff(
  repoPath: string, baseBranch: string,
  includeWorkingTree = true,
): Promise<FileDiff[]> {
  const diffRef = includeWorkingTree ? baseBranch : `${baseBranch}...HEAD`;
  // git diff baseBranch = committed + working tree vs merge-base
  const { stdout } = await exec(
    'git', ['diff', diffRef, '--unified=3', '--no-color'],
    { cwd: repoPath, maxBuffer: 10 * 1024 * 1024 },
  );
  return parseDiff(stdout);
}
```

`getFileAtBranch` reste inchange (il lit la version base pour comparaison AST old vs new). La version "new" est deja lue depuis le disque via `readFile(fullPath)` dans `parseRepoFiles`.

## Step 2 — Propager l'option dans `engine.ts`

**Fichier** : `src/core/engine.ts`

```typescript
export async function scan(
  rootDir: string, baseBranch = 'develop',
  includeWorkingTree = true,
): Promise<ScanResult> {
  // ... passer includeWorkingTree a processRepo puis computeDiff
}
```

Signature de `processRepo` mise a jour de la meme facon.

## Step 3 — Creer `useFileWatcher` hook

**Nouveau fichier** : `src/tui/hooks/useFileWatcher.ts`

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { watch, type FSWatcher } from 'node:fs';
import type { ScanResult } from '../../core/engine.js';

interface UseFileWatcherOptions {
  repoPaths: string[];
  rescan: () => Promise<ScanResult>;
  onNewData: (data: ScanResult) => void;
}

export function useFileWatcher(opts: UseFileWatcherOptions) {
  // Returns { isScanning: boolean; triggerRescan: () => void }
}
```

**Logique cle** :
- `fs.watch(repoPath, { recursive: true })` par repo
- Filtre : ignore `.git/`, `node_modules/`, `.revu/`
- Ne reagit qu'aux fichiers source : `\.(ts|tsx|html|scss|css)$`
- **Debounce 500ms** : plusieurs saves rapides → un seul rescan
- **Coalescing** : si un changement arrive pendant un scan en cours, queue UN seul rescan supplementaire (pas N)
- **Fallback gracieux** : si `fs.watch` recursive echoue (vieux Node), log + continue sans watcher
- Cleanup des watchers dans le return du `useEffect`

## Step 4 — Modifier `cli.ts`

**Fichier** : `src/cli.ts`

```typescript
const result = await scan(ROOT_DIR, BASE_BRANCH);
const rescan = () => scan(ROOT_DIR, BASE_BRANCH);

render(React.createElement(App, {
  initialData: result,
  rootDir: ROOT_DIR,
  baseBranch: BASE_BRANCH,
  rescan,
}));
```

- `data` renomme en `initialData`
- Ajouter `baseBranch` et `rescan` comme props

## Step 5 — Convertir `data` en state dans `App.tsx`

**Fichier** : `src/tui/App.tsx`

```typescript
interface AppProps {
  initialData: ScanResult;
  rootDir: string;
  baseBranch: string;
  rescan: () => Promise<ScanResult>;
}

export function App({ initialData, rootDir, baseBranch, rescan }: AppProps) {
  const [data, setData] = useState(initialData);
  const [dataVersion, setDataVersion] = useState(0);

  const repoPaths = useMemo(
    () => data.repos.map(r => join(rootDir, r.name)),
    [data.repos.length, rootDir],
  );

  const handleNewData = useCallback((newData: ScanResult) => {
    setData(newData);
    setDataVersion(v => v + 1);
  }, []);

  const { isScanning, triggerRescan } = useFileWatcher({
    repoPaths, rescan, onNewData: handleNewData,
  });
```

**Preservation d'etat lors du rescan** :
- `selectedFile` : garde si le fileId existe encore dans le nouveau data, sinon clear
- `collapsed` : inchange (cle par folder name, stable)
- `treeIdx` : clampe par le `safeIdx` existant
- `diffCursor` / `diffScroll` : gardes, clampes par `safeDiffCursor`
- `lineReviews` : inchanges (cles par `fileId:lineNum`, les lineNum peuvent shifter → tradeoff accepte, indicateur stale existant)

**Validation du selectedFile** :
```typescript
useEffect(() => {
  if (!selectedFile) return;
  const exists = data.repos.some(r => r.files.some(f => f.id === selectedFile));
  if (!exists) setSelectedFile(null);
}, [data, selectedFile]);
```

## Step 6 — Ajouter touche `r` pour reload manuel

**Fichier** : `src/tui/hooks/useNavigation.ts`

- Ajouter `onRescan?: () => void` dans `NavSetters`
- Dans `useInput`, apres la gestion du help/tutorial :
```typescript
if (input === 'r') { setters.onRescan?.(); return; }
```
- Passer `triggerRescan` depuis App.tsx

## Step 7 — Indicateur dans la StatusBar

**Fichier** : `src/tui/components/StatusBar.tsx`

- Ajouter prop `isScanning?: boolean`
- Afficher `[LIVE]` en vert quand le watcher est actif (toujours)
- Afficher `scanning...` en cyan pendant un rescan en cours

## Step 8 — Mettre a jour HelpOverlay + TutorialOverlay

- HelpOverlay : ajouter `r` → Reload dans GENERAL
- TutorialOverlay : mentionner le live reload dans la page Tips

---

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `src/core/scanner/diff-parser.ts` | `includeWorkingTree` param, default `baseBranch` au lieu de `baseBranch...HEAD` |
| `src/core/engine.ts` | Propager option, signature scan() |
| `src/tui/hooks/useFileWatcher.ts` | **Nouveau** — watcher + debounce + coalescing |
| `src/cli.ts` | Passer `initialData`, `rescan`, `baseBranch` |
| `src/tui/App.tsx` | `data` en state, integration watcher, validation selectedFile |
| `src/tui/hooks/useNavigation.ts` | Touche `r` reload |
| `src/tui/components/StatusBar.tsx` | Indicateur `[LIVE]` + `scanning...` |
| `src/tui/components/HelpOverlay.tsx` | Touche `r` |
| `src/tui/components/TutorialOverlay.tsx` | Mention live reload |

**Pas de nouvelle dependance** (`fs.watch` natif Node, pas chokidar).

---

## Verification

```bash
npx tsc -p tsconfig.node.json --noEmit
npm run dev
```

1. Ouvrir REVU sur un repo avec une branche feature
2. Verifier que `[LIVE]` apparait dans la status bar
3. Dans un autre terminal, modifier un fichier `.ts` du repo
4. Observer que le diff se met a jour dans REVU (~1s apres la sauvegarde)
5. Verifier que le fichier selectionne et le curseur sont preserves
6. Presser `r` pour forcer un reload manuel
7. Verifier que les flags de review sont preserves apres reload
