// Données du niveau : tout ce qui décrit la carte est ici.
// Pour modifier la carte, c'est CE fichier qu'il faut toucher — jamais engine.js/render.js.
//
// Voir DESIGN_NOTES.md à la racine du dossier mammoths/ pour les principes
// de conception (pourquoi de la glace plutôt que de la roche, comment un
// blocage "obligatoire" se construit, le piège du sol manquant sous un
// glaçon, etc.) avant de modifier ce fichier.
//
// Plan : 3 couloirs horizontaux d'une case de large, séparés par deux
// rangées-cloisons presque entièrement faites de GLACE (pas de roche) :
//   ligne 2 : couloir de M3
//   ligne 3 : cloison (glace partout sauf un seul vrai passage en x=6)
//   ligne 4 : couloir commun de M1 (part de x=1) et M2 (part de x=4) —
//             les deux doivent se rejoindre et pousser le duo ENSEMBLE
//   ligne 5 : cloison (glace partout sauf un seul vrai passage en x=5)
//   ligne 6 : couloir de M4
// Un faux mouvement vers le haut/bas depuis la ligne 2, 4 ou 6 pousse la
// glace de la cloison directement dans le couloir voisin — ça bloque
// quelqu'un d'autre, pas seulement soi-même. Les deux seuls vrais passages
// (x=5 et x=6) sont juste là où le duo atterrit une fois poussé : M1 et M2
// se séparent aussitôt, chacun vers une sortie différente.

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

const ROW_M3 = 2, ROW_DIV1 = 3, ROW_MAIN = 4, ROW_DIV2 = 5, ROW_M4 = 6;
const GAP1_X = 6; // seul vrai passage de la cloison ligne 3 (vers le couloir de M3)
const GAP2_X = 5; // seul vrai passage de la cloison ligne 5 (vers le couloir de M4)
const DIV1_ICE_X = [2, 4, 8, 10, 12, 14];
const DIV2_ICE_X = [3, 7, 9, 11, 13];

const cells = [];
for (const x of range(1, 14)) cells.push([x, ROW_M3]);
for (const x of range(1, 8)) cells.push([x, ROW_MAIN]); // le duo termine sa course en x=7/8
for (const x of range(1, 14)) cells.push([x, ROW_M4]);
cells.push([GAP1_X, ROW_DIV1]);
for (const x of DIV1_ICE_X) cells.push([x, ROW_DIV1]);
cells.push([GAP2_X, ROW_DIV2]);
for (const x of DIV2_ICE_X) cells.push([x, ROW_DIV2]);
cells.push([1, 3]); // alcôve du bouton destructeur, juste au-dessus du départ de M1

const ice = [];
for (const x of DIV1_ICE_X) ice.push({ id: `div1_${x}`, x, y: ROW_DIV1 });
for (const x of DIV2_ICE_X) ice.push({ id: `div2_${x}`, x, y: ROW_DIV2 });
ice.push({ id: "duoA", x: 6, y: ROW_MAIN });
ice.push({ id: "duoB", x: 7, y: ROW_MAIN });
ice.push({ id: "frontExit2", x: 14, y: ROW_M4 });

// `let`, pas `const` : player.js lui réaffecte une valeur (jamais une 2e
// déclaration) quand on clique "Jouer" sur un niveau créé dans l'éditeur.
let LEVEL = {
  cols: 16,
  rows: 9,
  rooms: [],
  cells,
  exits: [
    [15, ROW_M3], // sortie 1 — libre une fois le couloir dégagé
    [15, ROW_M4], // sortie 2 — bloquée par frontExit2, contournable par téléporteur
  ],
  mammoths: [
    [1, ROW_M3],   // M3
    [1, ROW_MAIN], // M1
    [1, ROW_M4],   // M4
    [4, ROW_MAIN], // M2 — même couloir que M1, mais assez loin pour devoir
                   // le rejoindre avant de pouvoir pousser le duo ensemble
                   // (les deux doivent être du MÊME côté et alignés)
  ],
  ice,
  buttons: [
    { type: "teleport", x: 4, y: ROW_M4, label: "T", color: "#4f7fd9", targetX: 15, targetY: ROW_M4 },
    { type: "destroy", x: 1, y: 3, label: "D", color: "#8a3a3a", linkedIce: "div1_2" },
  ],
};
