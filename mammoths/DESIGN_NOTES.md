# Notes de conception — Mammouths

Notes accumulées au fil des itérations, pour concevoir des niveaux vraiment
stratégiques et éviter de refaire les mêmes erreurs.

## Principe n°1 : la glace fait le travail, pas la roche

La roche (mur) ne devrait servir qu'à la limite absolue de la carte et aux
endroits où AUCUNE interaction n'a de sens. Partout ailleurs, un obstacle doit
être un glaçon — même immobile, même jamais poussé — parce qu'un glaçon reste
une menace potentielle (on peut le pousser par erreur) alors qu'un mur est
juste... du décor. Plus il y a de glaçons, plus chaque case a un enjeu.

**Piège à éviter** : remplir tout un rectangle de glace automatiquement (ce que
j'ai fait dans une version) produit des dizaines de glaçons que le joueur ne
touche jamais — de la déco, pas de la stratégie. Chaque glaçon placé doit
pouvoir être justifié : *que se passe-t-il si on le pousse, dans quelle
direction, et est-ce que ça aide ou ça ruine autre chose ?*

## Principe n°2 : chaque poussée doit avoir une conséquence ailleurs

Le vrai dilemme n'est pas juste local ("est-ce que je peux pousser ce
glaçon ?") mais global : pousser ce glaçon ICI bloque-t-il un passage LÀ-BAS ?
Techniques concrètes :
- Un glaçon poussé dans un couloir qu'un AUTRE mammouth doit emprunter plus
  tard = il faudra revenir avec le bon mammouth (ou un bouton) pour le
  déloger.
- Une sortie peut être obstruée par un glaçon dès le départ : ça n'est pas
  "en trop", ça oblige à consacrer une poussée précise pour la dégager, et
  pousser ce glaçon dans le mauvais sens peut le sceller pire.
- Plusieurs sorties ne doivent jamais être un filet de sécurité : si l'une
  d'elles est plus facile d'accès, vérifier qu'elle coûte quelque chose
  ailleurs (glaçon qui bloquait un raccourci pour un autre mammouth, etc.)

## Principe n°3 : le blocage "obligatoire" (téléportation seule)

Un glaçon devient impossible à pousser proprement quand ses 4 voisins sont :
- un côté = approche possible (sol)
- côté opposé = case qui n'existe pas encore tant qu'on n'a pas déjà
  résolu le problème (goulot après lui), ou tout simplement un mur
- les 2 côtés perpendiculaires = jamais listés comme sol (glace de fond ou
  mur, peu importe : le joueur ne peut jamais s'y tenir)

Résultat : une seule direction de poussée existe, et elle scelle le passage.
Il n'existe que 2 types de boutons (le piège reset a été supprimé) : soit
le bouton destructeur détruit le glaçon bloquant, soit le téléporteur
contourne le blocage, soit on accepte que CETTE sortie précise reste
bloquée et on utilise une autre sortie.

## Principe n°4 : poussée en groupe (glaçons collés)

Un mammouth seul pousse un glaçon isolé d'une case. Pour pousser N glaçons
collés dans le sens du déplacement, il faut N mammouths alignés juste
derrière le meneur, qui avancent tous ensemble au même coup. C'est le
mécanisme qui force les retrouvailles — mais attention : si le couloir qui y
mène est large (plus d'1 case de haut/large), les mammouths peuvent le
contourner par une autre rangée sans jamais pousser le bloc. Toujours vérifier
qu'un chemin large ne recolle pas plus loin sans être passé par le blocage.

## Piège technique à ne jamais oublier

**Le sol sous un glaçon doit être listé explicitement.** Le moteur vérifie le
mur AVANT de vérifier la glace : si la case d'un glaçon n'est pas dans la
liste des sols, elle est traitée comme un mur infranchissable et le glaçon
devient inutilisable en pratique (bug rencontré au moins 2 fois).

**Un rectangle "salle" qui déborde sur une case cachée** (celle juste
derrière un glaçon "obligatoire", par exemple) recrée un passage parallèle
et annule le piège. Après avoir défini une case comme *volontairement* non
listée (mur), vérifier qu'aucun rectangle voisin ne la recouvre par erreur.

## Principe n°5 : un glaçon poussé sur un bouton l'active aussi

Ce n'est plus seulement un piège à éviter (voir l'ancienne version de cette
note) : un glaçon qui atterrit sur la case d'un bouton non utilisé
DÉCLENCHE ce bouton, exactement comme un mammouth qui marcherait dessus
(`checkIceButtonTriggers` dans `engine.js`, appelé juste après tout
déplacement de glaçon). Deux conséquences très différentes selon le type :
- **Bouton destructeur** : c'est souvent le but recherché — pousser un
  glaçon "sacrifiable" dessus pour détruire, à distance, le glaçon
  vraiment gênant auquel il est lié, sans avoir besoin qu'un mammouth
  marche lui-même sur le bouton.
- **Téléporteur** : c'est presque toujours une erreur — il n'y a personne à
  téléporter, le bouton est simplement gâché pour de bon. Un couloir 1 case
  de large qui pousse inévitablement un glaçon jusqu'à un téléporteur (voir
  Piège technique n°3) le rend donc définitivement inutilisable : à
  utiliser exprès comme un vrai dilemme ("attention où tu pousses"), jamais
  par accident de conception.

Conséquence pour le placement : un bouton posé APRÈS un obstacle poussable
dans un couloir n'est plus un bug à corriger, c'est un choix de conception
à assumer consciemment dans les deux sens.

## Piège technique n°2 (historique) : téléportation directement sur la sortie

Bug moteur trouvé et corrigé : téléporter un mammouth directement sur une
case de sortie ne le faisait pas s'échapper (le moteur ne revérifiait pas
le terrain après une téléportation). Corrigé dans `triggerButton` : après
avoir déplacé le mammouth, vérifier si sa nouvelle case est la sortie.

