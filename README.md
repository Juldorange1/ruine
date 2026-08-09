# JulGame

Dépôt regroupant tous les jeux JulGame. Chaque jeu est **isolé dans son propre dossier**
à la racine, avec son propre `index.html` pour le lancer directement (aucune dépendance
entre les jeux, sauf mention contraire).

## Jeux disponibles

| Dossier | Jeu | Description |
|---|---|---|
| [`ruine/`](ruine/) | **Ruine** | Top-down desert/ruine, grille 12×12, modes Solo / Coop / PvP |
| [`hexdefense/`](hexdefense/) | **Hex Défense** | Tower defense hexagonal, plusieurs héros, Mode Infini (prestige, cristaux, Choses aléatoires) |
| [`wave/`](wave/) | **Wave** | Jeu de rythme/esquive façon Geometry Dash |
| [`arene/`](arene/) | **Arène** | Combat par vagues façon Hades, dash/échange/mine |
| [`avidite/`](avidite/) | **Avidité** | Dés push-your-luck, thème horloge du jugement |
| [`ecosysteme/`](ecosysteme/) | **Écosystème (SYLVA)** | Stratégie solo, chaîne trophique |
| [`enclave/`](enclave/) | **Enclave** | Jeu de territoire |
| [`hexcristal/`](hexcristal/) | **Crystal** | Jeu sur grille hexagonale |
| [`mammoths/`](mammoths/) | **Mammoths** | Puzzle inspiré des jeux SmartGames |

## Lancer un jeu

Chaque jeu peut s'ouvrir directement en local (`file://<dossier>/index.html`), ou via un
petit serveur HTTP (voir `.claude/launch.json` pour les configurations existantes) :

```bash
python -m http.server 5500 --directory ruine
```

La page [`index.html`](index.html) à la racine est un simple sommaire qui pointe vers
chaque jeu — ce n'est pas un jeu en soi.

## Arborescence

```
ruine/                  (dépôt = "JulGame")
├── index.html          Page d'accueil (liste des jeux)
├── README.md           Ce fichier
├── CLAUDE.md           Instructions générales du dépôt
├── ruine/              Jeu "Ruine"
├── hexdefense/         Jeu "Hex Défense"
├── wave/                Jeu "Wave"
├── arene/              Jeu "Arène"
├── avidite/             Jeu "Avidité"
├── ecosysteme/          Jeu "Écosystème"
├── enclave/             Jeu "Enclave"
├── hexcristal/          Jeu "Crystal"
└── mammoths/            Jeu "Mammoths"
```
