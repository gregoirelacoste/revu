# Phase 12 — Scoring v2 : Statistique + IA

## Contexte

Le scoring actuel est trop simpliste : 4 signaux (type fichier, volume, dependances, path securite) avec des poids egaux. 14 signaux sont deja calcules dans le pipeline mais ignores par le scorer. Le resultat : un DTO reformate par Prettier score autant qu'un guard dont on modifie la logique d'auth.

Deux axes d'amelioration :
- **Axe 1** : Scoring statistique — exploiter les signaux deja presents dans le code
- **Axe 2** : Scoring IA — methodologie pour enrichir le scoring via LLM

---

## Axe 1 — Scoring Statistique

### Etat des lieux : signaux ignores

| Signal deja calcule | Source | Utilise ? |
|---|---|---|
| `MethodData.sigChanged` | diff-extractor | Methode only, pas fichier |
| `MethodData.status` (new/mod/del) | diff-extractor | Non |
| `MethodData.impacted` | side-effects | Non |
| `MethodData.httpVerb` | ast-parser | Non |
| `ParsedMethod.decorators[]` | ast-parser | Non (perdu apres AST) |
| `DetectedLink.cross` (cross-repo) | link-detector | Non |
| `DetectedLink.type` (import/inject/type) | link-detector | Non (tout = +1 plat) |
| `DetectedLink.riskCrit` | link-detector | Non |
| `FileEntry.tested` | engine | Non |
| `isFormattingOnly()` | diff-extractor | Filtre le diff mais pas le score |
| `lineCriticality` config | config.ts | Defini, jamais applique |
| `MethodData.diff[].c` (contenu) | diff-extractor | Non |
| `ParsedMethod.startLine/endLine` | ast-parser | Non |
| `ScoringConfig.rules.alwaysShow` | config.ts | Non |

### Nouvelle formule : 3 couches

```
score = base_score × (1 + compound_bonus) × formatting_discount × test_discount
```

#### Couche 1 — Signaux de base (7 weights, somme = 1.0)

| Weight | Defaut | Ancien | Signal |
|---|---|---|---|
| `fileType` | 0.20 | 0.25 | Type fichier (service=0.8, dto=0.3...) |
| `changeVolume` | 0.15 | 0.25 | `min(1, (add+del)/200)` |
| `dependencies` | 0.20 | 0.25 | `min(1, inboundLinks/10)` |
| `securityContext` | 0.15 | 0.25 | Keywords sur path |
| **`contentRisk`** | **0.15** | - | **Regex sur contenu des lignes modifiees** |
| **`methodRisk`** | **0.10** | - | **Profil de risque agrege des methodes** |
| **`stability`** | **0.05** | - | **Ratio modification/ajout/suppression** |

#### Couche 2 — Bonus composites (multiplicateurs 0 a +0.5)

| Signal | Max bonus | Declencheur |
|---|---|---|
| `compoundSigDep` | +0.15 | Signature change + haute dependance |
| `changePropagation` | +0.20 | Service ET controller modifies ensemble |
| `cascadeDepth` | +0.15 | Chaine A→B→C tous modifies (depth > 1) |
| `dtoContractChange` | +0.15 | DTO avec decorateurs validation modifies |
| `existingEndpointMod` | +0.20 | Endpoint HTTP existant modifie/supprime |

#### Couche 3 — Attenuations (multiplicateurs < 1.0)

| Signal | Facteur | Condition |
|---|---|---|
| `formattingDiscount` | ×0.1 | 100% formatting-only |
| `formattingDiscount` | ×0.7 | >80% inchange, changements < 5 lignes |
| `testDiscount` | ×0.85 | `.spec.ts` aussi modifie dans la branche |

### Detail des 3 nouveaux signaux de base

#### `contentRisk` — Analyse du contenu des lignes

Regex sur `MethodData.diff[].c` (lignes ajoutees/supprimees) :

