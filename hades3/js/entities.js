// Dimensions logiques de l'arène + factories des entités de combat.

// Arène volontairement resserrée : plus dur de camper à distance en laissant les ennemis
// venir mourir tout seuls, l'espace pour fuir indéfiniment est plus limité.
// ARENA_H est nettement plus grand que ARENA_W en coordonnées de jeu — le monde réel
// est un rectangle "haut", pas un carré — pour qu'une fois compressé verticalement par
// la caméra inclinée (ARENA_TILT_Y, render.js), la carte affichée à l'écran soit carrée.
var ARENA_W = 820;
var ARENA_H = 1140;
var CELL_SIZE = 55; // coïncide avec le quadrillage dessiné en fond d'arène

var _nextId = 1;
function nextId() { return _nextId++; }

var PLAYER_BASE_SPEED = 230 * GAME_SPEED_MULT;

function makePlayer(spawnX, spawnY) {
  var maxHp = 100;
  return {
    kind: 'player',
    x: spawnX != null ? spawnX : ARENA_W / 2, y: spawnY != null ? spawnY : ARENA_H - 90,
    r: 17,
    hp: maxHp, maxHp: maxHp,
    speed: PLAYER_BASE_SPEED,
    dmgMult: 1,
    facingX: 0, facingY: -1,
    dashCd: 0, dashCdMax: 1.2,
    specialCd: 0, specialCdMax: 2,
    pulseCd: 0, pulseCdMax: 4.5,
    isDashing: false, dashTimer: 0, dashDurMax: 0.286, dashSpeed: 900 * GAME_SPEED_MULT,
    dashDirX: 0, dashDirY: -1, dashStartX: 0, dashStartY: 0,
    invulnTimer: 0,
    vx: 0, vy: 0,
    // Armes tirées au hasard en début de run (dashCd/dashCdMax = cooldown de l'arme de
    // type 1 quelle qu'elle soit ; pulseCd/pulseCdMax = celui de l'arme de type 2).
    weapon1: 'dash', weapon2: 'pulse',
    w1Charging: false, w1ChargeTime: 0, w1AimX: 0, w1AimY: 0,
    w2Resource: 100, w2ResourceMax: 100,
    trailKind: 'flame', trailTimer: 0
  };
}

// Appelé à chaque nouvelle vague : c'est la vague qui pilote les stats du personnage.
function applyWaveStatsToPlayer(p, waveStats) {
  var dmgMult = ((waveStats && waveStats.dmgPct != null) ? waveStats.dmgPct : 100) / 100;
  var spdMult = ((waveStats && waveStats.spdPct != null) ? waveStats.spdPct : 100) / 100;
  p.dmgMult = dmgMult;
  p.speed = PLAYER_BASE_SPEED * spdMult;
}

// Champs de temporisation (cooldowns/télégraphes) scalés par la vitesse d'attaque —
// une def par instance est clonée avec ces champs réduits plutôt que de toucher
// chaque minuteur individuellement dans updateEnemyAI.
var ATK_SPEED_TIMING_FIELDS = [
  'fireEvery', 'burstGap', 'shieldEvery', 'slamEvery', 'slamTelegraph',
  'chargeEvery', 'chargeTelegraph', 'telegraph', 'healEvery', 'boltEvery',
  'phaseEvery', 'laserEvery', 'volleyEvery', 'snipeEvery', 'snipeTelegraph',
  'mortarEvery', 'mortarTelegraph'
];

function scaleDefForAtkSpeed(def, atkSpdMult) {
  if (atkSpdMult === 1) return def;
  var scaled = {};
  for (var k in def) scaled[k] = def[k];
  ATK_SPEED_TIMING_FIELDS.forEach(function (f) { if (scaled[f] != null) scaled[f] = scaled[f] / atkSpdMult; });
  return scaled;
}

// De base (défi à 100%), les ennemis se déplacent et attaquent 20% moins vite — pousser
// les curseurs de défi au-delà de 100% est ce qui ramène (et dépasse) le rythme d'origine,
// pour que monter la difficulté soit toujours un choix clairement payant (voir goldDifficultyMult).
var ENEMY_BASE_SPD_MULT = 0.8;
var ENEMY_BASE_ATKSPD_MULT = 0.8;

