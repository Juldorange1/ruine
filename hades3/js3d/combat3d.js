// ============================================================================
// Combat 3D — Three.js, chargé via CDN (voir index.html et js3d/hub3d.js pour
// le même principe déjà appliqué au hub).
// ============================================================================
// La logique de jeu (js/combat.js : dégâts, IA, collisions, cooldowns) NE CHANGE
// PAS DU TOUT — ce module est un pur rendu qui lit l'état de CB (voir js/combat.js)
// et window.ARENA_W/ARENA_H (js/entities.js) à chaque frame et affiche des maillages
// en conséquence. Les coordonnées de jeu (x, y) sont utilisées TELLES QUELLES comme
// coordonnées 3D (x, 0, y) — aucune conversion d'échelle, pour ne jamais désynchroniser
// le rendu de la physique/visée (voir combat3DScreenToWorld, qui doit rester exact).
//
// Contrat avec le reste du jeu (scripts classiques, pas des modules) :
//   - window.Combat3D.available : true si Three.js a pu s'initialiser.
//   - window.Combat3D.render(t) : à appeler depuis la boucle de js/game.js, au même
//     endroit que l'ancien renderCombat(ctx, ...) — PAS de boucle rAF indépendante ici
//     (contrairement au hub) car le rendu doit rester synchronisé avec le pas de temps
//     fixe déjà géré par game.js (sensible au ressenti de jeu).
//   - window.Combat3D.resize() : à appeler quand le canvas change de taille.
//   - window.Combat3D.screenToWorld(clientX, clientY) : conversion souris -> monde,
//     par lancer de rayon sur le plan du sol (remplace l'ancienne combatMouseToWorld
//     purement 2D pour la visée).
//
// Chargé en script classique (pas un module) — voir js3d/hub3d.js pour l'explication :
// js3d/vendor/three.min.js, chargé juste avant, pose un THREE global.

(function () {
var THREE = window.THREE;

var TIER_COLORS_3D = ['#8fe3a0', '#c9e35b', '#f2b84b', '#f2603f', '#b34bf2'];

function hex(c) { return new THREE.Color(c); }

function disposeObject(obj) {
  obj.traverse(function (child) {
    if (child.isMesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach(function (m) { m.dispose(); });
      else child.material.dispose();
    }
  });
}

// ---------------- Sync générique par référence (ennemis, blocs, zones, mines) --------
// Garde une correspondance stable objet-de-jeu -> objet 3D d'une frame à l'autre (pas
// de scintillement/recréation), crée à l'apparition, retire à la disparition. Une Map
// native (clé = référence de l'objet, PAS item.id) plutôt qu'un objet JS : les zones de
// terrain (waves.js) n'ont pas de champ id du tout, un keying par id les faisait toutes
// s'écraser sur la même clé "undefined" — une seule visible à la fois, aléatoirement.
function syncByRef(scene, map, list, createFn, updateFn) {
  var seen = new Set();
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    seen.add(item);
    var obj = map.get(item);
    if (!obj) { obj = createFn(item); scene.add(obj); map.set(item, obj); }
    updateFn(obj, item);
  }
  map.forEach(function (obj, item) {
    if (!seen.has(item)) { scene.remove(obj); disposeObject(obj); map.delete(item); }
  });
}

// ---------------- Pool générique pour effets éphémères sans id stable ----------------
// (traînées de dash, cordes de grappin, anneaux de poussée, coups d'épée...) : on
// réutilise un tableau d'objets 3D déjà créés plutôt que d'en recréer un par frame.
function makePool(scene, createFn) {
  var items = [];
  return {
    sync: function (list, updateFn) {
      for (var i = 0; i < list.length; i++) {
        if (!items[i]) { items[i] = createFn(); scene.add(items[i]); }
        items[i].visible = true;
        updateFn(items[i], list[i]);
      }
      for (var j = list.length; j < items.length; j++) items[j].visible = false;
    }
  };
}

// ---------------- Terrain (sol + murs de bordure), reconstruit si la taille de
// l'arène change (elle est désormais aléatoire par run, voir randomizeArenaSize) ----
// Palette de sol par chapitre — miroir 3D de CHAPTER_THEMES (js/render.js, même index,
// chargé avant ce fichier donc déjà disponible ici) : sans ça, seul le rendu 2D de
// secours changeait d'ambiance d'un chapitre à l'autre, jamais la vraie scène 3D que la
// plupart des joueurs voient.
// `sky` pilote la couleur de fond/brouillard par chapitre (voir buildArenaShell) :
// avant, le ciel restait un violet neutre fixe quel que soit le chapitre.
var CHAPTER_GROUND_PALETTES = [
  { base: '#3a3020', spots: ['#5c4a28', '#2a2016', '#6b5830'], border: 0xe3b968, sky: 0x6b4a28 }, // Sables
  { base: '#1e2e1c', spots: ['#2e4a28', '#152016', '#345c30'], border: 0x8fe3a0, sky: 0x162820 }, // Marécage
  { base: '#2c1810', spots: ['#4a2418', '#1c0f0a', '#5c2c1c'], border: 0xff5a3c, sky: 0x2a0f08 }, // Braise
  { base: '#241f30', spots: ['#362d48', '#181420', '#3f3454'], border: 0xb34bf2, sky: 0x140c22 }  // Abîme
];

function currentChapterIdx3D() {
  if (typeof CB === 'undefined' || !CB || typeof ROOMS_PER_CHAPTER === 'undefined') return 0;
  // Armurerie/défis figent le thème (voir js/render.js currentChapterTheme, même principe).
  if (CB.forcedChapterTheme != null) return CB.forcedChapterTheme % CHAPTER_GROUND_PALETTES.length;
  return Math.floor(Math.min(CB.waveIndex, CB.totalWaves - 1) / ROOMS_PER_CHAPTER) % CHAPTER_GROUND_PALETTES.length;
}

// ---------------- Décor de sol par chapitre ----------------
// Dunes de sable (Sables), touffes d'herbe (Marécage), braises rougeoyantes (Braise),
// cristaux sombres (Abîme) : dispersés à la génération du décor (même cadence que le
// sol/les bordures), purement décoratifs (pas de collision), pour que chaque chapitre se
// sente vraiment habité au lieu d'un sol plat texturé. Comptes modestes (perf) : pas de
// vraie lumière par élément (juste de l'émissif), une géométrie simple par pièce.
var DECOR_SCATTER_COUNT = 22;
var DECOR_HERO_COUNT = 6;

function buildDuneTuft() {
  var mesh = new THREE.Mesh(
    new THREE.ConeGeometry(5 + Math.random() * 4, 2.2 + Math.random() * 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a7048, roughness: 0.95 })
  );
  mesh.position.y = mesh.geometry.parameters.height / 2;
  mesh.receiveShadow = true;
  return mesh;
}

function buildGrassTuft() {
  var group = new THREE.Group();
  var mat = new THREE.MeshStandardMaterial({ color: 0x4a7a3c, roughness: 0.8, side: THREE.DoubleSide });
  var bladeCount = 3 + Math.floor(Math.random() * 2);
  for (var i = 0; i < bladeCount; i++) {
    var h = 4 + Math.random() * 3;
    var blade = new THREE.Mesh(new THREE.ConeGeometry(0.55, h, 3), mat);
    var a = (i / bladeCount) * Math.PI * 2 + Math.random() * 0.6;
    blade.position.set(Math.cos(a) * 1.1, h / 2, Math.sin(a) * 1.1);
    blade.rotation.z = (Math.random() - 0.5) * 0.35;
    blade.rotation.x = (Math.random() - 0.5) * 0.2;
    group.add(blade);
  }
  return group;
}

function buildEmberRock() {
  var group = new THREE.Group();
  var rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(2.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.9 })
  );
  rock.position.y = 2;
  rock.castShadow = true;
  group.add(rock);
  var ember = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff6e30, emissive: 0xff5a1a, emissiveIntensity: 1.6 })
  );
  ember.position.y = 3.3;
  ember.scale.set(0.7, 0.35, 0.7);
  group.add(ember);
  return group;
}

function buildCrystalShard() {
  var group = new THREE.Group();
  var shardCount = 1 + Math.floor(Math.random() * 2);
  for (var i = 0; i < shardCount; i++) {
    var h = 6 + Math.random() * 6;
    var shard = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, h, 5),
      new THREE.MeshStandardMaterial({ color: 0x4a3560, emissive: 0xb34bf2, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.2 })
    );
    shard.position.set((Math.random() - 0.5) * 3, h / 2, (Math.random() - 0.5) * 3);
    shard.rotation.z = (Math.random() - 0.5) * 0.4;
    shard.rotation.x = (Math.random() - 0.5) * 0.4;
    group.add(shard);
  }
  return group;
}

var DECOR_BUILDERS = [buildDuneTuft, buildGrassTuft, buildEmberRock, buildCrystalShard];

// ---------------- Décor "hero" par thème ----------------
// Un cran au-dessus du petit décor de sol ci-dessus (qualité proche de buildTorch/
// buildDoorMesh du hub — plusieurs pièces, accents émissifs, parfois une vraie
// lumière) : peu d'instances par salle, mais bien plus travaillées, pour que
// l'arène ait de vrais points d'intérêt et pas seulement une texture de sol
// habillée de petits éléments répétitifs.
function buildDuneRockArch() {
  var group = new THREE.Group();
  var mat = new THREE.MeshStandardMaterial({ color: 0x8a7048, roughness: 0.9 });
  [-1, 1].forEach(function (side) {
    var slab = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 5), mat);
    slab.position.set(side * 9, 11, 0);
    slab.rotation.z = side * 0.28;
    slab.castShadow = true;
    slab.receiveShadow = true;
    group.add(slab);
  });
  for (var i = 0; i < 3; i++) {
    var geo = window.Shared3D ? window.Shared3D.makeRockGeometry(0.3) : new THREE.DodecahedronGeometry(1, 1);
    var rock = new THREE.Mesh(geo, mat);
    var r = 3 + Math.random() * 2;
    rock.position.set((Math.random() - 0.5) * 14, r * 0.5, (Math.random() - 0.5) * 8);
    rock.scale.set(r, r, r);
    rock.castShadow = true;
    group.add(rock);
  }
  return group;
}

function buildReedCluster() {
  var group = new THREE.Group();
  var pool = new THREE.Mesh(
    new THREE.CircleGeometry(8, 20),
    new THREE.MeshStandardMaterial({ color: 0x0f2018, roughness: 0.4, emissive: 0x2e9c6a, emissiveIntensity: 0.18 })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.05;
  group.add(pool);
  var mat = new THREE.MeshStandardMaterial({ color: 0x3c6a34, roughness: 0.8, side: THREE.DoubleSide });
  var count = 6 + Math.floor(Math.random() * 3);
  for (var i = 0; i < count; i++) {
    var h = 10 + Math.random() * 8;
    var reed = new THREE.Mesh(new THREE.ConeGeometry(0.5, h, 4), mat);
    var a = Math.random() * Math.PI * 2, r = Math.random() * 6;
    reed.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    reed.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(reed);
  }
  return group;
}

// Miroir direct de buildTorch (js3d/hub3d.js), palette Braise — withLight plafonné
// par appelant (budget d'éclairage, voir addChapterDecor) plutôt que systématique.
function buildBrazierStand(withLight) {
  var group = new THREE.Group();
  var bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 2.2, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x2c1c16, roughness: 0.6, metalness: 0.3 })
  );
  bowl.position.y = 15;
  bowl.castShadow = true;
  group.add(bowl);
  var pole = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.75 })
  );
  pole.position.y = 7;
  pole.castShadow = true;
  group.add(pole);
  var flame = new THREE.Mesh(
    new THREE.ConeGeometry(3.4, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff5a1a, emissiveIntensity: 1.8, transparent: true })
  );
  flame.position.y = 21;
  group.add(flame);
  if (withLight) {
    var light = new THREE.PointLight(0xff8a4a, 12, 130, 1.8);
    light.position.y = 20;
    group.add(light);
  }
  return group;
}

