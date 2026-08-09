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

// x3 de base : "toutes les salles doivent être plus dures".
var ENEMY_COUNT_BASE_MULT = 3;

// Échelle adoucie (0.4 au lieu de 0.7) : moins d'écart de nombre d'ennemis entre le
// premier et le dernier chapitre.
function randomEnemyCountFor(chapter, roomInChapter) {
  return (2 + Math.floor((chapter - 1) * 0.4) + Math.floor(roomInChapter / 2)) * ENEMY_COUNT_BASE_MULT;
}

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
  var enemies = [];
  for (var i = 0; i < count; i++) {
    var combo = roster[Math.floor(Math.random() * roster.length)];
    enemies.push({
      shape: combo.shape, tier: combo.tier,
      x: 50 + Math.random() * (ARENA_W - 100), y: 50 + Math.random() * (ARENA_H - 100),
      dmgPct: mods.enemyDmgPct * chapterDmgMult, spdPct: mods.enemySpdPct, atkSpdPct: mods.enemyAtkSpdPct
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

  var enemies = isDouble
    ? [makeBossEntry(bossTier, ARENA_W * 0.32, 140), makeBossEntry(extraBossTier, ARENA_W * 0.68, 140)]
    : [makeBossEntry(bossTier, ARENA_W / 2, 140)];
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
// beaucoup de cailloux (obstacles) + 0 à 3 points de grappin, jamais deux fois le même décor.
// Comptes réduits en cohérence avec la surface d'arène plus petite (sinon le terrain
// deviendrait proportionnellement bien plus encombré qu'avant).
var CHAPTER_ROCK_COUNT_MIN = 7;
var CHAPTER_ROCK_COUNT_MAX = 11;
var CHAPTER_GRAPPLE_COUNT_MAX = 3;
var CHAPTER_TERRAIN_AVOID_RADIUS = 120;

function randomTerrainPos(margin) {
  return [margin + Math.random() * (ARENA_W - margin * 2), margin + Math.random() * (ARENA_H - margin * 2)];
}

// Évite de faire apparaître un obstacle collé à la position actuelle du joueur
// (sinon le nouveau chapitre pourrait le coincer sous un caillou dès son démarrage).
function pickTerrainPos(margin, avoidX, avoidY) {
  for (var attempt = 0; attempt < 12; attempt++) {
    var pos = randomTerrainPos(margin);
    if (avoidX == null || Math.hypot(pos[0] - avoidX, pos[1] - avoidY) > CHAPTER_TERRAIN_AVOID_RADIUS) return pos;
  }
  return randomTerrainPos(margin);
}

function generateChapterTerrain(avoidX, avoidY) {
  var zones = [];
  var rockCount = CHAPTER_ROCK_COUNT_MIN + Math.floor(Math.random() * (CHAPTER_ROCK_COUNT_MAX - CHAPTER_ROCK_COUNT_MIN + 1));
  for (var i = 0; i < rockCount; i++) {
    var pos = pickTerrainPos(70, avoidX, avoidY);
    zones.push({ kind: 'wall', x: pos[0], y: pos[1], r: 26 + Math.random() * 22 });
  }
  // Toujours au moins 1 grappin disponible — jamais un chapitre sans aucun moyen de se téléporter.
  var grappleCount = 1 + Math.floor(Math.random() * CHAPTER_GRAPPLE_COUNT_MAX);
  for (var g = 0; g < grappleCount; g++) {
    var gp = pickTerrainPos(90, avoidX, avoidY);
    zones.push({ kind: 'grapple', x: gp[0], y: gp[1], r: 34 });
  }

  // Pas systématique : certains chapitres ont en plus des zones de boost de vitesse,
  // de petit soin ou de ralentissement — chacune profite à qui s'y trouve, joueur comme
  // ennemi, ce qui en fait un vrai enjeu tactique plutôt qu'un simple bonus gratuit.
  if (Math.random() < 0.6) {
    var speedCount = 1 + Math.floor(Math.random() * 2);
    for (var s = 0; s < speedCount; s++) {
      var sp = pickTerrainPos(90, avoidX, avoidY);
      zones.push({ kind: 'speed', x: sp[0], y: sp[1], r: 45 });
    }
  }
  if (Math.random() < 0.45) {
    var hp = pickTerrainPos(90, avoidX, avoidY);
    zones.push({ kind: 'heal', x: hp[0], y: hp[1], r: 40 });
  }
  if (Math.random() < 0.35) {
    var slp = pickTerrainPos(90, avoidX, avoidY);
    zones.push({ kind: 'slow', x: slp[0], y: slp[1], r: 45 });
  }

  // Pièges : de vrais éléments d'environnement (pas de zone magique), avec leur propre
  // état d'animation (phaseOffset pour les piques, cd/télégraphe pour les flèches).
  if (Math.random() < 0.4) {
    var spikeCount = 1 + Math.floor(Math.random() * 2);
    for (var sk = 0; sk < spikeCount; sk++) {
      var skp = pickTerrainPos(80, avoidX, avoidY);
      zones.push({ kind: 'trap_spike', x: skp[0], y: skp[1], r: 32, phaseOffset: Math.random() * 3 });
    }
  }
  if (Math.random() < 0.35) {
    var arrowCount = 1 + Math.floor(Math.random() * 2);
    for (var ar = 0; ar < arrowCount; ar++) {
      var arp = pickTerrainPos(80, avoidX, avoidY);
      zones.push({ kind: 'trap_arrow', x: arp[0], y: arp[1], r: 16, cd: 0.8 + Math.random() * 1.4, telegraphOn: false, telegraphTimer: 0 });
    }
  }
  return zones;
}

// Décrit une position dans le run pour l'affichage (HUD, transition de salle).
function describeWaveIndex(waveIndex) {
  var chapter = Math.floor(waveIndex / ROOMS_PER_CHAPTER) + 1;
  var posInChapter = waveIndex % ROOMS_PER_CHAPTER;
  if (posInChapter === RANDOM_ROOMS_PER_CHAPTER) return 'Chapitre ' + chapter + ' — Boss';
  return 'Chapitre ' + chapter + ' — Salle ' + (posInChapter + 1) + '/' + RANDOM_ROOMS_PER_CHAPTER;
}
