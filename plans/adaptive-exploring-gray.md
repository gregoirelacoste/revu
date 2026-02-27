# Plan : Méthodes supprimées + auto-avance review

## Contexte

Deux améliorations UX demandées :
1. Les méthodes/constantes **supprimées** d'un fichier n'apparaissent pas dans le right panel. Seules les méthodes `new`/`mod`/`unch` sont listées car `buildMethodData()` n'itère que sur les méthodes du **nouveau** code.
2. Quand on clique sur un flag (OK, Bug, Test, Question) sur une planète, rien ne se passe visuellement. L'utilisateur doit manuellement naviguer vers le fichier suivant. On veut un **auto-avance** vers la prochaine planète non reviewée.

---

## Feature 1 : Afficher les méthodes/constantes supprimées

### Step 1 : Ajouter `'del'` à MethodStatus

**Fichiers** : `src/server/types.ts:9` + `src/web/types/index.ts:4`

```typescript
export type MethodStatus = 'new' | 'mod' | 'unch' | 'del';
```

### Step 2 : Détecter les méthodes supprimées (server)

**Fichier** : `src/server/routes/scan.routes.ts` - `buildMethodData()` (l.191)

Après le `pf.methods.map(...)` actuel, ajouter une boucle sur `oldAst.methods` pour trouver celles absentes du nouveau code :

```typescript
function buildMethodData(pf, diff, oldAst, fileCrit): MethodData[] {
  const newMethods = pf.methods.map(m => { /* ... existant ... */ });

  // Méthodes supprimées
  if (oldAst?.methods) {
    const newNames = new Set(pf.methods.map(m => m.name));
    for (const om of oldAst.methods) {
      if (!newNames.has(om.name)) {
        const delDiff = extractDeletedMethodDiff(om.name, diff);
        if (delDiff.length === 0) continue; // pas dans le diff → pas vraiment supprimé
        newMethods.push({
          name: om.name, status: 'del', crit: Math.round(fileCrit * 0.8 * 10) / 10,
          usages: 0, tested: false, sigChanged: false, diff: delDiff,
        });
      }
    }
  }

  return newMethods;
}
```

### Step 3 : Extraire le diff d'une méthode supprimée (server)

**Fichier** : `src/server/routes/scan.routes.ts` - nouvelle fonction

Les lignes supprimées (`type: 'del'`) dans le diff qui correspondent au corps de la méthode. Comme la méthode n'existe plus dans le nouveau code, on utilise `oldStart` des hunks :

```typescript
function extractDeletedMethodDiff(
  methodName: string, diff: FileDiff,
): Array<{ t: DiffLineType; c: string }> {
  // Chercher un bloc de lignes 'del' consécutives qui contient le nom de la méthode
  const result: Array<{ t: DiffLineType; c: string }> = [];
  for (const hunk of diff.hunks) {
    const delBlock: string[] = [];
    for (const line of hunk.lines) {
      if (line.type === 'del') {
        delBlock.push(line.content);
      } else {
        if (delBlock.some(l => l.includes(methodName))) {
          for (const dl of delBlock) result.push({ t: 'd', c: dl });
        }
        delBlock.length = 0;
      }
    }
    // Flush remaining
    if (delBlock.some(l => l.includes(methodName))) {
      for (const dl of delBlock) result.push({ t: 'd', c: dl });
    }
  }
  return result;
}
```

### Step 4 : Même traitement pour les constantes supprimées (server)

**Fichier** : `src/server/routes/scan.routes.ts` - `buildConstantData()` (l.214)

Ajouter un paramètre `oldAst` et détecter les constantes supprimées de la même manière.

### Step 5 : Afficher les méthodes supprimées (frontend)

**Fichier** : `src/web/detail/PlanetDetail.tsx`

Le filtre actuel (l.46) inclut déjà tout sauf `unch` :
```typescript
.filter(m => m.status !== 'unch' || m.impacted)
```
Les méthodes `del` passeront automatiquement ce filtre.

Ajouter le compteur dans `PlanetHeader` :
```typescript
const delFn = changedItems.filter(m => m.status === 'del').length;
// Afficher Tag "DEL 2" en rouge à côté de NEW et MOD
```

**Fichier** : `src/web/detail/MethodRow.tsx`