function buildVoidObelisk() {
  var group = new THREE.Group();
  var shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 3.6, 26, 6),
    new THREE.MeshStandardMaterial({ color: 0x241f30, roughness: 0.6, emissive: 0x4a1f70, emissiveIntensity: 0.2 })
  );
  shaft.position.y = 13;
  shaft.castShadow = true;
  group.add(shaft);
  var band = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.6, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x342c48, emissive: 0xb34bf2, emissiveIntensity: 1.1, roughness: 0.3 })
  );
  band.position.y = 15;
  band.rotation.x = Math.PI / 2;
  group.add(band);
  var shardCount = 2 + Math.floor(Math.random() * 2);
  for (var i = 0; i < shardCount; i++) {
    var h = 4 + Math.random() * 4;
    var shard = new THREE.Mesh(
      new THREE.ConeGeometry(1, h, 5),
      new THREE.MeshStandardMaterial({ color: 0x4a3560, emissive: 0xb34bf2, emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.2 })
    );
    var a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 2;
    shard.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    shard.rotation.z = (Math.random() - 0.5) * 0.5;
    group.add(shard);
  }
  return group;
}

var DECOR_HERO_BUILDERS = [buildDuneRockArch, buildReedCluster, buildBrazierStand, buildVoidObelisk];
var DECOR_HERO_MIN_DIST = 55;
var DECOR_BRAZIER_LIGHT_BUDGET = 2; // lumières de brasier actives max par salle (budget d'éclairage)

function addChapterDecor(group, w, h, themeIdx) {
  // Pas de mise à l'échelle globale appliquée ici après coup : chaque builder randomise
  // déjà ses propres dimensions en amont, avec des positions Y calculées pour poser la
  // pièce au sol à cette taille précise — un facteur d'échelle externe désaligne l'assise
  // (le pied "flotte" ou s'enfonce selon le facteur tiré).
  var builder = DECOR_BUILDERS[themeIdx % DECOR_BUILDERS.length];
  for (var i = 0; i < DECOR_SCATTER_COUNT; i++) {
    var item = builder();
    item.position.x = 30 + Math.random() * (w - 60);
    item.position.z = 30 + Math.random() * (h - 60);
    item.rotation.y = Math.random() * Math.PI * 2;
    group.add(item);
  }

  // Palier "hero" : peu d'instances mais bien plus détaillées, espacées au mieux
  // entre elles (retry best-effort — même pragmatisme que l'évitement d'obstacle
  // des ennemis, pas de résolution de collision stricte).
  var heroBuilder = DECOR_HERO_BUILDERS[themeIdx % DECOR_HERO_BUILDERS.length];
  var isBrazier = heroBuilder === buildBrazierStand;
  var placed = [];
  var lightsUsed = 0;
  for (var hI = 0; hI < DECOR_HERO_COUNT; hI++) {
    var pos = null;
    for (var attempt = 0; attempt < 8; attempt++) {
      var cand = [30 + Math.random() * (w - 60), 30 + Math.random() * (h - 60)];
      var tooClose = placed.some(function (p) { return Math.hypot(p[0] - cand[0], p[1] - cand[1]) < DECOR_HERO_MIN_DIST; });
      if (!tooClose) { pos = cand; break; }
    }
    if (!pos) continue;
    placed.push(pos);
    var withLight = isBrazier && lightsUsed < DECOR_BRAZIER_LIGHT_BUDGET;
    var item = isBrazier ? buildBrazierStand(withLight) : heroBuilder();
    if (withLight) lightsUsed++;
    item.position.x = pos[0];
    item.position.z = pos[1];
    item.rotation.y = Math.random() * Math.PI * 2;
    group.add(item);
  }
}

// ---------------- Décor lointain, au-delà des murs de l'arène ----------------
// Avant : rien n'existait passé les murs, juste la couleur de fond plate — l'arène
// avait l'air de flotter dans le vide. Ces silhouettes (dunes/arbres morts/pics
// volcaniques/roches flottantes selon le chapitre) sont dispersées en anneau autour
// de l'arène et se fondent dans le brouillard (voir rebuild) au lieu de se découper
// nettement : lisibles comme "arrière-plan", jamais confondues avec le terrain de jeu.
function buildDuneRidge() {
  var mesh = new THREE.Mesh(
    new THREE.ConeGeometry(70 + Math.random() * 90, 60 + Math.random() * 70, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b5432, roughness: 1, fog: true })
  );
  mesh.position.y = mesh.geometry.parameters.height * 0.42;
  mesh.scale.y = 0.55;
  return mesh;
}

function buildDeadTree() {
  var group = new THREE.Group();
  var mat = new THREE.MeshStandardMaterial({ color: 0x0f1a12, roughness: 1, fog: true });
  var trunkH = 60 + Math.random() * 60;
  var trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 5, trunkH, 6), mat);
  trunk.position.y = trunkH / 2;
  group.add(trunk);
  var branchCount = 3 + Math.floor(Math.random() * 3);
  for (var i = 0; i < branchCount; i++) {
    var bh = trunkH * (0.35 + Math.random() * 0.4);
    var branch = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.8, bh, 5), mat);
    branch.position.y = trunkH * (0.55 + Math.random() * 0.35);
    branch.rotation.z = (Math.random() - 0.5) * 1.6;
    branch.rotation.x = (Math.random() - 0.5) * 1.6;
    group.add(branch);
  }
  return group;
}

function buildVolcanicSpire() {
  var group = new THREE.Group();
  var h = 90 + Math.random() * 120;
  var spire = new THREE.Mesh(
    new THREE.ConeGeometry(14 + Math.random() * 12, h, 6),
    new THREE.MeshStandardMaterial({ color: 0x241410, roughness: 0.95, fog: true })
  );
  spire.position.y = h / 2;
  group.add(spire);
  var glow = new THREE.Mesh(
    new THREE.SphereGeometry(4 + Math.random() * 3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xff6e30, emissive: 0xff5218, emissiveIntensity: 2 })
  );
  glow.position.y = h * 0.94;
  group.add(glow);
  return group;
}

function buildFloatingRock() {
  var group = new THREE.Group();
  var rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(14 + Math.random() * 16, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a2038, roughness: 0.85, emissive: 0x6a2fa0, emissiveIntensity: 0.35, fog: true })
  );
  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  rock.position.y = 60 + Math.random() * 160;
  group.add(rock);
  return group;
}

var BEYOND_BUILDERS = [buildDuneRidge, buildDeadTree, buildVolcanicSpire, buildFloatingRock];

// La caméra de combat est fixe et regarde l'arène depuis un point situé plein +Z
// (voir frameArena : camera.position.z = h/2 + camDist*0.62, aucun décalage en X) —
// semer le décor sur tout le pourtour plaçait donc une partie de l'anneau plus près
// de la caméra que le mur du fond de l'arène lui-même, en plein cadre au premier
// plan. On restreint le tirage à l'arc opposé à la caméra (± 110° autour de -Z) pour
// que le décor reste bien un arrière-plan, jamais un objet qui traverse la vue.
var BEYOND_ARC_CENTER = -Math.PI / 2; // -Z : à l'opposé de la caméra
var BEYOND_ARC_SPAN = Math.PI * (150 / 180);

function addBeyondScenery(group, w, h, themeIdx) {
  var builder = BEYOND_BUILDERS[themeIdx % BEYOND_BUILDERS.length];
  var cx = w / 2, cz = h / 2;
  var baseR = Math.max(w, h) * 0.9;
  var count = 16;
  for (var i = 0; i < count; i++) {
    var angle = BEYOND_ARC_CENTER + (Math.random() - 0.5) * BEYOND_ARC_SPAN;
    var radius = baseR + Math.random() * baseR * 0.6;
    var item = builder();
    item.position.x = cx + Math.cos(angle) * radius;
    item.position.z = cz + Math.sin(angle) * radius;
    item.rotation.y = Math.random() * Math.PI * 2;
    var s = 0.7 + Math.random() * 0.9;
    item.scale.multiplyScalar(s);
    group.add(item);
  }
}

// Zones découpées par une forme de salle non-rectangulaire (voir js/roomShapes.js) :
// ce n'est PAS une zone de jeu, juste le fond derrière la salle — le vide y est donc
// habillé avec les MÊMES silhouettes que le décor au-delà des murs (addBeyondScenery,
// BEYOND_BUILDERS un peu plus haut), pas des rochers de premier plan comme s'il
// s'agissait d'un obstacle dans la pièce. La collision (CB.blocks, invisible ici) est
// gérée séparément par carveZonesForRoomShape, indépendante du rendu.
function addCarveRubbleDecor(group, roomShape, themeIdx) {
  if (!roomShape) return;
  var builder = BEYOND_BUILDERS[themeIdx % BEYOND_BUILDERS.length];
  function placeBeyondProp(x, y) {
    var item = builder();
    item.position.set(x, 0, y);
    item.rotation.y = Math.random() * Math.PI * 2;
    var s = 0.6 + Math.random() * 0.5;
    item.scale.multiplyScalar(s);
    group.add(item);
  }
  if (roomShape.type === 'ring') {
    var count = 3 + Math.floor(Math.random() * 3);
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = roomShape.rInner * (0.15 + Math.random() * 0.55);
      placeBeyondProp(roomShape.cx + Math.cos(a) * r, roomShape.cy + Math.sin(a) * r);
    }
  } else if (roomShape.carveRects && roomShape.carveRects.length) {
    roomShape.carveRects.forEach(function (cr) {
      var area = (cr.x1 - cr.x0) * (cr.y1 - cr.y0);
      var n = Math.max(1, Math.min(3, Math.round(area / 12000)));
      for (var j = 0; j < n; j++) {
        placeBeyondProp(cr.x0 + Math.random() * (cr.x1 - cr.x0), cr.y0 + Math.random() * (cr.y1 - cr.y0));
      }
    });
  }
}

// Masque au sol des zones découpées : teinté de la couleur du ciel/brouillard du
// chapitre (pas un aplat sombre neutre, qui se lisait comme une flaque/piscine) —
// exactement la couleur contre laquelle se détache déjà le décor au-delà des murs,
// pour que la zone découpée se fonde visuellement dans ce même arrière-plan plutôt
// que de rester un morceau de sol normal texturé (elle N'EST PAS une zone de jeu).
function buildExteriorMaskMesh(shape, w, h, skyColorHex) {
  if (!shape) return null;
  var hasCarve = shape.type === 'ring' || (shape.carveRects && shape.carveRects.length);
  if (!hasCarve) return null;
  var res = 256;
  var canvas = document.createElement('canvas');
  canvas.width = res; canvas.height = res;
  var ctx = canvas.getContext('2d');
  var sx = res / w, sy = res / h;
  var cssColor = '#' + ('000000' + skyColorHex.toString(16)).slice(-6);
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, res, res);
  if (shape.type === 'ring') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(shape.cx * sx, shape.cy * sy, shape.rOuter * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = cssColor;
    ctx.beginPath();
    ctx.arc(shape.cx * sx, shape.cy * sy, shape.rInner * sx, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'destination-out';
    shape.testRects.forEach(function (r) {
      ctx.fillRect(r.x0 * sx, r.y0 * sy, (r.x1 - r.x0) * sx, (r.y1 - r.y0) * sy);
    });
  }
  var tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  var mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(w / 2, 0.35, h / 2);
  return mesh;
}

