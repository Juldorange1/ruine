// ============================================================================
// Hub 3D (menu principal) — Three.js, chargé en script classique (pas un module :
// un import ES + importmap dépend du chargement de modules, dont le comportement
// exact sous la CSP stricte d'un Artifact publié s'est avéré peu fiable — voir
// js3d/vendor/three.min.js, chargé juste avant ce fichier, qui pose un THREE
// global, exactement comme game.js etc. le font déjà pour le reste du code).
// ============================================================================
// Première étape de la migration vers une vraie 3D : seul le hub (menu) est
// concerné pour l'instant, le combat reste sur le rendu 2D existant (js/render.js).
// Ce module tourne dans sa PROPRE boucle d'animation, indépendante de celle du
// jeu 2D (js/game.js) — il lit juste VIEW pour savoir s'il doit se rendre visible.
//
// Contrat avec le reste du jeu :
//   - window.Hub3D.available : true si Three.js a pu s'initialiser (WebGL
//     disponible) — sinon js/game.js retombe sur le hub 2D existant.
//   - Ce module appelle des fonctions globales déjà définies ailleurs :
//     computeMoveVector(), isDown(), hubTriggerPoint(id), updateMenuStats(),
//     VIEW (variable globale mise à jour par js/game.js).

(function () {
var THREE = window.THREE;

var HUB3D_WIDTH = 16;
var HUB3D_DEPTH = 22;
var HUB3D_PLAYER_SPEED = 5.2;
var HUB3D_INTERACT_MARGIN = 0.6;

var HUB3D_POINTS = [
  { id: 'portal', kind: 'portal', x: -5, z: -9, r: 1.3, label: 'Lancer un run', color: 0x9b5cf0 },
  { id: 'challenges', kind: 'portal', x: 5, z: -9, r: 1.3, label: 'Défis', color: 0xff4fa3 },
  { id: 'weapons', kind: 'door', x: -5, z: 0, r: 0.9, label: "Entrer dans l'armurerie", color: 0xe3b968 },
  { id: 'settings', x: 5, z: 0, r: 0.9, label: 'Ouvrir les réglages', color: 0x7db4ff },
  { id: 'stats', x: 0, z: 3, r: 0.9, label: 'Voir les statistiques', color: 0xf2d38f }
];

function buildTorch(scene, x, z) {
  var bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.05, 0.14, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 0.6, metalness: 0.4 })
  );
  bowl.position.set(x, 1.18, z);
  bowl.castShadow = true;
  scene.add(bowl);

  var pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 1.2, 10),
    new THREE.MeshStandardMaterial({ color: 0x241d28, roughness: 0.75 })
  );
  pole.position.set(x, 0.6, z);
  pole.castShadow = true;
  scene.add(pole);

  // Flamme en cône (au lieu d'une simple sphère) : silhouette qui évoque un vrai feu,
  // dont la hauteur/l'opacité varient légèrement chaque frame pour un effet de vacillement.
  var flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff7a2e, emissiveIntensity: 1.8, transparent: true })
  );
  flame.position.set(x, 1.42, z);
  scene.add(flame);

  var light = new THREE.PointLight(0xff8a4a, 14, 13, 1.6);
  light.position.set(x, 1.4, z);
  scene.add(light);

  return { flame: flame, light: light, baseIntensity: 14 };
}

