// ============================================================================
// Défis (second portail du hub) : 8 salles uniques, une par arme de type 1 — chacune
// pensée pour mettre en valeur le mécanisme propre à cette arme, et TOUJOURS avec du
// terrain (pierres, téléporteurs ou zones : sans décor, le combat n'a aucune stratégie
// de positionnement). Réutilise entièrement le moteur de combat normal (goToCombat/
// initCombat, voir js/combat.js) via une queue à une seule salle ; CB.challengeId marque
// la salle comme un défi et CB.forcedChapterTheme fige la palette visuelle (voir
// currentChapterTheme dans render.js et currentChapterIdx3D dans js3d/combat3d.js).
// ============================================================================

// Dispose `count` ennemis en cercle autour de (cx, cy) — pratique pour les défis à
// foule sans avoir à taper chaque coordonnée à la main.
function ringEnemies(count, cx, cy, radius, shapeTierList, extra) {
  var out = [];
  for (var i = 0; i < count; i++) {
    var angle = (i / count) * Math.PI * 2;
    var st = shapeTierList[i % shapeTierList.length];
    var spec = { shape: st[0], tier: st[1], x: Math.round(cx + Math.cos(angle) * radius), y: Math.round(cy + Math.sin(angle) * radius) };
    if (extra) for (var k in extra) spec[k] = extra[k];
    out.push(spec);
  }
  return out;
}

