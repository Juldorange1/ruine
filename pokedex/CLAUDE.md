# Pokédex — Apprentissage — Notes pour Claude

Application personnelle d'apprentissage du Pokédex (voir [../CLAUDE.md](../CLAUDE.md) pour
les règles générales du dépôt). Ce dossier est indépendant des autres jeux JulGame.

## Provenance des données

- `data/pokedex.json` (noms FR, types, générations, régions, évolutions, formes, stats) et
  `images/pokemon/**` (artworks officiels) sont générés par `scripts/fetch_pokedex.py` depuis
  [PokeAPI](https://pokeapi.co) (open data, usage personnel/non-commercial).
- **Rien n'est inventé à la main** : toute donnée affichée vient de ce fichier JSON. Si un
  champ manque dans l'appli, corriger le script de récupération plutôt que coder une valeur
  en dur.
- Les images sont des artworks officiels Nintendo/Game Freak, réutilisés ici uniquement pour
  un usage privé et hors-ligne (pas de redistribution).

## Régénérer / mettre à jour les données

```bash
cd pokedex/scripts
python fetch_pokedex.py --limit 1025 --workers 20
```

Le script met en cache chaque réponse API dans `data/_cache/` (rejouable/interruptible sans
tout retélécharger) et ne retélécharge pas une image déjà présente sur disque.

## Architecture

- `js/pokedexData.js` — chargement/indexation de `data/pokedex.json`, recherche, filtres, distracteurs.
- `js/storage.js` — persistance locale (localStorage), export/import/reset.
- `js/srs.js` — niveaux de maîtrise + répétition espacée + groupes d'apprentissage progressif.
- `js/quizEngine.js` — génération des questions pour les 12 modes de jeu + correction.
- `js/stats.js` — agrégats statistiques + graphiques SVG.
- `js/ui.js` — navigation, rendu des écrans, moteur de session de jeu, raccourcis clavier.
- `js/app.js` — bootstrap.

100 % local : aucune requête réseau après le premier chargement (données et images sont sur
disque). Servir via un petit serveur HTTP local (`.claude/launch.json` → config `pokedex`,
port 5571) plutôt qu'en `file://` pour que `fetch('data/pokedex.json')` fonctionne dans tous
les navigateurs.
