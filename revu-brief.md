# REVU — Brief Produit Complet

## Vision

REVU est un outil de code review visuel et spatial pour architectures multi-services. Il représente une review comme un univers spatial où chaque service est une galaxie, chaque dossier un système, et chaque fichier une planète. L'objectif : **reviewer sans lire, lire en second**.

L'outil est pensé pour un développeur solo qui review du code sur plusieurs repos simultanément (NestJS, Angular, multi-services). Il fonctionne en local, à la racine du projet.

## Vocabulaire

| Terme | Concept | Équivalent technique |
|-------|---------|---------------------|
| **Univers** | La review complète | Ensemble des repos modifiés pour un ticket |
| **Galaxie** | Un repo / service | `certificall-api`, `certificall-front`, etc. |
| **Système** | Un dossier | `src/consumption/`, `src/trust/dto/` |
| **Planète** | Un fichier modifié | `consumption.service.ts` |
| **Orbite** | Les méthodes/constantes d'un fichier | Contenu visible au zoom |
| **Lien** | Une connexion entre fichiers | Import, HTTP, gRPC, injection, type |

---

## Architecture locale

### Structure du projet

```
certificall/                    ← racine du projet, REVU vit ici
├── .revu/                      ← données REVU
│   ├── config.json             ← configuration globale
│   └── reviews/                ← état des reviews
│       ├── api_CER-247.json
│       ├── front_CER-247.json
│       └── trust_CER-247.json
├── certificall-api/            ← repo git (galaxie)
├── certificall-front/          ← repo git (galaxie)
├── certificall-trust/          ← repo git (galaxie)
├── certificall-auth/           ← repo git (sur develop → pas affiché)
└── certificall-common/         ← repo git (sur develop → pas affiché)
```

### Détection automatique

Au démarrage, REVU :

1. Scanne tous les sous-dossiers contenant un `.git`
2. Pour chaque repo, lit la branche courante (`git branch --show-current`)
3. **Affiche uniquement les galaxies dont la branche courante ≠ develop**
4. Compare automatiquement : `branche courante` vs `develop`
5. Charge le fichier de review correspondant s'il existe dans `.revu/reviews/`

### Sélection de branche

Par défaut, chaque galaxie utilise sa branche courante. L'utilisateur peut manuellement choisir une autre branche au niveau de la galaxie. La comparaison se fait toujours contre `develop`.

Chaque galaxie affiche dans son header :
- Le nom du service
- La branche courante (ex: `feature/CER-247-consumption-dashboard`)

---

## Stockage des reviews

### Fichier de review

Un fichier JSON par couple (repo, branche), stocké dans `.revu/reviews/`.

Nommage : `{nom-du-repo}_{nom-de-branche-sanitized}.json`

Exemple : `certificall-api_CER-247-consumption-dashboard.json`

### Structure du fichier

```json
{
  "version": 1,
  "repo": "certificall-api",
  "branch": "feature/CER-247-consumption-dashboard",
  "baseBranch": "develop",
  "createdAt": "2026-02-27T10:00:00Z",
  "updatedAt": "2026-02-27T15:30:00Z",
  "files": {
    "src/consumption/consumption.controller.ts": {
      "flag": "ok",
      "methods": {
        "getStats": {
          "flag": "ok",
          "comments": [
            { "text": "Bien pensé le AdminGuard", "time": "15:20" }
          ],
          "actions": [
            { "text": "Vérifier la validation du query DTO", "done": true },
            { "text": "Ajouter test d'intégration", "done": false }
          ]
        },
        "getQuotas": {
          "flag": "bug",
          "comments": [
            { "text": "Le retour a changé mais le swagger n'est pas mis à jour", "time": "15:25" }
          ],
          "actions": []
        }
      }
    },
    "src/billing/billing.service.ts": {
      "flag": "test",
      "methods": {
        "syncQuotas": {
          "flag": "bug",
          "comments": [
            { "text": "Ce service consomme getQuotas() dont le retour a changé — il va casser", "time": "15:28" }
          ],
          "actions": [
            { "text": "Adapter le mapping du nouveau retour QuotaStatsDto", "done": false }
          ]
        }
      }
    }
  }
}
```

### Chargement

Au démarrage de REVU :
1. Pour chaque galaxie visible (branche ≠ develop)
2. Chercher `.revu/reviews/{repo}_{branch}.json`
3. Si trouvé → charger les flags, commentaires, actions
4. Si non trouvé → créer un fichier vide à la première interaction

### Flags disponibles

| Flag | Icône | Signification | Applicable sur |
|------|-------|---------------|----------------|
| `ok` | ✓ | Approuvé, rien à signaler | Fichier, méthode |
| `bug` | ✗ | Bug détecté, à corriger | Fichier, méthode |
| `test` | ◉ | Test manquant à ajouter | Fichier, méthode |
| `question` | ? | Question pour le développeur | Fichier, méthode |

