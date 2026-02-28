# REVU — Brief Produit Complet
## Terminal Code Review pour architectures multi-services

---

## 1. Vision

REVU est un éditeur de code review en terminal, spécialisé pour les architectures multi-services (NestJS/Angular). Trois volets synchronisés : arborescence, diff, contexte. Tout est corrélé — sélectionner un bout de code met à jour les trois panneaux simultanément.

L'objectif : **voir le critique d'abord, reviewer vite, exporter pour Claude**.

```
┌─ EXPLORER ─────────────┐┌─ DIFF ─────────────────────────────┐┌─ CONTEXT ──────────────┐
│ ◈ certificall-api      ││                                    ││                        │
│   feature/CER-247      ││  develop        │  CER-247         ││  Résumé ou détail      │
│                        ││                 │                   ││  contextuel selon      │
│  Arborescence des      ││  Side-by-side   │  avec scoring     ││  le focus courant      │
│  fichiers modifiés     ││  diff           │  par ligne        ││                        │
│  avec scores           ││                 │                   ││  Chunks, dépendances,  │
│                        ││                 │                   ││  review summary        │
└────────────────────────┘└─────────────────────────────────────┘└────────────────────────┘
 develop ↔ feature/CER-247      Tab ↑↓ Enter c [/] q                            ✓ 12/34
```

---

## 2. Architecture locale

### Structure du projet

```
certificall/                      ← racine, REVU vit ici
├── .revu/
│   ├── config.json               ← règles de criticité projet
│   └── reviews/
│       ├── api_CER-247.json      ← état review par (repo, branche)
│       ├── front_CER-247.json
│       └── trust_CER-247.json
├── certificall-api/              ← repo git
├── certificall-front/            ← repo git
├── certificall-trust/            ← repo git
├── certificall-auth/             ← sur develop → pas affiché
└── certificall-common/           ← sur develop → pas affiché
```

### Démarrage

```bash
cd certificall/
npx revu
```

Au lancement :

1. Scanner tous les sous-dossiers contenant `.git`
2. Pour chaque repo, lire la branche courante (`git branch --show-current`)
3. **N'afficher que les repos dont la branche ≠ develop**
4. Pour chaque repo visible, calculer le diff : `git diff develop...HEAD`
5. Charger le fichier de review correspondant dans `.revu/reviews/`
6. Construire l'arbre, calculer les scores, ouvrir le TUI

### Sélection de branche

Par défaut : branche courante de chaque repo.
Changement manuel : `Alt+B` sur un repo dans l'explorer → liste des branches → sélection.
La comparaison est toujours contre `develop`.

---

## 3. Les trois panneaux

### 3.1 — EXPLORER (gauche)

Arborescence des dossiers et fichiers modifiés uniquement. Rien d'autre.

#### Structure affichée

```
◈ certificall-api                    6.2    ← repo (galaxie)
  feature/CER-247                           ← branche courante
  ▸ src/consumption/                 5.8    ← dossier (score = max enfants)
    C consumption.controller.ts      5.5    ← fichier avec badge type
    S consumption.service.ts         6.8
    T consumption.service.spec.ts    1.2
    ▸ dto/                           2.8
      D stats.dto.ts                 3.0
      D stats-query.dto.ts           1.8
  ▸ src/billing/                     4.5
    S billing.service.ts          ⚡  4.5    ← side-effect
◈ certificall-trust                  8.5
  feature/CER-247
  ▸ src/trust/                       8.5
    S trust-score.service.ts         8.5
    M crypto.module.ts               9.2
    ▸ dto/                           2.8
      D score.dto.ts                 2.8
```

#### Badges type

| Badge | Type | Couleur |
|-------|------|---------|
| `C` | Controller | vert `#4ec9b0` |
| `S` | Service | bleu `#569cd6` |
| `M` | Module | violet `#c586c0` |
| `Co` | Component | rouge `#f14c4c` |
| `D` | DTO / Interface | cyan `#9cdcfe` |
| `G` | Guard | orange `#cca700` |
| `I` | Interceptor | orange `#cca700` |
| `P` | Pipe | rose `#c586c0` |
| `T` | Test (spec) | vert dim |