// Normale extérieure d'une arête axée (horizontale ou verticale — toutes les
// arêtes des formes polygonales de roomShapes.js le sont, unions de rectangles
// axés) : détermine par test de containment quel côté de l'arête est hors de la
// zone marchable, pour savoir dans quel sens excentrer le mur (même logique que
// l'ancien mur rectangulaire fixe, généralisée à un polygone quelconque).
function roomEdgeOutwardNormal(shape, x1, y1, x2, y2) {
  var midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
  var horizontal = Math.abs(y2 - y1) < 0.001;
  var eps = 3;
  if (horizontal) {
    var insideBelow = pointInRoomShape(shape, midX, midY + eps, 0.01);
    return insideBelow ? { x: 0, y: -1 } : { x: 0, y: 1 };
  }
  var insideRight = pointInRoomShape(shape, midX + eps, midY, 0.01);
  return insideRight ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

function buildArenaShell(scene) {
  var group = new THREE.Group();
  scene.add(group);
  var built = { w: 0, h: 0, theme: -1, shapeKey: null, ground: null, walls: [] };

  function rebuild(w, h, themeIdx, roomShape) {
    var shapeKey = roomShape ? roomShape.key : 'rect';
    if (built.w === w && built.h === h && built.theme === themeIdx && built.shapeKey === shapeKey) return;
    while (group.children.length) { var c = group.children.pop(); disposeObject(c); }
    built.w = w; built.h = h; built.theme = themeIdx; built.shapeKey = shapeKey;
    var palette = CHAPTER_GROUND_PALETTES[themeIdx % CHAPTER_GROUND_PALETTES.length];

    // Ciel + brouillard par chapitre : avant, la couleur de fond restait fixe (violet
    // neutre) quel que soit le thème, et rien ne fondait le décor lointain dans le
    // lointain — tout se découpait net jusqu'à l'horizon.
    //
    // ATTENTION taille du brouillard : un THREE.FogExp2 avec une densité mal calibrée
    // a fini par couvrir l'arène elle-même (jusqu'à 90% d'opacité sur les coins les
    // plus loin de la caméra), rendant le combat illisible — la caméra fixe de
    // frameArena() est bien plus loin de l'arène (jusqu'à ~1.87×`size` sur les coins)
    // qu'on ne l'imaginait. Un THREE.Fog linéaire avec un `near` calé au-delà de cette
    // distance mesurée (voir frameArena, camDist = size*1.55, position à 0.68/0.62 de
    // camDist) garantit qu'AUCUN brouillard ne touche la zone de jeu, quelle que soit
    // la taille d'arène tirée pour la run — seul le décor au-delà des murs (addBeyond-
    // Scenery) s'estompe, entre `near` et `far`.
    var fogSize = Math.max(w, h);
    scene.background = new THREE.Color(palette.sky);
    scene.fog = new THREE.Fog(palette.sky, fogSize * 2.05, fogSize * 3.4);

    var groundTex = window.Shared3D
      ? window.Shared3D.makeGroundTexture(palette.base, palette.spots, Math.max(4, Math.round(w / 90)))
      : null;
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.06, h * 1.06, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTex, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(w / 2, 0, h / 2);
    ground.receiveShadow = true;
    group.add(ground);
    var exteriorMask = buildExteriorMaskMesh(roomShape, w, h, palette.sky);
    if (exteriorMask) group.add(exteriorMask);

    var borderMat = new THREE.MeshStandardMaterial({ color: palette.border, roughness: 0.7, emissive: palette.border, emissiveIntensity: 0.12 });
    var trimMat = new THREE.MeshStandardMaterial({ color: palette.border, roughness: 0.4, emissive: palette.border, emissiveIntensity: 0.75 });
    var thick = Math.max(10, w * 0.02);
    var wallH = Math.max(14, w * 0.03);
    var trimH = wallH * 0.22;
    var pillarR = thick * 0.9, pillarH = wallH * 2.4;

    if (roomShape && roomShape.type === 'ring') {
      // Anneau : un unique mur cylindrique ouvert le long du cercle extérieur (pas de
      // piliers — une forme circulaire n'a pas de coins à marquer).
      var ringWall = new THREE.Mesh(
        new THREE.CylinderGeometry(roomShape.rOuter, roomShape.rOuter, wallH, 40, 1, true),
        borderMat
      );
      ringWall.position.set(roomShape.cx, wallH / 2, roomShape.cy);
      ringWall.castShadow = true;
      ringWall.receiveShadow = true;
      group.add(ringWall);
      var ringTrim = new THREE.Mesh(
        new THREE.CylinderGeometry(roomShape.rOuter * 1.005, roomShape.rOuter * 1.005, trimH, 40, 1, true),
        trimMat
      );
      ringTrim.position.set(roomShape.cx, wallH + trimH / 2, roomShape.cy);
      group.add(ringTrim);
    } else {
      // Rectangle/L/croix/haltère : mur+liseré+pilier généralisés au polygone extérieur
      // de la forme (4 sommets pour un rectangle = comportement identique à avant).
      var poly = (roomShape && roomShape.outerPolygon) ? roomShape.outerPolygon : [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
      var effShape = roomShape || makeRectangleRoomShape(w, h);
      for (var vi = 0; vi < poly.length; vi++) {
        var p1 = poly[vi], p2 = poly[(vi + 1) % poly.length];
        var horizontal = Math.abs(p2.y - p1.y) < 0.001;
        var length = horizontal ? Math.abs(p2.x - p1.x) : Math.abs(p2.y - p1.y);
        if (length < 0.5) continue;
        var normal = roomEdgeOutwardNormal(effShape, p1.x, p1.y, p2.x, p2.y);
        var midX = (p1.x + p2.x) / 2 + normal.x * thick / 2;
        var midY = (p1.y + p2.y) / 2 + normal.y * thick / 2;
        var bw = horizontal ? length : thick;
        var bd = horizontal ? thick : length;
        var wall = new THREE.Mesh(new THREE.BoxGeometry(bw, wallH, bd), borderMat);
        wall.position.set(midX, wallH / 2, midY);
        wall.castShadow = true;
        wall.receiveShadow = true;
        group.add(wall);
        // Liseré lumineux au sommet du mur : rend la bordure lisible et "conçue" plutôt
        // qu'un simple pavé plat, et sert de repère visuel net entre terrain et hors-jeu.
        var trim = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.01, trimH, bd * 1.01), trimMat);
        trim.position.set(midX, wallH + trimH / 2, midY);
        group.add(trim);
      }
      // Piliers : un par sommet du polygone (4 pour un rectangle = identique à avant).
      poly.forEach(function (c) {
        var pillar = new THREE.Mesh(new THREE.CylinderGeometry(pillarR, pillarR * 1.15, pillarH, 8), borderMat);
        pillar.position.set(c.x, pillarH / 2, c.y);
        pillar.castShadow = true;
        group.add(pillar);
        var cap = new THREE.Mesh(new THREE.SphereGeometry(pillarR * 1.3, 8, 8), trimMat);
        cap.position.set(c.x, pillarH, c.y);
        group.add(cap);
      });
    }

    addChapterDecor(group, w, h, themeIdx);
    addBeyondScenery(group, w, h, themeIdx);
    addCarveRubbleDecor(group, roomShape, themeIdx);
  }

  return { rebuild: rebuild };
}

// ---------------- Joueur ----------------
function buildPlayerMesh(scene) {
  var group = new THREE.Group();
  var body = new THREE.Mesh(
    new THREE.CapsuleGeometry(15, 26, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x241b22, roughness: 0.65, metalness: 0.05 })
  );
  body.position.y = 30;
  body.castShadow = true;
  group.add(body);

  var cape = new THREE.Mesh(
    new THREE.ConeGeometry(17, 38, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.8, side: THREE.DoubleSide })
  );
  cape.position.set(0, 26, -3);
  cape.rotation.x = Math.PI;
  cape.scale.set(1, 1, 0.5);
  cape.castShadow = true;
  group.add(cape);

  var sash = new THREE.Mesh(
    new THREE.BoxGeometry(4, 36, 4),
    new THREE.MeshStandardMaterial({ color: 0x7a1f22, roughness: 0.45, metalness: 0.1 })
  );
  sash.position.set(8, 32, 0);
  sash.rotation.z = 0.5;
  sash.castShadow = true;
  group.add(sash);

  var belt = new THREE.Mesh(
    new THREE.TorusGeometry(16, 2, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xd4af5a, roughness: 0.35, metalness: 0.75 })
  );
  belt.position.y = 20;
  belt.rotation.x = Math.PI / 2;
  belt.castShadow = true;
  group.add(belt);

  var head = new THREE.Mesh(
    new THREE.SphereGeometry(12, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xd9ab84, roughness: 0.55 })
  );
  head.position.y = 60;
  head.castShadow = true;
  group.add(head);
  var hair = new THREE.Mesh(
    new THREE.SphereGeometry(13, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0x241d28, roughness: 0.75 })
  );
  hair.position.y = 63;
  hair.castShadow = true;
  group.add(hair);
  var glow = new THREE.PointLight(0xffe0b0, 1.4, 220, 2);
  glow.position.y = 40;
  group.add(glow);
  scene.add(group);
  return { group: group, body: body, head: head };
}

// ---------------- Mannequin d'entraînement (armurerie, voir CB.isArmory) ----------------
// Un vrai personnage (paille/bois), pas une créature — même convention d'échelle unitaire
// que les autres (mis à l'échelle de e.r dans updateEnemyMesh), nom 'body' requis par
// createEnemyMesh juste après cet appel.
function buildDummyCreature(model) {
  var strawMat = new THREE.MeshStandardMaterial({ color: 0xc9b285, roughness: 0.85, metalness: 0.05 });
  var trimMat = new THREE.MeshStandardMaterial({ color: 0x6b5334, roughness: 0.7 });

  var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.62, 6, 10), strawMat);
  torso.position.y = 0.05;
  torso.name = 'body';
  model.add(torso);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), strawMat);
  head.position.y = 0.78;
  model.add(head);

  var armGeo = new THREE.CapsuleGeometry(0.09, 0.55, 4, 8);
  [-1, 1].forEach(function (side) {
    var arm = new THREE.Mesh(armGeo, trimMat);
    arm.position.set(side * 0.5, 0.18, 0);
    arm.rotation.z = Math.PI / 2;
    model.add(arm);
  });

  var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 8), trimMat);
  post.position.y = -0.45;
  model.add(post);
}

// ---------------- Ennemis : créatures organiques ----------------
// Chaque identité (15 ennemis + 5 boss) a sa PROPRE anatomie (torse/tête/membres/yeux)
// plutôt qu'un solide de base + accessoires — inspiré des silhouettes de monstres façon
// Hades. Convention commune : construit en "unité" centrée sur y=0 (torse au centre,
// tête au-dessus, pattes en dessous) — cette unité est ensuite mise à l'échelle du
// rayon de jeu réel (e.r) dans updateEnemyMesh, exactement comme l'ancien solide nu,
// donc la hitbox (dérivée de e.r) reste cohérente avec ce qui est affiché.

function newSkinMaterial(colorHex, style, opts) {
  opts = opts || {};
  var skin = window.Shared3D ? window.Shared3D.makeEnemySkinTexture(colorHex, style) : null;
  return new THREE.MeshStandardMaterial({
    color: opts.color || colorHex, map: skin,
    emissive: opts.emissive != null ? opts.emissive : colorHex,
    emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 0.32,
    roughness: opts.roughness != null ? opts.roughness : 0.55,
    metalness: opts.metalness != null ? opts.metalness : 0.08
  });
}
function makeEyeMesh(radius, color) {
  var eye = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 1.5 }));
  eye.name = 'eye';
  return eye;
}
function addEyePair(parent, center, spacing, radius, color) {
  [-1, 1].forEach(function (side) {
    var eye = makeEyeMesh(radius, color);
    eye.position.set(center.x + side * spacing, center.y, center.z);
    parent.add(eye);
  });
}

// ---- Tanks (square) : brutes trapues, 4 pattes massives, poings, armure lourde ----
var REAL_SQUARE_ASSET = { 1: 'yeti', 2: 'orc', 3: 'tribal', 4: 'mushroomking', 5: 'monkroose' };
function buildSquareCreature(model, e) {
  var tier = e.tier || 1;
  if (REAL_SQUARE_ASSET[tier] && window.Shared3D) {
    var realMesh = window.Shared3D.skinnedMeshFromAsset(REAL_SQUARE_ASSET[tier], e.color);
    if (realMesh) {
      realMesh.material.emissive = new THREE.Color(e.color);
      realMesh.name = 'body';
      model.add(realMesh);
      return;
    }
  }
  var colorHex = '#' + new THREE.Color(e.color).getHexString();
  var mat = newSkinMaterial(colorHex, 'metal', { roughness: 0.6, metalness: 0.25 });
  var trimMat = new THREE.MeshStandardMaterial({ color: 0x1c1620, roughness: 0.5, metalness: 0.35 });

  var torso = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), mat);
  torso.scale.set(1.05, 0.85, 1.15);
  torso.name = 'body';
  model.add(torso);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 12, 12), mat);
  head.position.set(0, 0.62, 0.55);
  model.add(head);
  addEyePair(model, new THREE.Vector3(0, 0.66, 0.92), 0.2, 0.09, 0xff5a3c);

  [[-0.55, 0.5], [0.55, 0.5], [-0.55, -0.45], [0.55, -0.45]].forEach(function (p) {
    var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.55, 4, 6), mat);
    leg.position.set(p[0], -0.6, p[1]);
    model.add(leg);
  });
  [-1, 1].forEach(function (side) {
    var arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 4, 6), mat);
    arm.position.set(side * 1.0, 0.05, 0.1);
    arm.rotation.z = side * 0.5;
    model.add(arm);
    var fist = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), trimMat);
    fist.position.set(side * 1.28, -0.22, 0.2);
    model.add(fist);
  });
  var band = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 6, 16), trimMat);
  band.rotation.x = Math.PI / 2;
  model.add(band);

  if (tier === 2) {
    // Bastion (tank_shield) : grande plaque-bouclier frontale
    var shield = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 1.4), trimMat);
    shield.position.set(0, 0, 0.95);
    model.add(shield);
  } else if (tier === 3) {
    // Colosse (tank_knockback) : biceps gonflés
    [-1, 1].forEach(function (side) {
      var bicep = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), mat);
      bicep.position.set(side * 1.02, 0.2, 0.1);
      model.add(bicep);
    });
  } else if (tier === 4) {
    // Golem (tank_slam) : masse portée sur l'épaule, prête à s'abattre
    var club = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.16, 0.85, 8), trimMat);
    club.position.set(0.85, 0.75, -0.15);
    club.rotation.z = 0.55;
    model.add(club);
  } else if (tier === 5) {
    // Titan (tank_charge) : cornes + posture penchée en avant (charge)
    [-1, 1].forEach(function (side) {
      var horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 6), trimMat);
      horn.position.set(side * 0.28, 1.0, 0.65);
      horn.rotation.x = -0.5;
      model.add(horn);
    });
    model.rotation.x = 0.14;
  }
}

