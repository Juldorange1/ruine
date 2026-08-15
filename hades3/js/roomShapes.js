// ============================================================================
// Formes de salle non-rectangulaires (L, croix, haltère, anneau à trou central),
// inspirées de la variété de salles de Hades 1/2. Le jeu n'a aucun pathfinding/
// navmesh (voir combat.js, évitement d'obstacle réactif à un seul obstacle) —
// plutôt que d'inventer un moteur de polygones générique, ce fichier expose un
// petit catalogue FERMÉ de templates nommés, chacun construit soit à partir
// d'une union de rectangles axés (L/croix/haltère — collision bon marché, même
// mental model que l'ancien clamp rectangulaire ARENA_W/ARENA_H), soit d'un
// anneau littéral traité en coordonnées polaires (distance au centre).
//
// Contrat consommé par combat.js/waves.js/render.js/js3d/combat3d.js :
//   CB.roomShape                         objet forme active (ou null = rectangle
//                                         implicite ARENA_W x ARENA_H)
//   pointInRoomShape(shape, x, y, margin) point à l'intérieur de la zone marchable ?
//   clampIntoRoom(x, y, margin)          lit CB.roomShape, renvoie [x, y] le plus
//                                         proche à l'intérieur (remplace l'ancien
//                                         clamp(x, margin, ARENA_W-margin))
//   outsideRoomShape(x, y)               lit CB.roomShape, marge nulle (despawn/
//                                         déclenchement de rebond)
//   carveZonesForRoomShape(shape)        zones {kind:'wall', isShapeCarve:true} à
//                                         ajouter au terrain généré — réutilise le
//                                         pipeline existant wall -> CB.blocks pour
//                                         à la fois matérialiser l'obstacle physique
//                                         (évitement déjà en place) ET le décor de
//                                         gravats (voir aussi combat3d.js Phase décor)
// ============================================================================

var ROOM_SHAPE_WEIGHTS = { rectangle: 40, lshape: 20, cross: 15, dumbbell: 15, ring: 10 };

function makeRectangleRoomShape(w, h) {
  return {
    type: 'polygon',
    key: 'rect:' + Math.round(w) + ',' + Math.round(h),
    w: w, h: h,
    testRects: [{ x0: 0, y0: 0, x1: w, y1: h }],
    outerPolygon: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    carveRects: []
  };
}

// Tromino (L) : un coin retiré, décomposé en 2 rectangles (le rectangle plein
// moins le coin se recouvre toujours proprement en 2 bandes). Coin choisi au
// hasard parmi les 4, taille de l'encoche 35%-55% de chaque dimension.
function makeLShapeRoomShape(w, h) {
  var corners = ['tl', 'tr', 'bl', 'br'];
  var corner = corners[Math.floor(Math.random() * 4)];
  var nw = w * (0.35 + Math.random() * 0.2);
  var nh = h * (0.35 + Math.random() * 0.2);
  var rectFull, rectBand, notch, poly;
  if (corner === 'tl') {
    rectFull = { x0: 0, y0: nh, x1: w, y1: h };
    rectBand = { x0: nw, y0: 0, x1: w, y1: nh };
    notch = { x0: 0, y0: 0, x1: nw, y1: nh };
    poly = [{ x: nw, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }, { x: 0, y: nh }, { x: nw, y: nh }];
  } else if (corner === 'tr') {
    rectFull = { x0: 0, y0: nh, x1: w, y1: h };
    rectBand = { x0: 0, y0: 0, x1: w - nw, y1: nh };
    notch = { x0: w - nw, y0: 0, x1: w, y1: nh };
    poly = [{ x: 0, y: 0 }, { x: w - nw, y: 0 }, { x: w - nw, y: nh }, { x: w, y: nh }, { x: w, y: h }, { x: 0, y: h }];
  } else if (corner === 'bl') {
    rectFull = { x0: 0, y0: 0, x1: w, y1: h - nh };
    rectBand = { x0: nw, y0: h - nh, x1: w, y1: h };
    notch = { x0: 0, y0: h - nh, x1: nw, y1: h };
    poly = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: nw, y: h }, { x: nw, y: h - nh }, { x: 0, y: h - nh }];
  } else { // br
    rectFull = { x0: 0, y0: 0, x1: w, y1: h - nh };
    rectBand = { x0: 0, y0: h - nh, x1: w - nw, y1: h };
    notch = { x0: w - nw, y0: h - nh, x1: w, y1: h };
    poly = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h - nh }, { x: w - nw, y: h - nh }, { x: w - nw, y: h }, { x: 0, y: h }];
  }
  return {
    type: 'polygon',
    key: 'lshape:' + corner + ',' + Math.round(nw) + ',' + Math.round(nh),
    w: w, h: h,
    testRects: [rectFull, rectBand],
    outerPolygon: poly,
    carveRects: [notch]
  };
}

