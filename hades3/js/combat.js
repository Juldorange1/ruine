// ============================================================================
// Simulation de combat en temps réel : mouvement, IA des 15 comportements,
// capacités du joueur, collisions, progression des vagues, victoire/défaite.
// ============================================================================
//
// Plan de ce fichier (chercher les en-têtes "----------------" pour naviguer) :
//   - Constantes générales + constantes des armes (tirées au hasard par run)
//   - Grille de cases (anti-camping des ennemis) + collisions ennemi-ennemi
//   - Init/déroulement d'un run (initCombat, spawnWave, applyZonesToArena)
//   - Zones de terrain (vitesse/soin/flamme, affectent joueur ET ennemis)
//   - Joueur (dash/grappin/poussée/échange/attraction + dispatch des 2 armes)
//   - Ennemis (dégâts/mort, évitement d'obstacles, IA — un gros switch par
//     comportement, un comportement = un type d'ennemi, jamais partagé)
//   - Projectiles / blasts / lasers (mise à jour générique, tirée par l'IA)
//   - Boucle principale (updateCombat, appelée une fois par frame par game.js)

var CB = null; // état de combat courant
var SWAP_PICK_RADIUS = 100;
var ZONE_SLOW_MULT = 0.5;
var ZONE_SPEED_MULT = 1.6;
var ZONE_HEAL_PER_SEC = 12; // ennemis uniquement (ils ont un vrai pool de PV utile en combat)
var ZONE_HEAL_PLAYER_PER_SEC = 2; // réduit les PV perdus affichés, seul indicateur qui compte pour le joueur
var ZONE_FLAME_PER_SEC = 16;
var CELL_REVISIT_FORBID_SEC = 15;
// "Charge" (arme type 1) : nommées CHARGE_* mais réutilisent le mécanisme historique du
// dash (isDashing/dashTimer/etc. dans entities.js) — voir tryPlayerCharge. Depuis le rework
// charge-puis-relâche (comme la météorite), dégâts/poussée montent avec le temps maintenu,
// entre les paires MIN/MAX ci-dessous (voir p.chargeFrac, résolu dans resolveChargeDamage).
var CHARGE_MAX_CHARGE_TIME = 1.2;
var CHARGE_MIN_DMG = 24;
var CHARGE_MAX_DMG = 60;
var CHARGE_TRAIL_WIDTH = 46;
var CHARGE_MIN_KNOCKBACK_FORCE = 260;
var CHARGE_MAX_KNOCKBACK_FORCE = 500;
var CHARGE_BLOCK_KNOCKBACK_FORCE = 260; // repousse aussi les pierres (CB.blocks), pas juste les ennemis
var WALL_SLAM_BONUS_DMG = 70; // bonus générique quand un ennemi repoussé (dash/pulse/pull/etc.) percute un obstacle
var MIN_TELEPORT_DIST = CELL_SIZE * 5;
var PULSE_RADIUS = 220;
var PULSE_FORCE = 1040;
var PASSIVE_DRAIN_PER_SEC = 2;
var GRAPPLE_DMG = 42; // -30% (était 60)
var GRAPPLE_DMG_RADIUS = 95;

// ---------------- Pièges de terrain ----------------
var SPIKE_TRAP_CYCLE = 2.6; // rétractées la plupart du temps, puis actives brièvement
var SPIKE_TRAP_ACTIVE_DUR = 0.7;
var SPIKE_TRAP_DMG_PER_SEC = 45;
var TRAP_ARROW_SPEED = 266; // -30% (était 380), cohérent avec le ralentissement global des projectiles
var TRAP_ARROW_DMG = 22;
var TRAP_ARROW_INTERVAL = 2.8;
var TRAP_ARROW_TELEGRAPH = 0.6;

// ---------------- Armes (tirées au hasard en début de run) ----------------
// Le dash est une arme de type 1 parmi d'autres ; la poussée, une arme de type 2
// parmi d'autres. Le grappin, lui, est toujours équipé (voir tryPlayerGrapple).

var METEOR_RADIUS = 110;
var METEOR_MAX_CHARGE = 2.5;
var METEOR_MIN_DMG = 40;
var METEOR_MAX_DMG = 220;
var METEOR_TELEGRAPH = 0.15;
var SWORD_RANGE = CELL_SIZE * 2;
var SWORD_ARC = Math.PI * 0.75;
var SWORD_DMG = 75;
var BRASIER_SPEED = 260 * GAME_SPEED_MULT;
var BRASIER_RADIUS = 26;
var BRASIER_DPS = 40;
var SPRINT_SPEED_MULT = 1.5;
var SPRINT_DRAIN_PER_SEC = 3;
var SPRINT_REGEN_PER_SEC = 1;
var PULL_FORCE = 620;
var PULL_DMG = 45;

// ---- Boomerang (type 1) ----
// -20% vitesse / +20% dégâts (demandé) : un projectile plus lent mais bien plus lourd à
// encaisser, cohérent avec sa nouvelle taille visuelle (voir createBoomerangMesh/
// drawBoomerang) — un gros boomerang qui va vite aurait été illisible.
var BOOMERANG_SPEED_OUT = 260 * 0.8;
var BOOMERANG_SPEED_BACK = 220 * 0.8;
var BOOMERANG_DMG = 30 * 1.2;
var BOOMERANG_CATCH_RADIUS = 26;
var BOOMERANG_R = 20; // bien plus gros (était 12), la hitbox suit le nouveau visuel
var BOOMERANG_RECATCH_CD = 0.3; // délai avant de pouvoir relancer après rattrapage

// ---- Tourelle (type 1) ----
var TURRET_RANGE = 210; // même portée que l'ancien pistolet laser
var TURRET_MAX = 4;
var TURRET_FIRE_INTERVAL = 1.1;
var TURRET_DMG = 16;
var TURRET_PROJ_SPEED = 260;
var TURRET_R = 16;

// ---- Couteau (type 1) ----
var KNIFE_RANGE = CELL_SIZE * 4;
var KNIFE_SPEED = 340;
var KNIFE_BASE_DMG = 22;
var KNIFE_BOUNCE_BONUS_DMG = 9;
var KNIFE_MAX_BOUNCES = 6;
var KNIFE_R = 8;

// ---- Onde de piques (type 1) ----
var SPIKES_COUNT = 360;
var SPIKES_DMG = 3; // divisé par 3 (était 9) : trop fort pour une attaque à 360° sans viser
var SPIKES_SPEED = 300;
var SPIKES_R = 4;

// ---- Mimétisme (type 2) ----
var MIMIC_RESOURCE_MAX = 50; // comme Sprint

// ---- Invincibilité (type 2) ----
var INVINCIBLE_DUR = 1.0;
var INVINCIBLE_CD = 10.0;

// ---- Piège (type 2) : transforme l'ennemi le plus proche (hors boss) en une vraie
// tourelle hostile qui tire sur LE JOUEUR en continu (portée illimitée : elle "te tire
// dessus toujours", peu importe où tu es dans la salle) — avant, c'était un pulse de
// dégâts aux ennemis à proximité, invisible et sans effet apparent pour le joueur. ----
var TRAPIFY_RADIUS = 550; // même valeur que l'ancien SWAP_ENEMY_RADIUS
var TRAP_TURRET_FIRE_INTERVAL = 1.1; // même cadence que la tourelle posée (arme type 1)
var TRAP_TURRET_DMG = 14;
var TRAP_TURRET_PROJ_SPEED = 260;
var TRAP_TURRET_VISUAL_R = 24; // petite embase nette, plus la grande zone translucide d'avant

var WEAPON1_IDS = ['meteor', 'sword', 'flame', 'charge', 'boomerang', 'turret', 'knife', 'spikes360'];
var WEAPON2_IDS = ['pulse', 'sprint', 'pull', 'mimic', 'invincible', 'trapify'];

var WEAPON1_INFO = {
  meteor: { name: 'Météore', cdMax: 1.8, desc: 'Maintiens (immobile) pour charger, relâche pour faire tomber un météore — dégâts proportionnels au temps de charge.' },
  sword: { name: 'Épée', cdMax: 0.7, desc: 'Frappe en zone, 2 cases vers le curseur.' },
  flame: { name: 'Brasier', cdMax: 0.15, desc: 'Dirige un brasier : vise où il doit aller.' },
  charge: { name: 'Charge', cdMax: 1.5, desc: 'Fonce vers la direction visée : inflige des dégâts et repousse ennemis et pierres.' },
  boomerang: { name: 'Boomerang', cdMax: 0, desc: "Lance un unique boomerang à portée infinie — il revient après avoir heurté quelque chose. Se relance dès qu'il est rattrapé." },
  turret: { name: 'Tourelle', cdMax: 0.5, desc: 'Pose une tourelle qui tire sur les ennemis à portée (4 max, espacées d\'au moins leur portée — en poser une 5e détruit la plus ancienne).' },
  knife: { name: 'Couteau', cdMax: 0.8, desc: 'Lance un couteau qui rebondit sur murs, pierres et ennemis (4 cases de portée) — dégâts croissants à chaque rebond.' },
  spikes360: { name: 'Onde de piques', cdMax: 2.6, desc: 'Tire 360 piques tout autour de toi.' }
};
var WEAPON2_INFO = {
  pulse: { name: 'Poussée', cdMax: 4.5, desc: 'Repousse tous les ennemis proches, sans dégâts.' },
  sprint: { name: 'Sprint', cdMax: 0, desc: '+50% de vitesse tant que maintenu, mais jauge deux fois plus courte que les autres armes de type 2.' },
  pull: { name: 'Attraction', cdMax: 4.0, desc: 'Aspire les ennemis proches vers toi, sans dégâts.' },
  mimic: { name: 'Mimétisme', cdMax: 0, desc: "S'attitre une arme de type 1 aléatoire à l'obtention ; tant que maintenu (jauge comme Sprint), transforme temporairement ton arme de type 1 en celle-ci." },
  invincible: { name: 'Invincibilité', cdMax: INVINCIBLE_CD, desc: 'Devient invincible pendant 1 seconde.' },
  trapify: { name: 'Piège', cdMax: 7.0, desc: "Transforme l'ennemi le plus proche (hors boss) en piège qui reste toute la salle." }
};

// Symbole affiché à côté du nom de l'arme (HUD, révélation d'armes, menu Armes) pour
// identifier l'effet d'un coup d'œil — un seul jeu d'icônes, les ids type1/type2 ne se
// recoupent jamais.
var WEAPON_ICONS = {
  meteor: '☄️', sword: '⚔️', flame: '🔥', charge: '💥', boomerang: '🪃', turret: '🗼', knife: '🔪', spikes360: '✴️',
  pulse: '🌀', sprint: '👟', pull: '🧲', mimic: '🎭', invincible: '🛡️', trapify: '🪤'
};
function weaponLabel(id) { return (WEAPON_ICONS[id] || '') + ' ' + (WEAPON1_INFO[id] || WEAPON2_INFO[id]).name; }

// Biais de tirage des armes (0 à 100% de chance relative en plus par arme), réglé depuis le
// sous-menu Armes du menu principal (voir editor.js) et persisté d'une session à l'autre.
var WEAPON_BIAS = {};

function pickWeightedWeapon(ids) {
  var weights = ids.map(function (id) { return 1 + (WEAPON_BIAS[id] || 0) / 100; });
  var total = weights.reduce(function (a, b) { return a + b; }, 0);
  var r = Math.random() * total;
  for (var i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) return ids[i];
  }
  return ids[ids.length - 1];
}

// Séparé de equipRandomWeapons pour pouvoir équiper des armes déjà tirées au sort
// plus tôt (voir startRunNow/editor.js, qui les révèle avant le début du combat)
// sans les retirer une seconde fois.
function applyWeapons(p, weapon1, weapon2) {
  p.weapon1 = weapon1;
  p.weapon2 = weapon2;
  p.dashCdMax = WEAPON1_INFO[p.weapon1].cdMax;
  p.pulseCdMax = WEAPON2_INFO[p.weapon2].cdMax;
  // Sprint et Mimétisme vont/agissent tant que maintenus mais avec une jauge deux fois
  // plus courte que les autres armes de type 2 (contrepartie de l'effet).
  p.w2ResourceMax = (p.weapon2 === 'sprint' || p.weapon2 === 'mimic') ? MIMIC_RESOURCE_MAX : 100;
  p.w2Resource = p.w2ResourceMax;
  p.mimicActive = false;
  // Mimétisme : s'attitre une arme de type 1 aléatoire (différente de celle équipée) dès
  // l'obtention, une fois pour toute la run — pas retirée à chaque activation.
  p.mimicWeapon = null;
  if (p.weapon2 === 'mimic') {
    var choices = WEAPON1_IDS.filter(function (id) { return id !== p.weapon1; });
    p.mimicWeapon = choices[Math.floor(Math.random() * choices.length)];
  }
}

function equipRandomWeapons(p) {
  applyWeapons(p, pickWeightedWeapon(WEAPON1_IDS), pickWeightedWeapon(WEAPON2_IDS));
}

// ---------------- Grille de cases (anti-camping) + collisions ennemi-ennemi ----------------

function cellOf(x, y) { return [Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE)]; }
function cellKey(cx, cy) { return cx + ',' + cy; }

function isCellForbidden(e, cx, cy) {
  var key = cellKey(cx, cy);
  if (key === e.lastCellKey) return false; // rester dans sa case actuelle reste toujours permis
  var hist = e.cellHistory;
  for (var i = 0; i < hist.length; i++) {
    if (hist[i].key === key && (CB.elapsed - hist[i].t) < CELL_REVISIT_FORBID_SEC) return true;
  }
  return false;
}