// ---- Tireurs (triangle) : créatures félines/aviaires longilignes, armes organiques dorsales ----
var REAL_TRIANGLE_ASSET = { 1: 'birb', 2: 'ninja', 3: 'frog', 4: 'dino', 5: 'squidle' };
function buildTriangleCreature(model, e) {
  var tier = e.tier || 1;
  if (REAL_TRIANGLE_ASSET[tier] && window.Shared3D) {
    var realMesh = window.Shared3D.skinnedMeshFromAsset(REAL_TRIANGLE_ASSET[tier], e.color);
    if (realMesh) {
      realMesh.material.emissive = new THREE.Color(e.color);
      realMesh.name = 'body';
      model.add(realMesh);
      return;
    }
  }
  var colorHex = '#' + new THREE.Color(e.color).getHexString();
  var mat = newSkinMaterial(colorHex, 'metal', { roughness: 0.5, metalness: 0.15 });
  var accentMat = new THREE.MeshStandardMaterial({ color: 0x1c1620, roughness: 0.4, metalness: 0.5 });

  var torso = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8), mat);
  torso.rotation.x = 0.35;
  torso.name = 'body';
  model.add(torso);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), mat);
  head.position.set(0, 0.62, 0.55);
  model.add(head);
  addEyePair(model, new THREE.Vector3(0, 0.68, 0.8), 0.15, 0.07, 0xffe066);

  if (tier !== 5) {
    // Pattes au sol pour tous sauf l'Oracle, qui lévite (voir plus bas).
    [-1, 1].forEach(function (side) {
      var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.75, 4, 6), mat);
      leg.position.set(side * 0.3, -0.65, -0.1);
      leg.rotation.z = side * 0.12;
      model.add(leg);
    });
  }
  [-1, 1].forEach(function (side) {
    var fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 3), accentMat);
    fin.position.set(side * 0.35, 0.05, -0.6);
    fin.rotation.z = side * 0.6;
    fin.rotation.x = 0.4;
    model.add(fin);
  });

  if (tier === 2) {
    // Arbalétrier (ranged_burst) : double carquois dorsal
    [-0.16, 0.16].forEach(function (ox) {
      var quill = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.6, 6), accentMat);
      quill.position.set(ox, 0.5, -0.35);
      quill.rotation.x = 0.5;
      model.add(quill);
    });
  } else if (tier === 3) {
    // Sniper (ranged_snipe) : tête surdimensionnée + viseur
    head.scale.setScalar(1.3);
    var scope = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 6, 16), accentMat);
    scope.position.set(0, 0.68, 0.95);
    model.add(scope);
  } else if (tier === 4) {
    // Mortier (ranged_mortar) : sac dorsal bulbeux
    var sac = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), mat);
    sac.position.set(0, 0.55, -0.45);
    model.add(sac);
  } else if (tier === 5) {
    // Oracle (ranged_volley_teleport) : lévite (pas de pattes, voir plus haut), anneau
    // flottant façon prescience
    var oracleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.06, 8, 24),
      new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.9, roughness: 0.2 })
    );
    oracleRing.name = 'oracleRing';
    oracleRing.rotation.x = Math.PI / 2;
    model.add(oracleRing);
  }
}

// ---- Autres (circle) : essences mystiques — lévitent, sauf la Sangsue qui rampe ----
var REAL_CIRCLE_ASSET = { 1: 'ghost', 2: 'mushnub', 3: 'greenspikyblob', 4: 'wizard', 5: 'hywirl' };
function buildCircleCreature(model, e) {
  var tier = e.tier || 1;
  if (REAL_CIRCLE_ASSET[tier] && window.Shared3D) {
    var realMesh = window.Shared3D.skinnedMeshFromAsset(REAL_CIRCLE_ASSET[tier], e.color);
    if (realMesh) {
      realMesh.material.emissive = new THREE.Color(e.color);
      realMesh.name = 'body';
      model.add(realMesh);
      return;
    }
  }
  var colorHex = '#' + new THREE.Color(e.color).getHexString();
  var mat = newSkinMaterial(colorHex, 'organic', { roughness: 0.5, metalness: 0.05 });

  if (tier === 2) {
    // Sangsue (leech) : rampe au sol, corps allongé et bas, tentacules
    var lowTorso = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), mat);
    lowTorso.scale.set(1.3, 0.55, 1.6);
    lowTorso.position.y = -0.35;
    lowTorso.name = 'body';
    model.add(lowTorso);
    var lowHead = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 10), mat);
    lowHead.position.set(0, -0.3, 0.85);
    model.add(lowHead);
    addEyePair(model, new THREE.Vector3(0, -0.24, 1.1), 0.15, 0.06, 0xff8a4a);
    var tendMat = new THREE.MeshStandardMaterial({ color: 0x7a1f22, roughness: 0.6 });
    for (var j = 0; j < 5; j++) {
      var ta = (j / 5) * Math.PI * 2;
      var tend = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 6), tendMat);
      tend.position.set(Math.cos(ta) * 0.85, -0.55, Math.sin(ta) * 1.05);
      tend.rotation.x = Math.PI * 0.42;
      model.add(tend);
    }
    return;
  }

  // Les autres lévitent : masse globulaire centrée, pas de pattes.
  var torso = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 1), mat);
  torso.name = 'body';
  model.add(torso);

  if (tier === 1) {
    // Rôdeur (laser_sweep) : immense œil émetteur central
    var eyeRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 8, 24), new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff5a3c, emissiveIntensity: 1.1 }));
    eyeRing.name = 'eye';
    eyeRing.position.z = 0.65;
    model.add(eyeRing);
    var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.3 }));
    pupil.name = 'pupil';
    pupil.position.z = 0.7;
    model.add(pupil);
    for (var k = 0; k < 6; k++) {
      var ka = (k / 6) * Math.PI * 2;
      var lash = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), mat);
      lash.position.set(Math.cos(ka) * 0.8, Math.sin(ka) * 0.8, 0.05);
      model.add(lash);
    }
  } else if (tier === 3) {
    // Enflammé (explode) : fissures lumineuses + flammes montantes
    addEyePair(model, new THREE.Vector3(0, 0.1, 0.6), 0.22, 0.08, 0xffb066);
    var flameMat = new THREE.MeshStandardMaterial({ color: 0xff8a4a, emissive: 0xff5a1a, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 });
    for (var f = 0; f < 4; f++) {
      var fa = (f / 4) * Math.PI * 2;
      var flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 6), flameMat);
      flame.name = 'flame' + f;
      flame.position.set(Math.cos(fa) * 0.6, 0.65, Math.sin(fa) * 0.6);
      model.add(flame);
    }
  } else if (tier === 4) {
    // Chaman (buff/heal) : robe/capuche + orbe de soin flottant
    var robeMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a0, roughness: 0.7 });
    var robe = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.15, 10, 1, true), robeMat);
    robe.position.y = -0.45;
    model.add(robe);
    addEyePair(model, new THREE.Vector3(0, 0.1, 0.55), 0.16, 0.06, 0xf2d38f);
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 14), new THREE.MeshStandardMaterial({ color: 0xf2d38f, emissive: 0xf2d38f, emissiveIntensity: 1.1 }));
    orb.name = 'staffOrb';
    orb.position.set(0, 0.95, 0);
    model.add(orb);
  } else if (tier === 5) {
    // Spectre (phase) : forme fantomatique, lambeaux, yeux creux
    addEyePair(model, new THREE.Vector3(0, 0.1, 0.55), 0.19, 0.07, 0xbfe3ff);
    for (var w = 0; w < 3; w++) {
      var tail = new THREE.Mesh(new THREE.ConeGeometry(0.26 - w * 0.05, 0.7, 8), mat);
      tail.name = 'wisp' + w;
      tail.position.set(0, -0.25 - w * 0.25, -0.45 - w * 0.28);
      tail.rotation.x = Math.PI;
      model.add(tail);
    }
  }
}

// ---- Boss : les 5 versions les plus imposantes de leur famille, une identité propre ----
function buildBossCreature(model, e) {
  var behavior = e.behavior;

  // Test en cours (2026-08-11) : Colossaure utilise un vrai modèle 3D (géométrie
  // extraite hors-jeu d'un pack CC0, voir js3d/assets_monsters.js et
  // Shared3D.skinnedMeshFromAsset) au lieu de la créature procédurale, pour évaluer si le
  // rendu est meilleur — à étendre aux autres ennemis si concluant, sinon à retirer.
  var REAL_BOSS_ASSET = {
    boss_ultimate: 'demon',
    boss_guardian: 'bluedemon',
    boss_oracle: 'alien',
    boss_shaman: 'orcskull',
    boss_wraith: 'ghostskull'
  };
  if (REAL_BOSS_ASSET[behavior] && window.Shared3D) {
    var realMesh = window.Shared3D.skinnedMeshFromAsset(REAL_BOSS_ASSET[behavior], e.color);
    if (realMesh) {
      // meshFromAsset ne pose pas de couleur d'émission (texture d'origine du pack) —
      // sans ça, updateEnemyMesh qui pilote hitFlash/isFire/isGhost via
      // body.material.emissiveIntensity n'aurait aucun effet visible (émissif noir par
      // défaut). On la fixe sur la couleur de palier de l'ennemi, comme newSkinMaterial
      // le fait déjà pour les créatures procédurales.
      realMesh.material.emissive = new THREE.Color(e.color);
      realMesh.name = 'body';
      model.add(realMesh);
      return;
    }
  }

  var colorHex = '#' + new THREE.Color(e.color).getHexString();
  var mat = newSkinMaterial(colorHex, 'crystal', { roughness: 0.45, metalness: 0.2 });
  var trimMat = new THREE.MeshStandardMaterial({ color: 0x1c1620, roughness: 0.4, metalness: 0.45 });

  var torso = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 14), mat);
  torso.scale.set(1.1, 1.0, 1.15);
  torso.name = 'body';
  model.add(torso);

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 14), mat);
  head.position.set(0, 0.85, 0.55);
  model.add(head);
  addEyePair(model, new THREE.Vector3(0, 0.9, 0.95), 0.24, 0.1, 0xffffff);

  var core = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 16), new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.3 }));
  core.name = 'core';
  core.position.set(0, 0, 0.5);
  model.add(core);

  [[-0.6, 0.55], [0.6, 0.55], [-0.6, -0.5], [0.6, -0.5]].forEach(function (p) {
    var leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 6), mat);
    leg.position.set(p[0], -0.65, p[1]);
    leg.castShadow = true;
    model.add(leg);
  });
  [-1, 1].forEach(function (side) {
    var arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.75, 4, 6), mat);
    arm.position.set(side * 1.25, 0, 0.15);
    arm.rotation.z = side * 0.5;
    arm.castShadow = true;
    model.add(arm);
    var fist = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), trimMat);
    fist.position.set(side * 1.65, -0.4, 0.3);
    fist.castShadow = true;
    model.add(fist);
  });

  if (behavior === 'boss_ultimate') {
    // Colossaure : le plus massif, cornes doubles
    [-1, 1].forEach(function (side) {
      var horn = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 8), trimMat);
      horn.position.set(side * 0.32, 1.2, 0.7);
      horn.rotation.x = -0.4;
      horn.castShadow = true;
      model.add(horn);
    });
    model.scale.multiplyScalar(1.08);
  } else if (behavior === 'boss_guardian') {
    // Gardien de Sable : grandes plaques d'épaule dorées
    var plateMat = new THREE.MeshStandardMaterial({ color: 0xc9a15a, roughness: 0.35, metalness: 0.65 });
    [-1, 1].forEach(function (side) {
      var plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 1.05), plateMat);
      plate.position.set(side * 1.05, 0.35, 0.1);
      plate.rotation.z = side * -0.15;
      plate.castShadow = true;
      model.add(plate);
    });
  } else if (behavior === 'boss_oracle') {
    // Oracle Déchue : silhouette élancée/éthérée + grand halo flottant
    torso.scale.set(0.9, 1.25, 0.9);
    var ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.085, 10, 36), new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.9, roughness: 0.15 }));
    ring2.name = 'oracleRing';
    model.add(ring2);
  } else if (behavior === 'boss_shaman') {
    // Nécromant Ossuaire : crâne + bâton d'os
    var boneMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.6 });
    var skull = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), boneMat);
    skull.position.set(0, 1.15, 0.7);
    model.add(skull);
    var staff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.9, 6), boneMat);
    staff.position.set(1.2, 0.1, 0.3);
    staff.rotation.z = 0.15;
    staff.castShadow = true;
    model.add(staff);
    var staffTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 1.0 }));
    staffTop.position.set(1.2, 1.05, 0.3);
    model.add(staffTop);
  } else if (behavior === 'boss_wraith') {
    // Spectre Ancien : forme fantomatique géante, traînées translucides (le corps
    // partagé "mat" devient translucide via isGhost dans updateEnemyMesh — les
    // lambeaux ci-dessous réutilisent volontairement CE MÊME matériau pour ghoster
    // uniformément avec le reste du corps, pas un matériau séparé figé).
    for (var w = 0; w < 4; w++) {
      var tail = new THREE.Mesh(new THREE.ConeGeometry(0.35 - w * 0.06, 0.9, 8), mat);
      tail.name = 'wisp' + w;
      tail.position.set(0, -0.3 - w * 0.3, -0.7 - w * 0.35);
      tail.rotation.x = Math.PI;
      model.add(tail);
    }
  }
}