---

## Interface — Canvas spatial

### Principe fondamental

Tout vit dans un seul canvas 2D infini. Pas de panels, pas de modals, pas de volets. L'utilisateur navigue par pan (drag) et zoom (molette), comme Google Maps. Le niveau de détail affiché dépend du niveau de zoom.

### Zoom sémantique

| Niveau | Scale | Ce qui est visible |
|--------|-------|--------------------|
| **Univers** | < 0.35 | Galaxies (ellipses colorées) + labels repos + liens majeurs |
| **Galaxies** | 0.35 – 0.7 | Systèmes (cercles dossiers) + planètes (cercles fichiers) + labels liens |
| **Systèmes** | 0.7 – 1.3 | Méthodes/constantes sous chaque planète (preview) + tags factuels au hover |
| **Planètes** | > 1.3 | Toutes les méthodes visibles + indicateurs test/signature + plus de méthodes visibles |
| **Focus** | clic planète → zoom 2.0 | Panel détail sous la planète : diff, flags, commentaires, actions |

### Galaxies (repos)

- Forme : **ellipse** avec fond teinté de la couleur du repo
- Bordure : couleur du repo, opacité faible
- Label : nom du repo + branche courante, en haut à gauche de l'ellipse
- Couleurs repo :
  - Front (Angular) : rouge `#ef4444`
  - API (NestJS) : bleu `#3b82f6`
  - Trust (NestJS) : violet `#a78bfa`
  - Chaque nouveau repo détecté reçoit une couleur unique

### Systèmes (dossiers)

- Forme : **cercle** en pointillés, fond subtil
- Label : chemin du dossier (ex: `src/consumption/dto`)
- Au hover : label agrandi avec fond contrasté pour lisibilité
- Taille proportionnelle au nombre de fichiers modifiés qu'il contient

### Planètes (fichiers)

- Forme : **cercle** plein
- **Taille proportionnelle à la criticité** (crit 9.2 → plus gros que crit 2.0)
- **Couleur de la bordure gauche** = criticité (vert < 3 < bleu < 5 < orange < 7.5 < rouge)
- Score de criticité affiché au centre, taille proportionnelle
- Nom du fichier sous le score (word-break, jamais croppé)
- Badge type IntelliJ en haut à gauche :

| Type | Badge | Couleur |
|------|-------|---------|
| Controller | C | Vert |
| Service | S | Bleu |
| Module | M | Violet |
| Component | Co | Rouge |
| Guard | G | Orange |
| DTO | D | Cyan |
| Interceptor | I | Orange |
| Pipe | P | Rose |

- Indicateur test : petit point en haut à droite (vert = testé, rouge = pas de test)
- Flag de review : icône en bas à gauche si flaggé
- Fichiers side-effect : bordure en pointillés + badge ⚡
- Stats : `+additions -deletions` visible à partir de zoom 0.5

### Hover sur une planète

Popup léger affichant des **tags factuels** :
- `+3 fn` (nouvelles méthodes)
- `~2 mod` (méthodes modifiées)
- `⚠ 1 sig` (signature changée)
- `untested` (pas de fichier .spec correspondant)

### Focus sur une planète (clic)

Le clic sur une planète :
1. Anime le zoom vers scale 2.0, centré sur la planète
2. Ouvre un panel détail **sous** la planète (pas un panel latéral)
3. Le panel contient : header fichier, liste méthodes/constantes, et au clic sur une méthode : diff + outils de review

---

## Liens entre planètes

### Types de liens

| Type | Détection | Visuel | Label exemple |
|------|-----------|--------|---------------|
| **import** | `import { X } from './...'` | Trait fin, couleur dim | `import getStats` |
| **HTTP** | `this.http.get/post/put/delete(...)` | Trait moyen, cyan | `GET /stats` |
| **gRPC** | Appel de service distant via proto | Trait épais, violet | `gRPC calculateScore` |
| **inject** | `@Inject()` / constructeur NestJS | Trait moyen, bleu | `inject computeStats` |
| **type** | Import de DTO/interface | Trait fin, dim | `type StatsDto` |
| **side-effect** | Méthode consomme une méthode modifiée | Pointillés, orange | `inject getQuotas ⚡` |

### Propriétés visuelles des liens

- **Épaisseur proportionnelle au risque** : un lien vers une méthode à crit 9.2 est plus épais qu'un lien vers crit 3.0
  - crit < 5 : 1px
  - crit 5-7 : 1.8px
  - crit ≥ 7 : 2.5px + glow
