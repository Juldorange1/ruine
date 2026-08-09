// Table des 15 ennemis : 3 formes x 5 paliers. Chacun a un comportement de code
// distinct (aucun ne partage son switch-case avec un autre) : deux ennemis peuvent
// se ressembler dans leurs chiffres, jamais dans leur façon d'attaquer.
// power() est convexe (tier^1.6) : peu d'ennemis forts rapportent bien plus
// que beaucoup d'ennemis faibles, à effectif de danger comparable.

var TIER_COLORS = ['#8fe3a0', '#c9e35b', '#f2b84b', '#f2603f', '#b34bf2'];

var SHAPE_MULT = { square: 1.15, triangle: 1.05, circle: 1.0 };

// Rythme général du jeu : déplacements, projectiles, charges — tout est 35% plus rapide.
var GAME_SPEED_MULT = 1.35;
var SPEED_FIELD_NAMES = ['projSpeed', 'chargeSpeed', 'volleySpeed', 'boltSpeed', 'snipeSpeed'];

function enemyPower(shape, tier) {
  if (shape === 'boss') return (BOSS_DEFS[tier] || BOSS_DEFS[1]).power;
  return Math.round(8 * Math.pow(tier, 1.6) * SHAPE_MULT[shape]);
}

function buildEnemyDef(shape, tier, name, behavior, extra) {
  var hpBase = shape === 'square' ? 60 + tier * 40 : (shape === 'triangle' ? 20 + tier * 18 : 30 + tier * 22);
  var speedBase = shape === 'square' ? 66 + tier * 4 : (shape === 'triangle' ? 88 + tier * 2 : 118 + tier * 6);
  var dmgBase = shape === 'square' ? 12 + tier * 4 : (shape === 'triangle' ? 8 + tier * 5 : 6 + tier * 3);
  var radiusBase = shape === 'square' ? 15 + tier * 1.6 : (shape === 'triangle' ? 13 + tier * 1.3 : 12 + tier * 1.3);
  var def = {
    id: shape + tier,
    shape: shape,
    tier: tier,
    name: name,
    behavior: behavior,
    hp: Math.round(hpBase),
    speed: speedBase * GAME_SPEED_MULT,
    dmg: Math.round(dmgBase),
    r: radiusBase,
    color: TIER_COLORS[tier - 1],
    power: enemyPower(shape, tier)
  };
  for (var k in extra) def[k] = extra[k];
  SPEED_FIELD_NAMES.forEach(function (f) { if (def[f] != null) def[f] *= GAME_SPEED_MULT; });
  return def;
}

var ENEMY_DEFS = {};
[
  // Onde de choc périodique : punit le fait de rester collé à lui en mêlée (tourner
  // autour en l'attaquant sans jamais se faire toucher), sans quoi ce serait juste
  // "une boule qui marche vers vous".
  buildEnemyDef('square', 1, 'Bloc', 'tank_basic', { ringEvery: 2.6, ringTelegraph: 0.55, ringRadius: 100, ringDmgMult: 1.3 }),
  buildEnemyDef('square', 2, 'Bastion', 'tank_shield', { shieldEvery: 4.5, shieldDur: 1.5 }),
  buildEnemyDef('square', 3, 'Colosse', 'tank_knockback', { knockForce: 340 }),
  buildEnemyDef('square', 4, 'Golem', 'tank_slam', { slamEvery: 3.2, slamTelegraph: 0.8, slamRadius: 110 }),
  buildEnemyDef('square', 5, 'Titan', 'tank_charge', { chargeEvery: 3.6, chargeTelegraph: 0.6, chargeSpeed: 620, chargeDur: 0.5 }),

  buildEnemyDef('triangle', 1, 'Tireur', 'ranged_basic', { fireEvery: 1.7, projSpeed: 220, keepDist: 220 }),
  buildEnemyDef('triangle', 2, 'Arbalétrier', 'ranged_burst', { burstCount: 3, burstGap: 0.14, fireEvery: 2.3, projSpeed: 260, keepDist: 210 }),
  buildEnemyDef('triangle', 3, 'Sniper', 'ranged_snipe', { fireEvery: 2.6, telegraph: 0.9, projSpeed: 480, keepDist: 260 }),
  buildEnemyDef('triangle', 4, 'Mortier', 'ranged_mortar', { fireEvery: 2.4, telegraph: 0.9, blastRadius: 90, keepDist: 240 }),
  buildEnemyDef('triangle', 5, 'Oracle', 'ranged_volley_teleport', { fireEvery: 2.2, projSpeed: 260, keepDist: 250 }),

  // S'approche puis s'ancre pour balayer un lazer en rotation complète — punit le fait de
  // rester collé à lui pour l'attaquer (tourner autour ne suffit plus à esquiver).
  buildEnemyDef('circle', 1, 'Rôdeur', 'other_laser_sweep', {
    sweepRange: 260, sweepEvery: 3.6, sweepTelegraph: 0.55, sweepDur: 1.7,
    laserLength: 260, laserWidth: 16, laserDmgPerSec: 28
  }),
  buildEnemyDef('circle', 2, 'Sangsue', 'other_leech', { drainPerSec: 14 }),
  buildEnemyDef('circle', 3, 'Enflammé', 'other_explode', { blastRadius: 100, blastDmg: 34 }),
  buildEnemyDef('circle', 4, 'Chaman', 'other_buff', {
    healEvery: 3.0, healAmount: 18, healRadius: 160, boltEvery: 2.0, boltDmg: 10, boltSpeed: 200,
    buffSpdMult: 1.4, buffDur: 3.2
  }),
  buildEnemyDef('circle', 5, 'Spectre', 'other_phase', {
    phaseEvery: 3.4, phaseDur: 0.5, phaseDist: 150,
    laserEvery: 4.8, laserTelegraph: 0.7, laserFireDur: 0.3, laserDmgPerSec: 40, laserLength: 380, laserWidth: 22
  })
].forEach(function (d) { ENEMY_DEFS[d.id] = d; });