#### Score de criticité

Affiché aligné à droite de chaque ligne, coloré par seuil :
- `≥ 7.0` → rouge (critique, review obligatoire)
- `≥ 4.5` → orange (attention)
- `≥ 2.5` → bleu (normal)
- `< 2.5` → vert (mineur)

Score d'un dossier = max des scores de ses enfants.
Score d'un repo = max des scores de ses dossiers.

#### Indicateurs visuels de l'état de review

Chaque fichier et dossier affiche son état de review :

```
  ✓ C consumption.controller.ts    5.5    ← entièrement reviewé (toutes les lignes)
  ◐ S consumption.service.ts       6.8    ← partiellement reviewé
    S trust-score.service.ts       8.5    ← pas encore reviewé
  ⚡ S billing.service.ts           4.5    ← side-effect non reviewé
```

| Indicateur | Signification |
|-----------|---------------|
| `✓` (vert) | Toutes les lignes modifiées sont checkées |
| `◐` (jaune) | Au moins une ligne checkée, mais pas toutes |
| ` ` (rien) | Aucune ligne reviewée |
| `⚡` (orange) | Fichier impacté par side-effect |

Les fichiers entièrement reviewés sont **visuellement atténués** (couleur dim) pour que l'œil se concentre naturellement sur ce qui reste à faire.

#### Navigation

| Touche | Action |
|--------|--------|
| `↑` `↓` | Monter / descendre dans l'arbre |
| `Enter` | Ouvrir le fichier dans le diff (centre) |
| `→` | Déplier un dossier / ouvrir fichier |
| `←` | Replier un dossier / remonter au parent |
| `Alt+B` | Changer de branche (sur un repo) |

#### Comportement au focus

Naviguer dans l'explorer met à jour **le volet droit en temps réel** :
- Focus sur un **repo** → volet droit = **Review Summary** (résumé global)
- Focus sur un **dossier** → volet droit = **liste de tous les chunks** du dossier
- Focus sur un **fichier** → volet droit = **chunks du fichier + dépendances (USED BY)**
- `Enter` sur un fichier → en plus, le **volet centre** s'ouvre sur le diff du fichier

---

### 3.2 — DIFF (centre)

Diff side-by-side façon IntelliJ. Develop à gauche, branche courante à droite.

#### Layout

