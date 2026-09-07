// ============================================================================
// ASCENSION — world.js
// Constantes de jeu (physique) + construction des niveaux créés dans
// l'éditeur (AS.World.buildCustom). Il n'y a plus de "niveaux principaux"
// codés en dur : les 4 difficultés (Facile/Normal/Difficile/Extrême) sont de
// simples étiquettes que le joueur assigne lui-même à l'un de ses niveaux
// créés dans l'éditeur (voir AS.Storage.setLevelMainDifficulty côté
// storage.js, et le sélecteur dans l'écran Éditeur côté main.js/index.html).
//
// Toute la géométrie "praticable" est faite de vrais meshes THREE.js ajoutés
// à AS.World.collidables : le contrôleur du joueur (player.js) fait des
// raycasts contre ces meshes pour le sol / les murs, donc les rampes et
// plateformes inclinées fonctionnent "gratuitement" sans AABB séparées.
// ============================================================================
window.AS = window.AS || {};

// ---------------------------------------------------------------------------
// Constantes physiques globales du personnage
// ---------------------------------------------------------------------------
AS.CFG = {
  gravityRise: -22,
  gravityFall: -34,
  gravityWallSlide: -6,
  jumpVel: 13,
  doubleJumpVel: 11,
  wallJumpVelY: 12.5,
  wallJumpPush: 9.5,
  dashSpeed: 24,
  dashDuration: 0.16,
  dashCharges: 1,
  maxSpeed: 9,
  boostMaxSpeed: 17,
  accelGround: 45,
  accelAir: 20,
  frictionGround: 30,
  frictionAir: 0.6,
  iceAccel: 11,
  iceFriction: 3,
  playerRadius: 0.42,
  playerHeight: 1.75,
  coyoteTime: 0.11,
  jumpBuffer: 0.13,
  // Distance sous la dernière plateforme solide au-delà de laquelle on
  // considère être tombé dans le vide (voir player.js:_checkVoid). Relatif
  // à l'altitude courante plutôt qu'un seuil absolu fixe : une chute reste
  // courte et quasi instantanée même tout en haut de la zone.
  voidMargin: 20,

  // ---- Rebond parfait : timing d'impact -----------------------------------
  perfectBounceWindow: 0.13,
  perfectBounceMult: 1.05,
  perfectBounceMin: 15,

  // ---- Glisse orbitale : capture sur une structure courbe -------------------
  orbitCaptureSpeed: 7,
  orbitCaptureBand: 1.3,
  orbitMaxDuration: 2.2,
  orbitGravityScale: 0.25,

  // ---- Portes de phase -------------------------------------------------
  // Une paire ne peut retéléporter le joueur qu'une fois toutes les 3s (les
  // deux extrémités partagent le même cooldown, posé sur les deux d'un coup
  // à chaque usage) : évite le ping-pong immédiat et donne un vrai rythme
  // d'utilisation plutôt qu'un passage libre.
  phaseGateCooldown: 3.0,
};

// 15 emplacements de niveau principal : 3 catégories (Court/Normal/Long,
// selon la longueur du niveau) x 5 niveaux de difficulté chacune — de
// simples étiquettes affichées sur l'écran titre : la géométrie vient
// toujours d'un niveau créé dans l'éditeur et assigné à cet emplacement
// (voir AS.Storage.getMainLevelFor). Clé = "<catégorie>-<1-5>".
AS.DIFF_CATEGORIES = [
  { id: 'court', label: 'Court' },
  { id: 'normal', label: 'Normal' },
  { id: 'long', label: 'Long' },
];
AS.DIFFS = {};
AS.DIFF_CATEGORIES.forEach((cat) => {
  for (let i = 1; i <= 5; i++) {
    AS.DIFFS[cat.id + '-' + i] = { label: cat.label + ' ' + i, category: cat.id, tier: i };
  }
});

// Images d'arrière-plan proposées dans l'éditeur pour un niveau créé.
AS.BACKGROUND_CHOICES = [
  { id: 'easy', label: 'Collines verdoyantes', path: 'assets/hdri/background.jpg' },
  { id: 'normal', label: 'Forêt enneigée', path: 'assets/hdri/background_normal.jpg' },
  { id: 'hard', label: 'Désert rocheux', path: 'assets/hdri/background_hard.jpg' },
  { id: 'extreme', label: 'Pics enneigés', path: 'assets/hdri/background_extreme.jpg' },
];

// Grille utilisée par l'éditeur de niveaux (blocs voxel).
AS.EDITOR_CELL = { x: 3, y: 1.6, z: 3 };