// Croix/plus : une barre verticale + une barre horizontale superposées, 4 coins
// retirés — 12 sommets extérieurs, 4 rectangles de découpe (un par coin).
function makeCrossRoomShape(w, h) {
  var vw = w * (0.4 + Math.random() * 0.15);
  var hh = h * (0.4 + Math.random() * 0.15);
  var vx0 = (w - vw) / 2, vx1 = (w + vw) / 2;
  var hy0 = (h - hh) / 2, hy1 = (h + hh) / 2;
  var vbar = { x0: vx0, y0: 0, x1: vx1, y1: h };
  var hbar = { x0: 0, y0: hy0, x1: w, y1: hy1 };
  var poly = [
    { x: vx0, y: 0 }, { x: vx1, y: 0 }, { x: vx1, y: hy0 }, { x: w, y: hy0 },
    { x: w, y: hy1 }, { x: vx1, y: hy1 }, { x: vx1, y: h }, { x: vx0, y: h },
    { x: vx0, y: hy1 }, { x: 0, y: hy1 }, { x: 0, y: hy0 }, { x: vx0, y: hy0 }
  ];
  var carveRects = [
    { x0: 0, y0: 0, x1: vx0, y1: hy0 },
    { x0: vx1, y0: 0, x1: w, y1: hy0 },
    { x0: 0, y0: hy1, x1: vx0, y1: h },
    { x0: vx1, y0: hy1, x1: w, y1: h }
  ];
  return {
    type: 'polygon',
    key: 'cross:' + Math.round(vw) + ',' + Math.round(hh),
    w: w, h: h,
    testRects: [vbar, hbar],
    outerPolygon: poly,
    carveRects: carveRects
  };
}

// Haltère : deux "bulbes" carrés reliés par un corridor plus étroit — 3 rectangles
// (léger recouvrement dans les bulbes pour garantir une union sans interstice),
// 12 sommets (2 encoches concaves en haut et en bas du corridor).
function makeDumbbellRoomShape(w, h) {
  // Doit rester < 50% de la largeur, sinon les deux bulbes se chevauchent au centre
  // et le corridor "encoche" (carveRects) s'inverse — plafonné à 38% pour garder un
  // corridor bien visible entre les deux bulbes.
  var bulbSize = Math.min(w, h) * (0.28 + Math.random() * 0.1);
  var corridorH = h * (0.18 + Math.random() * 0.1);
  var byTop = (h - bulbSize) / 2, byBot = byTop + bulbSize;
  var cTop = (h - corridorH) / 2, cBot = (h + corridorH) / 2;
  var leftBulb = { x0: 0, y0: byTop, x1: bulbSize, y1: byBot };
  var rightBulb = { x0: w - bulbSize, y0: byTop, x1: w, y1: byBot };
  var corridor = { x0: bulbSize * 0.5, y0: cTop, x1: w - bulbSize * 0.5, y1: cBot };
  var poly = [
    { x: 0, y: byTop }, { x: bulbSize, y: byTop }, { x: bulbSize, y: cTop }, { x: w - bulbSize, y: cTop },
    { x: w - bulbSize, y: byTop }, { x: w, y: byTop }, { x: w, y: byBot }, { x: w - bulbSize, y: byBot },
    { x: w - bulbSize, y: cBot }, { x: bulbSize, y: cBot }, { x: bulbSize, y: byBot }, { x: 0, y: byBot }
  ];
  var carveRects = [
    { x0: bulbSize, y0: byTop, x1: w - bulbSize, y1: cTop },
    { x0: bulbSize, y0: cBot, x1: w - bulbSize, y1: byBot }
  ];
  return {
    type: 'polygon',
    key: 'dumbbell:' + Math.round(bulbSize) + ',' + Math.round(corridorH),
    w: w, h: h,
    testRects: [leftBulb, rightBulb, corridor],
    outerPolygon: poly,
    carveRects: carveRects
  };
}