function createEnemyMesh(e) {
  var isBoss = e.shape === 'boss';
  var group = new THREE.Group();
  var model = new THREE.Group();
  model.name = 'model';
  group.add(model);

  if (e.isArmoryDummy) buildDummyCreature(model);
  else if (isBoss) buildBossCreature(model, e);
  else if (e.shape === 'square') buildSquareCreature(model, e);
  else if (e.shape === 'triangle') buildTriangleCreature(model, e);
  else buildCircleCreature(model, e);

  var body = model.getObjectByName('body');
  body.castShadow = true;
  body.receiveShadow = true;

  var shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
  );
  shadow.name = 'shadow';
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.5;
  group.add(shadow);

  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.12, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  ring.name = 'ring';
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  group.add(ring);

  var light = new THREE.PointLight(e.color, isBoss ? 3 : 0, isBoss ? 260 : 0, 2);
  light.name = 'light';
  group.add(light);

  // Lame de télégraphe (voir isEnemyTelegraphing/enemyTelegraphFrac, js/enemyRender.js,
  // partagées avec le rendu 2D) : cachée par défaut, la même géométrie sert pour tous
  // les types plutôt qu'un modèle par ennemi — demande explicite de VOIR l'ennemi lever
  // son arme avant de frapper, surtout les boss.
  var blade = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 1.3, 6),
    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xff5a3c, emissiveIntensity: 0.8, transparent: true, opacity: 0.9 })
  );
  blade.name = 'telegraphBlade';
  blade.visible = false;
  model.add(blade);

  return group;
}

var STATE_RING_COLORS = { elite: 0xffd700, speedBuff: 0x8fe3a0, shield: 0x88d4ff, telegraph: 0xff5a3c };

// Lissage d'angle avec repli correct autour de ±π (sinon un ennemi qui doit se
// retourner de 179° à -179° pivoterait dans le mauvais sens en passant par 0).
function lerpAngle3D(a, b, amt) {
  var diff = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + diff * amt;
}

function updateEnemyMesh(group, e, t) {
  var isBoss = e.shape === 'boss';
  var r = e.r;
  var isMoving = Math.abs(e.vx || 0) + Math.abs(e.vy || 0) > 6;
  var bobSpeed = isMoving ? 7.5 : 2.4;
  var bobAmp = (isBoss ? 0.22 : 0.14) * r * (isMoving ? 1 : 0.55);
  var bob = Math.max(0, Math.sin(t * bobSpeed + (e.animPhase || 0))) * bobAmp;
  var standH = r * (isBoss ? 0.95 : 0.72);

  group.position.set(e.x, standH + bob, e.y);
  var model = group.getObjectByName('model');
  model.scale.setScalar(r);
  // popScale : 0 à l'instant du spawn (petit), 1 une fois l'animation d'apparition
  // terminée (taille pleine, y reste ensuite) — inversé par erreur dans une version
  // précédente, ce qui coinçait tous les ennemis à 15% de leur taille en permanence.
  var spawnFrac = Math.min(1, (e.spawnTimer || 0) / 0.35);
  var popScale = 1 - spawnFrac * spawnFrac;
  group.scale.setScalar(0.15 + 0.85 * popScale);

  var body = model.getObjectByName('body');
  // Créatures à squelette réel (voir Shared3D.skinnedMeshFromAsset) : fait avancer le
  // clip de marche. render(t) ne fournit que le temps absolu, pas un delta — on le
  // dérive nous-mêmes par instance (stocké sur le group, pas la scène, pour rester
  // correct même si des ennemis apparaissent/disparaissent à des instants différents).
  if (body && body.userData && body.userData.mixer) {
    var lastT = group.userData._lastAnimT;
    var dt = lastT != null ? Math.min(0.1, Math.max(0, t - lastT)) : 0;
    group.userData._lastAnimT = t;
    body.userData.mixer.update(dt);
  }
  var flash = e.hitFlash > 0;
  var isGhost = (e.shape === 'circle' && e.tier === 5) || (isBoss && e.behavior === 'boss_wraith');
  var isFire = e.shape === 'circle' && e.tier === 3;
  if (flash) {
    body.material.emissiveIntensity = 1.4;
  } else if (isFire) {
    body.material.emissiveIntensity = 0.7 + Math.sin(t * 8 + (e.animPhase || 0)) * 0.35;
  } else {
    // Faible au repos : à 0.35 l'ancienne valeur, la teinte unie de palier (emissive)
    // s'ajoutait sur TOUTE la surface et écrasait le détail de la vraie texture du
    // modèle (tous les ennemis finissaient par se ressembler, juste "colorés
    // différemment"). Ici elle ne sert plus que d'accent discret — c'est la texture
    // qui porte le détail visuel, pas la teinte.
    body.material.emissiveIntensity = e.invulnOn ? 0.03 : 0.09;
  }
  if (isGhost) {
    body.material.transparent = true;
    body.material.opacity = 0.5 + Math.sin(t * 3 + (e.animPhase || 0)) * 0.12;
  } else {
    body.material.opacity = 1;
    body.material.transparent = false;
  }

  // Animations propres à certaines identités — voir buildSquareCreature/
  // buildTriangleCreature/buildCircleCreature/buildBossCreature pour la géométrie.
  if (isFire) {
    for (var f = 0; f < 4; f++) {
      var flame = model.getObjectByName('flame' + f);
      if (flame) { flame.scale.y = 1 + Math.sin(t * 6 + f) * 0.3; flame.material.opacity = 0.65 + Math.sin(t * 5 + f) * 0.2; }
    }
  }
  var eye = model.getObjectByName('eye');
  if (eye) { var pupil = model.getObjectByName('pupil'); var eyePulse = 1 + Math.sin(t * 5) * 0.15; eye.scale.setScalar(eyePulse); if (pupil) pupil.scale.setScalar(eyePulse); }
  var staffOrb = model.getObjectByName('staffOrb');
  if (staffOrb) staffOrb.position.y = 0.95 + Math.sin(t * 2.5 + (e.animPhase || 0)) * 0.14;
  var oracleRing = model.getObjectByName('oracleRing');
  if (oracleRing) { oracleRing.rotation.z = t * 1.2; oracleRing.rotation.x = Math.PI / 2 + Math.sin(t * 0.6) * 0.3; }
  var core = model.getObjectByName('core');
  if (core) core.material.emissiveIntensity = 1.1 + Math.sin(t * 6 + (e.animPhase || 0)) * 0.4;
  for (var wIdx = 0; wIdx < 4; wIdx++) {
    var wisp = model.getObjectByName('wisp' + wIdx);
    if (wisp) wisp.position.x = Math.sin(t * 2 + wIdx) * 0.15;
  }

  var shadow = group.getObjectByName('shadow');
  shadow.scale.setScalar(r * 1.15);
  shadow.position.y = -(standH + bob) + 0.5;

  var ring = group.getObjectByName('ring');
  var ringColor = null;
  if (e.isElite) ringColor = STATE_RING_COLORS.elite;
  if (e.speedBuffTimer > 0) ringColor = STATE_RING_COLORS.speedBuff;
  if (e.shieldOn) ringColor = STATE_RING_COLORS.shield;
  if (isEnemyTelegraphing(e)) ringColor = STATE_RING_COLORS.telegraph;
  if (ringColor != null) {
    ring.visible = true;
    ring.material.color.set(ringColor);
    ring.scale.setScalar(r * 1.35);
    ring.position.y = -(standH + bob) + r * 0.1;
  } else {
    ring.visible = false;
  }

  var light = group.getObjectByName('light');
  if (isBoss) light.intensity = 2.4 + Math.sin(t * 3) * 0.5;

  // Lame de télégraphe : levée en arrière au début du geste, s'abat vers l'avant à
  // l'approche du coup (même logique que partTelegraphRaise en 2D) — visible pour
  // n'importe quel type d'ennemi sans modèle dédié par créature.
  var blade = model.getObjectByName('telegraphBlade');
  if (blade) {
    if (isEnemyTelegraphing(e)) {
      var teleFrac = enemyTelegraphFrac(e, t);
      blade.visible = true;
      blade.position.set(0, 1.1, -0.2);
      blade.rotation.set(-0.9 + teleFrac * 1.6, 0, 0);
      blade.scale.setScalar(isBoss ? 1.6 : 1);
      blade.material.emissiveIntensity = 0.6 + teleFrac * 1.3;
      blade.material.opacity = 0.55 + teleFrac * 0.45;
    } else {
      blade.visible = false;
    }
  }

  // Orientation : suit la direction de déplacement (lissée), au lieu de tourner en
  // continu sans raison — un ennemi qui se tourne vers là où il va se lit comme
  // vivant plutôt que comme un objet qui pivote sur lui-même.
  if (isMoving) {
    var targetAngle = Math.atan2(e.vx, e.vy);
    e._facing3d = (e._facing3d == null) ? targetAngle : lerpAngle3D(e._facing3d, targetAngle, 0.18);
  } else if (e._facing3d == null) {
    e._facing3d = 0;
  }
  group.rotation.y = e._facing3d;
}

// ---------------- Barre de PV (billboard, objet à part du groupe qui tourne) --------
function createHealthBar() {
  var group = new THREE.Group();
  var bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x1a1420, transparent: true, opacity: 0.82, depthTest: false })
  );
  bg.name = 'bg';
  bg.renderOrder = 10;
  group.add(bg);
  var fillAnchor = new THREE.Group();
  fillAnchor.name = 'fillAnchor';
  group.add(fillAnchor);
  var fillGeo = new THREE.PlaneGeometry(1, 1);
  fillGeo.translate(0.5, 0, 0); // ancré à son bord gauche pour rétrécir depuis la droite
  var fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0x8fe3a0, depthTest: false }));
  fill.name = 'fill';
  fill.position.z = 0.02;
  fill.renderOrder = 11;
  fillAnchor.add(fill);
  return group;
}
function updateHealthBar(group, e, camera) {
  var width = e.r * 2.3, height = Math.max(2.6, e.r * 0.26);
  var frac = Math.max(0, Math.min(1, e.hp / e.maxHp));
  group.position.set(e.x, e.r * (e.shape === 'boss' ? 2.4 : 2.1) + 6, e.y);
  group.quaternion.copy(camera.quaternion); // billboard : toujours face caméra
  group.getObjectByName('bg').scale.set(width, height, 1);
  var fillAnchor = group.getObjectByName('fillAnchor');
  fillAnchor.position.x = -width / 2;
  var fill = fillAnchor.getObjectByName('fill');
  fill.scale.set(width * frac, height * 0.78, 1);
  fill.material.color.setHSL(frac * 0.33, 0.75, 0.5); // rouge (bas) -> vert (plein)
}