- **Label du lien** : type + nom de méthode (ex: `GET /consumption/stats`, `inject verifySignature`)
- **Visibilité** : labels visibles à partir de zoom 0.4
- **Flèches directionnelles** : la flèche pointe vers le fichier appelé
- **Courbes de Bézier** : les liens ne sont pas droits, ils courvent pour éviter de se superposer
- **Liens cross-galaxie** : plus courbés, couleur plus vive
- **Liens critiques** (crit ≥ 7.5) : rouge, glow subtil, épaisseur maximale

### Hover — Trace et Blast Radius

Au survol d'une planète :
1. **Connexions directes** : restent visibles à opacité normale
2. **Planètes non connectées** : tombent à opacité 0.04
3. **Blast radius niveau 1** : planètes directement en aval → anneau orange vif
4. **Blast radius niveau 2** : planètes 2 niveaux en aval → anneau orange pâle
5. Limité à 2 niveaux pour ne pas saturer visuellement

---

## Détail d'une planète (panel focus)

### Header

- Badge type (IntelliJ style)
- Nom complet du fichier + extension
- Tags factuels (`+2 fn · ~1 mod · ⚠ sig · untested`)
- Score de criticité

### Liste des méthodes/constantes

Triées par criticité décroissante. Chaque ligne affiche :

- Indicateur de statut : `+` new (vert), `~` modified (orange), `⚡` impacted (orange), `·` unchanged (dim)
- Badge type : `fn`, `GET`, `POST`, `T` (type), `ct` (constante)
- Nom de la méthode
- Indicateur signature changée : `⚠sig` (rouge) si la signature a changé
- Indicateur test manquant : point rouge si crit ≥ 5 et pas de test
- Flag de review si posé
- Barre d'usages : longueur proportionnelle au nombre d'appels dans la codebase
- Compteur d'usages : `7×`
- Score de criticité

### Diff (au clic sur une méthode)

Le diff s'ouvre inline sous la méthode. Caractéristiques :

- **Word-level highlighting** : quand une ligne est supprimée puis remplacée, seuls les tokens modifiés sont en surbrillance
  - Exemple : `Promise<number>` → `Promise<TrustScoreResult>` → seul le type est surligné
- Lignes ajoutées : fond vert subtil, bordure gauche verte, préfixe `+`
- Lignes supprimées : fond rouge subtil, bordure gauche rouge, préfixe `-`
- Lignes contexte : pas de fond, préfixe espace
- Font : monospace 9.5px, line-height 17px
- Whitespace préservé (pre)

### Outils de review (sous le diff)

#### Flags

5 boutons toggle, un seul actif à la fois par méthode :
- ✓ OK (vert)
- ✗ Bug (rouge)
- ◉ Test needed (orange)
- ? Question (violet)

#### Actions (checklist manuelle)

- Input : `+ action à faire...`
- Chaque action ajoutée apparaît comme une checkbox
- Clic sur la checkbox = toggle done/undone
- Les actions done sont barrées et grises
- Exemples :
  - "Vérifier que BillingService gère le nouveau retour"
  - "Ajouter test pour sigValid === false"
  - "Mettre à jour le swagger"

#### Commentaires

- Input : `commentaire...` + bouton envoi (↵)
- Chaque commentaire affiché avec horodatage
- Fond subtil cyan, bordure gauche

### Actions au niveau fichier

En bas du panel, les 4 flags sont disponibles pour marquer le fichier entier.

---

## Calcul de criticité

### Formule par fichier

```
criticité_fichier = (
  poids_type × 0.3 +
  poids_changements × 0.3 +
  poids_dependances × 0.2 +
  poids_securite × 0.2
) × 10
```

#### Poids par type de fichier

| Type | Poids |
|------|-------|
| Module (crypto, auth) | 1.0 |
| Service | 0.8 |
| Controller | 0.7 |
| Guard / Interceptor | 0.6 |
| Component | 0.5 |
| DTO | 0.3 |
| HTML / SCSS | 0.1 |
| Spec (test) | 0.1 |

#### Poids par volume de changements

```
poids = min(1.0, (additions + deletions) / 200)
```

#### Poids par dépendances

```
poids = min(1.0, nombre_de_fichiers_qui_importent_ce_fichier / 10)
```

#### Poids sécurité

Bonus si le fichier ou ses dossiers parents contiennent des mots-clés :
- `crypto`, `auth`, `guard`, `security`, `signature`, `certificate` → +0.5
- `billing`, `payment`, `subscription` → +0.3
- `trust`, `score`, `verification` → +0.4

### Criticité par méthode

```
criticité_méthode = (
  criticité_fichier × 0.4 +
  nombre_usages_normalisé × 0.3 +
  signature_changée × 0.2 +
  contexte_sécurité × 0.1
) × 10
```

---

## Détection des liens (analyse statique)

Pas de Claude/IA en MVP. Tout se fait par analyse statique du code TypeScript.

### Imports

