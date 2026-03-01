# Phase 11 — Review Map

## Context

REVU affiche les fichiers en liste et les diffs un par un. Il manque une **vue d'ensemble** : comment les changements s'articulent entre eux, ou sont les zones chaudes, et quel est le "chemin critique" de la review. L'analogie : une **minimap de RTS** — unites = fichiers, couleur = criticite, brouillard de guerre = non-reviewe, lignes = dependances.

**Touche** : `m` (toggle overlay plein ecran)

---

## Layout : 4 zones

```
┌─ REVIEW MAP ──────────────────────────────────────────────────────────┐
│                                                                        │
│  ████████████░░░░░░░░ 62%  ✓42 ✗3 ?2 💬5   3 repos · 12 files       │
│                                                                        │
│  ── TOPOLOGY ────────────────────────────────────────────────────────  │
│                                                                        │
│  certificall-nest                       certificall-admin              │
│  ┌ reports.service.ts (8.2) ◐ ─────┐   ┌ report.component.ts (5.3) ─┐│
│  │ ██ mapReportDetail  8.2  ✗      │──→│ ▓▓ loadReport       5.3    ││
│  │ ██ validateReport   7.1  ✓      │   │ ░░ formatDate       1.2  ✓ ││
│  │ ░░ initReports      2.0  ✓      │   └────────────────────────────┘│
│  └─────────────────────────────────┘                                  │
│  ┌ reports.controller.ts (5.1) ◐ ──┐   certificall-trust              │
│  │ ▓▓ createReport     5.1         │   ┌ fraud.analyzer.ts (6.8) ✗ ─┐│
│  │ ░░ updateReport     2.3  ✓      │──→│ ██ analyzeReport    6.8    ││
│  └─────────────────────────────────┘   └────────────────────────────┘│
│           │                                                           │
│           └──→ reports.service.ts (inject)                            │
│                                                                        │
│  ── HEAT ────────────────────────────────────────────────────────────  │
│  reports.service.ts    ██████▓▓░░░░  8.2  ◐ 12/20  ✗1               │
│  fraud.analyzer.ts     ██████▓▓░░░░  6.8  ✗  0/18  ← NEXT          │
│  report.component.ts   ▓▓▓▓░░░░░░░░  5.3  ◐  4/10                   │
│  reports.controller.ts ▓▓░░░░░░░░░░  5.1  ◐  4/15                   │
│  report.dto.ts         ░░░░░░░░░░░░  2.1  ✓  3/3                    │
│                                                                        │
│  ── IMPACT ──────────────────────────────────────────────────────────  │
│  ⚡ reports.service.ts → fraud.analyzer.ts (signature: validateReport) │
│  ⚡ reports.service.ts → report.component.ts (import: ReportStatus)    │
│                                                                        │
└─ ↑↓ navigate  Enter jump  m close ───────────────────────────────────┘
```

### Zone 1 — Dashboard Bar (2 lignes)

Barre de progression globale + compteurs.

```
████████████░░░░░░░░ 62%  ✓42 ✗3 ?2 💬5   3 repos · 12 files
```

- Progression = `reviewed / total` lignes flaggables
- Compteurs : ok, bugs, questions, commentaires
- Scope : nombre de repos, fichiers

### Zone 2 — Topology (zone principale)

Fichiers comme des **blocs** groupes par repo en colonnes.

**Structure d'un bloc** :
```
┌ filename.ts (crit) progress ──┐
│ ██ methodName     crit  flag  │
│ ▓▓ otherMethod    crit  ✓    │
│ ░░ lowMethod      crit  ✓    │
└───────────────────────────────┘
```

**Regles de rendu** :
- Bloc = fichier change (seuls les fichiers avec diff apparaissent)
- Methodes triees par criticite desc, couleur par seuil crit
- Progres du fichier : ✓ complete, ◐ partiel, ✗ non demarre
- Methodes reviewees = dim, non-reviewees = bright (brouillard de guerre)
- Max 5 methodes affichees par fichier (au-dela : `+N more`)

