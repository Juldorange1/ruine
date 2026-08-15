// Modèle de la file de vagues + calcul de la difficulté / des points.
// Une vague est { enemies: [{shape, tier, x, y, ...}], playerStats: {dmgPct, spdPct} } —
// playerStats est appliqué automatiquement au personnage dès que la vague démarre.
// Une file (queue) est un tableau de vagues, jouées dans l'ordre.

// Le multiplicateur est composé (pas juste additif) : chaîner N vagues rapporte
// nettement plus que si chaque vague était affrontée seule, pour que l'enchaînement
// à haut risque soit toujours la stratégie la plus rentable en points.
var CHAIN_BONUS_PER_WAVE = 0.18;

// Accepte aussi l'ancien format (vague = simple tableau d'ennemis, sans playerStats),
// pour que les vagues/presets sauvegardés avant l'ajout des stats par vague restent jouables.
function waveEnemies(wave) {
  return wave.enemies || wave;
}

function waveDifficulty(wave, index) {
  var enemies = waveEnemies(wave);
  var sum = 0;
  for (var i = 0; i < enemies.length; i++) {
    var sp = enemies[i];
    var hpMult = (sp.hpPct != null ? sp.hpPct : 100) / 100;
    var dmgMult = (sp.dmgPct != null ? sp.dmgPct : 100) / 100;
    sum += enemyPower(sp.shape, sp.tier) * hpMult * dmgMult;
  }
  return sum * Math.pow(1 + CHAIN_BONUS_PER_WAVE, index);
}

function totalDifficulty(queue) {
  var total = 0;
  for (var i = 0; i < queue.length; i++) total += waveDifficulty(queue[i], i);
  return total;
}

function totalPoints(queue) {
  return Math.round(totalDifficulty(queue));
}

function waveEnemyCount(wave) {
  return waveEnemies(wave).length;
}

// ---------------- Mode Run (façon Hades) ----------------
// Un run = 4 chapitres, entièrement générés — aucune vague n'est créée à la main.
// Chaque chapitre enchaîne 5 salles aléatoires (parmi les 15 ennemis normaux) puis
// un boss (parmi les 5, tirés sans répétition sur les 4 chapitres). Pas de récompense
// entre les salles — que du combat.
var CHAPTERS_PER_RUN = 4;
var RANDOM_ROOMS_PER_CHAPTER = 5;
var ROOMS_PER_CHAPTER = RANDOM_ROOMS_PER_CHAPTER + 1; // + le boss
var RANDOM_SHAPES = ['square', 'triangle', 'circle'];

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Répartit les 15 combos forme×palier en 4 groupes disjoints (un par chapitre) : aucun
// type d'ennemi normal ne réapparaît jamais d'un chapitre à l'autre au sein d'un même run.
// Triés par palier moyen croissant pour garder une progression de difficulté cohérente
// malgré le tirage aléatoire.
function buildChapterRosters() {
  var combos = [];
  RANDOM_SHAPES.forEach(function (shape) { for (var t = 1; t <= 5; t++) combos.push({ shape: shape, tier: t }); });
  var shuffled = shuffleArray(combos);
  var groups = [];
  for (var g = 0; g < CHAPTERS_PER_RUN; g++) groups.push([]);
  shuffled.forEach(function (c, i) { groups[i % CHAPTERS_PER_RUN].push(c); });
  groups.sort(function (a, b) {
    var avg = function (grp) { return grp.reduce(function (s, c) { return s + c.tier; }, 0) / grp.length; };
    return avg(a) - avg(b);
  });
  return groups;
}

// Plus de dynamisme demandé explicitement : nettement plus d'ennemis par salle qu'avant
// (le compromis "moins d'ennemis mais plus costauds" de la version précédente est levé).
var ENEMY_COUNT_BASE_MULT = 2.4;

// Chaque ennemi reste un peu plus fort que la valeur de base (pas autant qu'avant : avec
// beaucoup plus de monde à l'écran, pas besoin de gonfler chacun à +100% pour que la
// salle reste un vrai défi).
var ROOM_ENEMY_STRENGTH_PCT = 140;

// Un soigneur (Chaman, circle tier 4) de trop dans une même salle rend le combat
// interminable plutôt que difficile — jamais plus de 6 simultanément.
var MAX_HEALERS_PER_ROOM = 6;