// ---------------- Effets d'armes (joueur + ennemis) ---------------------------------
// Toutes les attaques (dash, épée, laser, météore, poussée, grappin, explosions/
// télégraphes ennemis, particules) — sans ça le joueur ne voit littéralement aucun
// retour visuel de ses propres coups une fois la 3D active.

function createDashTrailMesh() {
  return new THREE.Mesh(new THREE.BoxGeometry(9, 9, 1), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.75 }));
}
function updateDashTrailMesh(mesh, tr) {
  var mx = (tr.x1 + tr.x2) / 2, mz = (tr.y1 + tr.y2) / 2;
  var dx = tr.x2 - tr.x1, dz = tr.y2 - tr.y1;
  var len = Math.max(1, Math.sqrt(dx * dx + dz * dz));
  mesh.position.set(mx, 12, mz);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.scale.set(1, 1, len);
  mesh.material.opacity = 0.75 * Math.max(0, tr.life / tr.maxLife);
}

function createGrappleMesh() {
  return new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 1), new THREE.MeshBasicMaterial({ color: 0x7db4ff, transparent: true, opacity: 0.85 }));
}
function updateGrappleMesh(mesh, r) {
  var mx = (r.x1 + r.x2) / 2, mz = (r.y1 + r.y2) / 2;
  var dx = r.x2 - r.x1, dz = r.y2 - r.y1;
  var len = Math.max(1, Math.sqrt(dx * dx + dz * dz));
  mesh.position.set(mx, 16, mz);
  mesh.rotation.y = Math.atan2(dx, dz);
  mesh.scale.set(1, 1, len);
  mesh.material.opacity = 0.85 * Math.max(0, r.life / r.maxLife);
}

// Épée : la version précédente orientait l'arc via rotation.y en plus de
// rotation.x=-PI/2 — un cas de verrouillage de cardan (gimbal lock) de l'ordre Euler
// XYZ par défaut quand X vaut exactement -90° : rotation.y bascule alors l'anneau à la
// VERTICALE au lieu de le faire pivoter dans le plan du sol, si bien que l'effet ne
// pointait jamais vers la cible visée (confirmé par calibrage direct). Corrigé en
// pivotant sur rotation.z à la place (appliqué en dernier dans l'ordre XYZ, donc jamais
// couplé à la rotation.x qui aplatit l'anneau au sol) — désormais rotation.z = -sw.angle
// pointe exactement là où le coup a été porté. Reconstruit aussi en groupe à deux
// couches (zone remplie + liseré lumineux) pour vraiment lire comme un coup d'épée
// plutôt qu'un simple contour fin, et couvre exactement SWORD_RANGE/SWORD_ARC — la vraie
// zone de dégâts, pas une approximation.
function createSwordMesh() {
  var group = new THREE.Group();
  var fillGeo = new THREE.RingGeometry(SWORD_RANGE * 0.1, SWORD_RANGE, 28, 1, -SWORD_ARC / 2, SWORD_ARC);
  var fill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  fill.name = 'fill';
  group.add(fill);
  var edgeGeo = new THREE.RingGeometry(SWORD_RANGE * 0.92, SWORD_RANGE, 28, 1, -SWORD_ARC / 2, SWORD_ARC);
  var edge = new THREE.Mesh(edgeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
  edge.name = 'edge';
  edge.position.y = 0.5;
  group.add(edge);
  group.rotation.x = -Math.PI / 2;
  return group;
}
function updateSwordMesh(group, sw) {
  group.position.set(sw.x, 14, sw.y);
  group.rotation.z = -sw.angle;
  var frac = Math.max(0, sw.life / sw.maxLife);
  group.getObjectByName('fill').material.opacity = 0.55 * frac;
  group.getObjectByName('edge').material.opacity = 0.95 * frac;
}

function createPulseMesh() {
  var mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: 0x88d4ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
function updatePulseMesh(mesh, pr) {
  var frac = Math.max(0, pr.life / pr.maxLife);
  mesh.position.set(pr.x, 6, pr.y);
  mesh.scale.setScalar(Math.max(1, pr.radius * (1 - frac)));
  mesh.material.opacity = 0.7 * frac;
}

function createBlastMesh() {
  var group = new THREE.Group();
  var ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.name = 'ring';
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  var flash = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0 }));
  flash.name = 'flash';
  group.add(flash);
  return group;
}
function updateBlastMesh(group, b) {
  group.position.set(b.x, 0, b.y);
  var ring = group.getObjectByName('ring');
  var flash = group.getObjectByName('flash');
  if (b.delay > 0) {
    var frac = b.delay / (b.maxDelay || 1);
    ring.visible = true;
    ring.position.y = 0.6;
    ring.scale.setScalar(Math.max(1, b.radius));
    ring.material.color.set(b.color || '#ff5a3c');
    ring.material.opacity = 0.3 + (1 - frac) * 0.55;
    flash.visible = false;
  } else {
    ring.visible = false;
    flash.visible = true;
    flash.position.y = b.radius * 0.3;
    flash.scale.setScalar(b.radius * 0.85);
    flash.material.color.set(b.color || '#ff5a3c');
    flash.material.opacity = 0.55;
  }
}

function createLaserMesh() {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 8, 1), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.8 }));
}
function updateLaserMesh(mesh, l) {
  var telegraphing = l.telegraph > 0;
  var half = l.length / 2;
  mesh.position.set(l.x + Math.cos(l.angle) * half, 10, l.y + Math.sin(l.angle) * half);
  mesh.rotation.y = -l.angle + Math.PI / 2;
  var w = telegraphing ? Math.max(2, l.width * 0.12) : l.width;
  mesh.scale.set(w, 1, l.length);
  mesh.material.color.set(l.color || '#ff5a3c');
  mesh.material.opacity = telegraphing ? 0.3 : 0.85;
}

function createParticleMesh() {
  return new THREE.Mesh(new THREE.SphereGeometry(1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
}
function updateParticleMesh(mesh, pt) {
  mesh.position.set(pt.x, 8, pt.y);
  mesh.scale.setScalar(pt.size || 3);
  mesh.material.color.set(pt.color || '#ffffff');
  mesh.material.opacity = Math.max(0, pt.life / pt.maxLife);
}

// ---------------- Projectiles / mines / blocs / zones ----------------
function createProjectileMesh() {
  var mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  return mesh;
}
function updateProjectileMesh(mesh, pr) {
  mesh.position.set(pr.x, 12, pr.y);
  mesh.scale.setScalar(pr.r || 6);
  mesh.material.color.set(pr.color || '#f2603f');
}

// Palette de rocher par chapitre (même index que CHAPTER_GROUND_PALETTES) : grès pâle
// aux Sables, mousse humide au Marécage, basalte calciné à la Braise, cristal sombre à
// l'Abîme — au lieu d'un gris-violet unique partout, sans lien avec le décor autour.
var ROCK_PALETTES = [
  { color: 0x8a7a60, emissive: 0x3a3020, intensity: 0.25 }, // Sables
  { color: 0x4a5c48, emissive: 0x1c2a1a, intensity: 0.2 },  // Marécage
  { color: 0x3a2420, emissive: 0xc9503f, intensity: 0.35 }, // Braise (braise interne visible)
  { color: 0x342c48, emissive: 0xb34bf2, intensity: 0.3 }   // Abîme
];
function createBlockMesh() {
  // Géométrie irrégulière propre à chaque rocher (sommets décalés au hasard) plutôt
  // qu'un solide parfait partagé — beaucoup plus organique/réaliste vu de près.
  var geo = window.Shared3D ? window.Shared3D.makeRockGeometry(0.22) : new THREE.DodecahedronGeometry(1, 1);
  var palette = ROCK_PALETTES[currentChapterIdx3D()];
  var mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: palette.color, roughness: 0.85, emissive: palette.emissive, emissiveIntensity: palette.intensity })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function updateBlockMesh(mesh, b) {
  mesh.position.set(b.x, b.r * 0.6, b.y);
  mesh.scale.set(b.r, b.r * 1.1, b.r);
}

// Doit rester identique à ZONE_STYLES (js/render.js) — ce mapping était en réalité
// désynchronisé de sa contrepartie 2D sur PRESQUE toutes les entrées (grapple/slow
// inversés, speed/heal inversés, converted_trap/abyss_rift identiques) : la couleur
// d'une zone changeait selon qu'on jouait en 3D ou en secours 2D, une vraie source de
// confusion. trap_spike/trap_arrow ont désormais leur propre maillage dédié (voir plus
// bas) et ne passent plus par ce système générique.
var ZONE_COLORS = {
  slow: 0x7db4ff, speed: 0xf2d060, heal: 0x8fe3a0, flame: 0xff6e46, grapple: 0x9b5cf0,
  converted_trap: 0xff4fa3, abyss_rift: 0x4be8f2, chapter_relic: 0xf2a63f
};
// Icône flottante propre à chaque type de zone : jusqu'ici toutes les zones étaient un
// disque plat identique, seule la couleur changeait — insuffisant pour ne pas les
// confondre (l'écart de couleur seul ne suffit pas à distance ou pour un daltonien).
// Une vraie forme distincte par type, en plus de la couleur corrigée juste au-dessus.
function buildZoneIcon(kind) {
  var color = ZONE_COLORS[kind] || 0xffffff;
  var mat = new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.7, roughness: 0.35 });
  if (kind === 'heal') {
    var g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.14), mat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.14), mat));
    return g;
  }
  if (kind === 'speed') {
    var g2 = new THREE.Group();
    [-0.16, 0.16].forEach(function (ox) {
      var chevron = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 3), mat);
      chevron.rotation.z = -Math.PI / 2;
      chevron.position.x = ox;
      g2.add(chevron);
    });
    return g2;
  }
  if (kind === 'slow') return new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.07, 8, 16), mat);
  if (kind === 'grapple') {
    var g3 = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.22;
    g3.add(ring);
    var hook = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 6), mat);
    hook.position.y = -0.05;
    g3.add(hook);
    return g3;
  }
  if (kind === 'converted_trap') return new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 5), mat);
  if (kind === 'abyss_rift') {
    var g4 = new THREE.Group();
    var r1 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 16), mat);
    var r2 = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 16), mat);
    r2.rotation.x = Math.PI / 2;
    r2.name = 'r2';
    r1.name = 'r1';
    g4.add(r1, r2);
    return g4;
  }
  if (kind === 'chapter_relic') return new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mat);
  if (kind === 'flame') {
    // Manquait à l'appel : seule zone sans icône dédiée, confondue avec les autres
    // disques teintés en un coup d'œil (voir demande utilisateur sur la lisibilité).
    var g5 = new THREE.Group();
    g5.add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), mat));
    var innerMat = new THREE.MeshStandardMaterial({ color: 0xffe3a0, emissive: 0xffcf6e, emissiveIntensity: 1.2, roughness: 0.3 });
    var inner = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 8), innerMat);
    inner.position.y = -0.05;
    g5.add(inner);
    return g5;
  }
  return null;
}

// Habillage statique (généré une fois à la création de la zone, jamais reconstruit
// par frame) pour 3 types de zone dont le mécanisme profite d'un vrai décor plutôt
// que juste une icône flottante — la zone se lit "ce que c'est" au premier coup
// d'œil (une source qui soigne a l'air d'une source, pas d'un disque vert générique).
function buildZoneDressing(kind) {
  if (kind === 'heal') {
    var g = new THREE.Group();
    var stemMat = new THREE.MeshStandardMaterial({ color: 0x2e5c2a, roughness: 0.8 });
    var flowerMat = new THREE.MeshStandardMaterial({ color: 0x8fe3a0, emissive: 0x8fe3a0, emissiveIntensity: 0.9 });
    var count = 4;
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      var r = 0.35 + Math.random() * 0.3;
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.16, 5), stemMat);
      stem.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      g.add(stem);
      var flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), flowerMat);
      flower.position.set(Math.cos(a) * r, 0.17, Math.sin(a) * r);
      g.add(flower);
    }
    return g;
  }
  if (kind === 'flame') {
    var g2 = new THREE.Group();
    var scorch = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x140a08, roughness: 0.95 })
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.y = 0.015;
    g2.add(scorch);
    var emberMat = new THREE.MeshStandardMaterial({ color: 0xff6e30, emissive: 0xff5a1a, emissiveIntensity: 1.4 });
    for (var j = 0; j < 4; j++) {
      var ea = Math.random() * Math.PI * 2, er = 0.3 + Math.random() * 0.35;
      var ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), emberMat);
      ember.position.set(Math.cos(ea) * er, 0.03, Math.sin(ea) * er);
      ember.scale.y = 0.4;
      g2.add(ember);
    }
    return g2;
  }
  if (kind === 'grapple') {
    var plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.34, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: 0x342c40, roughness: 0.7 })
    );
    plinth.position.y = 0.09;
    return plinth;
  }
  return null;
}