```
if/else/switch/case          → 0.15
try/catch/throw              → 0.20
await / Promise.all          → 0.10
password/token/secret        → 0.25
@UseGuards/canActivate       → 0.20
@IsString/@IsEmail/@IsUUID   → 0.15
@Transform/@Type             → 0.12
```

Formule : `sum(lineWeights) / lineCount`, cap a 1.0

**Exemple** : Un `.dto.ts` score actuellement 2.1 (type=0.3). Mais si on modifie 5 lignes de `@IsEmail`, `@IsOptional` → `@IsNotEmpty`, le `contentRisk` monte a 0.8. Score final : ~4.5. Le reviewer sait que c'est un changement de contrat.

#### `methodRisk` — Profil methode

Par methode modifiee :
- `status='del'` → 0.7, `'mod'` → 0.5, `'new'` → 0.2
- `sigChanged && status='mod'` → +0.3 (changement de contrat)
- Body size change > 50% → +0.3 (restructuration)
- Multiplie par `1 + min(1, usages/10) × 0.5` (plus utilise = plus risque)

Normalise par nombre de methodes actives, cap a 1.0.

**Exemple** : `auth.service.ts` modifie `validateToken` (10 usages, sigChanged) + supprime `legacyAuth` (5 usages). methodRisk = 0.85.

#### `stability` — Type de changement

```
modifications (paires add/del) × 1.0
suppressions pures             × 0.7
ajouts purs                    × 0.3
```

Divise par le total, cap a 1.0.

**Exemple** : +50/-0 (feature add) → 0.3. +25/-25 (refactoring) → 1.0. Le refactoring est plus risque car on touche du code qui marchait.

### Detail des bonus composites

#### `compoundSigDep` — Signature + dependants

Si un fichier a `sigChanged=true` ET `dependencyCount >= 3` :
bonus = `min(0.15, deps/20 × 0.15)`

**Exemple** : `auth.service.ts` change la signature de `validateToken`. 8 controllers l'injectent. Bonus = +0.06. Le score passe de 7.2 a 7.6.

#### `changePropagation` — Modification en cascade

Pour chaque fichier qui importe CE fichier ET est aussi modifie : +0.03. Cross-repo : +0.06.

**Exemple** : `sync.service.ts` modifie + `case.controller.ts` modifie et l'importe → +0.03. Si `trust-analyzer.ts` (autre repo) l'importe aussi → +0.09 total.

#### `cascadeDepth` — Profondeur de chaine

BFS sur les links entre fichiers modifies. depth=2 → +0.05, depth=3 → +0.10, depth=4+ → +0.15.

**Exemple** : `case.dto.ts` → `case.service.ts` → `case.controller.ts` tous modifies. Depth=2, bonus = +0.05.

#### `dtoContractChange` — Validation DTO

Si `fileType='dto'` et les lignes modifiees contiennent des decorateurs de validation (`@IsString`, `@IsOptional`, `@MaxLength`, etc.) : bonus proportionnel au ratio de lignes validation.

**Exemple** : `create-case.dto.ts` ajoute `@IsUUID` sur un champ qui etait `@IsString`. dtoContractChange = +0.12. Un "petit" changement de DTO qui peut casser tous les clients.

#### `existingEndpointMod` — Endpoint existant

Si `fileType='controller'` : endpoints `mod` → +0.05 chacun, endpoints `del` → +0.08, endpoints `mod` avec `sigChanged` → +0.04 en plus.

**Exemple** : `case.controller.ts` modifie `GET /cases/:id` (existant) + ajoute `POST /cases/bulk` (nouveau). Seul le GET score le bonus (+0.05). Le POST est nouveau, risque moindre.

### Impact sur le scoring methode

Nouvelle formule methode (7 facteurs au lieu de 4) :