function updateCellHistory(e) {
  var c = cellOf(e.x, e.y);
  var key = cellKey(c[0], c[1]);
  if (e.lastCellKey !== key) {
    e.lastCellKey = key;
    e.cellHistory.push({ key: key, t: CB.elapsed });
    var cutoff = CB.elapsed - CELL_REVISIT_FORBID_SEC;
    e.cellHistory = e.cellHistory.filter(function (h) { return h.t >= cutoff; });
  }
}

function resolveEnemyCollisions() {
  var list = CB.enemies;
  for (var i = 0; i < list.length; i++) {
    if (!list[i].alive) continue;
    for (var j = i + 1; j < list.length; j++) {
      var a = list[i], b = list[j];
      if (!b.alive) continue;
      var d = dist(a.x, a.y, b.x, b.y);
      var minD = a.r + b.r;
      if (d < minD && d > 0.001) {
        var push = (minD - d) / 2;
        var nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
        a.x += nx * push; a.y += ny * push;
        b.x -= nx * push; b.y -= ny * push;
      }
    }
  }
}

// Petits utilitaires géométriques, utilisés dans tout le fichier.
function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function norm(dx, dy) {
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d < 0.0001) return [0, 0, 0];
  return [dx / d, dy / d, d];
}
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

// ---------------- Init / déroulement d'un run ----------------

// Reconstruit CB.blocks/CB.zones à partir d'une liste de zones fraîchement générées —
// les murs ('wall', les cailloux) deviennent des blocs solides, le reste (grappin, etc.)
// reste une zone. Appelé à l'init et à chaque nouveau chapitre (voir spawnWave).
function applyZonesToArena(zones) {
  var walls = zones.filter(function (z) { return z.kind === 'wall'; })
    .map(function (z) { return { id: nextId(), kind: 'block', x: z.x, y: z.y, r: z.r * 0.55, isShapeCarve: !!z.isShapeCarve }; });
  CB.zones = zones.filter(function (z) { return z.kind !== 'wall'; });
  CB.blocks = walls;
}

function initCombat(config) {
  var queue = config.queue;
  var pc = config.playerConfig || {};
  CB = {
    queue: queue,
    zones: [],
    waveIndex: 0,
    totalWaves: queue.length,
    enemies: [],
    projectiles: [],
    blasts: [],
    lasers: [],
    particles: [],
    dashTrails: [],
    grappleRopes: [],
    pulseRings: [],
    turrets: [],
    knives: [],
    boomerang: null,
    brasier: null,
    swordSwings: [],
    blocks: [],
    roomShape: null,
    player: makePlayer(pc.spawnX, pc.spawnY),
    phase: 'fighting',
    transitionTimer: 0,
    shakeTime: 0, shakeMag: 0,
    damageFlashTime: 0,
    ended: false, won: false,
    paused: false,
    elapsed: 0,
    killCount: 0,
    damageDealt: 0,
    totalDamageTaken: 0,
    points: totalPoints(queue),
    difficultyMods: config.difficultyMods || DEFAULT_DIFFICULTY_MODS
  };
  // Si les armes ont déjà été tirées au sort et révélées avant le combat (voir
  // startRunNow/editor.js), on les applique telles quelles plutôt que d'en retirer
  // d'autres — ce qui a été montré au joueur doit être ce avec quoi il commence.
  if (config.weapons) applyWeapons(CB.player, config.weapons.weapon1, config.weapons.weapon2);
  else equipRandomWeapons(CB.player);
  spawnWave(0);
  return CB;
}

var WAVE_START_GRACE = 1.0;
var MIN_ENEMY_SPAWN_DIST = 110;
var WAVE_TRANSITION_DUR = 1.8; // assez long pour lire "Chapitre X — Salle Y" avant l'enchaînement

// ---------------- Laisse anti-fuite en combat de boss ----------------
// Un vrai combat de boss ne se laisse pas kiter à l'infini : au-delà de cette distance
// au boss le plus proche, le joueur subit des dégâts constants et se fait ramener vers
// le combat — CB.leashWarning (0 à 1) est lu par le rendu pour prévenir avant que ça pique.
var BOSS_LEASH_RADIUS_RATIO = 288 / 492; // proportionnel à l'arène, dont la taille varie désormais par run
var BOSS_LEASH_PULL_FORCE = 260;
var BOSS_LEASH_DMG_PER_SEC = 14;

// ---------------- Pression anti-camping des boss ----------------
// Un boss qui reste trop longtemps face au même joueur sans mourir devient de plus en
// plus dangereux (vitesse + dégâts), pour qu'un pur tourniquet défensif finisse toujours
// par se faire punir — jusqu'à +50% après 40s de combat continu contre lui.
var BOSS_ENRAGE_AFTER = 18;
var BOSS_ENRAGE_RAMP = 40;
var BOSS_ENRAGE_MAX_MULT = 1.5;

// ---------------- Invocations du boss nécromancien ----------------
// Ce ne sont pas des ennemis de vague classiques (le nécromant les fait lui-même
// apparaître, comme un vrai pattern de boss) : max 2 squelettes vivants à la fois,
// faibles et éphémères, qui disparaissent avec le boss.
var NECRO_SUMMON_EVERY = 7;
var NECRO_SUMMON_MAX_ALIVE = 2;
var NECRO_SUMMON_HP_PCT = 35;
var NECRO_SUMMON_DMG_PCT = 60;

function spawnWave(index) {
  CB.waveIndex = index;
  CB.enemies = [];
  // Un piège issu de l'arme "Piège" (type 2) ne dure que la salle où il a été posé —
  // retiré explicitement ici plutôt que de lui donner un timer de vie, pour qu'il
  // survive exactement jusqu'au changement de salle, ni plus ni moins.
  CB.zones = (CB.zones || []).filter(function (z) { return z.kind !== 'converted_trap'; });
  // Nouveau chapitre = nouveau décor : le terrain change entièrement à chaque frontière
  // de chapitre (jamais au sein d'un même chapitre, pour ne pas déplacer le sol sous les pieds
  // du joueur en pleine salle). Les bonus de relique du chapitre précédent (voir
  // tryPlayerCollectRelic) ne survivent pas non plus au changement de chapitre.
  if (index % ROOMS_PER_CHAPTER === 0) {
    // Forme de salle tirée une fois par chapitre, jamais par salle (voir
    // js/roomShapes.js) — jamais pour l'armurerie/les défis (rectangle forcé
    // juste après leur propre applyZonesToArena, voir enterArmory/startChallenge).
    CB.roomShape = pickRoomShapeTemplate(ARENA_W, ARENA_H);
    applyZonesToArena(generateChapterTerrain(CB.player.x, CB.player.y, Math.floor(index / ROOMS_PER_CHAPTER), CB.roomShape));
    CB.player.chapterDmgBonusMult = 1;
    CB.player.chapterSpeedBonusMult = 1;
    AudioEngine.setMusicTheme(Math.floor(index / ROOMS_PER_CHAPTER));
  }
  var wave = CB.queue[index];
  var enemies = waveEnemies(wave);
  var p = CB.player;
  applyWaveStatsToPlayer(p, wave.playerStats);
  CB.isBossRoom = !!wave.isBossRoom;
  // Musique : la tension (tempo/dissonance du pouls percussif, voir audio.js) monte au
  // fil des salles d'un même chapitre et culmine à la salle de boss ; le motif rythmique
  // change à CHAQUE salle (roomSeed), pas seulement à chaque chapitre — sans ça, la
  // même boucle tournait identique pendant tout un chapitre.
  var roomInChapter = index % ROOMS_PER_CHAPTER;
  var tension = CB.isBossRoom ? 1 : roomInChapter / Math.max(1, ROOMS_PER_CHAPTER - 2);
  AudioEngine.setMusicRoom(tension, index);
  if (CB.isBossRoom) {
    // Salle de boss = toujours un rectangle simple (espace de combat propre, ne
    // perturbe pas le rayon de laisse/positionnement double-boss) — le reste du
    // décor généré en début de chapitre reste, seuls les rochers de découpe de
    // forme disparaissent.
    CB.roomShape = makeRectangleRoomShape(ARENA_W, ARENA_H);
    CB.blocks = CB.blocks.filter(function (b) { return !b.isShapeCarve; });
  }
  CB.leashWarning = 0;
  for (var i = 0; i < enemies.length; i++) {
    var sp = enemies[i];
    var def = getEnemyDef(sp.shape, sp.tier);
    var espawn = clampIntoRoom(sp.x, sp.y, def.r);
    var ex = espawn[0], ey = espawn[1];
    // Écarte le point d'apparition s'il tombe trop près de la position actuelle
    // du joueur (les PV/la position ne sont pas réinitialisés entre les vagues).
    var dToPlayer = dist(ex, ey, p.x, p.y);
    if (dToPlayer < MIN_ENEMY_SPAWN_DIST) {
      var n = dToPlayer > 0.001 ? norm(ex - p.x, ey - p.y) : [0, -1, 1];
      var espawn2 = clampIntoRoom(p.x + n[0] * MIN_ENEMY_SPAWN_DIST, p.y + n[1] * MIN_ENEMY_SPAWN_DIST, def.r);
      ex = espawn2[0]; ey = espawn2[1];
    }
    CB.enemies.push(makeEnemy(def, ex, ey, { hpPct: sp.hpPct, dmgPct: sp.dmgPct, spdPct: sp.spdPct, atkSpdPct: sp.atkSpdPct, sizePct: sp.sizePct, forceElite: sp.forceElite }));
  }
  // Brève invulnérabilité pour laisser au joueur le temps de réagir au nouveau décor,
  // sans jamais interrompre l'action : la vague suivante s'enchaîne immédiatement.
  p.invulnTimer = Math.max(p.invulnTimer, WAVE_START_GRACE);
  CB.phase = 'fighting';

  if (p.weapon1 === 'flame' && !CB.brasier) CB.brasier = { x: p.x, y: p.y, targetX: p.x, targetY: p.y };
}

function triggerShake(mag, dur) {
  if (mag > CB.shakeMag) { CB.shakeMag = mag; }
  CB.shakeTime = Math.max(CB.shakeTime, dur);
}

function spawnBurst(x, y, color, count, speed) {
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var s = speed * (0.4 + Math.random() * 0.6);
    CB.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.3, color, 2 + Math.random() * 2.5));
  }
}

// Vélocité d'impulsion sur les pierres (CB.blocks) : la charge (arme type 1) est la
// seule chose qui les repousse — décroît comme le knockback du joueur (knockVX/VY),
// bornée à l'arène puisque les pierres n'ont sinon aucune limite de déplacement.
function updateBlockKnockback(dt) {
  CB.blocks.forEach(function (b) {
    if (b.bvx || b.bvy) {
      b.x += (b.bvx || 0) * dt; b.y += (b.bvy || 0) * dt;
      b.bvx = (b.bvx || 0) * Math.pow(0.02, dt);
      b.bvy = (b.bvy || 0) * Math.pow(0.02, dt);
      if (Math.abs(b.bvx) < 4) b.bvx = 0;
      if (Math.abs(b.bvy) < 4) b.bvy = 0;
      var bxy = clampIntoRoom(b.x, b.y, b.r);
      b.x = bxy[0]; b.y = bxy[1];
    }
  });
}

function resolveBlockCollision(e) {
  for (var i = 0; i < CB.blocks.length; i++) {
    var b = CB.blocks[i];
    var d = dist(e.x, e.y, b.x, b.y);
    var minD = e.r + b.r;
    if (d < minD && d > 0.001) {
      var push = (minD - d);
      var nx = (e.x - b.x) / d, ny = (e.y - b.y) / d;
      e.x += nx * push; e.y += ny * push;
    }
  }
}

// ---------------- Zones de terrain (affectent joueur ET ennemis) ----------------

function applyZoneEffects(entity, dt, isPlayer) {
  var speedMult = 1;
  var nowInFlame = false;
  (CB.zones || []).forEach(function (z) {
    if (dist(entity.x, entity.y, z.x, z.y) > z.r) return;
    if (z.kind === 'slow') speedMult *= ZONE_SLOW_MULT;
    else if (z.kind === 'speed') speedMult *= ZONE_SPEED_MULT;
    else if (z.kind === 'heal') {
      if (isPlayer) {
        // Le joueur n'a pas de barre de PV suivie à l'écran : ce qui compte vraiment,
        // c'est le total de dégâts subis affiché au HUD. Une zone de soin doit donc
        // réduire CE compteur, sinon soigner p.hp n'aurait aucun effet visible.
        var healed = Math.min(CB.totalDamageTaken, ZONE_HEAL_PLAYER_PER_SEC * dt);
        CB.totalDamageTaken -= healed;
        entity.hp = Math.min(entity.maxHp, entity.hp + healed);
      } else {
        entity.hp = Math.min(entity.maxHp, entity.hp + ZONE_HEAL_PER_SEC * dt);
      }
    }
    else if (z.kind === 'flame') { nowInFlame = true; if (isPlayer) damagePlayer(ZONE_FLAME_PER_SEC * dt); else damageEnemy(entity, ZONE_FLAME_PER_SEC * dt); }
    else if (z.kind === 'trailflame' && !isPlayer) { nowInFlame = true; damageEnemy(entity, ZONE_FLAME_PER_SEC * dt); }
    else if (z.kind === 'trailmud' && !isPlayer) speedMult *= ZONE_SLOW_MULT;
    else if (z.kind === 'trap_spike') {
      var cyclePos = (CB.elapsed + (z.phaseOffset || 0)) % SPIKE_TRAP_CYCLE;
      if (cyclePos > SPIKE_TRAP_CYCLE - SPIKE_TRAP_ACTIVE_DUR) {
        if (isPlayer) damagePlayer(SPIKE_TRAP_DMG_PER_SEC * dt);
        else damageEnemy(entity, SPIKE_TRAP_DMG_PER_SEC * dt);
      }
    }
  });
  // Bruit d'embrasement une seule fois, au moment où l'entité ENTRE dans le feu (pas à
  // chaque frame de dégâts continus tant qu'elle y reste) — voir SFX.ignite, audio.js.
  if (nowInFlame && !entity._inFlame) AudioEngine.sfx('ignite');
  entity._inFlame = nowInFlame;
  return speedMult;
}