**Dependances** :
- Fleches ASCII entre blocs : `──→` (import), `══→` (inject)
- Cross-repo = affichees horizontalement entre colonnes
- Intra-repo = affichees verticalement avec `│` et `└──→`
- Seules les dependances vers des fichiers AUSSI changes sont affichees

**Layout colonnes** :
- Une colonne par repo
- Repos tries par criticite max desc
- Largeur colonne = proportionnelle au nombre de fichiers (min 30 chars)
- Si terminal trop etroit : un seul repo visible, `←→` pour scroller

### Zone 3 — Heat Strip (compact)

Une ligne par fichier, triee par criticite desc.

```
filename.ts  ██▓▓░░░░  crit  progress  findings
```

- Chaque caractere = une methode, coloree par sa criticite
- `██` = crit >= 7 (rouge), `▓▓` = 4.5-7 (orange), `░░` = < 4.5 (bleu/vert)
- Progres : ✓ / ◐ / ✗ + ratio reviewed/total
- Findings : `✗N` bugs, `?N` questions
- `← NEXT` pointe le prochain fichier non-reviewe le plus critique

### Zone 4 — Impact (side-effects)

Liste compacte des side-effects detectes.

```
⚡ source.ts → target.ts (signature: methodName)
⚡ source.ts → target.ts (import: TypeName)
```

- N'apparait que si des side-effects existent
- Max 5 lignes (au-dela : `+N more side-effects`)

---

## Langage visuel

| Element | Signification |
|---------|--------------|
| `██` rouge | Criticite >= 7 |
| `▓▓` orange | Criticite 4.5-7 |
| `░░` bleu/vert | Criticite < 4.5 |
| Bright | Non reviewe |
| Dim | Reviewe |
| `──→` | Import |
| `══→` | Injection |
| `✗` / `?` | Bug / Question flagge |
| `⚡` | Side-effect |
| `← NEXT` | Prochain fichier a reviewer |

---

## Interaction

| Touche | Action |
|--------|--------|
| `m` | Toggle la map |
| `↑↓` | Naviguer entre les fichiers (Heat strip) |
| `Enter` | Sauter au fichier dans le diff panel |
| `Esc` | Fermer |
| `←→` | Scroller repos (si terminal etroit) |

---

## Step 1 — Composant ReviewMapOverlay

**Nouveau fichier** : `src/tui/components/ReviewMapOverlay.tsx`

```typescript
interface ReviewMapOverlayProps {
  data: ScanResult;
  diffs: Map<string, TuiFileDiff>;
  lineReviews: Map<string, LineReview>;
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>;
  globalStats: ReviewStats;
  sideEffectCount: number;
  width: number;
  height: number;
  mapIdx: number;
}
```

**Sous-composants internes** (fonctions dans le meme fichier) :
- `DashboardBar` — barre de progression + compteurs
- `TopologyView` — blocs fichiers avec fleches
- `HeatStrip` — lignes compactes par fichier
- `ImpactList` — side-effects

## Step 2 — Donnees pour la topology

**Nouveau fichier** : `src/tui/map-data.ts`

```typescript
interface MapNode {
  fileId: string;
  name: string;
  repo: string;
  crit: number;
  progress: 'none' | 'partial' | 'complete';
  methods: { name: string; crit: number; reviewed: boolean; flag?: LineFlag }[];
  findings: { bugs: number; questions: number };
}

interface MapEdge {
  fromFileId: string;
  toFileId: string;
  type: 'import' | 'inject';
  specifiers: string[];
  crossRepo: boolean;
}

interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  repoColumns: { repo: string; nodeIds: string[] }[];
  sideEffects: SideEffect[];
}

export function buildMapData(
  data: ScanResult,
  diffs: Map<string, TuiFileDiff>,
  lineReviews: Map<string, LineReview>,
  fileProgress: Map<string, 'none' | 'partial' | 'complete'>,
): MapData
```

