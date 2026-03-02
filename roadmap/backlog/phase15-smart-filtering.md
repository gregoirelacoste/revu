# Phase 15 — Smart Filtering

## Objectif

Permettre au reviewer de filtrer et trouver instantanement les fichiers qui comptent. Actuellement, le filtre `minCrit` ne touche que le Context panel, et la recherche `/` ne matche que par nom de fichier. Cette phase transforme le filtrage en outil de triage rapide.

---

## Step 1 — Search enrichie avec prefixes

**Probleme** : La recherche fuzzy (`/`) ne filtre que par nom de fichier (`item.node.name.includes(q)`). Impossible de chercher "tous les services au-dessus de crit 7" ou "tous les fichiers avec des side-effects".

**Prefixes supportes** :

| Prefixe | Exemple | Filtre |
|---|---|---|
| `>N` | `>7` | Fichiers avec crit > 7 |
| `<N` | `<3` | Fichiers avec crit < 3 |
| `@type` | `@service` | Fichiers de type service |
| `!` | `!` | Fichiers avec side-effects (`sideEffects.length > 0`) |
| `~` | `~` | Fichiers avec `tested === false` |
| `*` | `*` | Fichiers avec bugs ou questions flagges |
| (sans prefixe) | `auth` | Fuzzy match sur le nom (comportement actuel) |
| combinaison | `>5 auth` | Crit > 5 ET nom contient "auth" |

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/App.tsx` | Refactorer le `filter()` dans le rendu du tree : extraire en fonction `matchesSearch(item, query, lineReviews, fileProgress)` qui parse les prefixes |

**Implementation** :
```typescript
function matchesSearch(item: FlatItem, q: string, ...): boolean {
  const parts = q.split(/\s+/);
  return parts.every(part => {
    if (part.startsWith('>')) return item.node.crit > parseFloat(part.slice(1));
    if (part.startsWith('<')) return item.node.crit < parseFloat(part.slice(1));
    if (part.startsWith('@')) return item.node.type === part.slice(1);
    if (part === '!') return item.node.sideEffects?.length > 0;
    if (part === '~') return item.node.tested === false;
    if (part === '*') return /* has bug or question flag */;
    return item.node.name.toLowerCase().includes(part.toLowerCase());
  });
}
```

**Effort** : 30 min

---

## Step 2 — minCrit affecte l'Explorer (dim, pas masque)

**Probleme** : `minCrit` (touches `[` et `]`) ne filtre que les chunks dans le Context panel. L'Explorer montre tous les fichiers quel que soit le filtre. Le reviewer voit des fichiers a crit 1.2 meme quand minCrit est a 5.

**Comportement** : Ne pas masquer les fichiers sous le seuil (ca perdrait l'orientation dans l'arbre), mais les dimmer visuellement.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/components/TreeRow.tsx` | Recevoir `minCrit` en prop. Quand `node.crit < minCrit`, appliquer `color={C.dim}` sur toute la ligne au lieu des couleurs normales |
| `src/tui/App.tsx` | Passer `minCrit` a `TreeRow` |

**Effort** : 15 min

---

## Step 3 — minCrit affecte le diff (dim les hunks sous le seuil)

**Probleme** : Dans le diff panel, tous les hunks sont affiches avec la meme intensite. Si minCrit est a 5 et un hunk a crit 2.3, il est quand meme affiche normalement.

**Comportement** : Dimmer (pas masquer) les hunks dont `methodCrit < minCrit`. Le header de hunk et ses lignes passent en `C.dim`. Le reviewer peut toujours les lire mais sait visuellement qu'ils sont sous le seuil.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/components/DLine.tsx` | Recevoir `minCrit` en prop. Quand `row.methodCrit < minCrit` et le row est un header ou une ligne de ce hunk, utiliser `C.dim` comme couleur dominante |
| `src/tui/App.tsx` | Passer `minCrit` au rendu du diff |

**Effort** : 20 min

---

## Step 4 — Section "STABLE DEPS" dans le Context panel

**Probleme** : La section DEPENDS ON ne montre que les imports qui sont EUX-MEMES modifies dans la branche (`diffs.has(targetFileId)`). Le reviewer ne voit pas les services injectes inchanges. Pour comprendre le contexte d'un fichier isole, il doit ouvrir l'IDE.

**Comportement** :
- Garder DEPENDS ON tel quel (imports changes, important pour le co-change risk)
- Ajouter une section STABLE DEPS en dessous, collapsed par defaut
- N'afficher que les liens de type `inject` (services NestJS) — pas tous les imports
- Limiter a 5 max, tries par nom

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/context.ts` | Dans `getFileContext()`, ajouter un second array `stableDeps` : liens sortants de type `inject` dont la cible N'est PAS dans `diffs` |
| `src/tui/types.ts` | Ajouter `stableDeps?: ImportEntry[]` sur `ContextData` |
| `src/tui/components/ContextPanel.tsx` | Afficher section STABLE DEPS en dim, avec les noms des services injectes. Afficher `(+N more)` si > 5 |

**Effort** : 30 min

---

## Ordre d'implementation

| Step | Quoi | Effort | Impact |
|---|---|---|---|
| 1 | Search enrichie avec prefixes | 30 min | Haut — triage instantane |
| 2 | minCrit dim dans l'Explorer | 15 min | Moyen — focus visuel |
| 3 | minCrit dim dans le diff | 20 min | Moyen — coherence du filtre |
| 4 | Stable deps dans Context | 30 min | Moyen — moins d'IDE |

**Total** : ~1h35

---

## Fichiers touches

| Fichier | Steps |
|---|---|
| `src/tui/App.tsx` | 1, 2, 3 |
| `src/tui/components/TreeRow.tsx` | 2 |
| `src/tui/components/DLine.tsx` | 3 |
| `src/tui/context.ts` | 4 |
| `src/tui/types.ts` | 4 |
| `src/tui/components/ContextPanel.tsx` | 4 |
| `src/tui/components/HelpOverlay.tsx` | 1 (documenter les prefixes de recherche) |

---

## Exemples d'usage

### Triage rapide d'une grosse PR (40 fichiers)

```
/         → ouvre la recherche
>7        → ne montre que les 5 fichiers a crit > 7
           → review rapide de ces 5
>4 @service → services a crit > 4
           → review des services moyens
~         → fichiers sans test modifie
           → verifier qu'ils ne manquent pas de coverage
*         → fichiers deja flagges bug/question
           → revoir les problemes trouves
```

### Focus avec minCrit

```
]]]       → monte minCrit a 5.0
           → Explorer : fichiers < 5 sont dimmes
           → Diff : hunks < 5 sont dimmes
           → Context : chunks < 5 sont masques
           → Le reviewer se concentre sur ce qui compte
```