// Anneau littéral (trou circulaire au centre) — c'est la forme explicitement
// nommée par la demande ("en rond avec un trou au milieu"), traitée à part avec
// de la vraie trigonométrie plutôt qu'une approximation par rectangles.
function makeRingRoomShape(w, h) {
  var cx = w / 2, cy = h / 2;
  var rOuter = Math.min(w, h) / 2 * (0.85 + Math.random() * 0.1);
  var rInner = rOuter * (0.35 + Math.random() * 0.2); // 35%-55% : anneau marchable toujours large
  return {
    type: 'ring',
    key: 'ring:' + Math.round(cx) + ',' + Math.round(cy) + ',' + Math.round(rOuter) + ',' + Math.round(rInner),
    w: w, h: h,
    cx: cx, cy: cy, rOuter: rOuter, rInner: rInner
  };
}

function pickRoomShapeTemplate(w, h) {
  var total = 0;
  for (var k in ROOM_SHAPE_WEIGHTS) total += ROOM_SHAPE_WEIGHTS[k];
  var roll = Math.random() * total;
  var acc = 0;
  var chosen = 'rectangle';
  for (var key in ROOM_SHAPE_WEIGHTS) {
    acc += ROOM_SHAPE_WEIGHTS[key];
    if (roll <= acc) { chosen = key; break; }
  }
  switch (chosen) {
    case 'lshape': return makeLShapeRoomShape(w, h);
    case 'cross': return makeCrossRoomShape(w, h);
    case 'dumbbell': return makeDumbbellRoomShape(w, h);
    case 'ring': return makeRingRoomShape(w, h);
    default: return makeRectangleRoomShape(w, h);
  }
}

// Point-dans-polygone (ray casting, marche pour un polygone concave quelconque) et
// point le plus proche sur le CONTOUR du polygone — utilisés pour tester/clamper par
// rapport au polygone extérieur RÉEL de la forme (shape.outerPolygon) plutôt que par
// rectangle de shape.testRects pris indépendamment.
//
// ATTENTION (bug vécu, pas juste théorique) : clamper indépendamment chaque rectangle
// de testRects avec sa propre marge crée une "zone morte" infranchissable pile au coin
// concave d'une découpe (L/croix/haltère) — deux rectangles qui se touchent sur une
// arête commune, une fois chacun rétréci de `margin` en interne, laissent un couloir de
// largeur 2×margin entre eux qu'AUCUN petit pas ne peut jamais traverser (chaque essai
// se fait reclamper très exactement au bord de départ, quelle que soit la direction
// tentée) — un ennemi s'y retrouvait visiblement figé en permanence, vélocité non nulle
// mais position totalement immobile. Tester/clamper contre le polygone extérieur réel
// (une seule frontière continue, sans arête interne) élimine structurellement cette
// zone morte.
function pointInPolygon(poly, x, y) {
  var inside = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var lenSq = dx * dx + dy * dy;
  var t = lenSq > 0.0001 ? clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1) : 0;
  return [x1 + dx * t, y1 + dy * t];
}

// Renvoie [x, y, distance] du point le plus proche sur le contour du polygone.
function nearestPointOnPolygonBoundary(poly, x, y) {
  var bestX = poly[0].x, bestY = poly[0].y, bestD = Infinity;
  for (var i = 0; i < poly.length; i++) {
    var p1 = poly[i], p2 = poly[(i + 1) % poly.length];
    var cp = closestPointOnSegment(x, y, p1.x, p1.y, p2.x, p2.y);
    var d = dist(x, y, cp[0], cp[1]);
    if (d < bestD) { bestD = d; bestX = cp[0]; bestY = cp[1]; }
  }
  return [bestX, bestY, bestD];
}

function polygonCentroid(poly) {
  var cx = 0, cy = 0;
  for (var i = 0; i < poly.length; i++) { cx += poly[i].x; cy += poly[i].y; }
  return [cx / poly.length, cy / poly.length];
}

