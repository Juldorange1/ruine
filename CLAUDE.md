# JulGame — Notes pour Claude

Ce dépôt (`ruine`, nom historique) regroupe **tous les jeux JulGame**. Chaque jeu vit dans
son propre dossier à la racine, indépendant des autres (pas de code ni de thème partagé,
sauf mention contraire explicite).

Voir [README.md](README.md) pour la liste des jeux et l'arborescence complète.

## Règles générales du dépôt

- **Un dossier = un jeu.** Chaque jeu a son propre `index.html` qui le lance directement,
  ouvrable en `file://` ou via un petit serveur HTTP local (`.claude/launch.json`).
- **Pas de dépendance inter-jeux.** Ne jamais faire référence au contenu, à l'univers ou
  au code d'un autre jeu du dépôt (ex: Hex Défense n'a aucun rapport avec Ruine).
- Certains jeux ont leurs propres instructions détaillées dans un `CLAUDE.md` local à leur
  dossier (ex: [ruine/CLAUDE.md](ruine/CLAUDE.md)) — s'y référer en priorité quand on travaille
  dans ce dossier.
- Le dossier `.claude/` (settings locaux) n'est pas suivi par git — c'est voulu.
- `index.html` à la racine est une simple page d'accueil qui liste les jeux ; ce n'est pas
  un jeu en soi.