// Pièges à flèches : visent le joueur après un court télégraphe, indépendamment de l'IA
// des ennemis — un vrai élément d'environnement, pas une créature.
function updateTraps(dt) {
  var p = CB.player;
  (CB.zones || []).forEach(function (z) {
    if (z.kind !== 'trap_arrow') return;
    if (z.telegraphOn) {
      z.telegraphTimer -= dt;
      if (z.telegraphTimer <= 0) {
        z.telegraphOn = false;
        var n = norm(p.x - z.x, p.y - z.y);
        if (n[2] > 0.01) {
          CB.projectiles.push(makeProjectile(z.x, z.y, n[0] * TRAP_ARROW_SPEED, n[1] * TRAP_ARROW_SPEED, TRAP_ARROW_DMG, 5, '#c9a06a'));
        }
        z.cd = TRAP_ARROW_INTERVAL;
      }
    } else {
      z.cd -= dt;
      if (z.cd <= 0) { z.telegraphOn = true; z.telegraphTimer = TRAP_ARROW_TELEGRAPH; }
    }
  });
}

// Piège issu de l'arme type 2 "Piège" (voir tryPlayerTrapify) : tourelle hostile fixe,
// à la position de l'ennemi transformé, qui tire sur le joueur à intervalles réguliers
// — portée illimitée, elle vise toujours le joueur où qu'il soit dans la salle.
function updateConvertedTraps(dt) {
  var p = CB.player;
  (CB.zones || []).forEach(function (z) {
    if (z.kind !== 'converted_trap') return;
    z.cd -= dt;
    if (z.cd <= 0) {
      var n = norm(p.x - z.x, p.y - z.y);
      CB.projectiles.push(makeProjectile(z.x, z.y, n[0] * TRAP_TURRET_PROJ_SPEED, n[1] * TRAP_TURRET_PROJ_SPEED, TRAP_TURRET_DMG, 6, '#ff4fa3', false, false));
      spawnBurst(z.x, z.y, '#ff4fa3', 6, 90);
      AudioEngine.sfx('shoot');
      z.cd = TRAP_TURRET_FIRE_INTERVAL;
    }
  });
}

// ---------------- Spécialités de chapitre : relique + failles de l'Abîme ----------------
// Voir CHAPTER_IDENTITIES/generateChapterTerrain (waves.js) pour ce qui est généré par
// chapitre. La relique change concrètement le personnage pour le reste du chapitre (pas
// un simple bonus cosmétique) ; les failles remplacent le grappin dans le dernier
// chapitre (aucun n'y est généré) par une téléportation par paires, sans viser.
var RIFT_COOLDOWN = 1.0;
var RIFT_DMG = 42; // même valeur que GRAPPLE_DMG : la faille remplace le grappin en chapitre 4
var RIFT_DMG_RADIUS = 95;

function tryPlayerCollectRelic(z) {
  z.consumed = true;
  var p = CB.player;
  if (z.effect === 'dmg') {
    p.chapterDmgBonusMult = RELIC_DMG_BONUS_MULT;
    applyWaveStatsToPlayer(p, CB.queue[CB.waveIndex].playerStats);
  } else if (z.effect === 'speed') {
    p.chapterSpeedBonusMult = RELIC_SPEED_BONUS_MULT;
    applyWaveStatsToPlayer(p, CB.queue[CB.waveIndex].playerStats);
  } else if (z.effect === 'heal') {
    CB.totalDamageTaken = Math.max(0, CB.totalDamageTaken - RELIC_HEAL_AMOUNT);
  } else if (z.effect === 'invincible') {
    p.invulnTimer = Math.max(p.invulnTimer, RELIC_INVINCIBLE_DUR);
  }
  spawnBurst(z.x, z.y, '#f2d38f', 22, 200);
  triggerShake(5, 0.2);
  AudioEngine.sfx('pickup');
  CB.zones = CB.zones.filter(function (zz) { return zz !== z; });
}

function updateChapterHazards(dt) {
  var p = CB.player;
  if (p.riftCd > 0) p.riftCd = Math.max(0, p.riftCd - dt);
  (CB.zones || []).forEach(function (z) {
    if (z.kind === 'chapter_relic' && !z.consumed) {
      if (dist(p.x, p.y, z.x, z.y) <= z.r + p.r) tryPlayerCollectRelic(z);
    } else if (z.kind === 'abyss_rift' && p.riftCd <= 0) {
      if (dist(p.x, p.y, z.x, z.y) <= z.r) {
        var dest = null;
        for (var i = 0; i < CB.zones.length; i++) {
          var o = CB.zones[i];
          if (o.kind === 'abyss_rift' && o.pairId === z.pairId && o !== z) { dest = o; break; }
        }
        if (dest) {
          var riftOldX = p.x, riftOldY = p.y;
          p.x = dest.x; p.y = dest.y;
          p.riftCd = RIFT_COOLDOWN;
          p.invulnTimer = Math.max(p.invulnTimer, 0.3);
          spawnBurst(z.x, z.y, '#b34bf2', 14, 160);
          spawnBurst(dest.x, dest.y, '#b34bf2', 14, 160);
          // Dégâts sur tout le trajet, comme le grappin qu'elle remplace en chapitre 4
          // (aucun grappin n'y est généré — voir CHAPTER_IDENTITIES).
          CB.enemies.forEach(function (e) {
            if (e.alive && pointNearSegment(e.x, e.y, riftOldX, riftOldY, p.x, p.y, RIFT_DMG_RADIUS * 2)) {
              damageEnemy(e, RIFT_DMG * p.dmgMult);
            }
          });
          triggerShake(6, 0.16);
        }
      }
    }
  });
}

// Laisse anti-fuite : dans une salle de boss, s'éloigner trop du combat inflige des
// dégâts constants et ramène le joueur vers le(s) boss — comme un vrai combat de boss,
// impossible de kiter à l'infini dans un coin de l'arène pour souffler indéfiniment.
function updateBossLeash(dt) {
  var p = CB.player;
  var nearest = null, nearestD = Infinity;
  CB.enemies.forEach(function (e) {
    if (!e.alive || e.shape !== 'boss') return;
    var d = dist(p.x, p.y, e.x, e.y);
    if (d < nearestD) { nearestD = d; nearest = e; }
  });
  if (!nearest) { CB.leashWarning = 0; return; }
  var leashRadius = ARENA_W * BOSS_LEASH_RADIUS_RATIO;
  var warnRadius = leashRadius * 0.75;
  if (nearestD > leashRadius) {
    CB.leashWarning = 1;
    damagePlayer(BOSS_LEASH_DMG_PER_SEC * dt);
    var n = norm(nearest.x - p.x, nearest.y - p.y);
    p.knockVX = (p.knockVX || 0) + n[0] * BOSS_LEASH_PULL_FORCE * dt * 6;
    p.knockVY = (p.knockVY || 0) + n[1] * BOSS_LEASH_PULL_FORCE * dt * 6;
  } else if (nearestD > warnRadius) {
    CB.leashWarning = (nearestD - warnRadius) / (leashRadius - warnRadius);
  } else {
    CB.leashWarning = 0;
  }
}

// Zones à durée de vie limitée (traînée) : expirent toutes seules.
function updateZones(dt) {
  CB.zones.forEach(function (z) { if (z.life != null) z.life -= dt; });
  CB.zones = CB.zones.filter(function (z) { return z.life == null || z.life > 0; });
}

// ---------------- Joueur ----------------

var DAMAGE_FLASH_DUR = 0.35;

var PLAYER_HURT_SFX_COOLDOWN = 0.35;

function damagePlayer(amount) {
  if (CB.player.invulnTimer > 0) return;
  CB.damageFlashTime = DAMAGE_FLASH_DUR;
  // PV infinis : jamais de mort, seul compte le total de dégâts subis (objectif = le minimiser).
  CB.player.hp -= amount;
  CB.totalDamageTaken += amount;
  // Secousse volontairement discrète (voir #damageFlash pour le retour visuel principal) :
  // une secousse trop forte à chaque coup devient vite fatigante sur un run de plusieurs minutes.
  triggerShake(3, 0.12);
  // Throttlé comme le SFX de coup porté (damageEnemy) : la saignée passive et les zones
  // de dégâts continus appellent damagePlayer à chaque frame, un son à chaque appel serait
  // un bourdonnement plutôt qu'un vrai retour "aïe".
  if ((CB.elapsed - (CB.lastHurtSfxT != null ? CB.lastHurtSfxT : -1)) > PLAYER_HURT_SFX_COOLDOWN) {
    AudioEngine.sfx('hurt');
    CB.lastHurtSfxT = CB.elapsed;
  }
}

function applyPassiveDrain(dt) {
  var p = CB.player;
  if (p.invulnTimer > 0) return;
  var amount = PASSIVE_DRAIN_PER_SEC * dt;
  p.hp -= amount;
  CB.totalDamageTaken += amount;
}

function tryPlayerCharge(dirX, dirY, chargeFrac) {
  var p = CB.player;
  if (p.dashCd > 0 || p.isDashing) return;
  var n = norm(dirX, dirY);
  if (n[2] < 0.001) { n = [p.facingX, p.facingY, 1]; }
  p.isDashing = true;
  p.dashTimer = p.dashDurMax;
  p.dashDirX = n[0]; p.dashDirY = n[1];
  p.dashStartX = p.x; p.dashStartY = p.y;
  p.chargeFrac = chargeFrac != null ? chargeFrac : 1;
  p.invulnTimer = Math.max(p.invulnTimer, p.dashDurMax + 0.08);
  p.dashCd = p.dashCdMax;
  spawnBurst(p.x, p.y, '#e3b968', 10, 140);
  AudioEngine.sfx('swing');
}

function pointNearSegment(px, py, x1, y1, x2, y2, width) {
  var dx = x2 - x1, dy = y2 - y1;
  var lenSq = dx * dx + dy * dy;
  var t = lenSq > 0.0001 ? clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1) : 0;
  var cx = x1 + dx * t, cy = y1 + dy * t;
  return dist(px, py, cx, cy) <= width / 2;
}

function resolveChargeDamage(p) {
  var x1 = p.dashStartX, y1 = p.dashStartY, x2 = p.x, y2 = p.y;
  var frac = p.chargeFrac != null ? p.chargeFrac : 1;
  var dmg = CHARGE_MIN_DMG + (CHARGE_MAX_DMG - CHARGE_MIN_DMG) * frac;
  var knockback = CHARGE_MIN_KNOCKBACK_FORCE + (CHARGE_MAX_KNOCKBACK_FORCE - CHARGE_MIN_KNOCKBACK_FORCE) * frac;
  CB.dashTrails.push({ x1: x1, y1: y1, x2: x2, y2: y2, life: 0.3, maxLife: 0.3 });
  CB.enemies.forEach(function (e) {
    if (e.alive && pointNearSegment(e.x, e.y, x1, y1, x2, y2, CHARGE_TRAIL_WIDTH)) {
      damageEnemy(e, dmg * p.dmgMult);
      var kn = norm(e.x - x1, e.y - y1);
      if (kn[2] < 0.01) kn = [p.dashDirX, p.dashDirY, 1];
      e.knockVX = kn[0] * knockback;
      e.knockVY = kn[1] * knockback;
    }
  });
  // Repousse aussi les pierres traversées par la charge (voir updateBlockKnockback).
  CB.blocks.forEach(function (b) {
    if (pointNearSegment(b.x, b.y, x1, y1, x2, y2, CHARGE_TRAIL_WIDTH + b.r)) {
      var kn = norm(b.x - x1, b.y - y1);
      if (kn[2] < 0.01) kn = [p.dashDirX, p.dashDirY, 1];
      b.bvx = kn[0] * CHARGE_BLOCK_KNOCKBACK_FORCE;
      b.bvy = kn[1] * CHARGE_BLOCK_KNOCKBACK_FORCE;
    }
  });
  spawnBurst((x1 + x2) / 2, (y1 + y2) / 2, '#e3b968', 8, 100);
}

function findGrappleTarget(mx, my) {
  var best = null, bestD = SWAP_PICK_RADIUS;
  (CB.zones || []).forEach(function (z) {
    if (z.kind !== 'grapple') return;
    var d = dist(mx, my, z.x, z.y);
    if (d < bestD) { bestD = d; best = z; }
  });
  return best;
}

function tryPlayerGrapple(mx, my) {
  var p = CB.player;
  if (p.specialCd > 0) return;
  var target = findGrappleTarget(mx, my);
  if (!target) return;
  var oldX = p.x, oldY = p.y;
  CB.grappleRopes.push({ x1: oldX, y1: oldY, x2: target.x, y2: target.y, life: 0.28, maxLife: 0.28 });
  p.x = target.x; p.y = target.y;
  p.invulnTimer = Math.max(p.invulnTimer, 0.15);
  p.specialCd = p.specialCdMax;
  spawnBurst(oldX, oldY, '#9b5cf0', 10, 140);
  spawnBurst(p.x, p.y, '#9b5cf0', 16, 190);
  AudioEngine.sfx('teleport');
  // Dégâts sur tout le trajet parcouru (pas juste au point de chute) : quiconque se
  // trouve sur la corde encaisse le passage du grappin.
  CB.enemies.forEach(function (e) {
    if (e.alive && pointNearSegment(e.x, e.y, oldX, oldY, p.x, p.y, GRAPPLE_DMG_RADIUS * 2)) {
      damageEnemy(e, GRAPPLE_DMG * p.dmgMult);
    }
  });
  triggerShake(6, 0.16);
}