var CHALLENGES = [
  {
    id: 'meteor', icon: WEAPON_ICONS.meteor, name: 'Pluie de Météores',
    desc: "Météore + Sprint : des pierres pour te mettre à couvert entre deux tirs à distance, contre des ennemis qui te punissent à découvert.",
    arenaSize: 620, chapterTheme: 0,
    weapons: { weapon1: 'meteor', weapon2: 'sprint' },
    spawn: { x: 310, y: 540 },
    zones: [
      { kind: 'wall', x: 150, y: 380, r: 35 },
      { kind: 'wall', x: 470, y: 380, r: 35 },
      { kind: 'wall', x: 310, y: 280, r: 38 },
      { kind: 'wall', x: 100, y: 180, r: 30 },
      { kind: 'wall', x: 520, y: 180, r: 30 }
    ],
    enemies: [
      { shape: 'triangle', tier: 3, x: 150, y: 100 },
      { shape: 'triangle', tier: 4, x: 470, y: 100 }
    ]
  },
  {
    id: 'sword', icon: WEAPON_ICONS.sword, name: 'Le Cercle de Lames',
    desc: "Épée + Poussée : une petite foule autour de piliers de pierre — l'arc de l'épée fait le tri, les piliers cassent les lignes de charge.",
    arenaSize: 500, chapterTheme: 1,
    weapons: { weapon1: 'sword', weapon2: 'pulse' },
    spawn: { x: 250, y: 440 },
    zones: [
      { kind: 'wall', x: 150, y: 280, r: 28 },
      { kind: 'wall', x: 350, y: 280, r: 28 },
      { kind: 'wall', x: 150, y: 160, r: 28 },
      { kind: 'wall', x: 350, y: 160, r: 28 }
    ],
    enemies: ringEnemies(10, 250, 220, 140, [['square', 1], ['circle', 1], ['triangle', 1]])
  },
  {
    id: 'flame', icon: WEAPON_ICONS.flame, name: 'Le Brasier Éternel',
    desc: 'Brasier + Poussée : le sol est presque entièrement en feu — quelques chemins sûrs, et des ennemis qui te repoussent dedans.',
    arenaSize: 500, chapterTheme: 2,
    weapons: { weapon1: 'flame', weapon2: 'pulse' },
    spawn: { x: 250, y: 440 },
    zones: [
      { kind: 'flame', x: 150, y: 150, r: 55 },
      { kind: 'flame', x: 350, y: 150, r: 55 },
      { kind: 'flame', x: 150, y: 300, r: 55 },
      { kind: 'flame', x: 350, y: 300, r: 55 },
      { kind: 'flame', x: 250, y: 220, r: 60 },
      { kind: 'flame', x: 90, y: 380, r: 45 },
      { kind: 'flame', x: 410, y: 380, r: 45 }
    ],
    enemies: [
      { shape: 'square', tier: 3, x: 250, y: 120 },
      { shape: 'square', tier: 2, x: 130, y: 260 },
      { shape: 'square', tier: 2, x: 370, y: 260 }
    ]
  },
  {
    id: 'charge', icon: WEAPON_ICONS.charge, name: "L'Immensité",
    desc: "Charge + Sprint : une arène deux fois plus grande que la normale, semée de pierres à percuter (bonus de dégâts à l'impact) pour couvrir la distance contre des tireurs isolés.",
    arenaSize: 900, chapterTheme: 0,
    weapons: { weapon1: 'charge', weapon2: 'sprint' },
    spawn: { x: 450, y: 820 },
    zones: [
      { kind: 'wall', x: 300, y: 450, r: 40 },
      { kind: 'wall', x: 600, y: 450, r: 40 },
      { kind: 'wall', x: 450, y: 300, r: 45 },
      { kind: 'wall', x: 200, y: 650, r: 35 },
      { kind: 'wall', x: 700, y: 650, r: 35 }
    ],
    enemies: [
      { shape: 'triangle', tier: 3, x: 120, y: 120 },
      { shape: 'triangle', tier: 4, x: 780, y: 120 },
      { shape: 'triangle', tier: 5, x: 450, y: 90 },
      { shape: 'circle', tier: 1, x: 120, y: 780 },
      { shape: 'square', tier: 3, x: 780, y: 780 }
    ]
  },
  {
    id: 'boomerang', icon: WEAPON_ICONS.boomerang, name: 'Ricochets',
    desc: "Boomerang + Attraction : des ennemis planqués derrière des pierres, atteignables en courbant le boomerang autour — le grappin d'appoint permet de te replacer vite.",
    arenaSize: 520, chapterTheme: 3,
    weapons: { weapon1: 'boomerang', weapon2: 'pull' },
    spawn: { x: 260, y: 460 },
    zones: [
      { kind: 'wall', x: 130, y: 260, r: 34 },
      { kind: 'wall', x: 390, y: 260, r: 34 },
      { kind: 'wall', x: 260, y: 150, r: 34 },
      { kind: 'grapple', x: 260, y: 350, r: 30 }
    ],
    enemies: [
      { shape: 'triangle', tier: 2, x: 90, y: 200 },
      { shape: 'triangle', tier: 2, x: 430, y: 200 },
      { shape: 'circle', tier: 2, x: 260, y: 90 },
      { shape: 'square', tier: 1, x: 260, y: 420 }
    ]
  },
  {
    id: 'turret', icon: WEAPON_ICONS.turret, name: 'Poste Avancé',
    desc: "Tourelle + Piège : tiens une position assiégée depuis 4 directions — des pierres forment des chicanes, une tourelle hostile pré-installée s'ajoute à la pression.",
    arenaSize: 560, chapterTheme: 2,
    weapons: { weapon1: 'turret', weapon2: 'trapify' },
    spawn: { x: 280, y: 280 },
    zones: [
      { kind: 'wall', x: 280, y: 120, r: 32 },
      { kind: 'wall', x: 280, y: 440, r: 32 },
      { kind: 'wall', x: 120, y: 280, r: 32 },
      { kind: 'wall', x: 440, y: 280, r: 32 },
      { kind: 'converted_trap', x: 280, y: 60, r: TRAP_TURRET_VISUAL_R, cd: 0.8 }
    ],
    enemies: [
      { shape: 'square', tier: 2, x: 280, y: 50 },
      { shape: 'triangle', tier: 2, x: 280, y: 510 },
      { shape: 'circle', tier: 2, x: 50, y: 280 },
      { shape: 'square', tier: 3, x: 510, y: 280 },
      { shape: 'triangle', tier: 3, x: 460, y: 100, forceElite: true },
      { shape: 'square', tier: 3, x: 100, y: 460, forceElite: true }
    ]
  },
  {
    id: 'knife', icon: WEAPON_ICONS.knife, name: 'Duel',
    desc: "Couteau + Invincibilité : un seul adversaire redoutable et mobile — quelques pierres au sol, parfaites pour faire rebondir le couteau et cumuler les dégâts croissants.",
    arenaSize: 420, chapterTheme: 1, isBossRoom: true,
    weapons: { weapon1: 'knife', weapon2: 'invincible' },
    spawn: { x: 210, y: 360 },
    zones: [
      { kind: 'wall', x: 120, y: 220, r: 26 },
      { kind: 'wall', x: 300, y: 220, r: 26 },
      { kind: 'wall', x: 210, y: 140, r: 26 }
    ],
    enemies: [
      { shape: 'boss', tier: 3, x: 210, y: 90 }
    ]
  },
  {
    id: 'spikes360', icon: WEAPON_ICONS.spikes360, name: 'Nuée',
    desc: "Onde de piques + Attraction : encerclé par une nuée d'ennemis minuscules — deux paires de failles servent d'échappatoires (chaque traversée inflige des dégâts sur sa trajectoire).",
    arenaSize: 440, chapterTheme: 3,
    weapons: { weapon1: 'spikes360', weapon2: 'pull' },
    spawn: { x: 220, y: 220 },
    zones: [
      { kind: 'abyss_rift', x: 60, y: 60, r: 28, pairId: 'a', cd: 0 },
      { kind: 'abyss_rift', x: 380, y: 380, r: 28, pairId: 'a', cd: 0 },
      { kind: 'abyss_rift', x: 380, y: 60, r: 28, pairId: 'b', cd: 0 },
      { kind: 'abyss_rift', x: 60, y: 380, r: 28, pairId: 'b', cd: 0 }
    ],
    enemies: ringEnemies(28, 220, 220, 160, [['square', 1], ['circle', 1], ['triangle', 1]])
  }
];