// Une vraie porte (cadre en pierre + battant en bois entrouvert, liseré doré) au lieu du
// même PNJ icosaèdre flottant que les autres points d'intérêt — l'armurerie se traverse
// par une porte, pas par un "objet à ramasser" (demandé explicitement).
function buildDoorMesh(pt) {
  var group = new THREE.Group();
  var frameMat = new THREE.MeshStandardMaterial({ color: 0x2c2433, roughness: 0.85 });
  var panelMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1e, roughness: 0.6, metalness: 0.1 });
  var trimMat = new THREE.MeshStandardMaterial({ color: pt.color, emissive: pt.color, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.3 });

  [-0.75, 0.75].forEach(function (dx) {
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.4, 0.28), frameMat);
    post.position.set(dx, 1.2, 0);
    post.castShadow = true;
    group.add(post);
  });
  var lintel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.32), frameMat);
  lintel.position.set(0, 2.4, 0);
  lintel.castShadow = true;
  group.add(lintel);

  // Battant légèrement entrouvert (pivote sur le montant gauche) : lisible comme une
  // vraie porte qu'on pousse, pas un simple panneau plat mural.
  var panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.05, 0.1), panelMat);
  panel.position.set(0.65, 0, 0);
  var hinge = new THREE.Group();
  hinge.position.set(-0.7, 1.15, 0);
  hinge.rotation.y = 0.4;
  panel.castShadow = true;
  hinge.add(panel);
  group.add(hinge);

  var trim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24, Math.PI), trimMat);
  trim.rotation.z = Math.PI;
  trim.position.set(0, 2.34, 0);
  group.add(trim);

  return group;
}

function buildInteractionPoint(scene, pt) {
  var isPortalGeo = pt.kind === 'portal';
  var isDoor = pt.kind === 'door';
  var mesh;
  if (isDoor) {
    mesh = buildDoorMesh(pt);
    mesh.position.set(pt.x, 0, pt.z);
    scene.add(mesh);
  } else {
    var geo = isPortalGeo
      ? new THREE.TorusGeometry(pt.r, 0.16, 16, 36)
      : new THREE.IcosahedronGeometry(pt.r * 0.55, 1);
    var mat = new THREE.MeshStandardMaterial({ color: pt.color, emissive: pt.color, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.15 });
    mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pt.x, isPortalGeo ? 1.3 : 0.9, pt.z);
    if (isPortalGeo) mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    scene.add(mesh);
  }

  // Petit socle sous les PNJ (les portails flottent au-dessus de leur anneau, la porte a
  // déjà son propre pied) — ancre visuellement l'objet au décor plutôt qu'un solide qui plane.
  if (!isPortalGeo && !isDoor) {
    var pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(pt.r * 0.5, pt.r * 0.6, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x2c2433, roughness: 0.8 })
    );
    pedestal.position.set(pt.x, 0.15, pt.z);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    scene.add(pedestal);
  }

  // Anneau au sol nettement plus épais/opaque qu'un premier jet — trop discret face à
  // l'éclairage généreux de la scène (voir le correctif de luminosité du hub), il se
  // fondait dans le décor au lieu de servir de repère de proximité clair.
  var ringGeo = new THREE.RingGeometry(pt.r + 0.15, pt.r + 0.7, 40);
  var ringMat = new THREE.MeshBasicMaterial({ color: pt.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  var ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pt.x, 0.06, pt.z);
  ring.visible = false;
  scene.add(ring);

  // Les portails sont les repères les plus importants de la scène : leur lumière porte
  // nettement plus loin que celle des PNJ pour rester visible depuis le point d'apparition
  // du joueur, à l'autre bout de la salle.
  var isPortal = pt.kind === 'portal';
  var light = new THREE.PointLight(pt.color, isPortal ? 9 : 4.5, isPortal ? 16 : 8, 2);
  light.position.set(pt.x, 1.4, pt.z);
  scene.add(light);

  return { def: pt, mesh: mesh, ring: ring };
}

// Pilier de pierre décoratif — sert à la fois aux 4 coins de la salle et à encadrer
// l'alcôve des portails, pour que le hub se lise comme une vraie architecture plutôt
// que 5 objets qui flottent dans une boîte vide (demande explicite : "plus belle et
// mieux organisée").
function buildPillar(scene, x, z, height) {
  height = height || 2.6;
  var mat = new THREE.MeshStandardMaterial({ color: 0x2c2433, roughness: 0.85 });
  var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, height, 10), mat);
  shaft.position.set(x, height / 2, z);
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  scene.add(shaft);
  var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.36, 0.22, 10), mat);
  cap.position.set(x, height + 0.11, z);
  cap.castShadow = true;
  scene.add(cap);
  var trim = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.045, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xd4af5a, roughness: 0.4, metalness: 0.6 })
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.set(x, height * 0.62, z);
  scene.add(trim);
}