| Facteur | Poids | Ancien |
|---|---|---|
| fileCrit (normalise) | 0.25 | 0.40 |
| normalizedUsages | 0.20 | 0.30 |
| sigChanged | 0.15 | 0.20 |
| securityWeight | 0.10 | 0.10 |
| **statusWeight** | **0.10** | - |
| **contentRisk** (methode) | **0.10** | - |
| **impactedWeight** | **0.10** | - |

### Scenarios avant/apres

| Scenario | Score v1 | Score v2 | Pourquoi |
|---|---|---|---|
| DTO avec `@IsOptional` → `@IsNotEmpty` | 2.1 | 4.5 | contentRisk + dtoContractChange |
| Guard `canActivate` modifie, 3 lignes | 4.8 | 7.2 | contentRisk (auth) + methodRisk (mod) |
| Service reformate Prettier, 200 lignes | 6.5 | 0.7 | formattingDiscount × 0.1 |
| Cross-repo inject target, sigChanged | 6.0 | 8.1 | compoundSigDep + changePropagation |
| Controller `DELETE` endpoint supprime | 5.2 | 7.4 | existingEndpointMod + methodRisk (del) |
| Nouveau fichier test, 100% additions | 3.8 | 2.2 | stability (0.3) + testDiscount |
| Service avec 3 methodes impactees | 5.5 | 6.8 | impactedWeight (methode) |

### Implementation

#### Step 1 — Types et config (30 min)

**`src/core/types.ts`** : ajouter `contentRisk`, `methodRisk`, `stability` a `ScoringWeights`

**`src/core/scoring/config.ts`** : defaults a 0.15, 0.10, 0.05. Reequilibrer les 4 anciens (0.20, 0.15, 0.20, 0.15).

Retrocompatible : un user avec un `config.json` existant (4 poids) recoit les nouveaux avec leurs defaults via `mergeConfig`.

#### Step 2 — Content signals (2h)

**Nouveau fichier `src/core/scoring/content-signals.ts`** (~150 lignes) :

10 fonctions pures, testables individuellement :
- `computeContentRisk(methods)` — regex sur diff lines
- `computeMethodRisk(methods, oldMethods?)` — status + sigChanged + body size
- `computeStabilityRisk(add, del, methods)` — ratio mod/add/del
- `computeCompoundSigDep(methods, depCount)` — sig × deps
- `computeChangePropagation(path, allFiles, links)` — cascade directe
- `computeCascadeDepth(path, allFiles, links)` — BFS profondeur
- `computeDtoContractChange(type, methods, constants)` — validation decorators
- `computeExistingEndpointMod(type, methods)` — HTTP endpoint mod/del
- `computeFormattingDiscount(methods, constants)` — attenuation formatting
- `computeTestDiscount(tested)` — attenuation test

#### Step 3 — Refactor criticality.ts (1h)

Nouvelle signature `computeFileCriticalityV2(config, signals: FileSignals)`.

`FileSignals` contient tout le contexte necessaire :
```typescript
interface FileSignals {
  additions: number; deletions: number;
  dependencyCount: number;
  filePath: string; fileType: string;
  methods: MethodData[]; constants: MethodData[];
  oldMethods?: ParsedMethod[];
  tested: boolean;
  allFiles: FileEntry[]; links: DetectedLink[];
}
```

L'ancien `computeFileCriticality` reste comme fallback (si `contentRisk/methodRisk/stability` sont a 0 dans la config, le comportement est identique a v1).

#### Step 4 — Adapter engine.ts (1h)

Passer `allFiles` et `links` a `enrichWithDependencies`. Ces donnees sont deja disponibles dans le scope de `scan()`.

Passer `oldMethods` (depuis `ParsedFile`) pour le calcul de body size ratio.

#### Step 5 — Verification (30 min)

```bash
npx tsc -p tsconfig.node.json --noEmit
npm run dev
```

Comparer les scores v1 vs v2 sur un vrai diff de Certificall. Ajuster les poids si necessaire.

---

## Axe 2 — Scoring IA

### Vision