function tryPlayerPulse() {
  var p = CB.player;
  if (p.pulseCd > 0) return;
  CB.enemies.forEach(function (e) {
    if (!e.alive) return;
    var d = dist(p.x, p.y, e.x, e.y);
    if (d > PULSE_RADIUS) return;
    var n = d > 0.001 ? norm(e.x - p.x, e.y - p.y) : [Math.random() * 2 - 1, Math.random() * 2 - 1, 1];
    var falloff = 1 - (d / PULSE_RADIUS) * 0.4;
    e.knockVX = n[0] * PULSE_FORCE * falloff;
    e.knockVY = n[1] * PULSE_FORCE * falloff;
  });
  p.pulseCd = p.pulseCdMax;
  CB.pulseRings.push({ x: p.x, y: p.y, life: 0.45, maxLife: 0.45, radius: PULSE_RADIUS });
  spawnBurst(p.x, p.y, '#88d4ff', 26, 230);
  triggerShake(8, 0.22);
  AudioEngine.sfx('blast');
}

function tryPlayerPull() {
  var p = CB.player;
  if (p.pulseCd > 0) return;
  CB.enemies.forEach(function (e) {
    if (!e.alive) return;
    var d = dist(p.x, p.y, e.x, e.y);
    if (d > PULSE_RADIUS || d < 30) return;
    var n = norm(p.x - e.x, p.y - e.y);
    e.knockVX = n[0] * PULL_FORCE;
    e.knockVY = n[1] * PULL_FORCE;
    damageEnemy(e, PULL_DMG * p.dmgMult); // les ennemis absorbés par l'attraction encaissent des dégâts
  });
  p.pulseCd = p.pulseCdMax;
  CB.pulseRings.push({ x: p.x, y: p.y, life: 0.4, maxLife: 0.4, radius: PULSE_RADIUS });
  spawnBurst(p.x, p.y, '#c9a8ff', 20, 150);
  triggerShake(6, 0.18);
  AudioEngine.sfx('blast');
}

function tryPlayerInvincible() {
  var p = CB.player;
  if (p.pulseCd > 0) return;
  p.invulnTimer = Math.max(p.invulnTimer, INVINCIBLE_DUR);
  p.pulseCd = p.pulseCdMax;
  spawnBurst(p.x, p.y, '#fff2c8', 18, 180);
  triggerShake(4, 0.12);
  AudioEngine.sfx('pickup');
}