function pointInRoomShape(shape, x, y, margin) {
  if (!shape) {
    var W = (typeof ARENA_W !== 'undefined') ? ARENA_W : 0, H = (typeof ARENA_H !== 'undefined') ? ARENA_H : 0;
    return x >= margin && x <= W - margin && y >= margin && y <= H - margin;
  }
  if (shape.type === 'ring') {
    var d = dist(x, y, shape.cx, shape.cy);
    return d >= shape.rInner + margin && d <= shape.rOuter - margin;
  }
  var poly = shape.outerPolygon;
  if (!pointInPolygon(poly, x, y)) return false;
  if (margin <= 0) return true;
  return nearestPointOnPolygonBoundary(poly, x, y)[2] >= margin;
}

// Point valide le plus proche à l'intérieur de CB.roomShape — remplace partout
// l'ancien clamp(x, margin, ARENA_W-margin) / clamp(y, margin, ARENA_H-margin).
// Le vecteur de correction qu'il calcule sert aussi de normale de rebond pour les
// couteaux (voir updateKnives, combat.js), unifiant rectangle/L/croix/anneau sous
// le même mécanisme que les rebonds sur blocs (CB.blocks) déjà existants.
function clampIntoRoom(x, y, margin) {
  var shape = (typeof CB !== 'undefined' && CB) ? CB.roomShape : null;
  if (!shape) {
    var W = (typeof ARENA_W !== 'undefined') ? ARENA_W : 0, H = (typeof ARENA_H !== 'undefined') ? ARENA_H : 0;
    return [clamp(x, margin, W - margin), clamp(y, margin, H - margin)];
  }
  if (shape.type === 'ring') {
    var dx = x - shape.cx, dy = y - shape.cy;
    var d = Math.sqrt(dx * dx + dy * dy);
    var rMin = shape.rInner + margin, rMax = shape.rOuter - margin;
    if (d < 0.0001) return [shape.cx + rMin, shape.cy];
    if (d >= rMin && d <= rMax) return [x, y];
    var rClamped = clamp(d, rMin, rMax);
    var nx = dx / d, ny = dy / d;
    return [shape.cx + nx * rClamped, shape.cy + ny * rClamped];
  }
  var poly = shape.outerPolygon;
  var centroid = polygonCentroid(poly);
  // Itératif et AMORTI plutôt qu'un seul "coup de pouce" vers le centre : près d'un
  // coin concave, pousser d'exactement la marge manquante calculée à la position de
  // départ ne suffit souvent pas (l'arête la plus proche change en cours de route) —
  // mesuré empiriquement à ~25% de points encore invalides après une seule passe sur
  // des ennemis de défi. Une version itérative NON amortie (poussée complète à chaque
  // passe) a ensuite été mesurée en train d'osciller sans converger pile aux coins
  // concaves (l'arête la plus proche bascule d'un côté à l'autre du coin d'une passe
  // à l'autre, chaque poussée complète dépassant vers le côté opposé) — d'où
  // l'amortissement (0.7 au lieu de 1) qui fait converger la correction en quelques
  // passes au lieu d'osciller indéfiniment entre deux points invalides.
  var cx = x, cy = y;
  for (var iter = 0; iter < 8; iter++) {
    if (pointInPolygon(poly, cx, cy)) {
      var np = nearestPointOnPolygonBoundary(poly, cx, cy);
      if (np[2] >= margin) return [cx, cy];
      var dirIn = norm(centroid[0] - cx, centroid[1] - cy);
      if (dirIn[2] < 0.01) return centroid;
      var need = (margin - np[2]) * 0.7;
      cx = cx + dirIn[0] * need; cy = cy + dirIn[1] * need;
    } else {
      var np2 = nearestPointOnPolygonBoundary(poly, cx, cy);
      var dirIn2 = norm(centroid[0] - np2[0], centroid[1] - np2[1]);
      if (dirIn2[2] < 0.01) return centroid;
      cx = np2[0] + dirIn2[0] * margin; cy = np2[1] + dirIn2[1] * margin;
    }
  }
  // Repli : la boucle n'a pas totalement convergé (coin très serré, écart résiduel de
  // l'ordre du pixel — mesuré à ~1% des cas, jamais plus) — on renvoie la dernière
  // position itérée telle quelle plutôt que de sauter au centre du plus grand
  // rectangle de la forme. Cet ancien repli téléportait visiblement le joueur/les
  // ennemis au milieu de la salle dès qu'ils frôlaient un bord de forme non
  // rectangulaire (signalé explicitement) : un dépassement de marge d'un pixel est
  // invisible, un saut à travers la salle ne l'est pas.
  return [cx, cy];
}