L'IA ne remplace pas le scoring statistique — elle le **complete**. Le scoring statistique est rapide et deterministe. L'IA ajoute la comprehension semantique : "ce changement de 3 lignes dans un guard est critique parce qu'il desactive la verification du token JWT".

### Approche A — Prompt-based (quick win, 2-3 jours)

#### Architecture

```
Pipeline heuristique (existant, instantane)
     ↓
Score heuristique par fichier (0-10)
     ↓
Envoi du diff + contexte a Claude Haiku ← parallel, ~2s pour 15 fichiers
     ↓
Score AI par fichier (0-10) + dimensions + concerns
     ↓
Fusion : merged = heuristic × (1 - confidence×0.6) + ai × confidence×0.6
     ↓
Score final affiche dans REVU
```

#### Prompt template

```
Assess the risk of this code change.

FILE: {path}
TYPE: {type}
HEURISTIC_SCORE: {crit}/10
DEPENDENCIES_IN: {depCount} files depend on this
SIGNATURE_CHANGES: {sigChangedMethods.join(', ') || 'none'}

DIFF:
{methodDiffs}

Score 0-10 across: correctness, security, impact, complexity, testability.
JSON: { score, dimensions, concerns: [max 3], confidence: 0-1 }
```

#### Cout et latence

- **Haiku 4.5** : ~$0.03/session (15 fichiers), ~200-400ms/fichier
- **Sonnet** : ~$0.10/session, ~400-800ms/fichier
- **Parallelise** (concurrence 5) : total ~1-3 secondes
- **Batch API** (overnight) : -50% cout

#### Integration dans REVU

- `src/core/scoring/ai-scorer.ts` — nouveau fichier (~100 lignes)
- Config dans `.revu/config.json` : `ai: { enabled, model, mergeWeights }`
- Stocke le resultat dans `ScoringOverride` existant (meme mecanisme que Alt+A)
- TUI : indicateur `[AI...]` pendant le scoring, remplace par le score quand pret
- Le `rescore()` existant gere deja les overrides — pas de changement TUI

#### Fusion des scores

```typescript
function mergeScores(heuristic: number, ai: AIScore): number {
  const aiWeight = 0.6 * ai.confidence;
  const heuristicWeight = 1.0 - aiWeight;
  return Math.min(10, heuristic * heuristicWeight + ai.score * aiWeight);
}
```

- Confidence 1.0 → 40% heuristique, 60% AI
- Confidence 0.3 → 82% heuristique, 18% AI
- L'heuristique ne descend jamais sous 40%

### Approche B — Learning from reviews (long terme)

#### Donnees disponibles

Chaque `.revu/reviews/{repo}_{branch}.json` contient les verdicts humains :
- `flag: 'ok' | 'bug' | 'question'` par ligne
- `comments: [{ text, time }]` par ligne
- `methods: Record<name, MethodReview>` par fichier

Quand un humain flagge `bug`, c'est un signal de supervision fort.

#### Pipeline de feedback

```
Humain review → flagge bug/ok/question
     ↓
Tuple extrait : (fileType, status, sigChanged, diffSnippet, verdict)
     ↓
Bug index enrichi (.revu/embeddings/bug-index.json)
     ↓
Poids heuristiques recalibres automatiquement
     ↓
Prochaine session : AI scoring utilise RAG + poids calibres
     ↓
Score plus precis → review plus rapide → plus de feedback
```

#### Step 1 — Extraction de tuples (1 jour)

`src/core/scoring/training-extractor.ts` — parcourt `.revu/reviews/`, genere :

```typescript
interface TrainingTuple {
  fileType: string;
  methodStatus: MethodStatus;
  signatureChanged: boolean;
  changeVolume: number;
  dependencyCount: number;
  diffSnippet: string;       // 10 premieres lignes
  humanVerdict: 'ok' | 'bug' | 'question' | 'unreviewed';
  hasComment: boolean;
  heuristicScore: number;
}
```

Commande CLI : `revu export-training` → JSON des tuples.