function createZoneMesh(z) {
  var group = new THREE.Group();
  var fill = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  fill.name = 'fill';
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.4;
  group.add(fill);
  // Contour net en plus du disque translucide : sans lui, une zone de la même teinte
  // que le sol pouvait devenir quasiment illisible malgré l'opacité.
  var rim = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  );
  rim.name = 'rim';
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.45;
  group.add(rim);
  var icon = z ? buildZoneIcon(z.kind) : null;
  if (icon) {
    icon.name = 'icon';
    group.add(icon);
  }
  var dressing = z ? buildZoneDressing(z.kind) : null;
  if (dressing) {
    dressing.name = 'dressing';
    group.add(dressing);
  }
  return group;
}
function updateZoneMesh(group, z, t) {
  group.position.set(z.x, 0, z.y);
  // icon est un enfant de group : group.scale=z.r ci-dessous s'applique déjà à lui, donc
  // ses propres scale/position restent en unités RELATIVES fixes (pas multipliées par
  // z.r ici, sans quoi l'icône finirait mise à l'échelle au carré du rayon).
  var icon = group.getObjectByName('icon');
  if (icon) {
    icon.scale.setScalar(0.55);
    icon.position.y = 0.35 + Math.sin((t || 0) * 2 + z.x * 0.02) * 0.06;
    if (z.kind === 'abyss_rift') {
      var r1 = icon.getObjectByName('r1'), r2 = icon.getObjectByName('r2');
      if (r1) r1.rotation.z = (t || 0) * 1.4;
      if (r2) r2.rotation.y = (t || 0) * -1.8;
    } else {
      icon.rotation.y = (t || 0) * 0.8;
    }
  }
  group.scale.setScalar(z.r);
  var color = ZONE_COLORS[z.kind] || 0xffffff;
  var fade = z.life != null && z.maxLife ? Math.max(0, z.life / z.maxLife) : 1;
  var fill = group.getObjectByName('fill');
  fill.material.color.set(color);
  fill.material.opacity = 0.6 * fade;
  var rim = group.getObjectByName('rim');
  rim.material.color.set(color);
  rim.material.opacity = 0.95 * fade;
}

// Pièges : maillages dédiés (comme la tourelle) au lieu du disque coloré générique
// (createZoneMesh) — un vrai mécanisme qui se lit d'un coup d'œil, cohérent avec leur
// rendu 2D déjà détaillé (drawSpikeTrap/drawArrowTrap dans render.js).
var SPIKE_TRAP_SPIKE_COUNT = 7;
function createSpikeTrapMesh() {
  var group = new THREE.Group();
  var base = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a352f, roughness: 0.85 })
  );
  group.add(base);
  var spikeMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.4, metalness: 0.5 });
  for (var i = 0; i < SPIKE_TRAP_SPIKE_COUNT; i++) {
    var spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 1, 5), spikeMat.clone());
    spike.name = 'spike' + i;
    var a = (i / SPIKE_TRAP_SPIKE_COUNT) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 0.55, 0.14, Math.sin(a) * 0.55);
    group.add(spike);
  }
  return group;
}
function updateSpikeTrapMesh(group, z) {
  group.position.set(z.x, 0, z.y);
  group.scale.setScalar(z.r);
  var elapsed = (typeof CB !== 'undefined' && CB) ? (CB.elapsed || 0) : 0;
  var cyclePos = (elapsed + (z.phaseOffset || 0)) % SPIKE_TRAP_CYCLE;
  var activeStart = SPIKE_TRAP_CYCLE - SPIKE_TRAP_ACTIVE_DUR;
  var riseTime = SPIKE_TRAP_ACTIVE_DUR * 0.3;
  var raised = Math.max(0, Math.min(1, (cyclePos - activeStart) / riseTime));
  for (var i = 0; i < SPIKE_TRAP_SPIKE_COUNT; i++) {
    var spike = group.getObjectByName('spike' + i);
    spike.scale.y = 0.2 + raised * 1.1;
    spike.material.emissive.set(raised > 0.25 ? 0xff4433 : 0x000000);
    spike.material.emissiveIntensity = raised * 0.7;
  }
}

function createArrowTrapMesh() {
  var group = new THREE.Group();
  var post = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.85 })
  );
  post.position.y = 0.35;
  group.add(post);
  var socket = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x17130d, emissive: 0xc9503f, emissiveIntensity: 0 })
  );
  socket.name = 'socket';
  socket.position.y = 0.55;
  group.add(socket);
  return group;
}
function updateArrowTrapMesh(group, z) {
  group.position.set(z.x, 0, z.y);
  group.scale.setScalar(1.4);
  var socket = group.getObjectByName('socket');
  socket.material.emissiveIntensity = z.telegraphOn ? 1.3 : 0;
}

// Tourelle : un vrai bug faisait flotter le cœur (bille bleue) bien au-dessus de la
// base (son décalage Y était appliqué en coordonnées LOCALES alors que le groupe entier
// est déjà positionné à y=8, doublant l'offset — base et cœur finissaient visuellement
// déconnectés, illisible comme "une tourelle"). Reconstruite en une seule pièce cohérente
// à taille fixe (indépendante de tu, contrairement à avant), avec une vraie lumière
// ponctuelle (max 4 tourelles à la fois, donc jamais plus de 4 lumières en plus) pour
// qu'elle reste repérable même noyée dans le décor de chapitre.
var TURRET_MESH_R = 15;
function createTurretMesh() {
  var group = new THREE.Group();
  var base = new THREE.Mesh(
    new THREE.CylinderGeometry(TURRET_MESH_R * 0.85, TURRET_MESH_R, TURRET_MESH_R * 0.55, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2233, roughness: 0.55, metalness: 0.35 })
  );
  base.position.y = TURRET_MESH_R * 0.28;
  base.castShadow = true;
  group.add(base);
  var mast = new THREE.Mesh(
    new THREE.CylinderGeometry(TURRET_MESH_R * 0.14, TURRET_MESH_R * 0.18, TURRET_MESH_R * 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3040, roughness: 0.5, metalness: 0.4 })
  );
  mast.position.y = TURRET_MESH_R * 0.28 + TURRET_MESH_R * 0.55 / 2 + TURRET_MESH_R * 0.7;
  group.add(mast);
  var core = new THREE.Mesh(
    new THREE.SphereGeometry(TURRET_MESH_R * 0.4, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x7db4ff, emissiveIntensity: 1.4 })
  );
  core.name = 'core';
  core.position.y = mast.position.y + TURRET_MESH_R * 0.7 + TURRET_MESH_R * 0.4;
  group.add(core);
  var light = new THREE.PointLight(0x7db4ff, 4, TURRET_RANGE * 1.3, 2);
  light.position.copy(core.position);
  group.add(light);
  return group;
}
function updateTurretMesh(group, tu, t) {
  group.position.set(tu.x, 0, tu.y);
  var core = group.getObjectByName('core');
  var pulse = 1 + Math.sin(t * 4) * 0.18;
  core.scale.setScalar(pulse);
}