## Piège technique n°3 : un simple obstacle peut sceller une sortie sans même une erreur

Dans un couloir strictement large d'une case, sans aucune possibilité de
déviation perpendiculaire, un glaçon "simple" posé entre le départ et la
sortie sera INÉVITABLEMENT poussé jusqu'à la sortie si le mammouth avance
tout droit jusqu'au bout — ce n'est même pas une erreur du joueur, c'est
juste la conséquence mathématique de "le glaçon reste toujours 1 case devant
moi tant que j'avance." Un glaçon "obstacle simple" n'a donc sa place dans un
tel couloir QUE s'il a un bouton destructeur dédié, une vraie case de
déviation perpendiculaire, ou s'il n'est jamais nécessaire d'aller jusqu'au
bout du couloir en le poussant. Sinon, laisser le couloir vide et réserver
la glace "à gérer" aux endroits qui ont un vrai mécanisme de secours.

## Piège technique n°4 : les scripts classiques partagent UNE SEULE portée globale

Quand une page charge plusieurs `<script src="...">` classiques (pas de
type="module"), tous les `let`/`const` déclarés au premier niveau de CHAQUE
fichier vivent dans le même environnement lexical global — un `let ice` dans
un fichier entre en collision avec un `const ice` d'un autre fichier chargé
sur la même page, avec une `SyntaxError` qui empêche TOUT le script fautif
de s'exécuter (y compris ses fonctions, pourtant normalement "hoisted").
Symptôme fourbe : aucune erreur visible dans les logs de la console via les
outils habituels, tout semble "juste ne rien faire". Pour déboguer, injecter
le script une seconde fois avec `document.head.appendChild(script)` refait
apparaître l'erreur de redéclaration explicitement.
→ Avant de réutiliser un nom de variable au premier niveau d'un fichier,
vérifier qu'aucun AUTRE fichier chargé sur la même page ne l'utilise déjà.

## Carte librement configurable : void vs wall

Une case peut être `'void'` (n'existe pas — la carte peut avoir n'importe
quelle forme, pas juste un rectangle plein), `'wall'` (roche placée
volontairement, visible), `'floor'` ou `'exit'`. Pour le moteur de jeu, void
et wall sont STRICTEMENT équivalentes (ni l'une ni l'autre ne sont dans
`cells`, donc infranchissables pareil) — la distinction ne sert qu'à
l'affichage (void = invisible, wall = texture de roche), via un champ
`walls` séparé dans le niveau enregistré, lu uniquement par render.js/editor.js.
Un niveau vierge démarre entièrement en void (aucune case du tout).

## Une seule page pour l'éditeur et le jeu

`index.html` contient les DEUX vues (`#editorView` et `#playerView`,
basculées via `hidden`) au lieu de deux documents séparés reliés par une
navigation. "Jouer" (`showPlayer()` dans `app.js`) est un appel de fonction
en mémoire, pas une écriture dans `localStorage` suivie d'un
`window.location.href`. `localStorage` ne sert plus qu'à la bibliothèque de
niveaux, qui est lue/écrite sur LA MÊME page — jamais dans un passage entre
deux documents.

**Pourquoi ce changement** : l'ancienne architecture à deux pages
(`index.html` → écrit le niveau choisi dans `localStorage` → navigue vers
`play.html` qui le relit) fonctionnait dans tous mes tests via un serveur
`http://127.0.0.1:PORT`, mais le workflow réel de ce projet est d'ouvrir les
fichiers directement en `file://` (voir CLAUDE.md de RUINE, dont ce
sous-projet hérite la convention). Sous `file://`, un navigateur peut traiter
deux fichiers du même dossier comme deux origines de stockage différentes,
ce qui casse silencieusement le passage par `localStorage` — c'est ce qui
provoquait "jouer ne marche pas" pour l'utilisateur sans jamais se reproduire
dans mes tests par serveur. Fusionner les deux vues en une seule page élimine
le problème à la racine.

## Méthode de test qui marche

- Ne jamais faire confiance à un serveur de test déjà ouvert dans une session
  précédente : `curl` en direct (pas le navigateur) pour vérifier que le
  fichier servi correspond bien au fichier sur disque, sinon tuer le process
  et relancer sur un port neuf.
- Simuler les coups avec `attemptMove(game, idx, dx, dy)` + `refresh()`
  directement dans la console, en vérifiant la position ET le message après
  CHAQUE coup — bien plus fiable que de simuler des clics/touches en
  supposant la position du mammouth (les erreurs de comptage s'accumulent
  vite sur un chemin long).