AS.World = (function () {

  // ---- Matériaux PBR (photos CC0 détourées, ambientCG) ---------------------
  // Redimensionnées à une résolution raisonnable pour une texture qui se
  // répète 2-3 fois sur un petit bloc (512/384px au lieu des 1024px
  // d'origine) : ~400 Ko au total pour les 4 matériaux au lieu de 16 Mo,
  // assez léger pour être embarqué tel quel partout (Artifact compris) —
  // plus besoin de détecter l'environnement ni de repli procédural pour ça.
  // Chemins écrits en toutes lettres (pas de concaténation "dossier+fichier")
  // pour que le script de build de l'Artifact puisse les remplacer un par un
  // par des data: URI. Utilisées par customMaterial() ci-dessous : tous les
  // niveaux sont désormais créés dans l'éditeur, donc c'est leur seule
  // consommatrice.
  const PBR_PATHS = {
    grass: { color: 'assets/textures/pbr/grass/color.jpg', normal: 'assets/textures/pbr/grass/normal.jpg', roughness: 'assets/textures/pbr/grass/roughness.jpg' },
    rock: { color: 'assets/textures/pbr/rock/color.jpg', normal: 'assets/textures/pbr/rock/normal.jpg', roughness: 'assets/textures/pbr/rock/roughness.jpg' },
    snow: { color: 'assets/textures/pbr/snow/color.jpg', normal: 'assets/textures/pbr/snow/normal.jpg', roughness: 'assets/textures/pbr/snow/roughness.jpg' },
    wood: { color: 'assets/textures/pbr/wood/color.jpg', normal: 'assets/textures/pbr/wood/normal.jpg', roughness: 'assets/textures/pbr/wood/roughness.jpg' },
  };
  const PBR_CACHE = {};
  function loadPBRMaterial(name, tile) {
    const cacheKey = name + '@' + tile;
    if (PBR_CACHE[cacheKey]) return PBR_CACHE[cacheKey];
    const paths = PBR_PATHS[name];
    const loader = new THREE.TextureLoader();
    const map = loader.load(paths.color);
    map.colorSpace = THREE.SRGBColorSpace;
    const normalMap = loader.load(paths.normal);
    const roughnessMap = loader.load(paths.roughness);
    [map, normalMap, roughnessMap].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(tile, tile);
      t.anisotropy = 4;
    });
    const mat = new THREE.MeshStandardMaterial({ map, normalMap, roughnessMap, roughness: 1 });
    PBR_CACHE[cacheKey] = mat;
    return mat;
  }

  // ---- Flèche indiquant le sens d'un pad de vitesse -------------------------
  // Un cône couché (pas debout) : une fois tourné à plat, il se lit comme une
  // flèche posée sur la surface plutôt qu'un cône planté dedans.
  const BOOST_ARROW_GEO = new THREE.ConeGeometry(0.38, 1.05, 3);
  BOOST_ARROW_GEO.rotateX(Math.PI / 2);
  const BOOST_ARROW_MAT = new THREE.MeshBasicMaterial({ color: 0xfff6df, transparent: true, opacity: 0.92, depthWrite: false });
  function addBoostArrow(scene, x, y, z, dir) {
    const mesh = new THREE.Mesh(BOOST_ARROW_GEO, BOOST_ARROW_MAT);
    mesh.position.set(x, y + 0.05, z);
    mesh.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(mesh);
    return mesh;
  }

  // ---- Pics mortels : décor uniquement (le bloc plein en dessous porte la
  // collision réelle, voir userData.surface='spike' et player.js) — un
  // petit groupe de cônes plutôt qu'un seul, pour bien lire "danger" de loin.
  const SPIKE_MAT = new THREE.MeshStandardMaterial({ color: 0xc9463a, emissive: 0x3a0805, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.3 });
  function addSpikeCones(scene, x, topY, z, sx, sz) {
    const cols = 2, rows = 2;
    const coneH = 0.32, coneR = Math.min(sx, sz) / (cols * 2.6);
    const geo = new THREE.ConeGeometry(coneR, coneH, 6);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const cone = new THREE.Mesh(geo, SPIKE_MAT);
        cone.position.set(
          x + (i + 0.5) / cols * sx - sx / 2,
          topY + coneH / 2,
          z + (j + 0.5) / rows * sz - sz / 2
        );
        cone.castShadow = true;
        scene.add(cone);
      }
    }
  }

  // ==========================================================================
  // Construction d'un niveau créé dans l'éditeur (liste de blocs voxel).
  // blocks: [{ gx, gy, gz, type, rot }]. C'est désormais la SEULE façon de
  // construire un niveau jouable, qu'il s'agisse d'un niveau personnel ou
  // d'un niveau assigné à une difficulté principale.
  // ==========================================================================
  const CUSTOM_MAT_CACHE = {};
  // `theme` ne change que le bloc "Roche" (le plus courant) : deux thèmes de
  // texture au choix dans l'éditeur, sans dupliquer les blocs au rôle
  // fonctionnel (glace/vitesse/rebond/pics...) qui gardent leur couleur.
  function customMaterial(type, theme) {
    const cacheKey = type + '@' + (theme || 'rock');
    if (CUSTOM_MAT_CACHE[cacheKey]) return CUSTOM_MAT_CACHE[cacheKey];
    let mat;
    if (type === 'ice') {
      mat = new THREE.MeshStandardMaterial({ map: AS.Util.iceTexture(33), roughness: 0.15, metalness: 0.05 });
    } else if (type === 'boost') {
      mat = new THREE.MeshStandardMaterial({ color: 0xff8a4c, emissive: 0x552200, roughness: 0.4 });
    } else if (type === 'bounce') {
      mat = new THREE.MeshStandardMaterial({ color: 0xc86bff, emissive: 0x3d0a55, roughness: 0.35 });
    } else if (type === 'crumble') {
      mat = new THREE.MeshStandardMaterial({ color: 0x9c8060, roughness: 0.9 });
    } else if (type === 'perfectBounce') {
      mat = new THREE.MeshStandardMaterial({ color: 0x5df2c8, emissive: 0x0a5c46, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.4 });
    } else if (type === 'spike') {
      mat = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.6, metalness: 0.3 });
    } else if (type === 'mover') {
      // Vraie photo de bois (PBR) au lieu d'une couleur plate : plus réaliste
      // pour une plateforme mobile, cohérent avec le sol en photo ci-dessous.
      mat = loadPBRMaterial('wood', 1.5);
    } else if (type === 'spawn') {
      mat = new THREE.MeshStandardMaterial({ color: 0x6ee7a0, emissive: 0x0c3a1e, roughness: 0.6 });
    } else if (type === 'finish') {
      mat = new THREE.MeshStandardMaterial({ color: 0xf3d98a, emissive: 0x442f00, emissiveIntensity: 0.5, roughness: 0.5 });
    } else {
      // Bloc "Roche" par défaut : vraie photo PBR (couleur + normale +
      // rugosité) au lieu de l'ancienne texture procédurale dessinée en
      // canvas — tous les niveaux étant désormais créés dans l'éditeur,
      // c'est le matériau que le joueur voit le plus souvent. Deux thèmes
      // au choix (voir l'éditeur) : Type 1 = roche, Type 2 = neige.
      mat = loadPBRMaterial(theme === 'snow' ? 'snow' : 'rock', 2.5);
    }
    CUSTOM_MAT_CACHE[cacheKey] = mat;
    return mat;
  }

  // Types "pleins" : posent un bloc solide (collidable) à la cellule.
  const SOLID_TYPES = ['normal', 'ice', 'boost', 'bounce', 'crumble', 'perfectBounce', 'spike', 'spawn', 'finish'];
  // Types "marqueurs" : pas de bloc solide — un objet de jeu (déclencheur,
  // zone...) est construit à la position de la cellule. 'phase' et
  // 'mover' sont posés PAR PAIRES : le 1er et le 2e
  // marqueur du même type posés dans le niveau se lient ensemble, le 3e et
  // le 4e forment une 2e paire, etc. (un marqueur seul et non apparié est
  // ignoré). 'orb' est une sphère de rebond immatérielle (voir plus bas) :
  // jamais de collision solide, on la traverse librement — seule une chute
  // dedans déclenche le rebond.
  const MARKER_TYPES = ['checkpoint', 'wind', 'lowgrav', 'phase', 'mover', 'orb'];
  const EDITOR_TYPES = SOLID_TYPES.concat(MARKER_TYPES);

  function buildCustom(scene, blocks, theme) {
    const cell = AS.EDITOR_CELL;
    const collidables = [];
    let spawnPos = new THREE.Vector3(0, 2, 0);
    let maxAltitude = 4;
    const triggers = [];
    const windZones = [];
    const gravityZones = [];
    const checkpoints = [];
    const movers = [];
    const decorations = [];
    const bounceOrbs = [];

    for (const b of blocks) {
      if (MARKER_TYPES.includes(b.type)) continue;
      const wx = b.gx * cell.x, wy = b.gy * cell.y, wz = b.gz * cell.z;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(cell.x * 0.96, cell.y * 0.92, cell.z * 0.96),
        customMaterial(b.type, theme)
      );
      mesh.position.set(wx, wy, wz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      const surfaceByType = { boost: 'boost', bounce: 'bounce', ice: 'ice', crumble: 'crumble', perfectBounce: 'perfectBounce', spike: 'spike' };
      mesh.userData.surface = surfaceByType[b.type] || 'normal';
      if (b.type === 'boost') {
        const rot = (b.rot || 0) * Math.PI / 2;
        mesh.userData.boostDir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
        addBoostArrow(scene, wx, wy + cell.y * 0.46, wz, mesh.userData.boostDir);
      }
      if (b.type === 'bounce') mesh.userData.bounceForce = 19;
      if (b.type === 'spike') addSpikeCones(scene, wx, wy + cell.y * 0.46, wz, cell.x * 0.9, cell.z * 0.9);
      scene.add(mesh);
      collidables.push(mesh);
      maxAltitude = Math.max(maxAltitude, wy + cell.y);

      if (b.type === 'spawn') spawnPos = new THREE.Vector3(wx, wy + cell.y / 2 + 0.6, wz);
      if (b.type === 'finish') {
        triggers.push({ type: 'finish', pos: new THREE.Vector3(wx, wy + cell.y / 2, wz), radius: 2.4 });
      }
    }

    // ---- Marqueurs : déclencheurs, zones, téléporteurs, plateformes mobiles, décor
    function markerWorldPos(b) {
      return new THREE.Vector3(b.gx * cell.x, b.gy * cell.y, b.gz * cell.z);
    }
    function rotDir(b) {
      const a = (b.rot || 0) * Math.PI / 2;
      return new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    }

    for (const b of blocks) {
      if (b.type === 'orb') {
        const p = markerWorldPos(b);
        const r = cell.x * 0.42;
        const mat = new THREE.MeshStandardMaterial({
          color: 0xff9ed6, emissive: 0x6b0a45, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.5,
          transparent: true, opacity: 0.6,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
        mesh.position.copy(p);
        scene.add(mesh);
        decorations.push({ mesh, spin: 0.5 });
        bounceOrbs.push({ pos: p, radius: r, force: 22 });
      } else if (b.type === 'checkpoint') {
        const p = markerWorldPos(b);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        pole.position.set(p.x, p.y + 1.2, p.z);
        const flagMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, emissive: 0x111111, side: THREE.DoubleSide });
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), flagMat);
        flag.position.set(p.x + 0.5, p.y + 2.0, p.z);
        scene.add(pole, flag);
        const idx = checkpoints.length;
        checkpoints.push({ pos: new THREE.Vector3(p.x, p.y + 0.1, p.z), flagMat, flag, pole });
        triggers.push({ type: 'checkpoint', index: idx, pos: p.clone(), radius: 2.2 });
      } else if (b.type === 'wind') {
        const p = markerWorldPos(b);
        const dir = rotDir(b);
        // 1 = Faible, 2 = Moyen (comportement d'origine), 3 = Fort.
        const powerScale = { 1: 0.55, 2: 1, 3: 1.7 }[b.power || 2] || 1;
        const sx = cell.x * 1.1, sy = cell.y * 4, sz = cell.z * 1.1;
        const min = new THREE.Vector3(p.x - sx / 2, p.y - sy / 2, p.z - sz / 2);
        const max = new THREE.Vector3(p.x + sx / 2, p.y + sy / 2, p.z + sz / 2);
        const force = new THREE.Vector3(dir.x * 3 * powerScale, 9 * powerScale, dir.z * 3 * powerScale);
        windZones.push({ min, max, force });
        const mat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(sx, sz) / 2, Math.min(sx, sz) / 2, sy, 16, 1, true), mat);
        mesh.position.copy(p);
        scene.add(mesh);
        decorations.push({ mesh, spin: 0.6 });
      } else if (b.type === 'lowgrav') {
        const p = markerWorldPos(b);
        const sx = cell.x * 2.2, sy = cell.y * 3, sz = cell.z * 2.2;
        const min = new THREE.Vector3(p.x - sx / 2, p.y - sy / 2, p.z - sz / 2);
        const max = new THREE.Vector3(p.x + sx / 2, p.y + sy / 2, p.z + sz / 2);
        gravityZones.push({ min, max, scale: 0.35 });
        const mat = new THREE.MeshBasicMaterial({ color: 0xd9c6ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(sx, sz) / 2, 20, 14), mat);
        mesh.position.copy(p);
        scene.add(mesh);
      }
    }

    // ---- Paires (posées dans l'ordre) : portes de phase et plateformes mobiles
    function pairsOf(type) {
      const list = blocks.filter((b) => b.type === type);
      const pairs = [];
      for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
      return pairs;
    }
    function phaseGateVisual(pos, dir, color) {
      const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.14, 10, 24), mat);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().add(dir));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
      disc.position.copy(pos);
      disc.lookAt(pos.clone().add(dir));
      scene.add(ring, disc);
      decorations.push({ mesh: ring, spin: 0.6 });
    }
    // Une couleur par paire (les deux portes d'une même paire partagent leur
    // couleur, pour que le lien entre elles soit lisible d'un coup d'oeil) —
    // les paires suivantes tournent dans une petite palette pour rester
    // distinguables les unes des autres.
    const PHASE_GATE_COLORS = [0x6ee7ff, 0xff6ea0, 0xffd166, 0x9dff6e, 0xc792ff, 0xff8a5c];
    pairsOf('phase').forEach(([ba, bb], i) => {
      const pa = markerWorldPos(ba), pb = markerWorldPos(bb);
      const da = rotDir(ba), db = rotDir(bb);
      const color = PHASE_GATE_COLORS[i % PHASE_GATE_COLORS.length];
      phaseGateVisual(pa, da, color);
      phaseGateVisual(pb, db, color);
      triggers.push({ type: 'phaseGate', pos: pa, dir: db, radius: 1.6, cooldown: 0, pairPos: pb });
      triggers.push({ type: 'phaseGate', pos: pb, dir: da, radius: 1.6, cooldown: 0, pairPos: pa });
    });
    for (const [ba, bb] of pairsOf('mover')) {
      const pa = markerWorldPos(ba), pb = markerWorldPos(bb);
      const sx = cell.x * 0.96, sy = cell.y * 0.5, sz = cell.z * 0.96;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), customMaterial('mover'));
      mesh.position.set(pa.x, pa.y - sy / 2, pa.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.surface = 'normal';
      scene.add(mesh);
      collidables.push(mesh);
      maxAltitude = Math.max(maxAltitude, Math.max(pa.y, pb.y) + cell.y);

      const legTime = 1 / 0.42; // ~2.4s par trajet, vitesse cohérente avec le niveau principal
      const pause = 0.28;
      const totalCycle = 2 * legTime + 2 * pause;
      const from = new THREE.Vector3(pa.x, pa.y - sy / 2, pa.z);
      const to = new THREE.Vector3(pb.x, pb.y - sy / 2, pb.z);
      let clock = 0;
      const prevPos = mesh.position.clone();
      const mover = {
        mesh,
        delta: new THREE.Vector3(),
        update: (dt) => {
          prevPos.copy(mesh.position);
          clock = (clock + dt) % totalCycle;
          if (clock < legTime) {
            mesh.position.lerpVectors(from, to, AS.Util.smoothstep(0, 1, clock / legTime));
          } else if (clock < legTime + pause) {
            mesh.position.copy(to);
          } else if (clock < 2 * legTime + pause) {
            mesh.position.lerpVectors(to, from, AS.Util.smoothstep(0, 1, (clock - legTime - pause) / legTime));
          } else {
            mesh.position.copy(from);
          }
          mover.delta.copy(mesh.position).sub(prevPos);
        },
      };
      mesh.userData.isMover = true;
      mesh.userData.moverRef = mover;
      movers.push(mover);
    }

    const fx = [];
    const sky = AS.Fx.buildSky(scene);
    const mountains = AS.Fx.buildMountainRing(scene, 0, 0, 220, 42);
    fx.push(AS.Fx.buildDust(scene, 150));

    const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x3a3226, 0.8);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d9, 1.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.0025;
    sun.target = new THREE.Object3D();
    scene.add(sun, sun.target);
    scene.fog = new THREE.Fog(0x3a2a4a, 40, 200);

    return {
      collidables,
      crumbles: collidables.filter((m) => m.userData.surface === 'crumble'),
      movers,
      triggers,
      windZones,
      gravityZones,
      checkpoints,
      decorations,
      orbitals: [],
      bounceOrbs,
      fx,
      sky,
      mountains,
      sun,
      maxAltitude,
      spawn: spawnPos,
    };
  }

  return { buildCustom, EDITOR_TYPES };
})();
