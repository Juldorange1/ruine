// Dimensions logiques de l'arène + factories des entités de combat.

// Arène carrée, 20% plus grande que la version resserrée précédente (410 -> 492).
// Taille de base ; la taille réelle d'un run est tirée au hasard entre 125% et 160%
// de cette base (voir randomizeArenaSize, appelée une fois par run dans editor.js).
// Plancher relevé (était 100%-135%) : les formes de salle non rectangulaires (voir
// js/roomShapes.js) peuvent découper une bonne partie de la surface — sans ce
// plancher plus haut, une petite arène + une découpe généreuse (ex. croix, haltère)
// pouvait laisser une zone marchable trop exiguë.
var ARENA_BASE_SIZE = 492;
var ARENA_W = ARENA_BASE_SIZE;
var ARENA_H = ARENA_BASE_SIZE;
var CELL_SIZE = 55; // coïncide avec le quadrillage dessiné en fond d'arène

function randomizeArenaSize() {
  var size = Math.round(ARENA_BASE_SIZE * (1.25 + Math.random() * 0.35));
  ARENA_W = size;
  ARENA_H = size;
}

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
    // isDashing/dashTimer/dashDir*/dashStart* : état de la "charge" (arme type 1), nommé
    // dash pour des raisons historiques (l'arme dash a été retirée, la charge en reprend
    // le mécanisme + repousse aussi les pierres, voir tryPlayerCharge dans combat.js).
    isDashing: false, dashTimer: 0, dashDurMax: 0.286, dashSpeed: 900 * GAME_SPEED_MULT,
    dashDirX: 0, dashDirY: -1, dashStartX: 0, dashStartY: 0,
    invulnTimer: 0,
    vx: 0, vy: 0,
    // Armes tirées au hasard en début de run (dashCd/dashCdMax = cooldown de l'arme de
    // type 1 quelle qu'elle soit ; pulseCd/pulseCdMax = celui de l'arme de type 2).
    weapon1: 'sword', weapon2: 'pulse',
    w1Charging: false, w1ChargeTime: 0, w1AimX: 0, w1AimY: 0, chargeFrac: 1,
    boomerangCd: 0,
    w2Resource: 100, w2ResourceMax: 100,
    mimicWeapon: null, mimicActive: false,
    // Bonus de la relique de chapitre (voir tryPlayerCollectRelic dans combat.js) :
    // persistent jusqu'à la fin du chapitre, contrairement à dmgMult/speed qui sont
    // recalculés à chaque salle par applyWaveStatsToPlayer — remis à 1 à chaque
    // nouveau chapitre (voir spawnWave).
    chapterDmgBonusMult: 1, chapterSpeedBonusMult: 1,
    riftCd: 0
  };
}

// Appelé à chaque nouvelle vague : c'est la vague qui pilote les stats du personnage.
// Le bonus de relique de chapitre (chapterDmgBonusMult/chapterSpeedBonusMult) se
// compose par-dessus, sans quoi il serait écrasé au changement de salle suivant.
function applyWaveStatsToPlayer(p, waveStats) {
  var dmgMult = ((waveStats && waveStats.dmgPct != null) ? waveStats.dmgPct : 100) / 100;
  var spdMult = ((waveStats && waveStats.spdPct != null) ? waveStats.spdPct : 100) / 100;
  p.dmgMult = dmgMult * (p.chapterDmgBonusMult || 1);
  p.speed = PLAYER_BASE_SPEED * spdMult * (p.chapterSpeedBonusMult || 1);
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

// Ennemis nettement plus rapides ET plus agressifs — plus de dynamisme demandé
// explicitement (vitesse de déplacement ET fréquence d'attaque toutes deux relevées,
// alors qu'avant l'attaque restait volontairement plus lente que le reste).
var ENEMY_BASE_SPD_MULT = 1.4;
var ENEMY_BASE_ATKSPD_MULT = 1.25;

// Le rayon de collision réel diffère légèrement du rayon de rendu selon la silhouette :
// un carré déborde de son cercle aux coins mais le déborde bien plus aux bords plats
// (rognés ici), un triangle se resserre vers la pointe, le corps rond est déjà dessiné
// en retrait (r*0.85) — tuner le multiplicateur par famille de forme rapproche le contact
// réel de ce que le joueur voit, sans réécrire toute la détection de collision en polygones.
var HIT_SHAPE_MULT = { square: 0.9, triangle: 0.85, circle: 0.88, boss: 0.92 };

// Ennemis d'élite : 5% de chance à chaque création (hors boss) — plus PV et dégâts
// mais PLUS PETITS (élites plus denses/vicieux, pas de simples "gros ennemis" faciles
// à repérer et à contourner) : +20% PV/dégâts, -20% de taille. Reconnaissables via
// l'anneau doré (voir render.js/combat3d.js STATE_RING_COLORS.elite), pas via la taille.
var ELITE_CHANCE = 0.05;
var ELITE_STAT_MULT = 1.2;
var ELITE_SIZE_MULT = 0.8;

function makeEnemy(def, x, y, mult) {
  mult = mult || {};
  // mult.forceElite (booléen explicite) outrepasse le tirage aléatoire — utilisé par les
  // défis fixes (voir js/challenges.js) pour garantir un statut élite sans aléa ; les
  // salles normales ne passent jamais ce champ, donc le tirage à 5% reste inchangé.
  var isElite = mult.forceElite != null ? mult.forceElite : (def.shape !== 'boss' && Math.random() < ELITE_CHANCE);
  var eliteStatMult = isElite ? ELITE_STAT_MULT : 1;
  var eliteSizeMult = isElite ? ELITE_SIZE_MULT : 1;
  var hpMult = (mult.hpPct != null ? mult.hpPct : 100) / 100 * eliteStatMult;
  var dmgMult = (mult.dmgPct != null ? mult.dmgPct : 100) / 100 * eliteStatMult;
  var spdMult = ENEMY_BASE_SPD_MULT * (mult.spdPct != null ? mult.spdPct : 100) / 100;
  var atkSpdMult = ENEMY_BASE_ATKSPD_MULT * (mult.atkSpdPct != null ? mult.atkSpdPct : 100) / 100;
  var sizeMult = (mult.sizePct != null ? mult.sizePct : 100) / 100 * eliteSizeMult;
  var hp = Math.max(1, Math.round(def.hp * hpMult));
  var scaledDef = scaleDefForAtkSpeed(def, atkSpdMult);
  return {
    kind: 'enemy',
    id: nextId(),
    def: scaledDef,
    shape: def.shape, tier: def.tier, name: def.name, behavior: def.behavior,
    isElite: isElite,
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

// pierceBlocks : les projectiles de boss traversent les rochers (voir updateProjectiles)
// au lieu de s'y arrêter, pour rester une vraie menace même quand le joueur se met à couvert.
// fromPlayer : projectile appartenant au joueur (tourelle, onde de piques...) — vise les
// ennemis au lieu du joueur, voir la branche dédiée dans updateProjectiles.
function makeProjectile(x, y, vx, vy, dmg, r, color, pierceBlocks, fromPlayer) {
  return { kind: 'projectile', id: nextId(), x: x, y: y, vx: vx, vy: vy, dmg: dmg, r: r || 6, color: color || '#f2603f', life: 4, pierceBlocks: !!pierceBlocks, fromPlayer: !!fromPlayer };
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
