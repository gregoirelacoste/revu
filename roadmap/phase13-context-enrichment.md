# Phase 13 — Enrichissement du contexte

## Objectif

Le pipeline AST + link-detector calcule de nombreuses informations qui ne sont jamais affichees dans le TUI. Resultat : le reviewer ouvre son IDE pour comprendre ce qui a change. Cette phase surface toutes les donnees deja calculees, pour que le reviewer n'ait (presque) plus besoin de quitter REVU.

---

## Step 1 — Afficher l'ancienne et nouvelle signature (sigChanged)

**Probleme** : Quand `sigChanged === true`, le header de hunk affiche juste `(Signature changed)`. Le reviewer ne sait pas CE qui a change sans ouvrir le fichier.

**Donnees existantes** : Dans `diff-extractor.ts` `buildMethodData()`, `oldMethod.signature` et `m.signature` sont tous les deux en scope — mais seul le booleen `sigChanged` survit dans `MethodData`.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/core/types.ts` | Ajouter `oldSignature?: string` et `newSignature?: string` sur `MethodData` |
| `src/core/analyzer/diff-extractor.ts` | Dans `buildMethodData()`, stocker `oldSignature: oldMethod?.signature`, `newSignature: m.signature` quand `sigChanged` |
| `src/tui/data.ts` | Propager `oldSignature`/`newSignature` dans `DiffRow` (type header) |
| `src/tui/components/DLine.tsx` | Sous le header de hunk, afficher 2 lignes dim : `- oldSignature` / `+ newSignature` quand presentes |

**Exemple rendu** :
```
── validateToken (Signature changed) 7.2 ──
  - validateToken(token: string): boolean
  + validateToken(token: string, opts?: ValidateOpts): Promise<boolean>
```

**Effort** : 45 min

---

## Step 2 — Afficher le path HTTP dans le header de hunk

**Probleme** : Pour un controller, le header montre `New GET endpoint` mais pas le path (`/users/:id`). Le reviewer ne sait pas quel endpoint API est touche.

**Donnees existantes** : `ParsedMethod.httpPath` est extrait par `ast-parser.ts` `extractHttpInfo()`. Mais `MethodData` ne porte que `httpVerb`, pas `httpPath`.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/core/types.ts` | Ajouter `httpPath?: string` sur `MethodData` |
| `src/core/analyzer/diff-extractor.ts` | Dans `buildMethodData()`, copier `httpPath` depuis `ParsedMethod` |
| `src/tui/data.ts` | Inclure `httpPath` dans le label du header de hunk via `methodLabel()` |

**Exemple rendu** :
```
── createUser (New POST /users 5.8) ──
── findById (Mod GET /users/:id 7.2) ──
```

**Effort** : 20 min

---

## Step 3 — Indicateur `tested: false` dans l'Explorer et le Context

**Probleme** : `FileEntry.tested` detecte si un `.spec.ts` est modifie en parallele. Jamais affiche. Un service modifie sans test est un red flag immediat.

**Donnees existantes** : `engine.ts` calcule `hasSpec` (lignes 149-152) et le stocke dans `FileEntry.tested`.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/data.ts` | Propager `tested` dans `FlatItem` / `TreeItem` |
| `src/tui/components/TreeRow.tsx` | Afficher `!` en orange apres le nom si `tested === false` et type est service/controller/guard |
| `src/tui/context.ts` | Inclure `tested` dans `ContextData` header |
| `src/tui/components/ContextPanel.tsx` | Afficher `⚠ No test changed` en orange dans le header quand `tested === false` |

**Effort** : 30 min

---

## Step 4 — Nombre de callers (usages) dans le header de hunk

**Probleme** : `MethodData.usages` est calcule par `enrichWithDependencies()` mais jamais affiche. Savoir qu'une methode a 12 callers vs 0 change la priorite de review.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/data.ts` | Ajouter `methodUsages?: number` sur `DiffRow`, peupler depuis `MethodData.usages` |
| `src/tui/components/DLine.tsx` | Afficher `(12 callers)` en dim apres le crit score quand `usages > 0` |

**Exemple rendu** :
```
── validateToken (Mod · sigChanged 7.2 · 8 callers) ──
```

**Effort** : 15 min

---

## Step 5 — Decorateurs de securite en badge sur le header

**Probleme** : Les decorateurs (`@UseGuards`, `@Roles`, `@Public`) sont extraits par `ast-parser.ts` mais jamais affiches. Un guard qui perd son `@UseGuards` est critique.