```
┌─ consumption.controller.ts ─── develop ↔ CER-247 ────── 5.5 ─┐
│                                                                │
│── getStats (Nouveau endpoint GET /stats) ──────────────── 5.5 │
│                                                                │
│  develop                    │  feature/CER-247                 │
│  24   @ApiTags('consump…    │  24   @ApiTags('consump…         │
│  25   export class Consu…   │  25   export class Consu…        │
│  26     constructor(priv…   │  26     constructor(priv…        │
│                             │  28 + @Get('stats')       2.0 ○ │
│                             │  29 + @UseGuards(Admin…   3.5 ○ │
│                             │  30 + async getStats(…    5.5 ○ │
│                             │  31 +   return this.sv…   4.0 ○ │
│                             │  32 + }                   0.5 ○ │
│                                                                │
│── getQuotas (Signature modifiée — retour changé) ──────── 6.2 │
│                                                                │
│  42   @Get('quotas/:id')    │  42   @Get('quotas/:id')        │
│  43 - …: Promise<QuotaDto…  │  43 + …: Promise<QuotaSta… 6.2 │
│            ▔▔▔▔▔▔▔▔▔▔▔      │            ▔▔▔▔▔▔▔▔▔▔▔▔▔       │
│  44     const company = …   │  44     const company = …       │
│  45 - return company.quo…   │  45 + const usage = awai…  4.5 │
│         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔    │  46 + return { quotas,…   5.8 │
│  46   }                     │  47   }                         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

#### Regroupement par hunk/méthode

Les diffs ne sont pas un flux plat de lignes. Ils sont **découpés par méthode/fonction** modifiée. Chaque hunk a :
- Un header : `── methodName (description) ──── score`
- Le diff des lignes de cette méthode
- Une séparation visuelle avant le hunk suivant

Les hunks sont triés par **criticité décroissante** : le plus critique apparaît en premier.

#### Numéros de ligne

Chaque côté (develop / branch) a ses propres numéros de ligne, alignés.

#### Indicateurs par ligne

Côté droit (branche review) :

```
  30 + async getStats(@Query() q: StatsQueryDto): Promise<StatsResponseDto> {   5.5 ○
  │  │ │                                                                         │   │
  │  │ │                                                                         │   └ review: ○ (pas vu) ou ✓ (ok) ou ✗ (bug) ou ? (question)
  │  │ │                                                                         └ score criticité de la ligne
  │  │ └ code
  │  └ + (ajout) ou - (suppression) ou   (contexte)
  └ numéro de ligne
```

#### Contraste progressif (feature clé)

Les lignes ne sont pas toutes affichées avec la même intensité. L'intensité visuelle est proportionnelle à la criticité :

| Criticité ligne | Fond | Texte | Effet |
|----------------|------|-------|-------|
| `≥ 7.0` | fond rouge/vert **intense** | blanc, bold | frappe immédiatement l'œil |
| `5.0 – 7.0` | fond rouge/vert moyen | bright | visible clairement |
| `2.5 – 5.0` | fond rouge/vert subtil | text normal | visible mais discret |
| `< 2.5` | fond minimal | dim | presque invisible, ne distrait pas |
| contexte | pas de fond | dim | disparaît visuellement |

Résultat : en scrollant le diff, **l'œil est naturellement attiré par les parties critiques**. Un changement de type de retour (`Promise<QuotaDto[]>` → `Promise<QuotaStatsDto>`) est visuellement 3x plus intense qu'un ajout de commentaire JSDoc.

#### Word-level diff highlighting

Quand une ligne est supprimée puis remplacée, les tokens qui ont changé sont en **inverse vidéo** (texte inversé) pour les rendre immédiatement identifiables.

Exemple :
```
  43 -   async getQuotas(id): ████████████████ {       ← "Promise<QuotaDto[]>" en inverse rouge
  43 +   async getQuotas(id): ██████████████████ {     ← "Promise<QuotaStatsDto>" en inverse vert
```

L'œil voit directement que seul le type de retour a changé, sans lire le reste.

#### Lignes de signature (isSig)

Les lignes qui contiennent une **signature de méthode modifiée** ont un traitement spécial :
- Bordure gauche épaisse colorée par criticité
- Texte en bold
- Score toujours affiché
- Ces lignes sont **toujours visibles** même si le seuil de criticité est élevé

Raison : un changement de signature est toujours important car il impacte tous les appelants.

#### Navigation dans le diff

| Touche | Action |
|--------|--------|
| `↑` `↓` | Scroll ligne par ligne |
| `PgUp` `PgDown` | Scroll par 10 lignes |
| `{` `}` | Sauter au hunk précédent / suivant |
| `c` | Marquer la ligne courante comme reviewée (toggle ✓/○) |
| `x` | Marquer la ligne comme bug (toggle ✗/○) |
| `?` | Marquer comme question |
| `m` | Ouvrir l'input commentaire sur la ligne courante |
| `Enter` (dans input) | Valider le commentaire |
| `Esc` | Fermer l'input commentaire |

#### Commentaire inline

Quand l'utilisateur appuie sur `m` sur une ligne :

```
  43 + async getQuotas(id): Promise<QuotaStatsDto> {   6.2 ✗
  ╭─ commentaire ─────────────────────────────────────────────╮
  │ > Le retour a changé mais billing.service n'est pas adapté│
  ╰───────────────────────────────────────────────────────────╯
  44     const company = await this.companyRepo.findOne(id);
```

Les commentaires déjà posés sont visibles sous la ligne concernée, avec un fond subtil.

#### Sélection d'une ligne → mise à jour du contexte

Quand le curseur est sur une ligne qui contient un appel de méthode ou un type, le **volet droit** affiche automatiquement :
- La méthode appelée et son fichier
- Le score de criticité de cette dépendance
- Un lien cliquable (`Enter` dans le volet droit) pour naviguer vers ce fichier/ligne

---

### 3.3 — CONTEXT (droite)

Le volet le plus intelligent. Son contenu change **dynamiquement** selon le focus dans les deux autres volets.

#### Mode 1 : Review Summary (focus sur un repo)

Quand le focus est sur un nœud repo dans l'explorer (le plus haut niveau).

```
┌─ REVIEW SUMMARY ──────────────┐
│                                │
│ ◈ certificall-api              │
│ feature/CER-247 ↔ develop      │
│                                │
│ 6 fichiers · 3 signatures      │
│ +312 lignes · -45 lignes       │
│ 18/34 lignes reviewées (53%)   │
│                                │
│ ─── CRITIQUE (≥7) ──────────  │
│ 9.2 crypto.module.ts           │
│     verifySignature  sig ⚠     │
│ 8.5 trust-score.service.ts     │
│     calculateScore  sig ⚠      │
│                                │
│ ─── ATTENTION (≥4.5) ───────  │
│ 6.8 consumption.service.ts     │
│     getQuotas  sig ⚠           │
│ 5.5 consumption.controller.ts  │
│     getStats  new              │
│ 5.2 consumption.service.ts     │
│     computeStats  new          │
│ 4.5 billing.service.ts  ⚡     │
│     syncQuotas  impacted       │
│                                │
│ ─── SIDE-EFFECTS ────────────  │
│ ⚡ billing.service.ts           │
│   syncQuotas() consomme        │
│   getQuotas() dont le retour   │
│   a changé                     │
│                                │
│ ─── FLAGGED ─────────────────  │
│ ✗ getQuotas (ctrl)  bug        │
│ ? syncQuotas (billing)  quest  │
│                                │
└────────────────────────────────┘
```

Ce résumé liste **tous les changements de la review triés par criticité**, avec les side-effects et les flags posés. C'est le point d'entrée naturel quand on ouvre l'outil.

Navigation : `↑↓` pour sélectionner un chunk, `Enter` pour sauter au fichier/ligne correspondant dans le diff.

#### Mode 2 : Dossier (focus sur un dossier)

```
┌─ CONTEXT ─────────────────────┐
│                                │
│ 📁 src/consumption/      5.8   │
│ 4 fichiers · 2 sig changed     │
│ +190 lignes                    │
│                                │
│ ─── CHANGES (4/6) ──────────  │
│ 6.8 service.ts → getQuotas    │
│     Sig + retour modifié       │
│ 6.2 controller.ts → getQuotas │
│     Signature modifiée         │
│ 5.5 controller.ts → getStats  │
│     Nouveau endpoint GET       │
│ 5.2 service.ts → computeStats │
│     Nouvelle méthode           │
│                                │
│ (2 chunks masqués, crit < 2.5) │
│                                │
└────────────────────────────────┘
```

Le nombre `(4/6)` indique que 4 chunks sont affichés sur 6 totaux (les 2 masqués sont sous le seuil de criticité).

#### Mode 3 : Fichier (focus sur un fichier)

```
┌─ CONTEXT ─────────────────────┐
│                                │
│ S consumption.service.ts  6.8  │
│ src/consumption/               │
│ +112 -23 · 2 hunks             │
│ 8/15 lignes reviewées (53%)    │
│                                │
│ ─── CHANGES ─────────────────  │
│▶6.8 getQuotas                  │
│     ~mod · sig ⚠ · untested    │
│     Sig + retour modifié       │
│ 5.2 computeStats               │
│     +new · untested            │
│     Nouvelle agrégation        │
│                                │
│ ─── USED BY ─────────────────  │
│ → controller.ts                │
│   getStats() injects           │
│   computeStats                 │
│ → billing.service.ts  ⚡       │
│   syncQuotas() consumes        │
│   getQuotas()                  │
│                                │
│ ─── FLAGS ───────────────────  │
│ ✗ getQuotas L78  "retour a     │
│   changé mais billing pas      │
│   adapté"                      │
│                                │
└────────────────────────────────┘
```

#### Mode 4 : Ligne de code (focus dans le diff)

Quand le curseur est sur une ligne spécifique dans le diff :

```
┌─ CONTEXT ─────────────────────┐
│                                │
│ L98: this.trustSvc.            │
│      calculateScore(…)    7.0  │
│                                │
│ ─── TARGET ──────────────────  │
│ S trust-score.service.ts  8.5  │
│ calculateScore()               │
│ ~mod · sig ⚠ · crit 8.5       │
│                                │
│ Signature changée :            │
│ - (photoId): Promise<number>   │
│ + (photoId, opts?):            │
│   Promise<TrustScoreResult>    │
│                                │
│ ─── ALSO CALLS ──────────────  │
│ → crypto.module.ts  9.2        │
│   verifySignature()  sig ⚠     │
│                                │
│ ─── CALLED BY ───────────────  │
│ → consumption.service.ts       │
│   computeStats() L98           │
│                                │
│ Enter: aller au fichier        │
│                                │
└────────────────────────────────┘
```

Ce mode est déclenché quand le curseur est sur une ligne contenant un appel identifiable (détecté par analyse statique). Le volet affiche la cible de l'appel, sa signature, ses dépendances.

---

## 4. Navigation globale et historique

### Historique de navigation

Chaque changement de fichier/ligne est empilé dans un historique :

| Touche | Action |
|--------|--------|
| `Alt+←` | Retour arrière dans l'historique |
| `Alt+→` | Avancer dans l'historique |

Comme dans un navigateur ou IntelliJ. Si tu navigues vers `billing.service.ts` via le volet contexte, puis tu veux revenir où tu étais : `Alt+←`.

### Raccourcis globaux

| Touche | Action |
|--------|--------|
| `Tab` | Panel suivant (explorer → diff → contexte → explorer) |
| `Shift+Tab` | Panel précédent |
| `Alt+C` | Ouvrir le sélecteur de seuil de criticité (prompt numérique) |
| `[` / `]` | Baisser / monter le seuil de criticité par pas de 0.5 |
| `Alt+B` | Changer de branche (sur le repo sélectionné) |
| `Alt+S` | Aller au Review Summary (focus repo) |
| `/` | Recherche de fichier (fuzzy) |
| `q` | Quitter |

### Corrélation des trois panneaux

Règle fondamentale : **toute action dans un panneau met à jour les autres**.

| Action | Explorer | Diff | Contexte |
|--------|----------|------|----------|
| `↑↓` dans explorer | se déplace | inchangé | se met à jour |
| `Enter` dans explorer | sélectionne | ouvre le diff | se met à jour |
| `↑↓` dans diff | suit le fichier | scroll | se met à jour si la ligne a un lien |
| `Enter` dans contexte | sélectionne le fichier | navigue au fichier/ligne | reste |
| `Alt+←` | suit | revient | suit |

---

## 5. Système de review

### Marquage des lignes

Chaque ligne modifiée (add/del) peut être marquée :

| Marqueur | Touche | Icône | Signification |
|----------|--------|-------|---------------|
| reviewed | `c` | `✓` | La ligne est ok |
| bug | `x` | `✗` | Bug détecté, à corriger |
| question | `?` | `?` | Question pour le dev |
| commentaire | `m` | `💬` | Ouvre l'input commentaire |

Un toggle : appuyer deux fois sur `c` enlève le ✓.

### Commentaires

Appui sur `m` → un input apparaît sous la ligne dans le diff.

```
  43 + async getQuotas(id): Promise<QuotaStatsDto> {   6.2 ✗
  ╭─────────────────────────────────────────────────────────╮
  │ 15:28 Le retour a changé mais billing n'est pas adapté  │
  ╰─────────────────────────────────────────────────────────╯
  ╭─ > ─────────────────────────────────────────────────────╮
  │ █                                                        │
  ╰─ Enter: envoyer · Esc: annuler ─────────────────────────╯
```

Plusieurs commentaires possibles sur la même ligne — ils s'empilent.

### Progression

La barre de statut en bas affiche en permanence :

```
 develop ↔ CER-247  ✓ 18/34 (53%)  ✗ 2 bugs  ? 1 question  💬 5 comments   crit≥2.5
```

---

## 6. Persistance — fichier de review

### Emplacement

```
.revu/reviews/{repo-name}_{branch-sanitized}.json
```

Exemple : `.revu/reviews/certificall-api_CER-247-consumption-dashboard.json`

### Chargement

Au démarrage :
1. Pour chaque repo affiché (branche ≠ develop)
2. Chercher le fichier `.revu/reviews/{repo}_{branch}.json`
3. Si trouvé → restaurer tous les marqueurs, commentaires, progression
4. Si non trouvé → créer à la première interaction

### Sauvegarde

**Auto-save** après chaque action (check, flag, commentaire). Pas de bouton "sauvegarder".

### Structure du fichier

```json
{
  "version": 1,
  "tool": "revu",
  "repo": "certificall-api",
  "branch": "feature/CER-247-consumption-dashboard",
  "baseBranch": "develop",
  "createdAt": "2026-02-28T10:00:00Z",
  "updatedAt": "2026-02-28T15:30:00Z",
  "critConfig": ".revu/config.json",
  "stats": {
    "totalLines": 34,
    "reviewedLines": 18,
    "bugs": 2,
    "questions": 1,
    "comments": 5
  },
  "files": {
    "src/consumption/consumption.controller.ts": {
      "status": "partial",
      "lines": {
        "28": { "flag": "ok" },
        "29": { "flag": "ok" },
        "30": { "flag": "ok" },
        "31": { "flag": "ok" },
        "32": { "flag": "ok" },
        "43": {
          "flag": "bug",
          "comments": [
            {
              "text": "Le retour a changé de QuotaDto[] à QuotaStatsDto mais le swagger n'est pas mis à jour. Il faut ajouter @ApiResponse avec le bon type.",
              "author": "gregoire",
              "time": "2026-02-28T15:25:00Z"
            }
          ]
        },
        "46": {
          "flag": "ok",
          "comments": [
            {
              "text": "Le destructuring est propre. Vérifier que remaining est bien calculé côté service.",
              "author": "gregoire",
              "time": "2026-02-28T15:26:00Z"
            }
          ]
        }
      }
    },
    "src/consumption/consumption.service.ts": {
      "status": "partial",
      "lines": {
        "78": {
          "flag": "bug",
          "comments": [
            {
              "text": "Le paramètre period est optional mais computeUsage() ne gère pas le cas undefined. Ajouter un fallback.",
              "author": "gregoire",
              "time": "2026-02-28T15:28:00Z"
            }
          ]
        },
        "98": {
          "flag": "question",
          "comments": [
            {
              "text": "calculateScore fait un appel gRPC par company. Sur 200 companies ça fait 200 appels. Batch possible ?",
              "author": "gregoire",
              "time": "2026-02-28T15:30:00Z"
            }
          ]
        }
      }
    },
    "src/billing/billing.service.ts": {
      "status": "not_started",
      "sideEffect": true,
      "lines": {}
    }
  }
}
```

### Objectif : export vers Claude Code CLI

Ce fichier JSON est conçu pour être envoyé à Claude Code CLI pour une review automatisée complémentaire.

Commande type :

```bash
claude-code review \
  --context .revu/reviews/certificall-api_CER-247.json \
  --rules .revu/config.json \
  --repo ./certificall-api
```

Claude Code reçoit :
1. Le fichier de review avec les flags et commentaires humains déjà posés
2. Les règles de criticité projet
3. Accès au repo pour lire le code complet

Claude peut alors :
- Confirmer ou nuancer les bugs flaggés
- Détecter des bugs non vus par le reviewer
- Suggérer des tests manquants
- Valider que les side-effects sont gérés
- Répondre aux questions posées dans les commentaires

Le JSON est structuré pour que Claude comprenne immédiatement le contexte : quel fichier, quelle ligne, quel flag, quel commentaire.

---

## 7. Configuration de criticité

### Fichier `.revu/config.json`

```json
{
  "version": 1,
  "stack": "nestjs-angular",
  "scoring": {
    "weights": {
      "fileType": 0.25,
      "changeVolume": 0.25,
      "dependencies": 0.25,
      "securityContext": 0.25
    },
    "fileTypes": {
      "module": 1.0,
      "guard": 0.9,
      "interceptor": 0.8,
      "service": 0.8,
      "controller": 0.7,
      "component": 0.5,
      "pipe": 0.4,
      "dto": 0.3,
      "interface": 0.2,
      "spec": 0.1,
      "html": 0.1,
      "scss": 0.05
    },
    "securityKeywords": {
      "high": ["crypto", "auth", "guard", "security", "signature", "certificate", "eidas", "c2pa", "qts", "private.key", "secret"],
      "medium": ["billing", "payment", "subscription", "quota", "trust", "score", "verify"],
      "low": ["config", "env", "migration"]
    },
    "securityBonus": {
      "high": 0.5,
      "medium": 0.3,
      "low": 0.1
    },
    "lineCriticality": {
      "signatureChange": 2.0,
      "returnTypeChange": 1.8,
      "parameterChange": 1.5,
      "guardDecorator": 1.3,
      "newDependencyInjection": 1.2,
      "errorHandling": 1.0,
      "regularCode": 0.5,
      "comment": 0.1,
      "import": 0.1,
      "whitespace": 0.0
    }
  },
  "rules": {
    "alwaysShow": [
      "Tout changement de signature de méthode publique",
      "Tout fichier dans un dossier contenant 'crypto', 'auth', 'guard'",
      "Toute modification de Guard ou Interceptor"
    ],
    "sideEffectDetection": true,
    "minCritForDisplay": 0
  }
}
```

### Calcul de criticité par fichier

```
score_fichier = (
  poids_type × weights.fileType +
  min(1, (add + del) / 200) × weights.changeVolume +
  min(1, nb_dependants / 10) × weights.dependencies +
  bonus_securite × weights.securityContext
) × 10
```

### Calcul de criticité par ligne

```
score_ligne = score_fichier × multiplicateur_ligne
```

Où `multiplicateur_ligne` vient de `lineCriticality` :
- Changement de signature : `× 2.0`
- Changement de type de retour : `× 1.8`
- Code normal : `× 0.5`
- Commentaire : `× 0.1`

### Personnalisation

Le fichier `config.json` est versionné avec le projet. L'équipe peut :
- Ajuster les poids par type de fichier (ex: les Guards plus critiques dans leur projet)
- Ajouter des mots-clés de sécurité propres à leur domaine
- Définir des règles "toujours afficher"
- Modifier les multiplicateurs par type de ligne

À terme, Claude pourra générer ce fichier à partir d'une description du projet et de sa stack.

---

## 8. Détection automatique (analyse statique)

### Ce que REVU détecte sans IA

| Détection | Méthode | Exemple |
|-----------|---------|---------|
| Imports | Regex/AST sur `import { X } from` | Lien entre fichiers |
| Injections NestJS | `constructor(private x: XService)` | Lien inject |
| Endpoints HTTP | `@Get()`, `@Post()`, etc. | Label du lien |
| Appels HTTP Angular | `this.http.get<Type>(url)` | Lien cross-service |
| Types/DTO | Import de types/interfaces | Lien type |
| Changement de signature | Diff de la ligne `async methodName(...)` | Flag isSig |
| Changement de type retour | Diff sur `Promise<X>` → `Promise<Y>` | Multiplicateur crit |
| Side-effects | Fichier non modifié qui consomme une méthode dont la signature a changé | Flag ⚡ |
| Tests | Présence de `*.spec.ts` correspondant | Indicateur tested/untested |

### Parser

`@typescript-eslint/parser` pour l'AST TypeScript.
Fallback regex pour les cas simples (imports, décorateurs).

---

## 9. Stack technique

### Runtime

- **Node.js** (≥ 18)
- **TypeScript**
- **Ink** (React pour terminal) — rendu TUI
- **tsx** — exécution TypeScript directe

### Modules principaux

| Module | Rôle |
|--------|------|
| `ink` | Framework TUI (React) |
| `@typescript-eslint/parser` | Analyse AST |
| `child_process` | Appels git |
| `chokidar` | Watch sur les fichiers (live reload) |
| `fs/path` | Lecture fichiers, gestion `.revu/` |

### Lancement

```bash
npx revu                    # lance sur le dossier courant
npx revu --path ./project   # lance sur un dossier spécifique
npx revu --crit 3.0         # seuil de criticité initial
npx revu --export review.md # exporte la review en markdown
```

---

## 10. Export

### Export Markdown

Commande : `npx revu --export` ou touche `Alt+E` dans l'outil.

Produit un fichier `.revu/exports/{repo}_{branch}_{date}.md` :

```markdown
# Code Review — certificall-api
## feature/CER-247-consumption-dashboard ↔ develop
**Date** : 2026-02-28 15:30
**Progression** : 18/34 lignes (53%)
**Bugs** : 2 · **Questions** : 1

---

### 🔴 consumption.controller.ts (5.5) — partiel

#### getQuotas — signature modifiée (6.2) ✗ BUG
```diff
- async getQuotas(id: string): Promise<QuotaDto[]> {
+ async getQuotas(id: string): Promise<QuotaStatsDto> {
```
> **Bug** : Le retour a changé de QuotaDto[] à QuotaStatsDto mais le swagger
> n'est pas mis à jour. Ajouter @ApiResponse avec le bon type.

---

### 🟡 consumption.service.ts (6.8) — partiel

#### getQuotas — signature + retour modifié (6.8) ✗ BUG
```diff
- async getQuotas(companyId: string): Promise<QuotaDto[]> {
+ async getQuotas(companyId: string, period?: DateRange): Promise<QuotaStatsDto> {
```
> **Bug** : Le paramètre period est optional mais computeUsage() ne gère pas
> le cas undefined. Ajouter un fallback.

#### computeStats — nouvelle méthode (5.2) ? QUESTION
L98:
```typescript
companies.map(c => this.trustSvc.calculateScore(c.lastPhotoId))
```
> **Question** : calculateScore fait un appel gRPC par company. Sur 200
> companies ça fait 200 appels. Batch possible ?

---

### ⚡ billing.service.ts (4.5) — side-effect, non reviewé

syncQuotas() consomme getQuotas() dont le retour a changé de
`QuotaDto[]` à `QuotaStatsDto`.
```

Ce markdown est directement utilisable comme :
- Input pour Claude Code CLI
- Commentaire de PR sur GitHub/GitLab
- Document de review à partager avec l'équipe

---

## 11. Hors scope MVP

- Intégration GitHub/GitLab (PR comments, webhooks)
- Review par Claude intégrée dans l'outil (v1.2)
- Collaboration multi-reviewers en temps réel
- Support d'autres langages que TypeScript
- Comparaison avec une branche autre que develop (sauf sélection manuelle)
- Watch mode (live reload quand le dev commit)
- Mouse tracking (hover TUI) — v1.1

---

## 12. Roadmap post-MVP

| Phase | Fonctionnalité |
|-------|---------------|
| **v1.1** | Mouse tracking (hover = update contexte), resize dynamique |
| **v1.2** | Claude Code integration : review automatisée, réponses aux questions |
| **v1.3** | Export vers GitHub/GitLab PR comments |
| **v1.4** | Watch mode : refresh automatique quand le dev modifie le code |
| **v1.5** | Support multi-langages (Python, Go, Rust) |
| **v2.0** | Version web (companion) avec la mind map spatiale de REVU v9 |

---

## 13. Référence visuelle

Le fichier `revu-editor.jsx` est le prototype React web de référence pour le design visuel (couleurs, contraste, layout). Le fichier `revu-tui/src/index.tsx` est le prototype Ink fonctionnel.

Les deux prototypes utilisent des données mockées. L'implémentation réelle remplace les données statiques par l'analyse git + AST.