**Logique** :
- Noeud par fichier avec diff (meme source que `buildFileDiffs`)
- Liens filtres : seuls ceux entre fichiers changes
- Groupement par repo en colonnes, tri par crit max desc
- Methodes triees par crit desc, max 5 par fichier

## Step 3 — Layout topology ASCII

**Dans** `ReviewMapOverlay.tsx`

Algorithme de placement :
1. Colonnes = repos, triees par crit max desc
2. Largeur colonne = `Math.floor((width - gaps) / repoCount)`, min 30
3. Si pas assez de place : mode scroll horizontal (`←→`)
4. Fichiers empiles verticalement dans chaque colonne, tries par crit desc
5. Fleches cross-repo : ligne horizontale `──→` entre colonnes
6. Fleches intra-repo : `│` vertical + `└──→`

**Simplification** : pas de routage complexe. Les fleches partent du bord droit du bloc source et arrivent au bord gauche du bloc cible. Si les blocs ne sont pas alignes, une ligne `│` descend/monte.

## Step 4 — Integration App.tsx

```typescript
const [showMap, setShowMap] = useState(false);
const [mapIdx, setMapIdx] = useState(0);
```

- Passer `setShowMap` et `setMapIdx` a `useNavigation`
- Rendre `ReviewMapOverlay` apres les panels (comme HelpOverlay)

## Step 5 — Navigation dans useNavigation.ts

```typescript
// Map overlay: 'm' toggles, ↑↓ navigate, Enter jump, Esc close
if (state.showMap) {
  if (input === 'm' || key.escape) { setters.setShowMap(() => false); return; }
  if (key.upArrow) { setters.setMapIdx(i => Math.max(0, i - 1)); return; }
  if (key.downArrow) { setters.setMapIdx(i => Math.min(mapFileCount - 1, i + 1)); return; }
  if (key.return) {
    // Jump to file at mapIdx
    const fileId = mapFiles[mapIdx];
    if (fileId) {
      setters.setSelectedFile(fileId);
      setters.setDiffCursor(() => 0);
      setters.setDiffScroll(() => 0);
      setters.setPanel(() => 1);
      setters.setShowMap(() => false);
    }
  }
  return;
}
if (input === 'm') { setters.setShowMap(v => !v); setters.setMapIdx(() => 0); return; }
```

## Step 6 — Mettre a jour HelpOverlay + TutorialOverlay

- HelpOverlay : ajouter `m` → Review map dans GENERAL
- TutorialOverlay : mentionner la map dans la page Tips

---

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `src/tui/map-data.ts` | **Nouveau** — buildMapData, types MapNode/MapEdge/MapData |
| `src/tui/components/ReviewMapOverlay.tsx` | **Nouveau** — overlay 4 zones |
| `src/tui/App.tsx` | State showMap/mapIdx, rendu overlay |
| `src/tui/hooks/useNavigation.ts` | Touche `m`, navigation map |
| `src/tui/components/HelpOverlay.tsx` | Touche `m` |
| `src/tui/components/TutorialOverlay.tsx` | Mention map |

**Pas de nouvelle dependance.**

---

## Contraintes techniques

- **Terminal etroit** (< 120 cols) : masquer la topology, ne montrer que Heat + Impact
- **Beaucoup de fichiers** (> 20) : Heat strip scrollable, topology paginee
- **Pas de liens** : masquer la section topology, ne montrer que Heat
- **Mono-repo** : pas de colonnes, layout vertical simple

## Verification

```bash
npx tsc -p tsconfig.node.json --noEmit
npm run dev
```

1. Ouvrir REVU sur un projet multi-repo
2. Presser `m` — verifier que la map s'affiche
3. Verifier la barre de progression et les compteurs
4. Verifier que les blocs fichiers sont groupes par repo
5. Verifier que les fleches de dependances apparaissent
6. Naviguer avec `↑↓` dans la heat strip
7. `Enter` sur un fichier — verifier le saut vers le diff
8. Presser `m` ou `Esc` — verifier la fermeture