// Inlay au sol sous chaque point d'intérêt — toujours visible (contrairement à
// l'anneau de proximité, qui n'apparaît qu'à l'approche) : marque chaque emplacement
// comme un vrai lieu désigné plutôt qu'un point choisi au hasard dans la pièce.
function buildFloorInlay(scene, x, z, r, color) {
  var geo = new THREE.RingGeometry(r * 0.3, r, 32);
  var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
  var inlay = new THREE.Mesh(geo, mat);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(x, 0.03, z);
  scene.add(inlay);
}

function buildPlayer(scene) {
  var group = new THREE.Group();

  var body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.62, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x241b22, roughness: 0.65, metalness: 0.05 })
  );
  body.position.y = 0.72;
  body.castShadow = true;
  group.add(body);

  // Cape courte derrière le personnage : un cône aplati suffit à donner une silhouette
  // moins "capsule nue", cohérent avec le thème Zagreus (tissu sombre, tranchant net).
  var cape = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 0.9, 12, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1a1420, roughness: 0.8, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.62, -0.08);
  cape.rotation.x = Math.PI;
  cape.scale.set(1, 1, 0.55);
  cape.castShadow = true;
  group.add(cape);

  var sash = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.85, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x7a1f22, roughness: 0.45, metalness: 0.1 })
  );
  sash.position.set(0.2, 0.75, 0);
  sash.rotation.z = 0.5;
  sash.castShadow = true;
  group.add(sash);

  var belt = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.045, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xd4af5a, roughness: 0.35, metalness: 0.75 })
  );
  belt.position.y = 0.52;
  belt.rotation.x = Math.PI / 2;
  belt.castShadow = true;
  group.add(belt);

  var head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xd9ab84, roughness: 0.55 })
  );
  head.position.y = 1.42;
  head.castShadow = true;
  group.add(head);

  var hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0x241d28, roughness: 0.75 })
  );
  hair.position.y = 1.48;
  hair.castShadow = true;
  group.add(hair);

  scene.add(group);
  return group;
}

