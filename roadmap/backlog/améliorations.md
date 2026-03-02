# Backlog Ameliorations REVU

> Notes et idees collectees pendant l'utilisation. Chaque item peut devenir un ticket ou integrer une phase.

---

## Scoring

- [ ] **Comment-only changes = score ~0** — Un fichier avec seulement des ajouts/suppressions de commentaires ne devrait pas scorer 4.2 (ex: item-analysis.service.ts). Reduire le poids des lignes `comment` dans `lineCriticality`.

## UX Explorer

- [ ] **Curseur plus visible dans le panel gauche** — Le fichier survole doit avoir le meme style que le fichier selectionne (background highlight), pas juste une fleche discrete.
- [ ] **Dossier grise quand tous ses fichiers sont reviewes** — Propagation du statut `complete` vers le dossier parent dans l'Explorer.
- [ ] **Bug : fichiers non grises apres review complete** — Certains fichiers (ex: ia-model.enum.ts) ne passent pas en grise malgre toutes les lignes flaggees. Investiguer la logique `fileProgress`.

## Navigation & Editeur

- [ ] **Ouvrir un fichier dans un editeur externe** — Raccourci (ex: `e`) pour ouvrir le fichier courant dans nvim/vim/code (configurable dans `.revu/config.json` : `"editor": "nvim"`). Idealement rester dans REVU avec un viewer read-only + coloration syntaxique.
- [ ] **Scroll souris** — Supporter le scroll molette (mouse events Ink) dans le diff panel. Scroll uniquement, pas de clic.

## AI Scoring

- [ ] **Clarifier le mode de fonctionnement** — L'AI peut aider de 2 manieres :
  1. Analyser toute la feature pour proposer une Review Map plus pertinente (clustering intelligent)
  2. Proposer un ajustement du scoring grace a sa comprehension du code (overrides)
- [ ] Documenter le workflow AI dans le README ou un guide dedie.

## Export & Integration Claude

- [ ] **Clarifier les exports `.revu/`** — Documenter a quoi servent les fichiers JSON (review state) vs les exports MD (partage humain/AI). Pourquoi le code review est dans le .md ? Comment partager avec Claude CLI pour qu'il reponde aux commentaires ?
- [ ] **Listing des commentaires** — Dans l'export, ajouter une section qui liste tous les commentaires avec leur emplacement (fichier, bloc, ligne) pour retrouver rapidement un commentaire sans parcourir tout le diff.
- [ ] **Export light pour AI** — Version condensee de l'export pour ne pas surcharger le contexte Claude.

## Roadmap & Organisation

- [x] **Ranger les phases dans `roadmap/`** — Phases terminees dans `terminé/`, futures en racine roadmap.
- [ ] **Encart "ameliorations" dans REVU** — Raccourci TUI pour prendre des notes d'amelioration qui s'enregistrent dans ce fichier backlog.