#### Step 2 — Calibration des poids (1 jour)

`src/core/scoring/calibrator.ts` — analyse les tuples :

1. Calculer le taux de bugs par `fileType` → ajuster `scoring.fileTypes`
2. Correler bugs avec `changeVolume` → ajuster `weights.changeVolume`
3. Correler bugs avec `dependencyCount` → ajuster `weights.dependencies`
4. Correler bugs avec `signatureChanged` → ajuster poids sigWeight dans methode

Commande : `revu calibrate` → propose les ajustements, demande confirmation.

**Prerequis** : minimum 50 reviews avec > 10 bugs flagges pour que la calibration soit significative.

#### Step 3 — RAG sur bugs passes (2-3 jours)

Quand un bug est flagge :
1. Generer un embedding du diff via l'API
2. Stocker dans `.revu/embeddings/bug-index.json`

Avant de scorer un fichier :
1. Chercher les K bugs les plus similaires (cosine similarity)
2. Injecter dans le prompt AI :

```
SIMILAR PAST BUGS IN THIS CODEBASE:
1. [auth.guard.ts] canActivate — "Missing null check on token.sub" (similarity: 0.87)
2. [user.service.ts] findByEmail — "SQL injection unsanitized" (similarity: 0.82)
```

Le modele utilise ces patterns passes pour mieux scorer sans fine-tuning.

#### Pas de fine-tuning

Raisons :
- Volume insuffisant (une equipe produit ~200 reviews/an, il en faut des milliers)
- Pas de fine-tuning Claude via API
- Le RAG suffit avec 50-100 bugs annotes
- Un modele fine-tune doit etre re-entraine quand le codebase evolue. Le RAG s'adapte naturellement.

### Phases de maturite

| Phase | Reviews | Strategie |
|---|---|---|
| 0-50 | Insuffisant | Scoring statistique v2 seul |
| 50-200 | Debut calibration | Prompt-based AI (Approche A) + calibration par fileType |
| 200+ | RAG operationnel | RAG sur bugs passes + calibration complete des 7 poids |

---

## Ordre d'implementation global

| Step | Axe | Quoi | Effort |
|---|---|---|---|
| 1 | Stat | Types + config (3 nouveaux weights) | 30 min |
| 2 | Stat | `content-signals.ts` (10 fonctions pures) | 2h |
| 3 | Stat | Refactor `criticality.ts` → v2 | 1h |
| 4 | Stat | Adapter `engine.ts` (passer allFiles + links) | 1h |
| 5 | Stat | Verification + calibration manuelle | 30 min |
| 6 | IA | `ai-scorer.ts` (prompt, appel API, fusion) | 2h |
| 7 | IA | Config AI dans `.revu/config.json` | 30 min |
| 8 | IA | Integration TUI (indicateur AI, rescore) | 1h |
| 9 | IA | `training-extractor.ts` | 1h |
| 10 | IA | `calibrator.ts` | 2h |
| 11 | IA | RAG bug index + enrichissement prompt | 3h |

**Total Axe 1** : ~5h
**Total Axe 2** : ~9h30

---

## Fichiers touches

| Fichier | Changement |
|---|---|
| `src/core/types.ts` | 3 nouveaux champs dans `ScoringWeights` |
| `src/core/scoring/config.ts` | Defaults reequilibres |
| `src/core/scoring/content-signals.ts` | **Nouveau** — 10 fonctions pures |
| `src/core/scoring/criticality.ts` | Formule v2 (3 couches) |
| `src/core/engine.ts` | Passer allFiles + links a enrichWithDependencies |
| `src/core/scoring/ai-scorer.ts` | **Nouveau** — prompt, API, fusion |
| `src/core/scoring/training-extractor.ts` | **Nouveau** — extraction tuples |
| `src/core/scoring/calibrator.ts` | **Nouveau** — calibration poids |
| `.revu/config.json` | Section `ai` + nouveaux weights |