**Donnees existantes** : `ParsedMethod.decorators` est un `string[]` complet. Non propage vers `MethodData`.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/core/types.ts` | Ajouter `decorators?: string[]` sur `MethodData` |
| `src/core/analyzer/diff-extractor.ts` | Copier `decorators` depuis `ParsedMethod` dans `buildMethodData()` |
| `src/tui/data.ts` | Propager vers `DiffRow` |
| `src/tui/components/DLine.tsx` | Afficher badges compacts : `[Guard]` `[Roles]` `[Public]` en couleur apres le nom de methode |

**Effort** : 30 min

---

## Step 6 — Cross-repo sur les liens (DEPENDS ON)

**Probleme** : `DetectedLink.cross` identifie les imports qui traversent les services. Jamais affiche. Un import cross-repo modifie est un risque majeur.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/types.ts` | Ajouter `isCross?: boolean` sur `ImportEntry` dans `ContextData` |
| `src/tui/context.ts` | Dans `getFileContext()`, propager `link.cross` vers `ImportEntry` |
| `src/tui/components/ContextPanel.tsx` | Afficher `✕` ou `[cross]` en orange pour les imports cross-repo |

**Effort** : 15 min

---

## Step 7 — Label `(Deleted · unused)` et crit des callers dans USED BY

**Deux petites ameliorations** :

### 7a — Deleted · unused

Quand `m.status === 'del'` et `m.usages === 0`, afficher `(Deleted · unused)` au lieu de `(Deleted)` dans le header de hunk. Zero computation supplementaire.

| Fichier | Modification |
|---|---|
| `src/tui/data.ts` | Dans `methodLabel()`, ajouter le cas `del + usages === 0` |

### 7b — Crit du caller dans USED BY

Afficher le score de criticite de chaque fichier dans la section USED BY du Context panel.

| Fichier | Modification |
|---|---|
| `src/tui/types.ts` | Ajouter `crit?: number` sur `UsedByEntry` |
| `src/tui/data.ts` | Dans `buildUsedByMap()`, lookup le crit du fichier caller depuis `ScanResult` |
| `src/tui/components/ContextPanel.tsx` | Afficher le crit en couleur a cote du nom du caller |

**Effort** : 25 min

---

## Step 8 — Compteur de methodes formatting-only filtrees

**Probleme** : `isFormattingOnly()` filtre silencieusement des methodes. Le reviewer peut se demander s'il manque quelque chose.

**Changements** :

| Fichier | Modification |
|---|---|
| `src/tui/types.ts` | Ajouter `formattingSkipped?: number` sur `TuiFileDiff` |
| `src/tui/data.ts` | Dans `buildFileDiffs()`, compter les methodes `unch` et stocker dans `formattingSkipped` |
| `src/tui/components/ContextPanel.tsx` | Afficher `+3 formatting-only` en dim dans le summary quand > 0 |

**Effort** : 15 min

---

## Ordre d'implementation

| Step | Quoi | Effort | Impact |
|---|---|---|---|
| 1 | Signatures avant/apres | 45 min | Tres haut — elimine le #1 motif d'ouvrir l'IDE |
| 2 | Path HTTP dans header | 20 min | Haut — endpoint visible d'un coup d'oeil |
| 3 | Indicateur `tested: false` | 30 min | Haut — red flag immediat |
| 4 | Nombre de callers | 15 min | Moyen-haut — priorisation rapide |
| 5 | Badges decorateurs securite | 30 min | Moyen-haut — surface de securite visible |
| 6 | Cross-repo sur liens | 15 min | Moyen — risque inter-service |
| 7 | Deleted unused + crit callers | 25 min | Moyen — skip + priorisation |
| 8 | Compteur formatting-only | 15 min | Moyen-bas — confiance |

**Total** : ~3h15

---

## Fichiers touches

| Fichier | Steps |
|---|---|
| `src/core/types.ts` | 1, 2, 5 |
| `src/core/analyzer/diff-extractor.ts` | 1, 2, 5 |
| `src/tui/types.ts` | 6, 7b, 8 |
| `src/tui/data.ts` | 1, 2, 3, 4, 7a, 7b, 8 |
| `src/tui/context.ts` | 3, 6 |
| `src/tui/components/DLine.tsx` | 1, 2, 4, 5 |
| `src/tui/components/TreeRow.tsx` | 3 |
| `src/tui/components/ContextPanel.tsx` | 3, 6, 7b, 8 |