function tryPlayerTrapify() {
  var p = CB.player;
  if (p.pulseCd > 0) return;
  var best = null, bestD = TRAPIFY_RADIUS;
  CB.enemies.forEach(function (e) {
    if (!e.alive || e.shape === 'boss') return;
    var d = dist(p.x, p.y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  });
  if (!best) return;
  var idx = CB.enemies.indexOf(best);
  // Retiré directement (pas via killEnemy) : ce n'est pas une mise à mort, donc ni
  // décompte de kill ni explosion de particules de mort.
  if (idx >= 0) CB.enemies.splice(idx, 1);
  CB.zones.push({ kind: 'converted_trap', x: best.x, y: best.y, r: TRAP_TURRET_VISUAL_R, cd: TRAP_TURRET_FIRE_INTERVAL * 0.5 });
  p.pulseCd = p.pulseCdMax;
  spawnBurst(best.x, best.y, '#ff4fa3', 20, 160);
  triggerShake(5, 0.15);
  AudioEngine.sfx('teleport');
}

// ---------------- Dispatch des armes équipées (type 1 ; type 2 = ex-poussée) ----------------

function updateWeapon1(dt, p, w1, aimX, aimY, moveX, moveY, weaponKey) {
  switch (weaponKey) {
    case 'charge':
      if (w1.justPressed && p.dashCd <= 0 && !p.isDashing && !p.w1Charging) { p.w1Charging = true; p.w1ChargeTime = 0; }
      if (p.w1Charging) {
        p.w1ChargeTime += dt;
        if (w1.justReleased) {
          var chargeFrac = clamp(p.w1ChargeTime / CHARGE_MAX_CHARGE_TIME, 0, 1);
          p.w1Charging = false;
          tryPlayerCharge(moveX, moveY, chargeFrac);
        }
      }
      break;

    case 'meteor':
      if (w1.justPressed && p.dashCd <= 0 && !p.w1Charging) { p.w1Charging = true; p.w1ChargeTime = 0; }
      if (p.w1Charging) {
        p.w1ChargeTime += dt;
        p.w1AimX = aimX; p.w1AimY = aimY;
        if (w1.justReleased) {
          var frac = clamp(p.w1ChargeTime / METEOR_MAX_CHARGE, 0, 1);
          var dmg = (METEOR_MIN_DMG + (METEOR_MAX_DMG - METEOR_MIN_DMG) * frac) * p.dmgMult;
          CB.blasts.push(makePendingBlast(p.w1AimX, p.w1AimY, METEOR_RADIUS, dmg, METEOR_TELEGRAPH, '#ff8a4a', true));
          spawnBurst(p.w1AimX, p.w1AimY, '#ff8a4a', 8, 70);
          AudioEngine.sfx('blast');
          p.w1Charging = false;
          p.dashCd = p.dashCdMax;
        }
      }
      break;

    case 'boomerang':
      // Prêt tant qu'aucun boomerang n'est en vol (voir updateBoomerang) — pas de
      // minuteur de recharge classique, mais un court délai (p.boomerangCd) après
      // rattrapage avant de pouvoir le relancer.
      if (w1.justPressed && !CB.boomerang && p.boomerangCd <= 0) {
        var bn = norm(aimX - p.x, aimY - p.y);
        var bdir = bn[2] > 0.01 ? bn : [p.facingX, p.facingY, 1];
        CB.boomerang = { x: p.x, y: p.y, vx: bdir[0] * BOOMERANG_SPEED_OUT, vy: bdir[1] * BOOMERANG_SPEED_OUT, phase: 'out', hitSet: {} };
        AudioEngine.sfx('shoot');
      }
      break;

    case 'turret':
      if (w1.justPressed && p.dashCd <= 0) {
        var tooCloseToTurret = CB.turrets.some(function (tu) { return dist(tu.x, tu.y, aimX, aimY) < TURRET_RANGE; });
        if (!tooCloseToTurret) {
          CB.turrets.push({ id: nextId(), x: aimX, y: aimY, cd: TURRET_FIRE_INTERVAL * 0.5 });
          if (CB.turrets.length > TURRET_MAX) CB.turrets.shift();
          p.dashCd = p.dashCdMax;
          AudioEngine.sfx('ui');
        }
      }
      break;

    case 'knife':
      if (w1.justPressed && p.dashCd <= 0) {
        var kn = norm(aimX - p.x, aimY - p.y);
        var kdir = kn[2] > 0.01 ? kn : [p.facingX, p.facingY, 1];
        CB.knives.push({ id: nextId(), x: p.x, y: p.y, vx: kdir[0] * KNIFE_SPEED, vy: kdir[1] * KNIFE_SPEED, dist: 0, bounces: 0, r: KNIFE_R, color: '#c9c9d9' });
        p.dashCd = p.dashCdMax;
        AudioEngine.sfx('shoot');
      }
      break;

    case 'spikes360':
      if (w1.justPressed && p.dashCd <= 0) {
        for (var si = 0; si < SPIKES_COUNT; si++) {
          var sa = (si / SPIKES_COUNT) * Math.PI * 2;
          CB.projectiles.push(makeProjectile(p.x, p.y, Math.cos(sa) * SPIKES_SPEED, Math.sin(sa) * SPIKES_SPEED, SPIKES_DMG * p.dmgMult, SPIKES_R, '#e3b968', false, true));
        }
        spawnBurst(p.x, p.y, '#e3b968', 20, 160);
        triggerShake(6, 0.2);
        p.dashCd = p.dashCdMax;
        AudioEngine.sfx('blast');
      }
      break;

    case 'sword':
      if (w1.justPressed && p.dashCd <= 0) {
        var sn = norm(aimX - p.x, aimY - p.y);
        var sdir = sn[2] > 0.01 ? sn : [p.facingX, p.facingY, 1];
        var sAngle = Math.atan2(sdir[1], sdir[0]);
        CB.enemies.forEach(function (e) {
          if (!e.alive) return;
          if (dist(p.x, p.y, e.x, e.y) > SWORD_RANGE + e.r) return;
          var eAngle = Math.atan2(e.y - p.y, e.x - p.x);
          var diff = Math.atan2(Math.sin(eAngle - sAngle), Math.cos(eAngle - sAngle));
          if (Math.abs(diff) <= SWORD_ARC / 2) damageEnemy(e, SWORD_DMG * p.dmgMult);
        });
        CB.swordSwings.push({ x: p.x, y: p.y, angle: sAngle, arc: SWORD_ARC, range: SWORD_RANGE, life: 0.18, maxLife: 0.18 });
        spawnBurst(p.x + sdir[0] * 40, p.y + sdir[1] * 40, '#fff2c8', 10, 120);
        AudioEngine.sfx('swing');
        p.dashCd = p.dashCdMax;
      }
      break;

    case 'flame':
      // Suit le curseur en continu tant que la touche est maintenue (pas juste au clic) —
      // relâcher la touche laisse le brasier sur sa dernière position visée.
      if (w1.held && CB.brasier) { CB.brasier.targetX = aimX; CB.brasier.targetY = aimY; }
      break;
  }
}

function updateWeapon2(dt, p, w2) {
  var sprintActive = false;
  switch (p.weapon2) {
    case 'pulse':
      if (w2.justPressed) tryPlayerPulse();
      break;
    case 'sprint':
      if (w2.held && p.w2Resource > 0) {
        sprintActive = true;
        p.w2Resource = Math.max(0, p.w2Resource - SPRINT_DRAIN_PER_SEC * dt);
      } else {
        p.w2Resource = Math.min(p.w2ResourceMax, p.w2Resource + SPRINT_REGEN_PER_SEC * dt);
      }
      break;
    case 'pull':
      if (w2.justPressed) tryPlayerPull();
      break;
    case 'mimic':
      if (w2.held && p.w2Resource > 0 && p.mimicWeapon) {
        p.mimicActive = true;
        p.w2Resource = Math.max(0, p.w2Resource - SPRINT_DRAIN_PER_SEC * dt);
      } else {
        p.mimicActive = false;
        p.w2Resource = Math.min(p.w2ResourceMax, p.w2Resource + SPRINT_REGEN_PER_SEC * dt);
      }
      break;
    case 'invincible':
      if (w2.justPressed) tryPlayerInvincible();
      break;
    case 'trapify':
      if (w2.justPressed) tryPlayerTrapify();
      break;
  }
  return sprintActive;
}

// ---- Tourelles (arme type 1 "turret") : posées, tirent seules sur l'ennemi le plus
// proche à portée, comme un piège de terrain (voir updateTraps) mais côté joueur. ----
function updateTurrets(dt) {
  CB.turrets.forEach(function (tu) {
    tu.cd -= dt;
    if (tu.cd <= 0) {
      var nearest = null, nearestD = TURRET_RANGE;
      CB.enemies.forEach(function (e) {
        if (!e.alive) return;
        var d = dist(tu.x, tu.y, e.x, e.y);
        if (d < nearestD) { nearestD = d; nearest = e; }
      });
      if (nearest) {
        var n = norm(nearest.x - tu.x, nearest.y - tu.y);
        CB.projectiles.push(makeProjectile(tu.x, tu.y, n[0] * TURRET_PROJ_SPEED, n[1] * TURRET_PROJ_SPEED, TURRET_DMG * CB.player.dmgMult, 6, '#7db4ff', false, true));
        AudioEngine.sfx('shoot');
      }
      tu.cd = TURRET_FIRE_INTERVAL;
    }
  });
}

// ---- Couteau (arme type 1 "knife") : rebondit sur pierres/murs et ennemis, dégâts
// croissants par rebond, jusqu'à sa portée totale ou son nombre de rebonds max. ----
function bounceKnife(k, nx, ny) {
  var speed = Math.sqrt(k.vx * k.vx + k.vy * k.vy);
  k.vx = nx * speed; k.vy = ny * speed;
  k.bounces++;
}

function updateKnives(dt) {
  CB.knives.forEach(function (k) {
    var stepDist = Math.sqrt(k.vx * k.vx + k.vy * k.vy) * dt;
    k.x += k.vx * dt; k.y += k.vy * dt; k.dist += stepDist;
    for (var i = 0; i < CB.blocks.length; i++) {
      var b = CB.blocks[i];
      var bd = dist(k.x, k.y, b.x, b.y);
      if (bd < KNIFE_R + b.r) { var bn = norm(k.x - b.x, k.y - b.y); bounceKnife(k, bn[0], bn[1]); break; }
    }
    CB.enemies.forEach(function (e) {
      if (!e.alive) return;
      if (dist(k.x, k.y, e.x, e.y) < KNIFE_R + e.hitR) {
        damageEnemy(e, (KNIFE_BASE_DMG + k.bounces * KNIFE_BOUNCE_BONUS_DMG) * CB.player.dmgMult);
        var en = norm(k.x - e.x, k.y - e.y);
        bounceKnife(k, en[0], en[1]);
      }
    });
    var kxy = clampIntoRoom(k.x, k.y, KNIFE_R);
    if (kxy[0] !== k.x || kxy[1] !== k.y) {
      var kn = norm(k.x - kxy[0], k.y - kxy[1]);
      k.x = kxy[0]; k.y = kxy[1];
      bounceKnife(k, kn[0], kn[1]);
    }
  });
  CB.knives = CB.knives.filter(function (k) { return k.dist < KNIFE_RANGE && k.bounces < KNIFE_MAX_BOUNCES; });
}

// ---- Boomerang (arme type 1 "boomerang") : sort en ligne droite jusqu'à heurter
// quelque chose (ou le bord de l'arène), puis revient vers la position actuelle du
// joueur — récupéré = prêt à relancer (voir dispatch dans updateWeapon1). ----
function updateBoomerang(dt) {
  var bm = CB.boomerang;
  if (!bm) return;
  bm.x += bm.vx * dt; bm.y += bm.vy * dt;
  if (bm.phase === 'out') {
    var hitSomething = false;
    for (var i = 0; i < CB.blocks.length; i++) {
      if (dist(bm.x, bm.y, CB.blocks[i].x, CB.blocks[i].y) < BOOMERANG_R + CB.blocks[i].r) { hitSomething = true; break; }
    }
    CB.enemies.forEach(function (e) {
      if (e.alive && !bm.hitSet[e.id] && dist(bm.x, bm.y, e.x, e.y) < BOOMERANG_R + e.hitR) {
        damageEnemy(e, BOOMERANG_DMG * CB.player.dmgMult);
        bm.hitSet[e.id] = true;
        hitSomething = true;
      }
    });
    if (!pointInRoomShape(CB.roomShape, bm.x, bm.y, BOOMERANG_R)) hitSomething = true;
    if (hitSomething) bm.phase = 'back';
  } else {
    var p = CB.player;
    var n = norm(p.x - bm.x, p.y - bm.y);
    bm.vx = n[0] * BOOMERANG_SPEED_BACK; bm.vy = n[1] * BOOMERANG_SPEED_BACK;
    CB.enemies.forEach(function (e) {
      if (e.alive && !bm.hitSet[e.id] && dist(bm.x, bm.y, e.x, e.y) < BOOMERANG_R + e.hitR) {
        damageEnemy(e, BOOMERANG_DMG * CB.player.dmgMult);
        bm.hitSet[e.id] = true;
      }
    });
    if (dist(bm.x, bm.y, p.x, p.y) < BOOMERANG_CATCH_RADIUS) { CB.boomerang = null; p.boomerangCd = BOOMERANG_RECATCH_CD; }
  }
}

function updateBrasier(dt) {
  if (!CB.brasier) return;
  var b = CB.brasier;
  var n = norm(b.targetX - b.x, b.targetY - b.y);
  if (n[2] > 4) { b.x += n[0] * BRASIER_SPEED * dt; b.y += n[1] * BRASIER_SPEED * dt; }
  CB.enemies.forEach(function (e) {
    if (e.alive && dist(e.x, e.y, b.x, b.y) <= BRASIER_RADIUS + e.r) damageEnemy(e, BRASIER_DPS * CB.player.dmgMult * dt);
  });
}

function updateSwordSwings(dt) {
  CB.swordSwings.forEach(function (s) { s.life -= dt; });
  CB.swordSwings = CB.swordSwings.filter(function (s) { return s.life > 0; });
}

function updatePlayer(dt, moveX, moveY, aimX, aimY, w1, w2) {
  var p = CB.player;

  if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.specialCd > 0) p.specialCd = Math.max(0, p.specialCd - dt);
  if (p.pulseCd > 0) p.pulseCd = Math.max(0, p.pulseCd - dt);
  if (p.boomerangCd > 0) p.boomerangCd = Math.max(0, p.boomerangCd - dt);
  if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

  var sprintActive = updateWeapon2(dt, p, w2);

  // Mimétisme (arme type 2) : substitue temporairement l'arme de type 1 active par
  // celle qui lui a été attitrée, tant que maintenu — dashCdMax suit l'arme réellement
  // en jeu à chaque instant pour que le rythme de recharge affiché reste correct.
  var effWeapon1 = (p.weapon2 === 'mimic' && p.mimicActive && p.mimicWeapon) ? p.mimicWeapon : p.weapon1;
  if (p._prevEffWeapon1 != null && p._prevEffWeapon1 !== effWeapon1 && p.w1Charging) {
    p.w1Charging = false; // évite une charge météore orpheline si le mimétisme change d'arme en cours de charge
  }
  p._prevEffWeapon1 = effWeapon1;
  p.dashCdMax = WEAPON1_INFO[effWeapon1].cdMax;
  if (p.dashCd > p.dashCdMax) p.dashCd = p.dashCdMax;

  updateWeapon1(dt, p, w1, aimX, aimY, moveX, moveY, effWeapon1);

  if (p.w1Charging) { moveX = 0; moveY = 0; }

  var zoneSpeedMult = applyZoneEffects(p, dt, true);
  var sprintMult = sprintActive ? SPRINT_SPEED_MULT : 1;

  if (p.isDashing) {
    p.vx = p.dashDirX * p.dashSpeed * zoneSpeedMult;
    p.vy = p.dashDirY * p.dashSpeed * zoneSpeedMult;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.dashTimer -= dt;
    if (p.dashTimer <= 0) { p.isDashing = false; resolveChargeDamage(p); }
  } else {
    if (moveX || moveY) { p.facingX = moveX; p.facingY = moveY; }
    p.vx = moveX * p.speed * zoneSpeedMult * sprintMult;
    p.vy = moveY * p.speed * zoneSpeedMult * sprintMult;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (p.knockVX || p.knockVY) {
    p.x += (p.knockVX || 0) * dt;
    p.y += (p.knockVY || 0) * dt;
    p.knockVX = (p.knockVX || 0) * Math.pow(0.02, dt);
    p.knockVY = (p.knockVY || 0) * Math.pow(0.02, dt);
    if (Math.abs(p.knockVX) < 4) p.knockVX = 0;
    if (Math.abs(p.knockVY) < 4) p.knockVY = 0;
  }

  var pxy = clampIntoRoom(p.x, p.y, p.r);
  p.x = pxy[0]; p.y = pxy[1];
  // Le dash "téléporte" : il traverse murs et obstacles, seules les limites de l'arène l'arrêtent.
  if (!p.isDashing) resolveBlockCollision(p);
}

// ---------------- Ennemis ----------------

var HIT_FLASH_DUR = 0.1;
var SPAWN_ANIM_DUR = 0.35;

function damageEnemy(e, amount) {
  if (!e.alive || e.invulnOn) return;
  var eff = amount;
  if (e.shieldOn) eff *= 0.5;
  if (e.stunTimer > 0) eff *= 1.5;
  e.hitFlash = HIT_FLASH_DUR;
  e.hp -= eff;
  CB.damageDealt += eff;
  spawnBurst(e.x, e.y, e.color, 5, 90);
  // SFX de coup, anti-spam par ennemi : les sources de dégâts continues (drain, laser,
  // brasier) rappellent damageEnemy à chaque frame — sans ce throttle, un bourdonnement
  // au lieu d'un vrai retour sonore de coup.
  if ((CB.elapsed - (e._lastHitSfxT != null ? e._lastHitSfxT : -1)) > 0.09) {
    AudioEngine.sfx('hit');
    e._lastHitSfxT = CB.elapsed;
  }
  // Nombre de dégâts flottant du mannequin d'entraînement (armurerie) : montant du coup,
  // pas le total cumulé (déjà affiché en continu dans le HUD, voir updateHUD/render.js).
  if (CB.isArmory && e.isArmoryDummy) {
    CB.armoryHitNumbers = CB.armoryHitNumbers || [];
    CB.armoryHitNumbers.push({ x: e.x, y: e.y, amount: Math.round(eff), life: 0.9, maxLife: 0.9 });
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.alive = false;
  CB.killCount++;
  spawnBurst(e.x, e.y, e.color, 16, 150);
  AudioEngine.sfx('kill');
  if (e.behavior === 'other_explode') {
    CB.blasts.push(makePendingBlast(e.x, e.y, e.def.blastRadius, e.def.blastDmg, 0.1, '#ff5a3c'));
  }
}

// ---------------- Évitement d'obstacles (steering) ----------------
// Un ennemi qui vise sa cible en ligne droite peut se retrouver plaqué contre un caillou
// pile entre lui et sa cible : resolveBlockCollision le repousse hors du bloc, mais comme
// sa vélocité repointe aussitôt tout droit dedans, il reste coincé sur place. On dévie donc
// la direction visée dès qu'un obstacle se trouve dans le couloir de déplacement, pour que
// l'ennemi contourne au lieu de pousser indéfiniment contre le mur.
var OBSTACLE_AVOID_LOOKAHEAD = 95;
var OBSTACLE_AVOID_MARGIN = 16;

function findBlockingObstacle(e, dirX, dirY) {
  var best = null, bestProj = Infinity;
  for (var i = 0; i < CB.blocks.length; i++) {
    var b = CB.blocks[i];
    var toBx = b.x - e.x, toBy = b.y - e.y;
    var proj = toBx * dirX + toBy * dirY;
    if (proj <= 0 || proj > OBSTACLE_AVOID_LOOKAHEAD + b.r) continue;
    var closestX = e.x + dirX * proj, closestY = e.y + dirY * proj;
    var perpD = dist(b.x, b.y, closestX, closestY);
    if (perpD < e.r + b.r + OBSTACLE_AVOID_MARGIN && proj < bestProj) { bestProj = proj; best = b; }
  }
  return best;
}

// La limite de la salle (voir js/roomShapes.js — plus forcément un simple rectangle
// depuis les formes de salle) : sans un vrai traitement dédié, un ennemi dont la
// cible se trouve "à travers" un mur/coin de la forme relance sans arrêt la même
// direction condamnée, et reste visiblement collé au mur (le clamp dur
// d'updateEnemyAI le repousse chaque frame, sans jamais dévier sa vélocité — d'où
// l'effet "coincé contre le mur"). Retourne la NORMALE du mur (vecteur unitaire
// pointant vers l'intérieur de la salle) plutôt qu'un point — un mur n'est pas un
// obstacle ponctuel, le traiter comme tel (calcul de côté par produit vectoriel
// pensé pour un rocher) produisait une déviation aberrante quand le point de
// contact tombait presque exactement sur la position de l'ennemi (mesuré : un
// ennemi totalement figé contre l'intérieur d'un coin concave de forme en L).
function findBlockingBoundary(e, dirX, dirY) {
  var lookX = e.x + dirX * OBSTACLE_AVOID_LOOKAHEAD, lookY = e.y + dirY * OBSTACLE_AVOID_LOOKAHEAD;
  if (pointInRoomShape(CB.roomShape, lookX, lookY, e.r)) return null;
  var nearest = clampIntoRoom(lookX, lookY, e.r);
  var n = norm(nearest[0] - lookX, nearest[1] - lookY);
  if (n[2] < 0.01) return null;
  return { normalX: n[0], normalY: n[1] };
}

function applySteerVelocity(e, dirX, dirY, speedMult) {
  var block = findBlockingObstacle(e, dirX, dirY);
  var boundary = block ? null : findBlockingBoundary(e, dirX, dirY);
  if (block) {
    var toBx = block.x - e.x, toBy = block.y - e.y;
    var cross = dirX * toBy - dirY * toBx;
    var side = cross >= 0 ? -1 : 1;
    var perpX = -dirY * side, perpY = dirX * side;
    // Composante directe très réduite (0.15, était 0.5) : un poids trop fort retirait
    // l'ennemi vers l'obstacle qu'il est censé contourner, d'où le mouvement en dents
    // de scie contre le caillou plutôt qu'un vrai contournement.
    var blend = norm(dirX * 0.15 + perpX, dirY * 0.15 + perpY);
    if (blend[2] > 0.01) { dirX = blend[0]; dirY = blend[1]; }
  } else if (boundary) {
    // Glissement le long du mur : on retire la composante de la direction voulue qui
    // pointe vers l'extérieur (le long de la normale) et on garde la composante
    // tangente, orientée pour continuer globalement dans le sens visé plutôt que de
    // faire demi-tour — l'ennemi longe le mur au lieu d'essayer de le traverser.
    var tX = -boundary.normalY, tY = boundary.normalX;
    var along = dirX * tX + dirY * tY;
    if (along < 0) { tX = -tX; tY = -tY; }
    var slide = norm(tX * 0.85 + boundary.normalX * 0.15, tY * 0.85 + boundary.normalY * 0.15);
    if (slide[2] > 0.01) { dirX = slide[0]; dirY = slide[1]; }
  }
  if (block || boundary) {
    // Lissage temporel de la direction de contournement (moyenne glissante avec la
    // frame précédente) : indispensable dès qu'un amas de plusieurs rochers proches se
    // dispute le titre de "obstacle le plus proche" d'une frame à l'autre — une
    // hystérésis basée sur l'identité de l'obstacle ne suffit pas dans ce cas (mesuré :
    // ~94% des frames changeaient de côté), alors que lisser directement la direction
    // de sortie amortit l'oscillation quelle qu'en soit la cause exacte.
    if (e._avoidDirX != null) {
      var smoothed = norm(dirX * 0.3 + e._avoidDirX * 0.7, dirY * 0.3 + e._avoidDirY * 0.7);
      if (smoothed[2] > 0.01) { dirX = smoothed[0]; dirY = smoothed[1]; }
    }
    e._avoidDirX = dirX;
    e._avoidDirY = dirY;
  } else {
    e._avoidDirX = null;
    e._avoidDirY = null;
  }
  e.vx = dirX * e.speed * (speedMult || 1) * (e.speedBuffMult || 1);
  e.vy = dirY * e.speed * (speedMult || 1) * (e.speedBuffMult || 1);
}

function steerToward(e, tx, ty, speedMult) {
  var n = norm(tx - e.x, ty - e.y);
  if (n[2] < 0.01) { e.vx = 0; e.vy = 0; return; }
  applySteerVelocity(e, n[0], n[1], speedMult);
}
function steerAway(e, tx, ty, speedMult) {
  var n = norm(e.x - tx, e.y - ty);
  if (n[2] < 0.01) { e.vx = 0; e.vy = 0; return; }
  applySteerVelocity(e, n[0], n[1], speedMult);
}

function meleeContact(e, dt, p, dmgMult, atkInterval) {
  var d = dist(e.x, e.y, p.x, p.y);
  if (d < e.hitR + p.r + 3) {
    e.vx = 0; e.vy = 0;
    if (e.atkCd <= 0) {
      damagePlayer(e.dmg * (dmgMult || 1));
      e.atkCd = atkInterval || 0.7;
      return true;
    }
  }
  return false;
}

function fireProjectileAt(e, p, speed, dmg, r, color) {
  var n = norm(p.x - e.x, p.y - e.y);
  CB.projectiles.push(makeProjectile(e.x, e.y, n[0] * speed, n[1] * speed, dmg, r, color));
}

// Anticipe la position du joueur (vitesse actuelle × temps de trajet estimé) au lieu de
// viser sa position présente — sans ça, marcher (ou tourner) en continu suffit à esquiver
// n'importe quel tir en ligne droite, ce qui rend les ennemis à distance inoffensifs face
// au kite.
function leadTarget(e, p, speed) {
  var d = dist(e.x, e.y, p.x, p.y);
  var leadTime = speed > 0 ? d / speed : 0;
  return [p.x + (p.vx || 0) * leadTime, p.y + (p.vy || 0) * leadTime];
}

function fireProjectileAtLead(e, p, speed, dmg, r, color) {
  var lt = leadTarget(e, p, speed);
  var n = norm(lt[0] - e.x, lt[1] - e.y);
  CB.projectiles.push(makeProjectile(e.x, e.y, n[0] * speed, n[1] * speed, dmg, r, color, e.shape === 'boss'));
}

// Vise la case du joueur + 2 cases voisines (au lieu d'une seule position) — force une
// vraie lecture/déplacement plutôt qu'une simple esquive latérale d'un point unique.
function pickMortarCells(px, py) {
  var c = cellOf(px, py);
  var neighbors = shuffleArray([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]);
  var cells = [[c[0], c[1]], [c[0] + neighbors[0][0], c[1] + neighbors[0][1]], [c[0] + neighbors[1][0], c[1] + neighbors[1][1]]];
  return cells.map(function (cc) {
    return clampIntoRoom(cc[0] * CELL_SIZE + CELL_SIZE / 2, cc[1] * CELL_SIZE + CELL_SIZE / 2, 30);
  });
}

function randomArenaPointNear(x, y, minR, maxR) {
  var a = Math.random() * Math.PI * 2;
  var r = minR + Math.random() * (maxR - minR);
  return clampIntoRoom(x + Math.cos(a) * r, y + Math.sin(a) * r, 30);
}

// Avance une charge (tank_charge/boss_ultimate) d'un pas, en s'arrêtant net si le pas
// percuterait un rocher — sans ça, l'ennemi fonçait dans le mur puis resolveBlockCollision
// (fin de updateEnemyAI) le repoussait hors du bloc à chaque frame pendant que la charge le
// repoussait aussitôt dedans : il restait à trembler sur place contre le mur pendant toute
// la durée de charge au lieu d'attaquer ("ne fait que rentrer dans des murs").
var CHARGE_WALL_STUN_BONUS = 0.6;

// ---------------- Filet de sécurité anti-blocage ----------------
// L'évitement d'obstacle ci-dessus (findBlockingObstacle/findBlockingBoundary) reste un
// steering réactif, pas un vrai pathfinding — au sommet concave d'une découpe de forme de
// salle (L/croix/haltère), un ennemi peut tomber dans un minimum local où chaque petit pas
// est aussitôt annulé par clampIntoRoom bien que sa vélocité désirée reste non nulle : figé
// visiblement contre le mur/rocher (constaté empiriquement, voir combat.js). Plutôt que de
// tenter de résoudre parfaitement la géométrie de chaque coin concave, on détecte l'absence
// de progression réelle malgré une vélocité significative et on force une brève échappée
// vers le centre de la salle (toujours atteignable en ligne droite pour nos formes, jamais
// un vrai labyrinthe) — un filet de sécurité pragmatique plutôt qu'une solution générale.
var STUCK_PROGRESS_DIST = 10; // unités parcourues en STUCK_TIME_THRESHOLD jugées "ça avance"
var STUCK_TIME_THRESHOLD = 0.5; // secondes de non-progression avant intervention
var STUCK_ESCAPE_DUR = 0.5; // durée de l'échappée forcée vers le centre

function roomCentroid() {
  var shape = (typeof CB !== 'undefined' && CB) ? CB.roomShape : null;
  if (!shape) return [ARENA_W / 2, ARENA_H / 2];
  if (shape.type === 'ring') return [shape.cx, shape.cy];
  return [shape.w / 2, shape.h / 2];
}

function advanceCharge(e, dt) {
  var nx = e.x + e.chargeDirX * e.def.chargeSpeed * dt;
  var ny = e.y + e.chargeDirY * e.def.chargeSpeed * dt;
  for (var i = 0; i < CB.blocks.length; i++) {
    var b = CB.blocks[i];
    if (dist(nx, ny, b.x, b.y) < e.hitR + b.r) {
      spawnBurst(e.x, e.y, '#ffffff', 14, 160);
      triggerShake(6, 0.15);
      return false;
    }
  }
  e.x = nx; e.y = ny;
  return true;
}

function updateEnemyAI(e, dt, p) {
  var d = dist(e.x, e.y, p.x, p.y);
  e.atkCd = Math.max(0, (e.atkCd || 0) - dt);
  if (e.stunTimer > 0) e.stunTimer -= dt;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  if (e.spawnTimer > 0) e.spawnTimer = Math.max(0, e.spawnTimer - dt);
  if (e.speedBuffTimer > 0) { e.speedBuffTimer -= dt; if (e.speedBuffTimer <= 0) e.speedBuffMult = 1; }

  // Mannequin d'entraînement de l'armurerie : totalement immobile, aucune IA (ni
  // déplacement ni attaque) — juste une cible plantée au sol. Le flash de coup/stun
  // décrémentés ci-dessus continuent de fonctionner normalement pour le retour visuel.
  if (CB.isArmory) { e.vx = 0; e.vy = 0; return; }

  if (e.shape === 'boss') {
    e.fightTimer += dt;
    var enrageT = clamp((e.fightTimer - BOSS_ENRAGE_AFTER) / BOSS_ENRAGE_RAMP, 0, 1);
    e.enrageMult = 1 + enrageT * (BOSS_ENRAGE_MAX_MULT - 1);
    e.dmg = Math.round(e.baseDmg * e.enrageMult);
    e.speed = e.baseSpeed * (1 + enrageT * (BOSS_ENRAGE_MAX_MULT - 1) * 0.6);
  }

  if (e._escapeTimer > 0) {
    // Échappée anti-blocage en cours (voir le filet de sécurité plus haut) : ignore le
    // comportement normal le temps de sortir du minimum local, plutôt que de laisser le
    // steering réactif retenter indéfiniment la même direction condamnée.
    e._escapeTimer -= dt;
    var centroidEsc = roomCentroid();
    steerToward(e, centroidEsc[0], centroidEsc[1]);
  } else {
  switch (e.behavior) {
    case 'tank_basic':
      if (e.telegraphOn) {
        e.vx = 0; e.vy = 0;
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          e.telegraphOn = false;
          if (dist(e.x, e.y, p.x, p.y) <= e.def.ringRadius) damagePlayer(e.dmg * e.def.ringDmgMult);
          spawnBurst(e.x, e.y, e.color, 22, 170);
          triggerShake(6, 0.15);
          e.stateTimer = e.def.ringEvery;
        }
      } else {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) { e.telegraphOn = true; e.telegraphTimer = e.def.ringTelegraph; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.ringTelegraph; }
        else if (!meleeContact(e, dt, p, 1, 0.7)) steerToward(e, p.x, p.y);
      }
      break;

    case 'tank_shield':
      e.stateTimer -= dt;
      if (e.shieldOn) { e.shieldTimer -= dt; if (e.shieldTimer <= 0) e.shieldOn = false; }
      if (e.stateTimer <= 0) { e.shieldOn = true; e.shieldTimer = e.def.shieldDur; e.stateTimer = e.def.shieldEvery; }
      if (!meleeContact(e, dt, p, 1, 0.7)) steerToward(e, p.x, p.y);
      break;

    case 'tank_knockback':
      if (!meleeContact(e, dt, p, 1, 0.8)) {
        steerToward(e, p.x, p.y);
      } else {
        var n = norm(p.x - e.x, p.y - e.y);
        p.knockVX = n[0] * e.def.knockForce; p.knockVY = n[1] * e.def.knockForce;
      }
      break;

    case 'tank_slam':
      if (e.telegraphOn) {
        e.vx = 0; e.vy = 0;
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          e.telegraphOn = false;
          if (dist(e.x, e.y, p.x, p.y) <= e.def.slamRadius) damagePlayer(e.dmg * 1.8);
          spawnBurst(e.x, e.y, '#f2603f', 20, 180);
          triggerShake(9, 0.25);
          e.stateTimer = e.def.slamEvery;
        }
      } else {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) { e.telegraphOn = true; e.telegraphTimer = e.def.slamTelegraph; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.slamTelegraph; }
        else if (d > e.r + p.r + 20) steerToward(e, p.x, p.y, 0.8); else { e.vx = 0; e.vy = 0; }
      }
      break;

    case 'tank_charge':
      if (e.charging) {
        var tcOk = advanceCharge(e, dt);
        e.chargeTimer -= dt;
        if (!e.chargeHit && dist(e.x, e.y, p.x, p.y) < e.hitR + p.r + 4) { damagePlayer(e.dmg * 1.5); e.chargeHit = true; }
        if (!tcOk || e.chargeTimer <= 0) {
          e.charging = false;
          e.stunTimer = 0.5 + (tcOk ? 0 : CHARGE_WALL_STUN_BONUS);
          e.stateTimer = e.def.chargeEvery;
        }
      } else if (e.telegraphOn) {
        e.vx = 0; e.vy = 0;
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          e.telegraphOn = false; e.charging = true; e.chargeHit = false;
          e.chargeTimer = e.def.chargeDur;
          var cn = norm(p.x - e.x, p.y - e.y);
          e.chargeDirX = cn[0]; e.chargeDirY = cn[1];
          triggerShake(4, 0.1);
        }
      } else {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) { e.telegraphOn = true; e.telegraphTimer = e.def.chargeTelegraph; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.chargeTelegraph; }
        else steerToward(e, p.x, p.y, 0.55);
      }
      break;

    case 'ranged_basic':
      steerRanged(e, p, d);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) { fireProjectileAtLead(e, p, e.def.projSpeed, e.dmg, 6, '#c9e35b'); e.stateTimer = e.def.fireEvery; }
      break;

    case 'ranged_burst':
      steerRanged(e, p, d);
      if (e.burstCount > 0) {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          fireProjectileAtLead(e, p, e.def.projSpeed, e.dmg, 6, '#c9e35b');
          e.burstCount--;
          e.burstTimer = e.def.burstGap;
        }
      } else {
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) { e.burstCount = e.def.burstCount; e.burstTimer = 0; e.stateTimer = e.def.fireEvery; }
      }
      break;

    case 'ranged_snipe':
      if (e.telegraphOn) {
        e.vx = 0; e.vy = 0;
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          e.telegraphOn = false;
          fireProjectileAtLead(e, p, e.def.projSpeed, e.dmg * 1.6, 5, '#f2603f');
          e.stateTimer = e.def.fireEvery;
        }
      } else {
        steerRanged(e, p, d);
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) { e.telegraphOn = true; e.telegraphTimer = e.def.telegraph; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.telegraph; }
      }
      break;

    case 'ranged_mortar':
      steerRanged(e, p, d);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        pickMortarCells(p.x, p.y).forEach(function (c) {
          CB.blasts.push(makePendingBlast(c[0], c[1], e.def.blastRadius, e.dmg * 1.5, e.def.telegraph, '#f2b84b'));
        });
        e.stateTimer = e.def.fireEvery;
      }
      break;

    case 'ranged_volley_teleport':
      steerRanged(e, p, d);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        var vlt = leadTarget(e, p, e.def.projSpeed);
        [-0.28, 0, 0.28].forEach(function (off) {
          var base = Math.atan2(vlt[1] - e.y, vlt[0] - e.x) + off;
          CB.projectiles.push(makeProjectile(e.x, e.y, Math.cos(base) * e.def.projSpeed, Math.sin(base) * e.def.projSpeed, e.dmg * 0.7, 5, '#b34bf2'));
        });
        e.stateTimer = e.def.fireEvery;
      }
      break;

    case 'other_laser_sweep':
      if (e.sweeping) {
        e.vx = 0; e.vy = 0;
        e.sweepTimer -= dt;
        if (e.sweepTimer <= 0) { e.sweeping = false; e.stateTimer = e.def.sweepEvery; }
      } else if (e.telegraphOn) {
        e.vx = 0; e.vy = 0;
        e.telegraphTimer -= dt;
        if (e.telegraphTimer <= 0) {
          e.telegraphOn = false;
          e.sweeping = true;
          e.sweepTimer = e.def.sweepDur;
          var sweepStartAngle = Math.random() * Math.PI * 2;
          var spinSpeed = (Math.PI * 2 / e.def.sweepDur) * (Math.random() < 0.5 ? 1 : -1);
          CB.lasers.push(makeLaser(e.x, e.y, sweepStartAngle, e.def.laserLength, e.def.laserWidth, 0, e.def.sweepDur, e.def.laserDmgPerSec, e.color, spinSpeed));
        }
      } else {
        e.stateTimer -= dt;
        if (d <= e.def.sweepRange) {
          e.vx = 0; e.vy = 0;
          if (e.stateTimer <= 0) { e.telegraphOn = true; e.telegraphTimer = e.def.sweepTelegraph; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.sweepTelegraph; }
        } else {
          steerToward(e, p.x, p.y, 0.85);
        }
      }
      break;

    case 'other_leech':
      if (d < e.hitR + p.r + 2) { e.vx = 0; e.vy = 0; damagePlayer(e.def.drainPerSec * dt); }
      else steerToward(e, p.x, p.y);
      break;

    case 'other_explode':
      if (d < e.hitR + p.r + 4 && p.invulnTimer <= 0) {
        damagePlayer(e.def.blastDmg);
        spawnBurst(e.x, e.y, '#ff5a3c', 18, 170);
        triggerShake(8, 0.2);
        e.hp = 0; e.alive = false;
      } else steerToward(e, p.x, p.y, 1.05);
      break;

    case 'other_buff':
      steerRanged(e, p, d, 200);
      e.stateTimer -= dt;
      if (e.stateTimer <= 0) {
        CB.enemies.forEach(function (o) {
          if (o !== e && o.alive && dist(o.x, o.y, e.x, e.y) <= e.def.healRadius) {
            o.hp = Math.min(o.maxHp, o.hp + e.def.healAmount);
            o.speedBuffMult = e.def.buffSpdMult;
            o.speedBuffTimer = e.def.buffDur;
            spawnBurst(o.x, o.y, '#8fe3a0', 4, 50);
          }
        });
        spawnBurst(e.x, e.y, '#8fe3a0', 14, 90);
        e.stateTimer = e.def.healEvery;
      }
      if (d < e.hitR + p.r + 3 && e.atkCd <= 0) { damagePlayer(e.dmg * 0.6); e.atkCd = 0.8; }
      e.boltTimer = (e.boltTimer == null ? e.def.boltEvery : e.boltTimer) - dt;
      if (e.boltTimer <= 0) { fireProjectileAtLead(e, p, e.def.boltSpeed, e.def.boltDmg, 6, '#8fe3a0'); e.boltTimer = e.def.boltEvery; }
      break;

    case 'other_phase':
      e.stateTimer -= dt;
      if (e.invulnOn) { e.invulnTimer -= dt; if (e.invulnTimer <= 0) e.invulnOn = false; }
      if (e.stateTimer <= 0) {
        var pp = randomArenaPointNear(p.x, p.y, MIN_TELEPORT_DIST, MIN_TELEPORT_DIST + e.def.phaseDist);
        e.x = pp[0]; e.y = pp[1];
        e.invulnOn = true; e.invulnTimer = e.def.phaseDur;
        e.stateTimer = e.def.phaseEvery;
        spawnBurst(e.x, e.y, '#b34bf2', 12, 130);
      } else if (!meleeContact(e, dt, p, 0.8, 0.6)) {
        steerToward(e, p.x, p.y, 0.9);
      }
      e.laserTimer = (e.laserTimer == null ? e.def.laserEvery : e.laserTimer) - dt;
      if (e.laserTimer <= 0) {
        var sAng = Math.atan2(p.y - e.y, p.x - e.x);
        CB.lasers.push(makeLaser(e.x, e.y, sAng, e.def.laserLength, e.def.laserWidth, e.def.laserTelegraph, e.def.laserFireDur, e.def.laserDmgPerSec, '#b34bf2'));
        e.laserTimer = e.def.laserEvery;
      }
      break;

    case 'boss_ultimate':
      var busy = false;

      if (e.charging) {
        busy = true;
        var buOk = advanceCharge(e, dt);
        e.chargeTimer -= dt;
        if (!e.chargeHit && dist(e.x, e.y, p.x, p.y) < e.hitR + p.r + 6) { damagePlayer(e.dmg * 1.4); e.chargeHit = true; }
        if (!buOk || e.chargeTimer <= 0) {
          e.charging = false;
          e.stunTimer = 0.4 + (buOk ? 0 : CHARGE_WALL_STUN_BONUS);
        }
      } else if (e.chargeTelegraphOn) {
        busy = true;
        e.vx = 0; e.vy = 0;
        e.chargeTelegraphTimer -= dt;
        if (e.chargeTelegraphTimer <= 0) {
          e.chargeTelegraphOn = false; e.charging = true; e.chargeHit = false; e.chargeTimer = e.def.chargeDur;
          var bcn = norm(p.x - e.x, p.y - e.y);
          e.chargeDirX = bcn[0]; e.chargeDirY = bcn[1];
          triggerShake(5, 0.12);
        }
      } else {
        e.chargeCd = (e.chargeCd == null ? e.def.chargeEvery : e.chargeCd) - dt;
        if (e.chargeCd <= 0) { e.chargeTelegraphOn = true; e.chargeTelegraphTimer = e.def.chargeTelegraph; e.chargeCd = e.def.chargeEvery; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.chargeTelegraph; }
      }

      if (e.slamTelegraphOn) {
        busy = true;
        e.vx = 0; e.vy = 0;
        e.slamTelegraphTimer -= dt;
        if (e.slamTelegraphTimer <= 0) {
          e.slamTelegraphOn = false;
          if (dist(e.x, e.y, p.x, p.y) <= e.def.slamRadius) damagePlayer(e.def.slamDmg);
          spawnBurst(e.x, e.y, '#ff2d55', 26, 200);
          triggerShake(10, 0.28);
        }
      } else if (!e.charging && !e.chargeTelegraphOn) {
        e.slamCd = (e.slamCd == null ? e.def.slamEvery : e.slamCd) - dt;
        if (e.slamCd <= 0) { e.slamTelegraphOn = true; e.slamTelegraphTimer = e.def.slamTelegraph; e.slamCd = e.def.slamEvery; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.slamTelegraph; }
      }

      e.laserCd = (e.laserCd == null ? e.def.laserEvery : e.laserCd) - dt;
      if (e.laserCd <= 0) {
        var bAng = Math.atan2(p.y - e.y, p.x - e.x);
        CB.lasers.push(makeLaser(e.x, e.y, bAng, e.def.laserLength, e.def.laserWidth, e.def.laserTelegraph, e.def.laserFireDur, e.def.laserDmgPerSec, '#ff2d55'));
        e.laserCd = e.def.laserEvery;
      }

      e.volleyCd = (e.volleyCd == null ? e.def.volleyEvery : e.volleyCd) - dt;
      if (e.volleyCd <= 0) {
        for (var vi = 0; vi < e.def.volleyCount; vi++) {
          var vAng = (Math.PI * 2 / e.def.volleyCount) * vi;
          CB.projectiles.push(makeProjectile(e.x, e.y, Math.cos(vAng) * e.def.volleySpeed, Math.sin(vAng) * e.def.volleySpeed, e.def.volleyDmg, 7, '#ff2d55', true));
        }
        e.volleyCd = e.def.volleyEvery;
      }

      if (!busy && !meleeContact(e, dt, p, 1, 0.6)) steerToward(e, p.x, p.y, 0.7);
      break;

    case 'boss_guardian':
      var busyGd = false;

      e.shieldStateTimer = (e.shieldStateTimer == null ? e.def.shieldEvery : e.shieldStateTimer) - dt;
      if (e.shieldOn) { e.shieldTimer -= dt; if (e.shieldTimer <= 0) e.shieldOn = false; }
      if (e.shieldStateTimer <= 0) { e.shieldOn = true; e.shieldTimer = e.def.shieldDur; e.shieldStateTimer = e.def.shieldEvery; }

      if (e.slamTelegraphOn) {
        busyGd = true;
        e.vx = 0; e.vy = 0;
        e.slamTelegraphTimer -= dt;
        if (e.slamTelegraphTimer <= 0) {
          e.slamTelegraphOn = false;
          if (dist(e.x, e.y, p.x, p.y) <= e.def.slamRadius) damagePlayer(e.def.slamDmg);
          spawnBurst(e.x, e.y, e.color, 26, 200);
          triggerShake(10, 0.28);
        }
      } else {
        e.slamCd = (e.slamCd == null ? e.def.slamEvery : e.slamCd) - dt;
        if (e.slamCd <= 0) { e.slamTelegraphOn = true; e.slamTelegraphTimer = e.def.slamTelegraph; e.slamCd = e.def.slamEvery; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.slamTelegraph; }
      }

      if (!busyGd) {
        if (d < e.hitR + p.r + 4) {
          e.vx = 0; e.vy = 0;
          if (e.atkCd <= 0) {
            var gdn = norm(p.x - e.x, p.y - e.y);
            p.knockVX = gdn[0] * e.def.knockForce; p.knockVY = gdn[1] * e.def.knockForce;
            damagePlayer(e.dmg);
            e.atkCd = 0.75;
          }
        } else steerToward(e, p.x, p.y, 0.75);
      }
      break;

    case 'boss_oracle':
      steerRanged(e, p, d, e.def.keepDist);

      if (e.oracleTelegraphOn) {
        e.vx = 0; e.vy = 0;
        e.oracleTelegraphTimer -= dt;
        if (e.oracleTelegraphTimer <= 0) {
          e.oracleTelegraphOn = false;
          fireProjectileAtLead(e, p, e.def.snipeSpeed, e.dmg * e.def.snipeDmgMult, 6, e.color);
        }
      } else {
        e.snipeCd = (e.snipeCd == null ? e.def.snipeEvery : e.snipeCd) - dt;
        if (e.snipeCd <= 0) { e.oracleTelegraphOn = true; e.oracleTelegraphTimer = e.def.snipeTelegraph; e.snipeCd = e.def.snipeEvery; e._telegraphStartT = CB.elapsed; e._telegraphDurTotal = e.def.snipeTelegraph; }
      }

      e.mortarCd = (e.mortarCd == null ? e.def.mortarEvery : e.mortarCd) - dt;
      if (e.mortarCd <= 0) {
        CB.blasts.push(makePendingBlast(p.x, p.y, e.def.mortarRadius, e.dmg * e.def.mortarDmgMult, e.def.mortarTelegraph, '#f2b84b'));
        e.mortarCd = e.def.mortarEvery;
      }

      e.oraclePhaseCd = (e.oraclePhaseCd == null ? e.def.phaseEvery : e.oraclePhaseCd) - dt;
      if (e.oraclePhaseCd <= 0) {
        var op = randomArenaPointNear(p.x, p.y, MIN_TELEPORT_DIST, MIN_TELEPORT_DIST + e.def.phaseDist);
        e.x = op[0]; e.y = op[1];
        spawnBurst(e.x, e.y, e.color, 14, 140);
        e.oraclePhaseCd = e.def.phaseEvery;
      }
      break;

    case 'boss_shaman':
      if (d < e.hitR + p.r + 3) { e.vx = 0; e.vy = 0; damagePlayer(e.def.drainPerSec * dt); }
      else steerToward(e, p.x, p.y, 0.85);

      e.shamanHealCd = (e.shamanHealCd == null ? e.def.healEvery : e.shamanHealCd) - dt;
      if (e.shamanHealCd <= 0) {
        e.hp = Math.min(e.maxHp, e.hp + e.def.healAmount);
        spawnBurst(e.x, e.y, e.color, 16, 100);
        e.shamanHealCd = e.def.healEvery;
      }

      e.shamanVolleyCd = (e.shamanVolleyCd == null ? e.def.volleyEvery : e.shamanVolleyCd) - dt;
      if (e.shamanVolleyCd <= 0) {
        for (var svi = 0; svi < e.def.volleyCount; svi++) {
          var svAng = (Math.PI * 2 / e.def.volleyCount) * svi;
          CB.projectiles.push(makeProjectile(e.x, e.y, Math.cos(svAng) * e.def.volleySpeed, Math.sin(svAng) * e.def.volleySpeed, e.def.volleyDmg, 6, e.color, true));
        }
        e.shamanVolleyCd = e.def.volleyEvery;
      }

      e.necroSummonCd = (e.necroSummonCd == null ? NECRO_SUMMON_EVERY : e.necroSummonCd) - dt;
      if (e.necroSummonCd <= 0) {
        e.summonedIds = (e.summonedIds || []).filter(function (sid) {
          return CB.enemies.some(function (o) { return o.id === sid && o.alive; });
        });
        if (e.summonedIds.length < NECRO_SUMMON_MAX_ALIVE) {
          var sDef = getEnemyDef('square', 1);
          var sp = randomArenaPointNear(e.x, e.y, 60, 140);
          var skeleton = makeEnemy(sDef, sp[0], sp[1], { hpPct: NECRO_SUMMON_HP_PCT, dmgPct: NECRO_SUMMON_DMG_PCT });
          CB.enemies.push(skeleton);
          e.summonedIds.push(skeleton.id);
          spawnBurst(skeleton.x, skeleton.y, e.color, 14, 110);
        }
        e.necroSummonCd = NECRO_SUMMON_EVERY;
      }
      break;

    case 'boss_wraith':
      e.wraithJitterTimer = (e.wraithJitterTimer == null ? 0 : e.wraithJitterTimer) - dt;
      if (e.wraithJitterTimer <= 0) {
        var wja = Math.random() * Math.PI * 2;
        e.jitterX = Math.cos(wja); e.jitterY = Math.sin(wja);
        e.wraithJitterTimer = e.def.jitterEvery;
      }
      if (e.invulnOn) { e.invulnTimer -= dt; if (e.invulnTimer <= 0) e.invulnOn = false; }

      e.wraithPhaseCd = (e.wraithPhaseCd == null ? e.def.phaseEvery : e.wraithPhaseCd) - dt;
      if (e.wraithPhaseCd <= 0) {
        var wp = randomArenaPointNear(p.x, p.y, MIN_TELEPORT_DIST, MIN_TELEPORT_DIST + e.def.phaseDist);
        e.x = wp[0]; e.y = wp[1];
        e.invulnOn = true; e.invulnTimer = e.def.phaseDur;
        spawnBurst(e.x, e.y, e.color, 14, 150);
        e.wraithPhaseCd = e.def.phaseEvery;
      } else if (!meleeContact(e, dt, p, 0.9, 0.7)) {
        var wtn = norm(p.x - e.x, p.y - e.y);
        e.vx = (wtn[0] + e.jitterX * 0.5) * e.speed;
        e.vy = (wtn[1] + e.jitterY * 0.5) * e.speed;
      }

      e.wraithLaserCd = (e.wraithLaserCd == null ? e.def.laserEvery : e.wraithLaserCd) - dt;
      if (e.wraithLaserCd <= 0) {
        var waAng = Math.atan2(p.y - e.y, p.x - e.x);
        CB.lasers.push(makeLaser(e.x, e.y, waAng, e.def.laserLength, e.def.laserWidth, e.def.laserTelegraph, e.def.laserFireDur, e.def.laserDmgPerSec, e.color));
        e.wraithLaserCd = e.def.laserEvery;
      }
      break;
  }
  }

  var zMult = applyZoneEffects(e, dt, false);
  var moveX = e.vx * dt * zMult, moveY = e.vy * dt * zMult;
  if (moveX || moveY) {
    var destCell = cellOf(e.x + moveX, e.y + moveY);
    if (isCellForbidden(e, destCell[0], destCell[1])) {
      var cellOnlyX = cellOf(e.x + moveX, e.y);
      var cellOnlyY = cellOf(e.x, e.y + moveY);
      if (!isCellForbidden(e, cellOnlyX[0], cellOnlyX[1])) e.x += moveX;
      else if (!isCellForbidden(e, cellOnlyY[0], cellOnlyY[1])) e.y += moveY;
      // Les 3 cases candidates (diagonale + les 2 axes) sont TOUTES interdites (zone
      // exiguë déjà entièrement visitée dans les 15 dernières secondes, ex. corridor
      // étroit d'une salle en haltère) : mieux vaut avancer quand même que geler
      // complètement l'ennemi — signalé explicitement ("des ennemis se déplacent sans
      // avancer") : la vélocité désirée restait non nulle mais la position ne bougeait
      // plus jamais tant qu'aucune case voisine ne redevenait autorisée.
      else { e.x += moveX; e.y += moveY; }
    } else {
      e.x += moveX; e.y += moveY;
    }
  }
  if (e.knockVX || e.knockVY) {
    e.x += e.knockVX * dt;
    e.y += e.knockVY * dt;
    e.knockVX *= Math.pow(0.02, dt);
    e.knockVY *= Math.pow(0.02, dt);
    if (Math.abs(e.knockVX) < 4) e.knockVX = 0;
    if (Math.abs(e.knockVY) < 4) e.knockVY = 0;
  }

  var exy2 = clampIntoRoom(e.x, e.y, e.r);
  e.x = exy2[0]; e.y = exy2[1];

  // Filet de sécurité anti-blocage (voir le commentaire au-dessus d'updateEnemyAI) :
  // vélocité désirée notable mais quasi aucune progression réelle depuis un moment ->
  // minimum local (coin concave), on programme une échappée pour la frame suivante.
  var speedNow = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
  if (speedNow > 20 && !CB.isArmory && e.shape !== 'boss') {
    if (e._stuckAnchorX == null || dist(e.x, e.y, e._stuckAnchorX, e._stuckAnchorY) > STUCK_PROGRESS_DIST) {
      e._stuckAnchorX = e.x; e._stuckAnchorY = e.y; e._stuckSinceT = CB.elapsed;
    } else if (CB.elapsed - e._stuckSinceT > STUCK_TIME_THRESHOLD) {
      e._escapeTimer = STUCK_ESCAPE_DUR;
      e._stuckAnchorX = e.x; e._stuckAnchorY = e.y; e._stuckSinceT = CB.elapsed;
    }
  } else {
    e._stuckAnchorX = null;
  }

  var knockSpeed = Math.sqrt(e.knockVX * e.knockVX + e.knockVY * e.knockVY);
  var preBlockX = e.x, preBlockY = e.y;
  resolveBlockCollision(e);
  if (knockSpeed > 60 && dist(preBlockX, preBlockY, e.x, e.y) > 2) {
    // Percuté contre un obstacle en plein repoussage (dash/pulse/pull/etc.) : gros dégâts bonus.
    damageEnemy(e, WALL_SLAM_BONUS_DMG * CB.player.dmgMult);
    spawnBurst(e.x, e.y, '#ffffff', 16, 180);
    triggerShake(7, 0.16);
    e.knockVX = 0; e.knockVY = 0;
  }
  updateCellHistory(e);
}