// 5 boss, chacun avec un kit composite distinct (aucun ne partage sa case de
// comportement). Placés via la palette Boss, un par "tier" (1 à 5).
var BOSS_DEFS = {};
[
  {
    tier: 1, name: 'Colossaure', behavior: 'boss_ultimate',
    hp: 750, speed: 92, dmg: 32, r: 46, color: '#ff2d55', power: 480,
    chargeEvery: 5.5, chargeTelegraph: 0.7, chargeSpeed: 560, chargeDur: 0.6,
    slamEvery: 6.5, slamTelegraph: 0.9, slamRadius: 150, slamDmg: 46,
    laserEvery: 7.5, laserTelegraph: 0.8, laserFireDur: 0.9, laserDmgPerSec: 60, laserLength: 900, laserWidth: 42,
    volleyEvery: 4.5, volleyCount: 24, volleyDmg: 14, volleySpeed: 230
  },
  {
    tier: 2, name: 'Gardien de Sable', behavior: 'boss_guardian',
    hp: 900, speed: 75, dmg: 38, r: 48, color: '#e3a13a', power: 500,
    knockForce: 380,
    shieldEvery: 5.0, shieldDur: 1.8,
    slamEvery: 5.5, slamTelegraph: 0.85, slamRadius: 160, slamDmg: 50
  },
  {
    tier: 3, name: 'Oracle Déchue', behavior: 'boss_oracle',
    hp: 620, speed: 100, dmg: 26, r: 42, color: '#b34bf2', power: 490,
    snipeEvery: 3.0, snipeTelegraph: 0.9, snipeSpeed: 520, snipeDmgMult: 1.8,
    mortarEvery: 3.6, mortarTelegraph: 0.9, mortarRadius: 100, mortarDmgMult: 1.6,
    phaseEvery: 6.0, phaseDist: 220, keepDist: 260
  },
  {
    tier: 4, name: 'Nécromant Ossuaire', behavior: 'boss_shaman',
    hp: 700, speed: 85, dmg: 20, r: 44, color: '#8fe3a0', power: 495,
    drainPerSec: 22,
    healEvery: 4.0, healAmount: 60,
    volleyEvery: 3.2, volleyCount: 20, volleyDmg: 12, volleySpeed: 210
  },
  {
    tier: 5, name: 'Spectre Ancien', behavior: 'boss_wraith',
    hp: 560, speed: 130, dmg: 24, r: 40, color: '#7db4ff', power: 485,
    phaseEvery: 2.6, phaseDur: 0.4, phaseDist: 200,
    laserEvery: 4.2, laserTelegraph: 0.6, laserFireDur: 0.5, laserDmgPerSec: 45, laserLength: 500, laserWidth: 26,
    jitterEvery: 0.3
  }
].forEach(function (d) {
  d.id = 'boss' + d.tier;
  d.shape = 'boss';
  d.speed *= GAME_SPEED_MULT;
  SPEED_FIELD_NAMES.forEach(function (f) { if (d[f] != null) d[f] *= GAME_SPEED_MULT; });
  BOSS_DEFS[d.tier] = d;
});

function getEnemyDef(shape, tier) {
  if (shape === 'boss') return BOSS_DEFS[tier] || BOSS_DEFS[1];
  return ENEMY_DEFS[shape + tier];
}