// Le rayon de collision réel diffère légèrement du rayon de rendu selon la silhouette :
// un carré déborde de son cercle aux coins mais le déborde bien plus aux bords plats
// (rognés ici), un triangle se resserre vers la pointe, le corps rond est déjà dessiné
// en retrait (r*0.85) — tuner le multiplicateur par famille de forme rapproche le contact
// réel de ce que le joueur voit, sans réécrire toute la détection de collision en polygones.
var HIT_SHAPE_MULT = { square: 0.9, triangle: 0.85, circle: 0.88, boss: 0.92 };

function makeEnemy(def, x, y, mult) {
  mult = mult || {};
  var hpMult = (mult.hpPct != null ? mult.hpPct : 100) / 100;
  var dmgMult = (mult.dmgPct != null ? mult.dmgPct : 100) / 100;
  var spdMult = ENEMY_BASE_SPD_MULT * (mult.spdPct != null ? mult.spdPct : 100) / 100;
  var atkSpdMult = ENEMY_BASE_ATKSPD_MULT * (mult.atkSpdPct != null ? mult.atkSpdPct : 100) / 100;
  var sizeMult = (mult.sizePct != null ? mult.sizePct : 100) / 100;
  var hp = Math.max(1, Math.round(def.hp * hpMult));
  var scaledDef = scaleDefForAtkSpeed(def, atkSpdMult);
  return {
    kind: 'enemy',
    id: nextId(),
    def: scaledDef,
    shape: def.shape, tier: def.tier, name: def.name, behavior: def.behavior,
    x: x, y: y, r: def.r * sizeMult,
    hitR: def.r * sizeMult * (HIT_SHAPE_MULT[def.shape] || 0.9),
    hp: hp, maxHp: hp,
    speed: def.speed * spdMult, dmg: Math.round(def.dmg * dmgMult), color: def.color,
    baseSpeed: def.speed * spdMult, baseDmg: Math.round(def.dmg * dmgMult), fightTimer: 0, enrageMult: 1,
    vx: 0, vy: 0,
    atkCd: 0.6 + Math.random() * 0.6,
    stateTimer: 1 + Math.random() * 1.5,
    telegraphOn: false,
    shieldOn: false,
    invulnOn: false,
    latched: false,
    speedBuffTimer: 0, speedBuffMult: 1,
    animPhase: Math.random() * Math.PI * 2, // décale l'animation de respiration/pas de chaque ennemi
    chargeDirX: 0, chargeDirY: 0, charging: false,
    jitterX: 0, jitterY: 0,
    cellHistory: [], lastCellKey: null,
    hitFlash: 0, spawnTimer: 0.35,
    knockVX: 0, knockVY: 0,
    alive: true
  };
}

function makeProjectile(x, y, vx, vy, dmg, r, color) {
  return { kind: 'projectile', id: nextId(), x: x, y: y, vx: vx, vy: vy, dmg: dmg, r: r || 6, color: color || '#f2603f', life: 4 };
}

function makePendingBlast(x, y, radius, dmg, delay, color, hitsEnemies) {
  return { kind: 'blast', id: nextId(), x: x, y: y, radius: radius, dmg: dmg, delay: delay, maxDelay: delay, color: color || '#ff5a3c', done: false, hitsEnemies: !!hitsEnemies };
}

function makeLaser(x, y, angle, length, width, telegraphDur, fireDur, dmgPerSec, color, spinSpeed) {
  return {
    kind: 'laser', id: nextId(), x: x, y: y, angle: angle, length: length, width: width,
    telegraph: telegraphDur, telegraphMax: telegraphDur,
    fireTimer: fireDur, fireMax: fireDur,
    firing: false, dmgPerSec: dmgPerSec, color: color || '#ff5a3c', done: false,
    spinSpeed: spinSpeed || 0 // rad/s : balaie en tournant sur lui-même au lieu de rester fixe
  };
}

function makeParticle(x, y, vx, vy, life, color, size) {
  return { x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life, color: color, size: size || 3 };
}