function steerRanged(e, p, d, keepDistOverride) {
  var kd = keepDistOverride || e.def.keepDist;
  if (d < kd - 20) steerAway(e, p.x, p.y, 0.8);
  else if (d > kd + 40) steerToward(e, p.x, p.y, 0.8);
  else { e.vx *= 0.4; e.vy *= 0.4; }
}

// ---------------- Projectiles / blasts / lasers ----------------

function updateProjectiles(dt) {
  var p = CB.player;
  CB.projectiles.forEach(function (pr) {
    pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
    if (pr.life <= 0) return;
    if (outsideRoomShape(pr.x, pr.y)) { pr.life = 0; return; }
    if (!pr.pierceBlocks) {
      for (var i = 0; i < CB.blocks.length; i++) {
        if (dist(pr.x, pr.y, CB.blocks[i].x, CB.blocks[i].y) < pr.r + CB.blocks[i].r) { pr.life = 0; return; }
      }
    }
    if (pr.fromPlayer) {
      for (var j = 0; j < CB.enemies.length; j++) {
        var e = CB.enemies[j];
        if (e.alive && dist(pr.x, pr.y, e.x, e.y) < pr.r + e.hitR) { damageEnemy(e, pr.dmg); pr.life = 0; return; }
      }
    } else if (dist(pr.x, pr.y, p.x, p.y) < pr.r + p.r) { damagePlayer(pr.dmg); pr.life = 0; }
  });
  CB.projectiles = CB.projectiles.filter(function (pr) { return pr.life > 0; });
}