// Échelle adoucie (0.4 au lieu de 0.7) : moins d'écart de nombre d'ennemis entre le
// premier et le dernier chapitre.
function randomEnemyCountFor(chapter, roomInChapter) {
  return (2 + Math.floor((chapter - 1) * 0.4) + Math.floor(roomInChapter / 2)) * ENEMY_COUNT_BASE_MULT;
}

function isHealerCombo(combo) { return combo.shape === 'circle' && combo.tier === 4; }

// Les ennemis normaux infligent proportionnellement moins de dégâts à mesure que le run
// avance (surtout au chapitre 4) : l'écart de difficulté entre chapitres vient moins d'un
// déluge de dégâts ambiants, et le vrai point culminant du chapitre 4 est son boss (voir
// FINAL_BOSS_* plus bas), pas la moyenne des salles qui y mènent.
var CHAPTER_DMG_MULT = [1, 0.95, 0.85, 0.65];

// Le boss du dernier chapitre est le vrai point culminant du run : nettement plus grand,
// plus résistant et plus puissant que les autres, quel que soit celui tiré au hasard.
var FINAL_BOSS_SIZE_PCT = 165;
var FINAL_BOSS_HP_PCT = 170;
var FINAL_BOSS_DMG_PCT = 130;

var DEFAULT_DIFFICULTY_MODS = { enemyDmgPct: 100, enemyCountPct: 100, enemySpdPct: 100, enemyAtkSpdPct: 100 };

// Multiplicateur d'or de fin de run associé à un jeu de défis — composé (pas additif) sur
// les 4 curseurs, pour que monter la difficulté reste toujours largement la stratégie la
// plus payante. Utilisé à la fois pour l'affichage en direct (pré-run) et le calcul final
// (voir showResult dans game.js), afin que ce qui est montré corresponde exactement à ce qui
// est payé.
function goldDifficultyMult(mods) {
  mods = mods || DEFAULT_DIFFICULTY_MODS;
  return (mods.enemyDmgPct / 100) * (mods.enemyCountPct / 100) *
    (mods.enemySpdPct / 100) * (mods.enemyAtkSpdPct / 100);
}

function generateRandomWave(chapter, roomInChapter, mods, roster) {
  mods = mods || DEFAULT_DIFFICULTY_MODS;
  var chapterDmgMult = CHAPTER_DMG_MULT[Math.min(chapter, CHAPTER_DMG_MULT.length) - 1];
  var count = Math.max(1, Math.round(randomEnemyCountFor(chapter, roomInChapter) * mods.enemyCountPct / 100));
  var nonHealerRoster = roster.filter(function (c) { return !isHealerCombo(c); });
  var enemies = [];
  var healerCount = 0;
  for (var i = 0; i < count; i++) {
    var combo = roster[Math.floor(Math.random() * roster.length)];
    if (isHealerCombo(combo) && healerCount >= MAX_HEALERS_PER_ROOM) {
      combo = nonHealerRoster.length ? nonHealerRoster[Math.floor(Math.random() * nonHealerRoster.length)] : combo;
    }
    if (isHealerCombo(combo)) healerCount++;
    enemies.push({
      shape: combo.shape, tier: combo.tier,
      x: 50 + Math.random() * (ARENA_W - 100), y: 50 + Math.random() * (ARENA_H - 100),
      hpPct: ROOM_ENEMY_STRENGTH_PCT,
      dmgPct: mods.enemyDmgPct * chapterDmgMult * (ROOM_ENEMY_STRENGTH_PCT / 100),
      spdPct: mods.enemySpdPct, atkSpdPct: mods.enemyAtkSpdPct
    });
  }
  return { enemies: enemies, playerStats: { dmgPct: 100, spdPct: 100 } };
}

// Salle de boss façon "vrai jeu vidéo" : plus aucun ennemi classique ne vient distraire
// le combat, seul le duel avec le(s) boss compte. Le boss du dernier chapitre reçoit un
// bonus de taille/PV/dégâts pour être le vrai point culminant du run. Une salle sur trois
// tire un second boss (combat double) — chacun voit alors ses PV/dégâts réduits pour que
// l'affrontement reste juste plutôt que doubler brutalement la difficulté.
var DOUBLE_BOSS_CHANCE = 0.3;
var DOUBLE_BOSS_STAT_PCT = 68;