function initHub3D() {
  var canvas = document.getElementById('hubCanvas');
  if (!canvas || typeof THREE.WebGLRenderer !== 'function') return null;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    return null;
  }
  if (!renderer) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (window.Shared3D) window.Shared3D.setupRenderer(renderer);

  var scene = new THREE.Scene();
  // Pas de brouillard : la distance caméra→portail (~32) dépassait la portée du
  // brouillard précédent (jusqu'à 30), ce qui le rendait quasiment invisible — d'où
  // la scène "sombre" et le portail introuvable signalés. Fond nettement plus clair
  // aussi, pour que la salle se lise bien sans nuire à l'ambiance.
  scene.background = new THREE.Color(0x231a2c);

  var camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100);
  camera.position.set(0, 15, 16);
  camera.lookAt(0, 0, -2);

  // Lumières généreuses : ambiance froide de base + une chaude dominante façon torches,
  // cohérent avec la palette du reste du jeu (violet/or/braise), mais volontairement
  // beaucoup plus lumineux qu'un premier jet — priorité à la lisibilité.
  scene.add(new THREE.HemisphereLight(0xccc0e0, 0x4a3f56, 2.0));
  var sun = new THREE.DirectionalLight(0xffe9cc, 1.8);
  sun.position.set(-6, 14, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -HUB3D_WIDTH; sun.shadow.camera.right = HUB3D_WIDTH;
  sun.shadow.camera.top = HUB3D_DEPTH; sun.shadow.camera.bottom = -HUB3D_DEPTH;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  var fill = new THREE.DirectionalLight(0xd8c8ff, 0.7);
  fill.position.set(8, 10, -4);
  scene.add(fill);

  var groundTex = window.Shared3D
    ? window.Shared3D.makeGroundTexture('#352a3f', ['#453552', '#241b2c', '#4a3a48'], 5)
    : null;
  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HUB3D_WIDTH, HUB3D_DEPTH, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: groundTex, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var borderMat = new THREE.MeshStandardMaterial({ color: 0x3a2e3c, roughness: 0.8 });
  var borderThickness = 0.4;
  [
    [0, -HUB3D_DEPTH / 2, HUB3D_WIDTH, borderThickness],
    [0, HUB3D_DEPTH / 2, HUB3D_WIDTH, borderThickness],
    [-HUB3D_WIDTH / 2, 0, borderThickness, HUB3D_DEPTH],
    [HUB3D_WIDTH / 2, 0, borderThickness, HUB3D_DEPTH]
  ].forEach(function (b) {
    var wall = new THREE.Mesh(new THREE.BoxGeometry(b[2], 0.5, b[3]), borderMat);
    wall.position.set(b[0], 0.25, b[1]);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  });

  var torches = [
    buildTorch(scene, -HUB3D_WIDTH / 2 + 1, -HUB3D_DEPTH / 2 + 1.5),
    buildTorch(scene, HUB3D_WIDTH / 2 - 1, -HUB3D_DEPTH / 2 + 1.5),
    buildTorch(scene, -HUB3D_WIDTH / 2 + 1, HUB3D_DEPTH / 2 - 1.5),
    buildTorch(scene, HUB3D_WIDTH / 2 - 1, HUB3D_DEPTH / 2 - 1.5)
  ];

  // Piliers aux 4 coins + encadrement de l'alcôve des portails (le repère le plus
  // important de la salle, but du joueur) : mur bas en fond + 2 piliers plus hauts qui
  // le flanquent, pour que "lancer un run"/"défis" se lisent comme une vraie porte
  // d'entrée vers l'aventure plutôt que deux anneaux posés dans le vide.
  [[-HUB3D_WIDTH / 2 + 0.8, -HUB3D_DEPTH / 2 + 0.8], [HUB3D_WIDTH / 2 - 0.8, -HUB3D_DEPTH / 2 + 0.8],
   [-HUB3D_WIDTH / 2 + 0.8, HUB3D_DEPTH / 2 - 0.8], [HUB3D_WIDTH / 2 - 0.8, HUB3D_DEPTH / 2 - 0.8]]
    .forEach(function (c) { buildPillar(scene, c[0], c[1], 2.4); });
  [-7, 7].forEach(function (px) { buildPillar(scene, px, -HUB3D_DEPTH / 2 + 1.6, 3.3); });
  var alcoveBackMat = new THREE.MeshStandardMaterial({ color: 0x2c2433, roughness: 0.8 });
  var alcoveBack = new THREE.Mesh(new THREE.BoxGeometry(HUB3D_WIDTH * 0.62, 3.6, 0.35), alcoveBackMat);
  alcoveBack.position.set(0, 1.8, -HUB3D_DEPTH / 2 + 0.4);
  alcoveBack.castShadow = true;
  alcoveBack.receiveShadow = true;
  scene.add(alcoveBack);

  // Chemin central du point d'apparition vers l'alcôve des portails — guide le regard
  // et lit comme un lieu conçu plutôt qu'une pièce vide où les points d'intérêt
  // flottent sans hiérarchie.
  var pathMat = new THREE.MeshStandardMaterial({ color: 0x4a3a52, roughness: 0.9 });
  var path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, HUB3D_DEPTH * 0.72), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.02, -HUB3D_DEPTH * 0.08);
  path.receiveShadow = true;
  scene.add(path);

  var points = HUB3D_POINTS.map(function (pt) { return buildInteractionPoint(scene, pt); });
  HUB3D_POINTS.forEach(function (pt) { buildFloorInlay(scene, pt.x, pt.z, pt.r + 0.7, pt.color); });
  var player = buildPlayer(scene);
  player.position.set(0, 0, 8);

  function resize() {
    var w = canvas.clientWidth || window.innerWidth;
    var h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  var nearId = null;
  var facing = 0;
  var clock = new THREE.Clock();

  function update(dt) {
    var mv = (typeof computeMoveVector === 'function') ? computeMoveVector() : [0, 0];
    var mx = mv[0], mz = mv[1];
    if (mx || mz) {
      player.position.x += mx * HUB3D_PLAYER_SPEED * dt;
      player.position.z += mz * HUB3D_PLAYER_SPEED * dt;
      facing = Math.atan2(mx, mz);
    }
    player.position.x = Math.max(-HUB3D_WIDTH / 2 + 0.6, Math.min(HUB3D_WIDTH / 2 - 0.6, player.position.x));
    player.position.z = Math.max(-HUB3D_DEPTH / 2 + 0.6, Math.min(HUB3D_DEPTH / 2 - 0.6, player.position.z));
    player.rotation.y = facing;

    var t = clock.getElapsedTime();

    torches.forEach(function (tc, i) {
      var flick = Math.sin(t * 9 + i * 2.1) * 0.5 + Math.sin(t * 17 + i) * 0.5;
      tc.flame.scale.set(1 + flick * 0.12, 1 + flick * 0.22, 1 + flick * 0.12);
      tc.light.intensity = tc.baseIntensity + flick * 2.5;
    });

    var near = null;
    points.forEach(function (p) {
      var dx = player.position.x - p.def.x, dz = player.position.z - p.def.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      var isNear = d <= p.def.r + HUB3D_INTERACT_MARGIN;
      p.ring.visible = isNear;
      if (isNear) {
        var pulse = 1 + Math.sin(t * 5) * 0.08;
        p.ring.scale.set(pulse, pulse, 1);
      }
      // Les portails et la porte restent immobiles (repères fixes et lisibles, une porte
      // qui tourne sur elle-même serait absurde) ; seuls les PNJ gardent une légère
      // rotation/respiration pour ne pas paraître inertes.
      if (p.def.kind !== 'portal' && p.def.kind !== 'door') {
        p.mesh.rotation.y = t * 1.1;
        p.mesh.position.y = 0.9 + Math.sin(t * 2 + p.def.x) * 0.06;
      }
      if (isNear) near = p.def;
    });
    nearId = near;

    // Les 5 points d'intérêt fonctionnent tous pareil désormais : un simple indice
    // "Touche E — ..." de proximité, l'action ne se déclenche qu'à l'appui.
    var promptEl = document.getElementById('hubPrompt');
    if (promptEl) {
      if (near) { promptEl.hidden = false; promptEl.textContent = 'Touche E — ' + near.label; }
      else promptEl.hidden = true;
    }

    var interactHeld = (typeof isDown === 'function') && isDown('KeyE');
    if (interactHeld && !update._prevInteract && near && typeof hubTriggerPoint === 'function') {
      hubTriggerPoint(near.id);
    }
    update._prevInteract = interactHeld;
  }

  function frame() {
    requestAnimationFrame(frame);
    if (typeof VIEW !== 'undefined' && VIEW === 'menu') {
      var dt = Math.min(clock.getDelta(), 0.05);
      update(dt);
      renderer.render(scene, camera);
    } else {
      clock.getDelta(); // évite un grand saut de dt au retour sur le hub
    }
  }
  requestAnimationFrame(frame);

  return { renderer: renderer, scene: scene, camera: camera, player: player };
}

var hub3dInstance = null;
try {
  hub3dInstance = initHub3D();
} catch (e) {
  hub3dInstance = null;
}

window.Hub3D = { available: !!hub3dInstance, instance: hub3dInstance };
})();