```typescript
// Détecte : import { ConsumptionService } from './consumption.service'
// Crée un lien "import" entre les deux fichiers
```

Parser : regex ou AST TypeScript (`@typescript-eslint/parser`)

### Injections NestJS

```typescript
// Détecte : constructor(private consumptionSvc: ConsumptionService)
// Crée un lien "inject" entre le controller/service et le service injecté
```

### Endpoints HTTP

```typescript
// Détecte : @Get('stats'), @Post('create'), etc.
// Associe au controller pour labelliser les liens
```

### Appels HTTP (Angular)

```typescript
// Détecte : this.http.get<StatsDto>('/consumption/stats')
// Crée un lien "HTTP GET /consumption/stats" entre le service front et le controller
```

### Types / DTOs

```typescript
// Détecte : import { StatsResponseDto } from '../dto/stats.dto'
// Crée un lien "type" entre le fichier utilisateur et le DTO
```

### Side effects

Un fichier est marqué "side-effect" s'il :
1. N'a aucun changement propre (add = 0, del = 0)
2. Mais une de ses méthodes consomme une méthode dont la signature a changé dans cette review

---

## Thèmes

### Dark mode (défaut)

```
Background:     #060810
Surface:        #0b0d15
Card:           #10131c
Border:         #1c2030
Text:           #7b869c
Text dim:       #3a4258
Text bright:    #c8d0e0
White:          #e8ecf4
```

### Light mode

```
Background:     #f4f5f7
Surface:        #ffffff
Card:           #ffffff
Border:         #dde0e6
Text:           #5f6b80
Text dim:       #a4adc0
Text bright:    #2c3547
White:          #161b26
```

### Couleurs sémantiques (identiques dans les deux modes)

```
Green:    #22c55e (OK, new, tested)
Red:      #ef4444 (bug, critical, untested)
Orange:   #eab308 (warning, modified, test needed)
Blue:     #3b82f6 (info, service)
Purple:   #a78bfa (question, module)
Cyan:     #06b6d4 (HTTP, usage élevé)
```

### Fonts

- **Code / scores / badges** : JetBrains Mono (fallback: Fira Code, monospace)
- **Labels / UI** : Inter (fallback: system-ui, sans-serif)

---

## Stack technique MVP

### Frontend

- **React** avec TypeScript
- **Canvas HTML5** ou **SVG** pour le rendu spatial (à évaluer en prototype)
- Pas de framework UI — tout custom pour le contrôle total du rendu
- Pan & zoom : implémentation custom (pas de lib)
- Organisation atomic des composants et séparation des responsabilités

### Backend

- **Node.js** en local (CLI qui lance un serveur web local)
- **Git** : appels directs via `child_process` (`git diff`, `git branch`, `git log`)
- **TypeScript Parser** : `@typescript-eslint/parser` pour l'AST
- Pas de base de données — fichiers JSON dans `.revu/`

### Lancement

```bash
cd certificall/
npx revu
# → Ouvre http://localhost:3847 dans le navigateur
# → Scanne les repos, détecte les branches, calcule les diffs
# → Charge les fichiers de review existants
```

---

## Ce qui est hors scope MVP

- Collaboration multi-reviewers
- Intégration GitHub/GitLab (webhooks, PR comments)
- Analyse par Claude/IA (suggestions, résumé, checklist auto)
- Timeline des commits
- Navigation clavier
- Comparaison avec une branche autre que develop (sauf sélection manuelle)
- Historique des reviews passées
- Export des commentaires vers un système externe

---

## Roadmap post-MVP

| Phase | Fonctionnalité |
|-------|---------------|
| **v1.1** | Navigation clavier (Tab entre planètes par criticité, n/d/f/espace) |
| **v1.2** | Intégration Claude : résumé d'intent par galaxie, checklist auto-suggérée |
| **v1.3** | Intégration Git hosting : push des commentaires comme PR review |
| **v1.4** | Mode collaboratif : plusieurs reviewers, résolution de commentaires |
| **v2.0** | SaaS : hébergé, connecté aux repos, historique, analytics |

---

## Prototype de référence

Le fichier `revu-v9.jsx` est le prototype interactif de référence pour l'interface. Il démontre :

- Canvas spatial avec pan & zoom libre
- Galaxies (ellipses), systèmes (cercles pointillés), planètes (cercles pleins)
- Liens entre planètes avec labels et épaisseur variable
- Zoom sémantique (méthodes révélées progressivement)
- Focus sur planète avec panel détail
- Word-level diff highlighting
- Tags factuels au hover
- Blast radius au hover
- Indicateur test coverage
- Flags, commentaires, actions de review
- Dark / light mode

Ce prototype utilise des données mockées. L'implémentation réelle remplacera les données statiques par l'analyse git + AST décrite ci-dessus.