// ---------------- Présentoirs d'armes (armurerie, voir enterArmory dans js/game.js) ----
// Un socle simple + une icône emoji flottante (voir Shared3D.makeEmojiSprite) : pas besoin
// d'une géométrie dédiée par arme, l'icône déjà utilisée partout ailleurs (HUD, menus,
// voir WEAPON_ICONS dans combat.js) suffit à identifier chaque présentoir d'un coup d'œil.
var PEDESTAL_R = 18;
function buildPedestalMesh(ped) {
  var group = new THREE.Group();
  var color = ped.type === 1 ? 0xe3b968 : 0x7db4ff;
  var base = new THREE.Mesh(
    new THREE.CylinderGeometry(PEDESTAL_R, PEDESTAL_R * 1.1, PEDESTAL_R * 0.8, 10),
    new THREE.MeshStandardMaterial({ color: 0x2c2433, roughness: 0.8 })
  );
  base.position.y = PEDESTAL_R * 0.4;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  var ring = new THREE.Mesh(
    new THREE.TorusGeometry(PEDESTAL_R * 0.7, PEDESTAL_R * 0.08, 8, 20),
    new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.8, roughness: 0.35 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = PEDESTAL_R * 0.82;
  group.add(ring);
  if (window.Shared3D) {
    var icon = window.Shared3D.makeEmojiSprite(WEAPON_ICONS[ped.id] || '❓', PEDESTAL_R * 1.5);
    icon.name = 'icon';
    icon.position.y = PEDESTAL_R * 1.9;
    group.add(icon);
  }
  var light = new THREE.PointLight(color, 2.2, PEDESTAL_R * 6, 2);
  light.position.y = PEDESTAL_R * 1.5;
  group.add(light);
  return group;
}
function updatePedestalMesh(group, ped, t) {
  group.position.set(ped.x, 0, ped.y);
  var icon = group.getObjectByName('icon');
  if (icon) icon.position.y = PEDESTAL_R * 1.9 + Math.sin((t || 0) * 2 + ped.x * 0.05) * 2;
}

// Nombre de dégâts flottant par coup sur le mannequin (voir updateArmoryHitNumbers,
// combat.js) — texte dessiné sur un canvas (contenu différent à chaque coup, donc pas
// mis en cache comme Shared3D.makeEmojiSprite qui réutilise toujours les mêmes emoji).
function buildHitNumberMesh(n) {
  var size = 128;
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  var ctx2d = canvas.getContext('2d');
  ctx2d.font = '800 52px Inter, sans-serif';
  ctx2d.textAlign = 'center';
  ctx2d.textBaseline = 'middle';
  ctx2d.shadowColor = '#000';
  ctx2d.shadowBlur = 6;
  ctx2d.fillStyle = '#ffb08a';
  ctx2d.fillText('-' + n.amount, size / 2, size / 2);
  var tex = new THREE.CanvasTexture(canvas);
  if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(22, 22, 1);
  return sprite;
}
function updateHitNumberMesh(sprite, n) {
  var frac = Math.max(0, n.life / n.maxLife);
  var rise = (1 - frac) * ARMORY_HIT_NUMBER_RISE;
  sprite.position.set(n.x, 55 + rise, n.y);
  sprite.material.opacity = frac;
}

function initCombat3D() {
  var canvas = document.getElementById('combatCanvas3D');
  if (!canvas || typeof THREE.WebGLRenderer !== 'function') return null;

  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
  catch (e) { return null; }
  if (!renderer) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (window.Shared3D) window.Shared3D.setupRenderer(renderer);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1622);

  var camera = new THREE.PerspectiveCamera(50, 16 / 9, 1, 4000);

  scene.add(new THREE.HemisphereLight(0xccc0e0, 0x4a3f56, 2.0));
  var sun = new THREE.DirectionalLight(0xffe9cc, 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(sun.target);
  var fill = new THREE.DirectionalLight(0xd8c8ff, 0.7);
  fill.position.set(300, 400, -150);
  scene.add(fill);

  var arenaShell = buildArenaShell(scene);
  var player = buildPlayerMesh(scene);

  var enemyMap = new Map(), healthBarMap = new Map(), blockMap = new Map(), zoneMap = new Map(), turretMap = new Map(), pedestalMap = new Map(), hitNumberMap = new Map();
  var spikeTrapMap = new Map(), arrowTrapMap = new Map();
  var projectilePool = makePool(scene, createProjectileMesh);
  var knifePool = makePool(scene, createProjectileMesh);
  var dashTrailPool = makePool(scene, createDashTrailMesh);
  var grapplePool = makePool(scene, createGrappleMesh);
  var swordPool = makePool(scene, createSwordMesh);
  var pulsePool = makePool(scene, createPulseMesh);
  var blastPool = makePool(scene, createBlastMesh);
  var laserPool = makePool(scene, createLaserMesh);
  var particlePool = makePool(scene, createParticleMesh);
  var groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  var raycaster = new THREE.Raycaster();

  // Brasier (compagnon de flamme, singleton — voir arme type 1 "flame"), laser du
  // joueur et charge de météore ne sont pas des tableaux CB : état spécial du joueur,
  // gérés à part plutôt que via un pool.
  var brasierMesh = (function () {
    var group = new THREE.Group();
    var core = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff8a4a, emissive: 0xff5a1a, emissiveIntensity: 1.6 }));
    core.name = 'core';
    group.add(core);
    // Halo externe semi-transparent : donne du volume/une aura de chaleur au lieu
    // d'une simple boule pleine, en plus d'être deux fois plus gros que la version
    // précédente (jugée trop petite/peu visible).
    var halo = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 14), new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.35 }));
    halo.name = 'halo';
    group.add(halo);
    var light = new THREE.PointLight(0xff8a4a, 11, 240, 2);
    group.add(light);
    group.visible = false;
    scene.add(group);
    return group;
  })();
  // Bien plus gros et détaillé qu'un simple pavé plat (demandé) : deux vraies pales en V,
  // matériau doré métallique + cœur lumineux + lumière ponctuelle, cohérent avec le reste
  // de l'arsenal (tourelle, épée) plutôt qu'un solide unicolore terne.
  var boomerangMesh = (function () {
    // Échelle dérivée de BOOMERANG_R (combat.js, coordonnées de jeu = coordonnées 3D
    // directement) : le maillage précédent (un simple pavé de 2.2 unités) était minuscule
    // comparé au joueur (rayon de capsule 15) — quasi invisible à l'échelle de la scène.
    var BR = (typeof BOOMERANG_R !== 'undefined') ? BOOMERANG_R : 20;
    var group = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0xe3b968, emissive: 0xc9932f, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.6 });
    var bladeGeo = new THREE.BoxGeometry(BR * 1.6, BR * 0.38, BR * 0.22);
    [0.5, Math.PI + 0.5].forEach(function (rotY) {
      var pivot = new THREE.Group();
      pivot.rotation.y = rotY;
      var blade = new THREE.Mesh(bladeGeo, mat);
      blade.position.x = BR * 0.75;
      blade.castShadow = true;
      pivot.add(blade);
      group.add(pivot);
    });
    var core = new THREE.Mesh(
      new THREE.SphereGeometry(BR * 0.4, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff6d9, emissive: 0xf2d38f, emissiveIntensity: 1.3 })
    );
    group.add(core);
    var light = new THREE.PointLight(0xe3b968, 3.5, BR * 5, 2);
    group.add(light);
    group.visible = false;
    scene.add(group);
    return group;
  })();
  var meteorChargeMesh = (function () {
    var mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  })();
  // Anneau de charge de l'arme Charge (au pied du joueur, pas au sol visé — contrairement à
  // la météorite qui cible une zone, la Charge se propulse depuis la position du joueur).
  var chargeRingMesh = (function () {
    var mesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: 0xe3b968, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  })();

  var lastArenaW = -1, lastArenaH = -1, lastArenaTheme = -1, lastArenaShapeKey = null;

  function frameArena() {
    var w = (typeof ARENA_W !== 'undefined') ? ARENA_W : 492;
    var h = (typeof ARENA_H !== 'undefined') ? ARENA_H : 492;
    var themeIdx = currentChapterIdx3D();
    var roomShape = (typeof CB !== 'undefined' && CB) ? CB.roomShape : null;
    var shapeKey = roomShape ? roomShape.key : 'rect';
    // Le sol/les bordures doivent se reconstruire au changement de chapitre ou de forme
    // de salle même si l'arène garde la même taille (sinon la scène 3D resterait figée
    // sur le thème/la forme du premier chapitre toute la run) — pas seulement au
    // changement de taille.
    if (w === lastArenaW && h === lastArenaH && themeIdx === lastArenaTheme && shapeKey === lastArenaShapeKey) return;
    lastArenaW = w; lastArenaH = h; lastArenaTheme = themeIdx; lastArenaShapeKey = shapeKey;
    arenaShell.rebuild(w, h, themeIdx, roomShape);
    var size = Math.max(w, h);
    // Caméra nettement resserrée sur la salle (était ×1.55, un premier essai à ×1.32
    // jugé insuffisant) : moins de décor "au-delà des contours" visible sur les bords
    // de l'écran, demande explicite. ×1.28 est le point le plus proche testé qui garde
    // encore une marge de sécurité confortable (~6%) avant que les coins de la plus
    // grande salle ne sortent du champ de la caméra — vérifié par projection des 4
    // coins en NDC (au-delà de ×1.22 les coins commencent à dépasser [-1,1]).
    var camDist = size * 1.28;
    camera.position.set(w / 2, camDist * 0.68, h / 2 + camDist * 0.62);
    camera.lookAt(w / 2, 0, h / 2);
    camera.updateProjectionMatrix();

    // Le soleil (ombres) doit suivre l'arène : sa cible et la fenêtre de sa caméra
    // d'ombre (orthographique) sont recalculées à chaque changement de taille — sinon
    // les ombres se désalignent ou disparaissent dès que l'arène n'est plus la taille
    // par défaut (elle est désormais aléatoire par run, 492 à 664).
    sun.position.set(w / 2 - size * 0.4, size * 0.9, h / 2 + size * 0.3);
    sun.target.position.set(w / 2, 0, h / 2);
    sun.target.updateMatrixWorld();
    var camSize = size * 0.78;
    sun.shadow.camera.left = -camSize; sun.shadow.camera.right = camSize;
    sun.shadow.camera.top = camSize; sun.shadow.camera.bottom = -camSize;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = size * 3;
    sun.shadow.camera.updateProjectionMatrix();
  }

  function resize() {
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function screenToWorld(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    var hit = new THREE.Vector3();
    var ok = raycaster.ray.intersectPlane(groundPlane, hit);
    return ok ? [hit.x, hit.z] : [0, 0];
  }

  function render(t) {
    if (typeof CB === 'undefined' || !CB) return;
    frameArena();

    player.group.position.set(CB.player.x, 0, CB.player.y);
    var facing = Math.atan2(CB.player.facingX || 0, CB.player.facingY || -1);
    player.group.rotation.y = facing;
    var invuln = CB.player.invulnTimer > 0;
    player.body.material.opacity = invuln ? 0.5 + Math.sin(t * 30) * 0.25 : 1;
    player.body.material.transparent = invuln;

    var aliveEnemies = CB.enemies.filter(function (e) { return e.alive; });
    syncByRef(scene, enemyMap, aliveEnemies, createEnemyMesh, function (g, e) { updateEnemyMesh(g, e, t); });
    syncByRef(scene, healthBarMap, aliveEnemies, createHealthBar, function (g, e) { updateHealthBar(g, e, camera); });
    syncByRef(scene, blockMap, CB.blocks, createBlockMesh, updateBlockMesh);
    // trap_spike/trap_arrow ont leur propre maillage (voir plus haut) — exclus du disque
    // générique pour ne pas se retrouver rendus deux fois.
    var plainZones = [], spikeTraps = [], arrowTraps = [];
    (CB.zones || []).forEach(function (z) {
      if (z.kind === 'trap_spike') spikeTraps.push(z);
      else if (z.kind === 'trap_arrow') arrowTraps.push(z);
      else plainZones.push(z);
    });
    syncByRef(scene, zoneMap, plainZones, createZoneMesh, function (g, z) { updateZoneMesh(g, z, t); });
    syncByRef(scene, spikeTrapMap, spikeTraps, createSpikeTrapMesh, updateSpikeTrapMesh);
    syncByRef(scene, arrowTrapMap, arrowTraps, createArrowTrapMesh, updateArrowTrapMesh);
    syncByRef(scene, turretMap, CB.turrets, createTurretMesh, function (g, tu) { updateTurretMesh(g, tu, t); });
    syncByRef(scene, pedestalMap, CB.armoryPedestals || [], buildPedestalMesh, function (g, ped) { updatePedestalMesh(g, ped, t); });
    // Pas de syncByRef générique ici : chaque sprite a sa PROPRE texture canvas (le texte
    // change à chaque coup, jamais partagée comme les icônes emoji des présentoirs) — il
    // faut la disposer explicitement, sinon fuite d'un canvas à chaque coup porté.
    var liveHitNumbers = CB.armoryHitNumbers || [];
    liveHitNumbers.forEach(function (n) {
      var sprite = hitNumberMap.get(n);
      if (!sprite) { sprite = buildHitNumberMesh(n); scene.add(sprite); hitNumberMap.set(n, sprite); }
      updateHitNumberMesh(sprite, n);
    });
    hitNumberMap.forEach(function (sprite, n) {
      if (liveHitNumbers.indexOf(n) === -1) {
        scene.remove(sprite);
        sprite.material.map.dispose();
        sprite.material.dispose();
        hitNumberMap.delete(n);
      }
    });
    projectilePool.sync(CB.projectiles, updateProjectileMesh);
    knifePool.sync(CB.knives, updateProjectileMesh);
    dashTrailPool.sync(CB.dashTrails, updateDashTrailMesh);
    grapplePool.sync(CB.grappleRopes, updateGrappleMesh);
    swordPool.sync(CB.swordSwings, updateSwordMesh);
    pulsePool.sync(CB.pulseRings, updatePulseMesh);
    blastPool.sync(CB.blasts, updateBlastMesh);
    laserPool.sync(CB.lasers, updateLaserMesh);
    particlePool.sync(CB.particles, updateParticleMesh);

    if (CB.brasier) {
      brasierMesh.visible = true;
      brasierMesh.position.set(CB.brasier.x, 22, CB.brasier.y);
      var bPulse = 1 + Math.sin(t * 10) * 0.15;
      // x2 : jugé trop petit/peu visible avant. Le halo respire un peu plus large
      // et plus lentement que le noyau pour un effet de flamme vivante.
      brasierMesh.getObjectByName('core').scale.setScalar(BRASIER_RADIUS * 0.6 * bPulse);
      brasierMesh.getObjectByName('halo').scale.setScalar(BRASIER_RADIUS * 0.85 * (1 + Math.sin(t * 5) * 0.1));
    } else {
      brasierMesh.visible = false;
    }

    if (CB.boomerang) {
      boomerangMesh.visible = true;
      boomerangMesh.position.set(CB.boomerang.x, 14, CB.boomerang.y);
      boomerangMesh.rotation.y = t * 14;
    } else {
      boomerangMesh.visible = false;
    }

    var chargingWeapon1 = (CB.player.weapon2 === 'mimic' && CB.player.mimicActive && CB.player.mimicWeapon) ? CB.player.mimicWeapon : CB.player.weapon1;
    if (CB.player.w1Charging && chargingWeapon1 === 'meteor') {
      var mFrac = Math.min(1, (CB.player.w1ChargeTime || 0) / METEOR_MAX_CHARGE);
      meteorChargeMesh.visible = true;
      meteorChargeMesh.position.set(CB.player.w1AimX, 3, CB.player.w1AimY);
      meteorChargeMesh.scale.setScalar(Math.max(2, METEOR_RADIUS * mFrac));
      meteorChargeMesh.material.opacity = 0.4 + mFrac * 0.4;
    } else {
      meteorChargeMesh.visible = false;
    }

    if (CB.player.w1Charging && chargingWeapon1 === 'charge') {
      var cFrac = Math.min(1, (CB.player.w1ChargeTime || 0) / CHARGE_MAX_CHARGE_TIME);
      chargeRingMesh.visible = true;
      chargeRingMesh.position.set(CB.player.x, 3, CB.player.y);
      chargeRingMesh.scale.setScalar(Math.max(2, CHARGE_TRAIL_WIDTH * (0.5 + cFrac)));
      chargeRingMesh.material.opacity = 0.4 + cFrac * 0.4;
    } else {
      chargeRingMesh.visible = false;
    }

    renderer.render(scene, camera);
  }

  return { renderer: renderer, scene: scene, camera: camera, render: render, resize: resize, screenToWorld: screenToWorld };
}

var combat3dInstance = null;
try { combat3dInstance = initCombat3D(); } catch (e) { combat3dInstance = null; }

window.Combat3D = combat3dInstance
  ? { available: true, instance: combat3dInstance, render: combat3dInstance.render, resize: combat3dInstance.resize, screenToWorld: combat3dInstance.screenToWorld }
  : { available: false, instance: null };
})();
