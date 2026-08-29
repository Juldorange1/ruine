# JulGame

Dépôt regroupant tous les jeux JulGame. Chaque jeu est **isolé dans son propre dossier**
à la racine, avec son propre `index.html` pour le lancer directement (aucune dépendance
entre les jeux, sauf mention contraire).

## Jeux disponibles

| Dossier | Jeu | Description |
|---|---|---|
| [`ruines/`](ruines/) | **Ruine** | Top-down desert/ruine, grille 12×12, modes Solo / Coop / PvP |
| [`hexdefense/`](hexdefense/) | **Hex Défense** | Tower defense hexagonal, plusieurs héros, Mode Infini (prestige, cristaux, Choses aléatoires) |
| [`wave/`](wave/) | **Wave** | Jeu de rythme/esquive façon Geometry Dash |
| [`hades3/`](hades3/) | **Hades 3** | Combat par vagues façon Hades, dash/échange/mine |
| [`ecosysteme/`](ecosysteme/) | **Écosystème (SYLVA)** | Stratégie solo, chaîne trophique |
| [`pokedex/`](pokedex/) | **Pokédex — Apprentissage** | Appli perso d'apprentissage du Pokédex (quiz, révision espacée, 100 % hors-ligne) |
| [`geodash/`](geodash/) | **GeoDash** | Éditeur de niveaux façon Geometry Dash (piques, blocs, portails) + mode test/jeu |
| [`mineur/`](mineur/) | **Mineur** | Mine voxel en vraie 3D, vue première personne, 20×20×30, bâtiments à cooldown |

> **Avidité** a été déplacé dans son propre dépôt indépendant
> (`C:\Users\juldorange\avidite`, hors de ce monorepo) le 2026-08-29, pour
> pouvoir sortir de la contrainte "scripts classiques / compatible file://"
> commune aux autres jeux ici et explorer un rendu 3D plus poussé (modules ES,
> chargement de modèles, post-traitement).

## Lancer un jeu

Chaque jeu peut s'ouvrir directement en local (`file://<dossier>/index.html`), ou via un
petit serveur HTTP (voir `.claude/launch.json` pour les configurations existantes) :

```bash
python -m http.server 5500 --directory ruines
```

La page [`index.html`](index.html) à la racine est un simple sommaire qui pointe vers
chaque jeu — ce n'est pas un jeu en soi.

## Arborescence

```
ruine/                  (dépôt = "JulGame")
├── index.html          Page d'accueil (liste des jeux)
├── README.md           Ce fichier
├── CLAUDE.md           Instructions générales du dépôt
├── ruines/              Jeu "Ruine"
├── hexdefense/         Jeu "Hex Défense"
├── wave/                Jeu "Wave"
├── hades3/              Jeu "Hades 3"
├── ecosysteme/          Jeu "Écosystème"
├── pokedex/             Jeu "Pokédex"
├── geodash/             Jeu "GeoDash"
└── mineur/              Jeu "Mineur"
```