function generateBossWave(chapter, bossTier, mods, roster, extraBossTier) {
  mods = mods || DEFAULT_DIFFICULTY_MODS;
  var isFinalChapter = chapter === CHAPTERS_PER_RUN;
  var isDouble = extraBossTier != null;

  function makeBossEntry(tier, x, y) {
    var entry = {
      shape: 'boss', tier: tier, x: x, y: y,
      dmgPct: mods.enemyDmgPct, spdPct: mods.enemySpdPct, atkSpdPct: mods.enemyAtkSpdPct
    };
    if (isFinalChapter) {
      entry.hpPct = FINAL_BOSS_HP_PCT;
      entry.dmgPct = mods.enemyDmgPct * (FINAL_BOSS_DMG_PCT / 100);
      entry.sizePct = FINAL_BOSS_SIZE_PCT;
    }
    if (isDouble) {
      entry.hpPct = (entry.hpPct != null ? entry.hpPct : 100) * (DOUBLE_BOSS_STAT_PCT / 100);
      entry.dmgPct = entry.dmgPct * (DOUBLE_BOSS_STAT_PCT / 100);
    }
    return entry;
  }

  var bossSpawnY = ARENA_H * 0.35;
  var enemies = isDouble
    ? [makeBossEntry(bossTier, ARENA_W * 0.32, bossSpawnY), makeBossEntry(extraBossTier, ARENA_W * 0.68, bossSpawnY)]
    : [makeBossEntry(bossTier, ARENA_W / 2, bossSpawnY)];
  return { enemies: enemies, playerStats: { dmgPct: 100, spdPct: 100 }, isBossRoom: true };
}

// Génère le run complet : 4 chapitres, chacun 5 salles aléatoires puis un boss.
// Les 4 boss sont tirés sans répétition parmi les 5 existants.
function buildRunQueue(mods) {
  mods = mods || DEFAULT_DIFFICULTY_MODS;
  var bossTiers = shuffleArray([1, 2, 3, 4, 5]).slice(0, CHAPTERS_PER_RUN);
  var rosters = buildChapterRosters();
  var queue = [];
  for (var chapter = 1; chapter <= CHAPTERS_PER_RUN; chapter++) {
    var roster = rosters[chapter - 1];
    for (var room = 1; room <= RANDOM_ROOMS_PER_CHAPTER; room++) queue.push(generateRandomWave(chapter, room, mods, roster));
    var mainBossTier = bossTiers[chapter - 1];
    var extraBossTier = null;
    if (Math.random() < DOUBLE_BOSS_CHANCE) {
      var pool = [1, 2, 3, 4, 5].filter(function (t) { return t !== mainBossTier; });
      extraBossTier = pool[Math.floor(Math.random() * pool.length)];
    }
    queue.push(generateBossWave(chapter, mainBossTier, mods, roster, extraBossTier));
  }
  return queue;
}

// ---------------- Terrain par chapitre ----------------
// Régénéré à chaque nouveau chapitre (voir applyZonesToArena/spawnWave dans combat.js) :
// cailloux (obstacles) + points de grappin, jamais deux fois le même décor au sein d'un
// même chapitre. Comptes réduits en cohérence avec la surface d'arène plus petite (sinon
// le terrain deviendrait proportionnellement bien plus encombré qu'avant).
var CHAPTER_TERRAIN_AVOID_RADIUS = 120;

// ---------------- Identité par chapitre ----------------
// Les 4 chapitres ont chacun une vraie spécialité (pas juste une palette de couleurs,
// voir CHAPTER_THEMES dans render.js qui partage le même index) : un piège dominant, une
// relique à ramasser qui change le gameplay pour le reste du chapitre, et pour le dernier
// chapitre, l'absence totale de grappin — remplacé par des failles de l'Abîme (téléportation
// par paires, sans viser). L'index (0-3) est le même que celui utilisé pour CHAPTER_THEMES.
var CHAPTER_IDENTITIES = [
  { key: 'sables', name: 'Sables', relic: 'dmg', hasGrapple: true, rockRange: [5, 7], grappleMax: 3 },
  { key: 'marecage', name: 'Marécage', relic: 'heal', hasGrapple: true, rockRange: [5, 7], grappleMax: 3 },
  { key: 'braise', name: 'Braise', relic: 'speed', hasGrapple: true, rockRange: [6, 8], grappleMax: 2 },
  { key: 'abime', name: 'Abîme', relic: 'invincible', hasGrapple: false, rockRange: [7, 9], grappleMax: 0 }
];
function chapterIdentityFor(chapterIdx) { return CHAPTER_IDENTITIES[chapterIdx % CHAPTER_IDENTITIES.length]; }