function rotateAround(x, y, cx, cy, angleRad) {
  var dx = x - cx, dy = y - cy;
  var c = Math.cos(angleRad), s = Math.sin(angleRad);
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

// "2 fois plus dur et long" (demande utilisateur) sans réécrire les 8 défis un par
// un : arène agrandie (plus de terrain à couvrir), et un second exemplaire tourné +
// écarté de chaque ennemi (pas un simple miroir centre-à-centre — pour un anneau
// d'ennemis symétrique, ça retomberait exactement sur les positions existantes),
// chacun plus résistant et plus offensif.
var CHALLENGE_SIZE_MULT = 1.35;
var CHALLENGE_ENEMY_HP_MULT = 2;
var CHALLENGE_ENEMY_DMG_MULT = 1.6;
var CHALLENGE_ENEMY_ATKSPD_MULT = 1.5; // attaquent 50% plus vite (demande utilisateur)
var CHALLENGE_DUPLICATE_ROTATION = 0.9; // rad (~52°) : évite tout alignement avec les pas d'angle usuels des anneaux d'ennemis (36°, 12.86°...)
var CHALLENGE_DUPLICATE_SPREAD = 1.15; // écarte un peu plus du centre, profite de l'arène agrandie

function buildChallengeEnemies(ch, w, h) {
  var cx = w / 2, cy = h / 2;
  var scaled = ch.enemies.map(function (e) {
    var se = {};
    for (var k in e) se[k] = e[k];
    se.x = Math.round(e.x * CHALLENGE_SIZE_MULT);
    se.y = Math.round(e.y * CHALLENGE_SIZE_MULT);
    se.hpPct = Math.round((e.hpPct != null ? e.hpPct : 100) * CHALLENGE_ENEMY_HP_MULT);
    se.dmgPct = Math.round((e.dmgPct != null ? e.dmgPct : 100) * CHALLENGE_ENEMY_DMG_MULT);
    se.atkSpdPct = Math.round((e.atkSpdPct != null ? e.atkSpdPct : 100) * CHALLENGE_ENEMY_ATKSPD_MULT);
    return se;
  });
  var duplicated = scaled.map(function (e) {
    var de = {};
    for (var k in e) de[k] = e[k];
    var rot = rotateAround(e.x, e.y, cx, cy, CHALLENGE_DUPLICATE_ROTATION);
    de.x = Math.round(cx + (rot[0] - cx) * CHALLENGE_DUPLICATE_SPREAD);
    de.y = Math.round(cy + (rot[1] - cy) * CHALLENGE_DUPLICATE_SPREAD);
    return de;
  });
  return scaled.concat(duplicated);
}

// Quelques pièges/grappin supplémentaires par défi (demande utilisateur : "plus de
// piège ou grappin"), positionnés au hasard puis contraints à la forme de salle —
// s'ajoutent au terrain déjà pensé à la main pour chaque défi plutôt que de le
// remplacer.
function buildExtraChallengeHazards(w, h, roomShape) {
  var extra = [];
  var trapCount = 3 + Math.floor(Math.random() * 3);
  for (var i = 0; i < trapCount; i++) {
    var pos = pickTerrainPos(70, null, null, roomShape);
    if (Math.random() < 0.5) {
      extra.push({ kind: 'trap_spike', x: pos[0], y: pos[1], r: 32, phaseOffset: Math.random() * 3 });
    } else {
      extra.push({ kind: 'trap_arrow', x: pos[0], y: pos[1], r: 16, cd: 0.8 + Math.random() * 1.4, telegraphOn: false, telegraphTimer: 0 });
    }
  }
  var gpos = pickTerrainPos(90, null, null, roomShape);
  extra.push({ kind: 'grapple', x: gpos[0], y: gpos[1], r: 30 });
  return extra;
}

function startChallenge(id) {
  var ch = CHALLENGES.filter(function (c) { return c.id === id; })[0];
  if (!ch) return;
  ARENA_W = Math.round(ch.arenaSize * CHALLENGE_SIZE_MULT);
  ARENA_H = Math.round(ch.arenaSize * CHALLENGE_SIZE_MULT);
  goToCombat({
    queue: [{ enemies: buildChallengeEnemies(ch, ARENA_W, ARENA_H), playerStats: { dmgPct: 100, spdPct: 100 }, isBossRoom: !!ch.isBossRoom }],
    playerConfig: { spawnX: Math.round(ch.spawn.x * CHALLENGE_SIZE_MULT), spawnY: Math.round(ch.spawn.y * CHALLENGE_SIZE_MULT) },
    weapons: ch.weapons
  });
  CB.challengeId = id;
  CB.forcedChapterTheme = ch.chapterTheme;

  // Forme de salle FIXE (rectangle), pas tirée au hasard : chaque défi a son terrain
  // (pierres, pièges, présentoirs...) placé à la main pour occuper tout le carré de
  // l'arène — une forme non rectangulaire tirée à chaque lancement (essayé plus tôt)
  // rendait le même défi méconnaissable d'une tentative à l'autre, signalé comme
  // indésirable. spawnWave (dans goToCombat ci-dessus) a déjà tiré et appliqué SA
  // propre forme pour clamper les ennemis à la volée — on la remplace ici par le
  // rectangle, donc les positions déjà clampées contre l'ancienne forme doivent être
  // reclampées contre la nouvelle.
  CB.roomShape = makeRectangleRoomShape(ARENA_W, ARENA_H);
  CB.enemies.forEach(function (e) {
    var exy = clampIntoRoom(e.x, e.y, e.r);
    e.x = exy[0]; e.y = exy[1];
  });

  var scaledZones = (ch.zones || []).map(function (z) {
    var sz = {};
    for (var k in z) sz[k] = z[k];
    sz.x = Math.round(z.x * CHALLENGE_SIZE_MULT);
    sz.y = Math.round(z.y * CHALLENGE_SIZE_MULT);
    return sz;
  });
  var allZones = scaledZones
    .concat(buildExtraChallengeHazards(ARENA_W, ARENA_H, CB.roomShape))
    .concat(carveZonesForRoomShape(CB.roomShape));
  // Reclampe chaque zone dans la forme tirée : l'agrandissement/la découpe de forme
  // pourrait sinon laisser une zone pensée pour l'ancienne arène carrée hors de la
  // nouvelle zone marchable.
  allZones.forEach(function (z) {
    var zxy = clampIntoRoom(z.x, z.y, z.r || 20);
    z.x = zxy[0]; z.y = zxy[1];
  });
  applyZonesToArena(allZones);
  AudioEngine.setMusicTheme(ch.chapterTheme);
  // Défis = toujours sous tension (2x PV/1.6x dégâts/1.5x vitesse d'attaque, voir
  // CHALLENGE_ENEMY_*_MULT plus haut) — la salle de boss du défi 'knife' pousse même à
  // la tension maximale.
  AudioEngine.setMusicRoom(ch.isBossRoom ? 1 : 0.75, id.length * 7 + ARENA_W);
}