Style visuel pour `status === 'del'` :
- Nom barré (`textDecoration: 'line-through'`)
- Badge "DEL" rouge au lieu de "NEW"/"MOD"
- Diff affiché normalement (que des lignes rouges `'d'`)

---

## Feature 2 : Auto-avance après flag planète

### Step 6 : Helper `findNextPlanet`

**Fichier** : `src/web/utils/geometry.ts` - nouvelle fonction

```typescript
export function findNextPlanet(
  allPlanets: FlatPlanet[],
  currentId: string,
  archivedIds: Set<string>,
): FlatPlanet | null {
  const current = allPlanets.find(p => p.id === currentId);
  if (!current) return null;

  // 1. Même système, non reviewé, par criticité décroissante
  const sameSystem = allPlanets
    .filter(p => p.system.id === current.system.id && p.id !== currentId && !archivedIds.has(p.id))
    .sort((a, b) => b.crit - a.crit);
  if (sameSystem.length > 0) return sameSystem[0];

  // 2. Même galaxie, non reviewé, par criticité décroissante
  const sameGalaxy = allPlanets
    .filter(p => p.galaxy.id === current.galaxy.id && p.id !== currentId && !archivedIds.has(p.id))
    .sort((a, b) => b.crit - a.crit);
  if (sameGalaxy.length > 0) return sameGalaxy[0];

  // 3. N'importe quelle planète non reviewée
  const any = allPlanets
    .filter(p => p.id !== currentId && !archivedIds.has(p.id))
    .sort((a, b) => b.crit - a.crit);
  return any[0] ?? null;
}
```

### Step 7 : Modifier FlagBar pour auto-naviguer

**Fichier** : `src/web/detail/PlanetDetail.tsx`

Ajouter `onNavigate`, `allPlanets`, `archivedIds` aux props de `FlagBar` :

```typescript
function FlagBar({ planet, flag, P, toggleFlag, onNavigate, allPlanets, archivedIds }) {
  // ...
  onClick={() => {
    toggleFlag(planet.id, ft.key);
    // Si on vient de mettre un flag (pas de toggle off), avancer
    if (flag !== ft.key) {
      // Petit délai pour laisser le state se mettre à jour
      setTimeout(() => {
        const next = findNextPlanet(allPlanets, planet.id,
          new Set([...archivedIds, planet.id])); // inclure la planète qu'on vient de flagger
        if (next) onNavigate({ kind: 'planet', id: next.id, planet: next });
      }, 150);
    }
  }
}
```

### Step 8 : Passer les props nécessaires

**Fichier** : `src/web/detail/PlanetDetail.tsx` (l.143)

```typescript
<FlagBar planet={planet} flag={flag} P={P} toggleFlag={review.toggleFlag}
  onNavigate={onNavigate} allPlanets={allPlanets} archivedIds={review.archivedIds} />
```

La prop `allPlanets` doit être ajoutée à l'interface `Props` de `PlanetDetail` (elle n'y est peut-être déjà - à vérifier).

---

## Fichiers modifiés (résumé)

| Fichier | Nature |
|---------|--------|
| `src/server/types.ts` | `MethodStatus` += `'del'` |
| `src/web/types/index.ts` | `MethodStatus` += `'del'` |
| `src/server/routes/scan.routes.ts` | `buildMethodData` détecte les suppressions, `extractDeletedMethodDiff`, `buildConstantData` avec oldAst |
| `src/web/detail/PlanetDetail.tsx` | Compteur DEL dans header, FlagBar avec auto-avance |
| `src/web/detail/MethodRow.tsx` | Style barré pour `status === 'del'` |
| `src/web/utils/geometry.ts` | `findNextPlanet()` |

---

## Vérification

1. `npx tsc --noEmit` (server) → 0 erreurs
2. `npx tsc -p tsconfig.web.json --noEmit` → 0 erreurs
3. `npx vite build` → OK
4. Tests manuels :
   - Supprimer une méthode dans un fichier modifié → elle apparaît avec badge "DEL" et diff rouge
   - Cliquer "OK" sur une planète → navigue automatiquement vers la prochaine planète non reviewée du même système
   - Si toutes les planètes du système sont reviewées → navigue vers la prochaine du même repo
   - Toggle off un flag (re-clic) → pas de navigation
