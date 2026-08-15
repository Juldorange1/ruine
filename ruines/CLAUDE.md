# RUINE — Notes pour Claude

## Présentation du projet

Jeu de navigateur **top-down 2D sur canvas** (grille 12×12 tiles de 64 px), thème désert/ruine.
Pas de build, pas de dépendances, pas de bundler.

Point d'entrée : **`index.html`**  
Ancien fichier monolithique conservé pour référence : `ruine.html` (670 Ko, peut être supprimé).

---

## Structure du projet

```
ruine/
├── index.html          Point d'entrée (10 Ko)
├── style.css           Tout le CSS (6 Ko)
├── images/
│   ├── desert1.jpg     Texture solo (36 Ko)
│   ├── desert2.jpg     Texture destruction (51 Ko)
│   ├── grass1.jpg      Texture coop (121 Ko)
│   ├── grass2.jpg      Texture coop alt (112 Ko)
│   └── stone.jpg       Texture PvP (116 Ko)
└── js/                 Scripts chargés dans cet ordre dans index.html
    ├── canvas.js       Canvas, TILE/MAP/CW/CH, resz(), floor image (~24 lignes)
    ├── globals.js      NAMES, BD_HP, GAMEMODE, G, et tous les vars d'état (~35 lignes)
    ├── init.js         mkRng, mkPlayer, mkBd, initGame, cell helpers (~92 lignes)
    ├── placement.js    Barre de placement, addBd, moveP (~153 lignes)
    ├── combat.js       Combat, lance, drills, activateBd (~138 lignes)
    ├── shop.js         Shop, upgrades, piques, téléport (~139 lignes)
    ├── world.js        Météores, flood-check, spawnPvpBuilding, updPiques (~127 lignes)
    ├── ai.js           IA solo (updAI, aiDecide, aiBuy, aiBuildDrill) (~57 lignes)
    ├── render.js       draw(), drawBd(), drawPlayer(), HUD, log, sfx stubs (~284 lignes)
    └── game.js         Boucle principale, events, startGame, wire buttons (~463 lignes)
```

**Ordre de chargement important** : canvas.js → globals.js → init.js → … → game.js.  
Toutes les variables sont globales (`var` au top-level des fichiers = `window.*`).

---

## Modes de jeu

| Mode | `GAMEMODE` | Description |
|------|-----------|-------------|
| Solo Record | `'solo'` | 1 joueur, score = max diamants en temps limité |
| Coop Record | `'coop'` | 2 joueurs local (même équipe), score cumulé |
| Affrontement (PvP) | `'pvp'` | 2 joueurs local, élimination |
| Diamond Race | flag `diamondRace` | Variante : atteindre 600 ♦ le plus vite |
| Série | flag `seriesActive` | 3 parties enchaînées, moyenne des scores |

---

## Ressources & bâtiments

**Ressources :** charbon (`coal`), or (`gold`), diamant (`diamond`)

**Bâtiments** (HP définis dans `BD_HP` dans globals.js) :
- `factory` (USINE) — permet d'acheter bâtiments et upgrades
- `bank` (MAGAZIN) — collecte les ressources des foreuses
- `drill` / `drillfast` (FOREUSE / FOREUSE+) — extraction auto
- `teleporter` (TP) — téléportation (coûte 1 diamant/utilisation)
- piques (`pique`) — blesse les joueurs qui marchent dessus (−25 PV/s)

---

## Contrôles

| Joueur | Déplacement | Activer | Attaquer |
|--------|------------|---------|----------|
| P1 | Flèches | Clic gauche | Clic droit |
| P2 (PvP/Coop) | Z Q S D | F | R |

Touches globales : `ESC` = annuler, `P` = pause.

---

## Variables globales clés (dans globals.js)

```js
GAMEMODE        // 'solo' | 'coop' | 'pvp'
G               // état complet de la partie (players, buildings, blocks, time…)
G.p1, G.p2     // objets joueur
G.buildings     // tableau des bâtiments actifs
G.blocks        // blocs destructibles (ressources minérales)
mineralQty      // 3, 5 ou 7 minéraux par type
soloDur/coopDur // durée de partie en minutes
diamondRace     // bool — mode course aux 600 diamants
seriesActive    // bool — série de 3 parties
```

Variables canvas (dans canvas.js) :
```js
TILE = 64   // pixels par case
MAP = 12    // grille 12×12
CW, CH      // dimensions canvas en pixels (MAP*TILE)
C, X        // HTMLCanvasElement et CanvasRenderingContext2D
floorC      // canvas off-screen pour le fond
```

---

## Particularités à connaître

- **Pas de build** : modifier un fichier JS/CSS/HTML suffit, recharger le navigateur.
- **Globals partagés** : les fichiers JS ne sont pas des modules — tout est `window.*`. Ne pas utiliser `import/export`.
- **Pas de son** : `sfx()` est un stub vide dans render.js (désactivé volontairement).
- **Canvas 2D** : pas de WebGL, rendu pur `CanvasRenderingContext2D`.
- **IA solo uniquement** : `updAI()` retourne immédiatement en mode PvP/Coop.
- **RNG déterministe** : `mkRng(seed)` dans init.js pour la génération de carte.
- **Joueur nommé 'Juldorange'** : `NAMES[0]` dans globals.js.
- **Pas de localStorage** : aucune persistance entre sessions.
- **Textures** : 5 JPEG dans `images/`, chargées via `<img>` dans index.html et dessinées sur canvas off-screen (`floorC`) dans canvas.js et game.js.

---

## Guide de modification rapide

| Je veux changer… | Fichier à éditer |
|-----------------|-----------------|
| Apparence, couleurs, layout | `style.css` |
| Durée de partie, HP des bâtiments, noms | `js/globals.js` |
| Taille de la grille (MAP), taille des tiles | `js/canvas.js` |
| Génération de carte, spawn des joueurs | `js/init.js` |
| Vitesse de déplacement, collision | `js/placement.js` |
| Dégâts, portée du lance, attaque bâtiment | `js/combat.js` |
| Prix du shop, upgrades, téléport | `js/shop.js` |
| Comportement des météores, des piques | `js/world.js` |
| Comportement de l'IA (solo) | `js/ai.js` |
| Rendu canvas, HUD, messages log | `js/render.js` |
| Boucle de jeu, clavier/souris, menus | `js/game.js` |
| Structure des overlays, boutons | `index.html` |
| Textures de fond | `images/*.jpg` |

---

## Workflow de test

Ouvrir `index.html` directement dans un navigateur (`file://`). Pas besoin de serveur HTTP.

Pour modifier du code : éditer le(s) fichier(s) concerné(s), puis recharger l'onglet (`F5`).

---

## Notes git

- `ruine.html` (ancien monolithe) est dans le dépôt mais peut être supprimé : `git rm ruine.html`
- Le dossier `.claude/` (settings locaux) n'est pas suivi par git — c'est voulu.