function updateBlasts(dt) {
  var p = CB.player;
  CB.blasts.forEach(function (b) {
    b.delay -= dt;
    if (b.delay <= 0 && !b.done) {
      b.done = true;
      if (b.hitsEnemies) {
        CB.enemies.forEach(function (e) { if (e.alive && dist(e.x, e.y, b.x, b.y) <= b.radius) damageEnemy(e, b.dmg); });
      } else if (dist(p.x, p.y, b.x, b.y) <= b.radius) {
        damagePlayer(b.dmg);
      }
      spawnBurst(b.x, b.y, b.color, 16, 160);
      triggerShake(6, 0.18);
    }
  });
  CB.blasts = CB.blasts.filter(function (b) { return !b.done; });
}

function pointNearLaser(px, py, l) {
  var dx = Math.cos(l.angle), dy = Math.sin(l.angle);
  var vx = px - l.x, vy = py - l.y;
  var proj = vx * dx + vy * dy;
  if (proj < 0 || proj > l.length) return false;
  var perp = Math.abs(vx * dy - vy * dx);
  return perp <= l.width / 2;
}

function updateLasers(dt) {
  var p = CB.player;
  CB.lasers.forEach(function (l) {
    if (!l.firing) {
      l.telegraph -= dt;
      if (l.telegraph <= 0) l.firing = true;
    } else {
      if (l.spinSpeed) l.angle += l.spinSpeed * dt;
      l.fireTimer -= dt;
      if (p.invulnTimer <= 0 && pointNearLaser(p.x, p.y, l)) damagePlayer(l.dmgPerSec * dt);
      if (l.fireTimer <= 0) l.done = true;
    }
  });
  CB.lasers = CB.lasers.filter(function (l) { return !l.done; });
}

