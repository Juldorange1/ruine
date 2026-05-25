# RUINE — Notes pour Claude

## Présentation du projet

`ruine.html` est un jeu de navigateur **entièrement contenu dans un seul fichier HTML** (~670 Ko, ~1604 lignes). Il n'y a pas de build, pas de dépendances, pas de bundler : tout — CSS, HTML, JS — est dans ce fichier.

Le jeu est un **top-down 2D sur canvas** (grille 12×12 tiles de 64 px) avec thème désert/ruine.

---

## Architecture du fichier

```
ruine.html
├── <head> / <style>    lignes 1–67     CSS (minifié, sections commentées)
├── <body>              lignes 68–192   HTML : overlays, HUD, canvas, shop, log
└── <script>            lignes 193–1604 JavaScript (non-minifié mais dense)
```

Sections JS clés (repérables par les commentaires `/* ... */`) :
- **CONSTANTS** (~l.220) — noms, couleurs, HP des bâtiments, durées
- **STATE** (~l.241) — variables globales de la partie en cours
- **RNG** (~l.256) — générateur déterministe
- **INIT** (~l.259) — `initGame()`, `mkPlayer()`, `mkBd()`, placement ressources
- **CELL HELPERS** (~l.326) — occupation de cases, drill adjacent
- **PLACEMENT** (~l.348) — barre de placement de blocs/bâtiments
- **SHOP** (~l.639) — `openShop()`, `renderShop()`, `buyBd()`, `buyUpg()`
- **TELEPORT** (~l.760)
- **METEORS** (~l.778) — météores aléatoires, flood-check
- **AI** (~l.905) — IA solo (`updSingleAI`, `aiDecide`, `aiBuy`)
- **DRAW** (~l.962) — rendu canvas (`draw()`, `drawBd()`, `drawPlayer()`)
- **HUD** (~l.1213) — `updateHUD()`, log messages
- **MAIN LOOP** (~l.1246) — `loop(ts)`, gestion clavier/souris
- **startGame** (~l.1472)

---

## Modes de jeu

| Mode | `GAMEMODE` | Description |
|------|-----------|-------------|
| Solo Record | `'solo'` | 1 joueur, score = max diamants en temps limité |
| Coop Record | `'coop'` | 2 joueurs local (même équipe), score cumulé |
| Affrontement (PvP) | `'pvp'` | 2 joueurs local, élimination |
| Diamond Race | flag `diamondRace` | Variante : atteindre 600 ♦ le plus vite possible |
| Série | flag `seriesActive` | 3 parties enchaînées, moyenne des scores |

---

## Ressources & bâtiments

**Ressources :** charbon (`coal`), or (`gold`), diamant (`diamond`)

**Bâtiments** (objet `BD_HP` pour les HP) :
- `factory` (USINE) — permet d'acheter bâtiments et upgrades
- `bank` (MAGAZIN) — collecte les ressources des foreuses
- `drill` (FOREUSE) — extrait les ressources automatiquement
- `drillfast` (FOREUSE+) — version rapide
- `teleporter` (TP) — téléportation (coûte 1 diamant/utilisation)
- `meteor` — bâtiment destructible par météore
- piques (`pique`) — blesse les joueurs qui marchent dessus (−25 PV/s)

---

## Contrôles

| Joueur | Déplacement | Activer | Attaquer |
|--------|------------|---------|----------|
| P1 | Flèches directionnelles | Clic gauche | Clic droit |
| P2 (PvP/Coop) | Z Q S D | F | R |
| Solo (alt) | Z Q S D | — | — |

Touches globales : `ESC` = annuler action en cours, `P` = pause.

---

## Variables globales importantes

```js
GAMEMODE        // 'solo' | 'coop' | 'pvp'
G               // état complet de la partie (players, buildings, blocks, time…)
G.p1, G.p2     // objets joueur
G.buildings     // tableau des bâtiments actifs
G.blocks        // blocs destructibles (ressources minérales)
TILE = 64       // taille d'une case en pixels
MAP = 12        // grille 12×12
mineralQty      // 3, 5 ou 7 minéraux par type
soloDur/coopDur // durée de partie en minutes
diamondRace     // bool — mode course aux 600 diamants
seriesActive    // bool — série de 3 parties
```

---

## Particularités à connaître

- **Fichier unique** : toute modification touche `ruine.html`. Pas de fichiers séparés CSS/JS.
- **Lignes très longues** : la plupart du CSS est sur des lignes denses ; certaines lignes JS font plusieurs Ko. Utiliser `offset` + `limit` petits lors de la lecture.
- **Pas de son** : `sfx()` est un stub vide (désactivé volontairement).
- **Canvas 2D** : pas de WebGL, rendu pur `CanvasRenderingContext2D`.
- **IA solo uniquement** : `updAI()` retourne immédiatement en mode PvP/Coop.
- **RNG déterministe** : `mkRng(seed)` pour la génération de la carte.
- **Joueur nommé 'Juldorange'** : `NAMES[0]` est le joueur P1 humain.
- **Pas de localStorage** : aucune persistance entre sessions.

---

## Workflow de test

Ouvrir `ruine.html` directement dans un navigateur (pas besoin de serveur HTTP). Tout fonctionne en `file://`.
