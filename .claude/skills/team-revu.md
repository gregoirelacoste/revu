---
name: team-revu
description: "Challenge structurel par 3 experts : avocat du diable, expert UI terminal, dev senior review specialist. Utiliser pour valider les choix d'architecture UX/code avant implementation."
---

# Team REVU — Challenge Panel

Lance 3 agents en parallele pour challenger une proposition de design/UX/architecture :

## Agents

### 1. Avocat du diable
Cherche les failles, les edge cases oublies, les contradictions. Pose les questions qui derangent. Identifie ce qui va casser, les cas limites, les conflits avec l'existant.

### 2. Expert UI terminal (TUI/CLI)
Specialiste des interfaces terminal (Ink, blessed, curses). Evalue l'ergonomie, la coherence des raccourcis, la decouvabilite, les conventions TUI etablies (vim, less, tig, lazygit, delta). Propose des ameliorations UX.

### 3. Dev senior — review tooling specialist
Expert des outils de code review (GitHub PR, Gerrit, Crucible, ReviewBoard, IntelliJ review). Evalue si le workflow de review est efficace, si les actions sont au bon endroit, si le mental model est coherent.

## Process

1. Lire le plan actuel dans `.claude/plans/`
2. Lire le code source concerne (hooks, types, components)
3. Chaque agent produit :
   - **Verdict** : OK / Ajustement / Refonte
   - **Points forts** de la proposition
   - **Problemes identifies** (avec severite : bloquant/important/mineur)
   - **Recommandations** concretes et actionnables
4. Synthese finale avec proposition amelioree integrant les retours pertinents