function updateDashTrails(dt) {
  CB.dashTrails.forEach(function (t) { t.life -= dt; });
  CB.dashTrails = CB.dashTrails.filter(function (t) { return t.life > 0; });
}

function updateGrappleRopes(dt) {
  CB.grappleRopes.forEach(function (r) { r.life -= dt; });
  CB.grappleRopes = CB.grappleRopes.filter(function (r) { return r.life > 0; });
}

function updatePulseRings(dt) {
  CB.pulseRings.forEach(function (r) { r.life -= dt; });
  CB.pulseRings = CB.pulseRings.filter(function (r) { return r.life > 0; });
}

function updateParticles(dt) {
  CB.particles.forEach(function (pt) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= Math.pow(0.05, dt); pt.vy *= Math.pow(0.05, dt);
    pt.life -= dt;
  });
  CB.particles = CB.particles.filter(function (pt) { return pt.life > 0; });
}

// ---------------- Boucle principale ----------------

function endCombat(won) {
  CB.ended = true;
  CB.won = won;
  CB.phase = 'ended';
}

var ARMORY_INTERACT_MARGIN = 14;

// Présentoirs d'armes de l'armurerie (voir enterArmory, js/game.js) : la proximité +
// la touche d'interaction équipe l'arme dans le bon emplacement (type 1 ou type 2, sans
// toucher à l'autre) et ouvre le panneau de description/biais (openArmoryPanel, editor.js).
function updateArmoryPedestals(dt) {
  var p = CB.player;
  var near = null, nearD = Infinity;
  (CB.armoryPedestals || []).forEach(function (ped) {
    var d = dist(p.x, p.y, ped.x, ped.y);
    if (d <= ped.r + ARMORY_INTERACT_MARGIN && d < nearD) { nearD = d; near = ped; }
  });
  CB.armoryNearPedestal = near;
  var interactHeld = isDown('KeyE');
  if (interactHeld && !CB.armoryPrevInteract && near) {
    if (near.type === 1) applyWeapons(p, near.id, p.weapon2);
    else applyWeapons(p, p.weapon1, near.id);
    // Le brasier (arme 'flame') a besoin d'un état compagnon dédié (CB.brasier), normalement
    // créé une seule fois en tout début de run (spawnWave) — ici l'arme peut être équipée à
    // tout moment via un présentoir, donc on le crée/détruit à l'équipement pour le rendre
    // testable (et éviter qu'il continue de brûler après avoir changé d'arme).
    if (p.weapon1 === 'flame' && !CB.brasier) CB.brasier = { x: p.x, y: p.y, targetX: p.x, targetY: p.y };
    else if (p.weapon1 !== 'flame') CB.brasier = null;
    CB.armoryPanelWeapon = near.id;
    applyWeaponHUDLabels();
    openArmoryPanel(near.id);
    AudioEngine.sfx('pickup');
  }
  CB.armoryPrevInteract = interactHeld;
}

// Nombres de dégâts flottants du mannequin d'entraînement — un par coup (voir
// damageEnemy), montent légèrement puis s'effacent. Rendu 2D : drawArmoryHitNumbers
// (render.js). Rendu 3D : pool de sprites texte, js3d/combat3d.js.
var ARMORY_HIT_NUMBER_RISE = 34; // pixels/unités de jeu parcourus sur toute la durée de vie
function updateArmoryHitNumbers(dt) {
  (CB.armoryHitNumbers || []).forEach(function (n) { n.life -= dt; });
  CB.armoryHitNumbers = (CB.armoryHitNumbers || []).filter(function (n) { return n.life > 0; });
}

var EMPTY_WEAPON_INPUT = { held: false, justPressed: false, justReleased: false };

function updateCombat(dt, moveX, moveY, mouseX, mouseY, w1, w2) {
  if (!CB || CB.ended) return;
  w1 = w1 || EMPTY_WEAPON_INPUT;
  w2 = w2 || EMPTY_WEAPON_INPUT;

  CB.elapsed += dt;
  if (CB.shakeTime > 0) { CB.shakeTime -= dt; if (CB.shakeTime <= 0) CB.shakeMag = 0; }
  if (CB.damageFlashTime > 0) CB.damageFlashTime = Math.max(0, CB.damageFlashTime - dt);

  updatePlayer(dt, moveX, moveY, mouseX, mouseY, w1, w2);
  updateParticles(dt);
  updateDashTrails(dt);
  updateGrappleRopes(dt);
  updatePulseRings(dt);
  updateSwordSwings(dt);
  updateZones(dt);

  if (CB.isArmory) { updateArmoryPedestals(dt); updateArmoryHitNumbers(dt); }

  if (CB.phase === 'fighting') {
    if (!CB.isArmory) applyPassiveDrain(dt);
    CB.enemies.forEach(function (e) { if (e.alive) updateEnemyAI(e, dt, CB.player); });
    CB.enemies = CB.enemies.filter(function (e) { return e.alive; });
    resolveEnemyCollisions();
    updateBlockKnockback(dt);
    updateProjectiles(dt);
    updateBlasts(dt);
    updateLasers(dt);
    updateTurrets(dt);
    updateKnives(dt);
    updateBoomerang(dt);
    updateBrasier(dt);
    updateTraps(dt);
    updateConvertedTraps(dt);
    updateChapterHazards(dt);
    if (CB.isBossRoom) updateBossLeash(dt);

    // L'armurerie n'a pas de condition de victoire (les mannequins ne meurent jamais,
    // hp/dmg neutralisés à la création — voir enterArmory dans js/game.js) : garde
    // explicite malgré tout, au cas où.
    if (!CB.isArmory && CB.enemies.length === 0) {
      if (CB.waveIndex + 1 < CB.totalWaves) {
        CB.phase = 'transition';
        CB.transitionTimer = WAVE_TRANSITION_DUR;
      } else {
        endCombat(true);
      }
    }
  } else if (CB.phase === 'transition') {
    updateBlockKnockback(dt);
    updateProjectiles(dt); updateBlasts(dt); updateLasers(dt);
    updateKnives(dt); updateBoomerang(dt); updateBrasier(dt);
    CB.transitionTimer -= dt;
    if (CB.transitionTimer <= 0) spawnWave(CB.waveIndex + 1);
  }
}