// Effets des reliques (voir tryPlayerCollectRelic dans combat.js) — dmg/speed durent
// jusqu'à la fin du chapitre (chapterDmgBonusMult/chapterSpeedBonusMult), heal est un
// soin immédiat, invincible une brève invulnérabilité immédiate.
var RELIC_DMG_BONUS_MULT = 1.25;
var RELIC_SPEED_BONUS_MULT = 1.2;
var RELIC_HEAL_AMOUNT = 40;
var RELIC_INVINCIBLE_DUR = 3.0;

function randomTerrainPos(margin) {
  return [margin + Math.random() * (ARENA_W - margin * 2), margin + Math.random() * (ARENA_H - margin * 2)];
}

// Évite de faire apparaître un obstacle collé à la position actuelle du joueur
// (sinon le nouveau chapitre pourrait le coincer sous un caillou dès son démarrage).
// roomShape (optionnel, voir js/roomShapes.js) : si fourni, rejette aussi les
// positions hors de la zone marchable de la salle (sinon retombe sur l'ancien
// tirage purement rectangulaire).
function pickTerrainPos(margin, avoidX, avoidY, roomShape) {
  for (var attempt = 0; attempt < 20; attempt++) {
    var pos = randomTerrainPos(margin);
    if (roomShape && !pointInRoomShape(roomShape, pos[0], pos[1], 0)) continue;
    if (avoidX == null || Math.hypot(pos[0] - avoidX, pos[1] - avoidY) > CHAPTER_TERRAIN_AVOID_RADIUS) return pos;
  }
  return randomTerrainPos(margin);
}