function outsideRoomShape(x, y) {
  var shape = (typeof CB !== 'undefined' && CB) ? CB.roomShape : null;
  return !pointInRoomShape(shape, x, y, 0);
}

// Matérialise la zone non-marchable d'une forme en zones 'wall' (réutilise le
// pipeline existant wall -> CB.blocks, voir applyZonesToArena dans combat.js) :
// sert à la fois d'obstacle physique (évitement déjà en place pour les rochers)
// et de décor de gravats/ruine (voir aussi le passage décor de js3d/combat3d.js).
function carveZonesForRoomShape(shape) {
  if (!shape) return [];
  var zones = [];
  function scatterCluster(x0, y0, x1, y1, count) {
    var rectW = x1 - x0, rectH = y1 - y0;
    if (rectW <= 6 || rectH <= 6) return; // trop fin pour y poser un rocher
    for (var i = 0; i < count; i++) {
      // Le rayon (et donc la marge = r*0.6) est plafonné à la taille du rectangle —
      // sinon, sur une découpe fine (ex. l'étranglement de l'haltère), le point
      // "x0+margin" dépasserait déjà x1 et le rocher finirait hors de sa propre
      // zone de découpe (constaté empiriquement : ~1 rocher sur 3 en dehors).
      var maxR = Math.min(rectW, rectH) / 1.3;
      var r = Math.min(30 + Math.random() * 24, Math.max(6, maxR));
      var margin = r * 0.6;
      var spanX = Math.max(0, rectW - margin * 2);
      var spanY = Math.max(0, rectH - margin * 2);
      var x = x0 + margin + Math.random() * spanX;
      var y = y0 + margin + Math.random() * spanY;
      zones.push({ kind: 'wall', x: x, y: y, r: r, isShapeCarve: true });
    }
  }
  if (shape.type === 'ring') {
    // Anneau de rochers longeant le trou intérieur (le vide doit rester lisible,
    // pas un remplissage plein) + petits amas dans les 4 coins hors du cercle.
    var rimCount = 7 + Math.floor(Math.random() * 3);
    for (var i = 0; i < rimCount; i++) {
      var a = (i / rimCount) * Math.PI * 2 + Math.random() * 0.15;
      zones.push({
        kind: 'wall',
        x: shape.cx + Math.cos(a) * shape.rInner,
        y: shape.cy + Math.sin(a) * shape.rInner,
        r: 22 + Math.random() * 14,
        isShapeCarve: true
      });
    }
    // cf plus petit + jitter réduit qu'un premier essai : garantit (vérifié empiriquement
    // sur 1000 tirages) que même dans le pire cas de rOuter/jitter, l'amas de coin reste
    // hors du cercle extérieur plutôt que d'empiéter dessus.
    var w = shape.w, h = shape.h, cf = 0.08;
    var corners = [[w * cf, h * cf], [w * (1 - cf), h * cf], [w * cf, h * (1 - cf)], [w * (1 - cf), h * (1 - cf)]];
    corners.forEach(function (c) {
      var n = 1 + Math.floor(Math.random() * 2);
      var jitter = Math.min(w, h) * 0.04;
      for (var j = 0; j < n; j++) {
        zones.push({
          kind: 'wall',
          x: c[0] + (Math.random() - 0.5) * jitter * 2,
          y: c[1] + (Math.random() - 0.5) * jitter * 2,
          r: 26 + Math.random() * 16,
          isShapeCarve: true
        });
      }
    });
  } else if (shape.carveRects && shape.carveRects.length) {
    shape.carveRects.forEach(function (cr) {
      // Peu de gros rochers plutôt que beaucoup de petits : une poignée d'obstacles
      // lit comme un vrai mur, alors qu'un maze de petits cailloux serrés est
      // justement ce qui piège l'évitement à un seul obstacle (l'ennemi hésite entre
      // deux rochers voisins au lieu de contourner le bloc dans son ensemble).
      var area = (cr.x1 - cr.x0) * (cr.y1 - cr.y0);
      var count = Math.max(2, Math.min(4, Math.round(area / 9000)));
      scatterCluster(cr.x0, cr.y0, cr.x1, cr.y1, count);
    });
  }
  return zones;
}