function generateChapterTerrain(avoidX, avoidY, chapterIdx, roomShape) {
  var id = chapterIdentityFor(chapterIdx || 0);
  var zones = [];
  var rockCount = id.rockRange[0] + Math.floor(Math.random() * (id.rockRange[1] - id.rockRange[0] + 1));
  for (var i = 0; i < rockCount; i++) {
    var pos = pickTerrainPos(70, avoidX, avoidY, roomShape);
    zones.push({ kind: 'wall', x: pos[0], y: pos[1], r: 26 + Math.random() * 22 });
  }

  if (id.hasGrapple) {
    // Toujours au moins 1 grappin disponible dans les chapitres qui en ont.
    var grappleCount = 1 + Math.floor(Math.random() * id.grappleMax);
    for (var g = 0; g < grappleCount; g++) {
      var gp = pickTerrainPos(90, avoidX, avoidY, roomShape);
      zones.push({ kind: 'grapple', x: gp[0], y: gp[1], r: 34 });
    }
  } else {
    // Abîme : pas de grappin — 2 paires de failles à la place (4 au total), qui
    // téléportent vers leur jumelle au contact, sans viser. Le grappin (touche dédiée)
    // devient un no-op ce chapitre-là : la mobilité passe entièrement par les failles.
    for (var pair = 0; pair < 2; pair++) {
      var pairId = 'rift' + pair;
      var p1 = pickTerrainPos(90, avoidX, avoidY, roomShape);
      var p2 = pickTerrainPos(90, avoidX, avoidY, roomShape);
      zones.push({ kind: 'abyss_rift', x: p1[0], y: p1[1], r: 30, pairId: pairId, cd: 0 });
      zones.push({ kind: 'abyss_rift', x: p2[0], y: p2[1], r: 30, pairId: pairId, cd: 0 });
    }
  }

  // Pas systématique : certains chapitres ont en plus des zones de boost de vitesse,
  // de petit soin ou de ralentissement — chacune profite à qui s'y trouve, joueur comme
  // ennemi, ce qui en fait un vrai enjeu tactique plutôt qu'un simple bonus gratuit.
  // Les probabilités varient par chapitre (Braise est hostile — peu de soin/vitesse ;
  // Marécage privilégie le ralentissement, cohérent avec la boue).
  var speedChance = id.key === 'braise' ? 0.25 : (id.key === 'marecage' ? 0.3 : 0.6);
  var healChance = id.key === 'braise' ? 0.25 : (id.key === 'abime' ? 0.2 : 0.45);
  var slowChance = id.key === 'marecage' ? 1 : (id.key === 'braise' ? 0.2 : 0.35);
  if (Math.random() < speedChance) {
    var speedCount = 1 + Math.floor(Math.random() * 2);
    for (var s = 0; s < speedCount; s++) {
      var sp = pickTerrainPos(90, avoidX, avoidY, roomShape);
      zones.push({ kind: 'speed', x: sp[0], y: sp[1], r: 45 });
    }
  }
  if (Math.random() < healChance) {
    var hp = pickTerrainPos(90, avoidX, avoidY, roomShape);
    zones.push({ kind: 'heal', x: hp[0], y: hp[1], r: 40 });
  }
  if (Math.random() < slowChance) {
    var slowCount = id.key === 'marecage' ? (2 + Math.floor(Math.random() * 2)) : 1;
    for (var sl = 0; sl < slowCount; sl++) {
      var slp = pickTerrainPos(90, avoidX, avoidY, roomShape);
      zones.push({ kind: 'slow', x: slp[0], y: slp[1], r: 45 });
    }
  }

  // Braise : braises au sol (dégâts continus) comme piège dominant, exclusif à ce
  // chapitre — le sol lui-même devient hostile, pas juste des mécanismes ponctuels.
  if (id.key === 'braise') {
    var flameCount = 2 + Math.floor(Math.random() * 2);
    for (var fl = 0; fl < flameCount; fl++) {
      var flp = pickTerrainPos(80, avoidX, avoidY, roomShape);
      zones.push({ kind: 'flame', x: flp[0], y: flp[1], r: 38 });
    }
  }

  // Pièges : de vrais éléments d'environnement (pas de zone magique), avec leur propre
  // état d'animation (phaseOffset pour les piques, cd/télégraphe pour les flèches).
  // Chaque chapitre a un piège dominant (garanti) et l'autre en secondaire (aléatoire) —
  // sauf l'Abîme, chaotique, qui garantit les deux.
  var spikeChance = id.key === 'marecage' ? 1 : (id.key === 'abime' ? 1 : 0.25);
  var arrowChance = id.key === 'sables' ? 1 : (id.key === 'abime' ? 1 : 0.2);
  if (Math.random() < spikeChance) {
    var spikeCount = 1 + Math.floor(Math.random() * 2);
    for (var sk = 0; sk < spikeCount; sk++) {
      var skp = pickTerrainPos(80, avoidX, avoidY, roomShape);
      zones.push({ kind: 'trap_spike', x: skp[0], y: skp[1], r: 32, phaseOffset: Math.random() * 3 });
    }
  }
  if (Math.random() < arrowChance) {
    var arrowCount = 1 + Math.floor(Math.random() * 2);
    for (var ar = 0; ar < arrowCount; ar++) {
      var arp = pickTerrainPos(80, avoidX, avoidY, roomShape);
      zones.push({ kind: 'trap_arrow', x: arp[0], y: arp[1], r: 16, cd: 0.8 + Math.random() * 1.4, telegraphOn: false, telegraphTimer: 0 });
    }
  }

  // Relique du chapitre : un seul exemplaire, ramassable une fois (voir
  // tryPlayerCollectRelic dans combat.js), change concrètement le gameplay pour le
  // reste du chapitre plutôt qu'un simple bonus cosmétique.
  var rp = pickTerrainPos(90, avoidX, avoidY, roomShape);
  zones.push({ kind: 'chapter_relic', x: rp[0], y: rp[1], r: 26, effect: id.relic, consumed: false });

  // Matérialise la zone non-marchable de la forme de salle (voir js/roomShapes.js) en
  // rochers — obstacle physique ET décor de gravats/ruine.
  zones = zones.concat(carveZonesForRoomShape(roomShape));

  return zones;
}

// Décrit une position dans le run pour l'affichage (HUD, transition de salle). Le nom
// de l'identité du chapitre est affiché en clair — la différence entre chapitres doit
// se voir jusque dans le HUD, pas juste dans le décor.
function describeWaveIndex(waveIndex) {
  var chapter = Math.floor(waveIndex / ROOMS_PER_CHAPTER) + 1;
  var chapterName = chapterIdentityFor(chapter - 1).name;
  var posInChapter = waveIndex % ROOMS_PER_CHAPTER;
  if (posInChapter === RANDOM_ROOMS_PER_CHAPTER) return 'Chapitre ' + chapter + ' — ' + chapterName + ' — Boss';
  return 'Chapitre ' + chapter + ' — ' + chapterName + ' — Salle ' + (posInChapter + 1) + '/' + RANDOM_ROOMS_PER_CHAPTER;
}
