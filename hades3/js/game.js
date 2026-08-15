// Bootstrap, machine à états de vue, input clavier/souris (configurables), boucle principale.

var VIEW = 'menu';
var KEYS = {};
var MOUSE_DOWN = {};
var mouseClientX = 0, mouseClientY = 0;
var lastTime = 0;

var FACING_SPECIAL_RANGE = 85;

function isDown(code) { return !!KEYS[code]; }

function isActionHeld(action) {
  var b = KEYBINDS[action];
  return b.indexOf('Mouse') === 0 ? !!MOUSE_DOWN[parseInt(b.slice(5), 10)] : isDown(b);
}

function computeMoveVector() {
  var dx = 0, dy = 0;
  if (isDown(KEYBINDS.up)) dy -= 1;
  if (isDown(KEYBINDS.down)) dy += 1;
  if (isDown(KEYBINDS.left)) dx -= 1;
  if (isDown(KEYBINDS.right)) dx += 1;
  if (dx || dy) { var n = norm(dx, dy); return [n[0], n[1]]; }
  return [0, 0];
}

function facingAimPoint(range) {
  var p = CB.player;
  var fx = p.facingX || 0, fy = p.facingY || -1;
  var n = (fx || fy) ? norm(fx, fy) : [0, -1, 1];
  return [p.x + n[0] * range, p.y + n[1] * range];
}

function triggerAction(action, aimPoint) {
  if (!CB || CB.ended) return;
  if (action === 'pause') { CB.paused = !CB.paused; syncPauseButtonLabel(); return; }
  if (CB.paused) return;
  if (action === 'special') { var pt2 = aimPoint || facingAimPoint(FACING_SPECIAL_RANGE); tryPlayerGrapple(pt2[0], pt2[1]); }
}

function syncPauseButtonLabel() {
  var btn = document.getElementById('pauseCombatBtn');
  if (btn) btn.textContent = (CB && CB.paused) ? '▶ Reprendre' : '⏸ Pause';
  // Point de passage unique de tout changement de CB.paused (bouton pause, ouverture des
  // réglages en combat, alt-tab/changement d'onglet) : coupe la musique d'ambiance tant
  // que le jeu est en pause plutôt que de la laisser jouer derrière un écran figé, ce qui
  // se lit comme "du bruit alors que le jeu ne tourne pas vraiment".
  if (CB) { if (CB.paused) AudioEngine.pauseMusic(); else AudioEngine.resumeMusic(); }
}

function applyWeaponHUDLabels() {
  var w1 = WEAPON1_INFO[CB.player.weapon1];
  var w2 = WEAPON2_INFO[CB.player.weapon2];
  var el1 = document.getElementById('abilityDash');
  var el2 = document.getElementById('abilityPulse');
  el1.querySelector('.ability-name').textContent = weaponLabel(CB.player.weapon1);
  el1.title = w1.desc;
  el2.querySelector('.ability-name').textContent = weaponLabel(CB.player.weapon2);
  el2.title = w2.desc;
}

function combat3DAvailable() { return !!(window.Combat3D && window.Combat3D.available); }

function resizeCombatCanvas() {
  var canvas = document.getElementById('combatCanvas');
  var canvas3D = document.getElementById('combatCanvas3D');
  var use3D = combat3DAvailable();
  canvas.style.display = use3D ? 'none' : 'block';
  canvas3D.style.display = use3D ? 'block' : 'none';
  if (use3D) {
    window.Combat3D.resize();
    mouseClientX = canvas3D.clientWidth / 2;
    mouseClientY = canvas3D.clientHeight / 2;
  } else {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    mouseClientX = canvas.width / 2;
    mouseClientY = canvas.height / 2;
  }
}

// ---------------- Hub explorable (menu principal) ----------------
// Une petite scène qu'on traverse à pied plutôt qu'un empilement de boutons : un portail
// (lance un run), et trois PNJ (armes, réglages, statistiques). Distances volontairement
// courtes — voir HUB_W/HUB_H — pour qu'aller d'un point à l'autre reste immédiat.
var HUB_W = 640, HUB_H = 890;
var HUB = null;
var HUB_INTERACT_MARGIN = 10;

function resizeHubCanvas() {
  var canvas = document.getElementById('hubCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function initHub() {
  HUB = {
    player: makePlayer(HUB_W * 0.5, HUB_H * 0.82),
    points: [
      { id: 'portal', kind: 'portal', x: HUB_W * 0.32, y: HUB_H * 0.16, r: 34, label: 'Lancer un run' },
      { id: 'challenges', kind: 'portal', x: HUB_W * 0.68, y: HUB_H * 0.16, r: 34, label: 'Défis' },
      { id: 'weapons', kind: 'door', x: HUB_W * 0.2, y: HUB_H * 0.5, r: 22, label: "Entrer dans l'armurerie" },
      { id: 'settings', kind: 'npc', x: HUB_W * 0.8, y: HUB_H * 0.5, r: 22, label: 'Ouvrir les réglages' },
      { id: 'stats', kind: 'npc', x: HUB_W * 0.5, y: HUB_H * 0.62, r: 22, label: 'Voir les statistiques' }
    ],
    nearPoint: null,
    prevInteractHeld: false
  };
}

function hubTriggerPoint(id) {
  if (id === 'portal') { showPrerunView(); return; }
  if (id === 'challenges') { showChallengesView(); return; }
  if (id === 'weapons') { enterArmory(); return; }
  if (id === 'settings') { openSettings(); return; }
  if (id === 'stats') { openHubStatsDialog(); return; }
}

// Le PNJ statistiques ouvre une bulle de dialogue fermable au lieu d'afficher les
// chiffres en permanence dès qu'on s'approche — cohérent avec les 3 autres points
// d'intérêt, qui exigent tous un appui sur E plutôt qu'une simple proximité.
function openHubStatsDialog() {
  updateMenuStats();
  document.getElementById('hubStatsDialog').hidden = false;
}
function closeHubStatsDialog() {
  document.getElementById('hubStatsDialog').hidden = true;
}

function updateHub(dt, moveX, moveY) {
  var p = HUB.player;
  if (moveX || moveY) { p.facingX = moveX; p.facingY = moveY; }
  p.vx = moveX * p.speed; p.vy = moveY * p.speed;
  p.x = clamp(p.x + p.vx * dt, p.r, HUB_W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, HUB_H - p.r);

  var near = null;
  for (var i = 0; i < HUB.points.length; i++) {
    var pt = HUB.points[i];
    if (dist(p.x, p.y, pt.x, pt.y) <= p.r + pt.r + HUB_INTERACT_MARGIN) { near = pt; break; }
  }
  HUB.nearPoint = near;

  var promptEl = document.getElementById('hubPrompt');
  if (near) { promptEl.hidden = false; promptEl.textContent = 'Touche E — ' + near.label; }
  else promptEl.hidden = true;

  var interactHeld = isDown('KeyE');
  if (interactHeld && !HUB.prevInteractHeld && near) hubTriggerPoint(near.id);
  HUB.prevInteractHeld = interactHeld;
}

function goToCombat(config) {
  closeSettings();
  document.getElementById('menuView').hidden = true;
  document.getElementById('prerunView').hidden = true;
  document.getElementById('challengesView').hidden = true;
  document.getElementById('combatView').hidden = false;
  document.getElementById('resultModal').hidden = true;
  VIEW = 'combat';
  document.getElementById('armoryExitBtn').hidden = true;
  resizeCombatCanvas();
  initCombat(config);
  applyWeaponHUDLabels();
  syncPauseButtonLabel();
  // La musique ne joue que pendant une vraie session (run/armurerie/défi) — jamais au
  // menu/hub. Le thème exact (chapitre) est corrigé juste après par spawnWave/
  // enterArmory/startChallenge via AudioEngine.setMusicTheme.
  AudioEngine.startMusic(0);
}

// ---------------- Armurerie (test d'armes en 3D, voir le portail "Voir les armes") ----------------
// Une vraie salle de combat (mêmes moteurs de jeu/rendu que le reste), mais sans aucun
// ennemi hostile : des mannequins d'entraînement (PV énormes, dégâts nuls) et des
// présentoirs le long des murs — s'approcher et appuyer sur E équipe l'arme dans le bon
// emplacement (type 1/2) et ouvre le panneau de description/biais (editor.js).
var ARMORY_ARENA_SIZE = 480;
var ARMORY_PEDESTAL_R = 20;

function buildArmoryPedestalRow(ids, x) {
  var top = 55, bottom = ARMORY_ARENA_SIZE - 55;
  return ids.map(function (id, i) {
    var y = ids.length > 1 ? top + (bottom - top) * (i / (ids.length - 1)) : (top + bottom) / 2;
    return { id: id, type: WEAPON1_INFO[id] ? 1 : 2, x: x, y: y, r: ARMORY_PEDESTAL_R };
  });
}

function buildArmoryDummies() {
  // Un seul personnage immobile (pas des ennemis) planté au centre de la salle — voir
  // isArmoryDummy plus bas, qui pilote son rendu (mannequin, pas une créature) et son
  // IA (aucune, updateEnemyAI). PV énormes/dégâts nuls : ne meurt jamais, ne blesse jamais.
  var c = ARMORY_ARENA_SIZE / 2;
  return [{ shape: 'square', tier: 1, x: c, y: c - 40, hpPct: 100000, dmgPct: 0, sizePct: 130 }];
}

function enterArmory() {
  ARENA_W = ARMORY_ARENA_SIZE;
  ARENA_H = ARMORY_ARENA_SIZE;
  var lastW1 = (CB && CB.player && CB.player.weapon1) || 'sword';
  var lastW2 = (CB && CB.player && CB.player.weapon2) || 'pulse';
  goToCombat({
    queue: [{ enemies: buildArmoryDummies(), playerStats: { dmgPct: 100, spdPct: 100 } }],
    playerConfig: { spawnX: ARMORY_ARENA_SIZE / 2, spawnY: ARMORY_ARENA_SIZE - 70 },
    weapons: { weapon1: lastW1, weapon2: lastW2 }
  });
  applyZonesToArena([]); // salle vide, sans le décor aléatoire généré par défaut à la salle 0
  CB.roomShape = makeRectangleRoomShape(ARENA_W, ARENA_H); // jamais de forme exotique en armurerie
  CB.isArmory = true;
  CB.forcedChapterTheme = 0;
  AudioEngine.setMusicTheme(0);
  AudioEngine.setMusicRoom(0, 0); // armurerie = test d'armes tranquille, jamais de tension
  if (CB.enemies[0]) CB.enemies[0].isArmoryDummy = true;
  CB.armoryPedestals = buildArmoryPedestalRow(WEAPON1_IDS, 45).concat(buildArmoryPedestalRow(WEAPON2_IDS, ARMORY_ARENA_SIZE - 45));
  closeArmoryPanel();
  document.getElementById('armoryExitBtn').hidden = false;
}

function exitArmory() {
  closeArmoryPanel();
  CB = null;
  document.getElementById('combatView').hidden = true;
  VIEW = 'menu';
  AudioEngine.stopMusic();
  showMenuView();
}

function backToMenu() {
  closeSettings();
  document.getElementById('combatView').hidden = true;
  document.getElementById('prerunView').hidden = true;
  document.getElementById('weaponRevealView').hidden = true;
  document.getElementById('resultModal').hidden = true;
  VIEW = 'menu';
  AudioEngine.stopMusic();
  showMenuView();
}

function formatTime(seconds) {
  var m = Math.floor(seconds / 60);
  var s = (seconds - m * 60).toFixed(1);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function showResult() {
  CB.resultShown = true;
  var title = document.getElementById('resultTitle');
  var text = document.getElementById('resultText');
  var statsEl = document.getElementById('resultStats');
  // PV infinis : plus de défaite possible, seul l'objectif "moins de dégâts subis" compte
  // en plus du score. Nombre brut, indépendant de tout pool de PV configurable.
  var totalDmgTaken = Math.round(CB.totalDamageTaken);
  var improvedTime = saveBestTimeIfBetter(CB.elapsed);
  var improvedHp = saveLeastHpLostIfBetter(totalDmgTaken);
  var runsCompleted = incrementRunsCompleted();

  // L'or n'a aucune utilité : c'est juste un indicateur de performance — moins de dégâts
  // subis rapporte plus, mais même une run difficile garde un plancher (GOLD_MIN_FRACTION)
  // au lieu de pouvoir tomber à zéro. Les défis pré-run augmentent le potentiel d'or gagnable.
  var mods = CB.difficultyMods || DEFAULT_DIFFICULTY_MODS;
  var difficultyMult = goldDifficultyMult(mods);
  var GOLD_BASE = 150;
  var GOLD_EXPECTED_DAMAGE_BASE = 700;
  var GOLD_MIN_FRACTION = 0.15;
  var expectedDamage = GOLD_EXPECTED_DAMAGE_BASE * Math.sqrt(difficultyMult);
  var performance = Math.max(0, Math.min(1, 1 - totalDmgTaken / expectedDamage));
  var goldMult = GOLD_MIN_FRACTION + (1 - GOLD_MIN_FRACTION) * performance;
  var goldEarned = Math.round(GOLD_BASE * difficultyMult * goldMult);
  var goldTotal = addGold(goldEarned);
  var improvedGoldRun = saveBestGoldRunIfBetter(goldEarned);
  saveBestGoldRunByWeaponIfBetter(CB.player.weapon1, goldEarned);

  statsEl.innerHTML =
    '<span>Runs complétés : <b>' + runsCompleted + '</b></span>' +
    '<span>Temps du run : <b>' + formatTime(CB.elapsed) + '</b></span>' +
    '<span>Ennemis éliminés : <b>' + CB.killCount + '</b></span>' +
    '<span>Dégâts infligés : <b>' + Math.round(CB.damageDealt) + '</b></span>' +
    '<span>Dégâts subis : <b>' + totalDmgTaken + '</b>' + (improvedHp ? ' — record !' : '') + '</span>' +
    '<span>🪙 Or gagné : <b>' + goldEarned + '</b> (total : ' + goldTotal + ')' + (improvedGoldRun ? ' — record !' : '') + '</span>' +
    '<span class="gold-detail">Calcul : base ' + GOLD_BASE + ' × difficulté ×' + difficultyMult.toFixed(2) +
      ' × performance ' + Math.round(goldMult * 100) + '% (' + totalDmgTaken + ' dégâts subis sur ' + Math.round(expectedDamage) + ' attendus, plancher ' + Math.round(GOLD_MIN_FRACTION * 100) + '%) = ' + goldEarned + '</span>';

  title.textContent = 'Run terminé';
  text.textContent = 'Les 4 boss sont vaincus — run complété en ' + formatTime(CB.elapsed) + '.' + (improvedTime ? ' Nouveau record de vitesse !' : '');

  AudioEngine.sfx('victory');
  document.getElementById('resultModal').hidden = false;
}

// Résultat de fin de défi (voir js/challenges.js) : deux records individuels par défi
// (temps ET dégâts subis, demandés séparément) — n'importe lequel des deux peut battre
// un record indépendamment de l'autre. Pas de calcul d'or ici (concept propre aux runs).
function showChallengeResult() {
  CB.resultShown = true;
  var ch = CHALLENGES.filter(function (c) { return c.id === CB.challengeId; })[0];
  var totalDmgTaken = Math.round(CB.totalDamageTaken);
  var elapsed = CB.elapsed;
  var improvedDmg = saveChallengeBestIfBetter(CB.challengeId, totalDmgTaken);
  var improvedTime = saveChallengeBestTimeIfBetter(CB.challengeId, elapsed);
  var bestDmg = loadChallengeBest(CB.challengeId);
  var bestTime = loadChallengeBestTime(CB.challengeId);

  document.getElementById('resultTitle').textContent = ch ? ch.name + ' — Défi réussi' : 'Défi réussi';
  document.getElementById('resultText').textContent = 'Terminé en ' + formatTime(elapsed) + ', en subissant ' + totalDmgTaken + ' dégâts.' +
    (improvedTime || improvedDmg ? ' Nouveau record !' : '');
  document.getElementById('resultStats').innerHTML =
    '<span>Temps : <b>' + formatTime(elapsed) + '</b>' + (improvedTime ? ' — record !' : '') + '</span>' +
    '<span>Meilleur temps : <b>' + (bestTime != null ? formatTime(bestTime) : formatTime(elapsed)) + '</b></span>' +
    '<span>Dégâts subis : <b>' + totalDmgTaken + '</b>' + (improvedDmg ? ' — record !' : '') + '</span>' +
    '<span>Moins de dégâts subis : <b>' + (bestDmg != null ? Math.round(bestDmg) : totalDmgTaken) + '</b></span>';

  AudioEngine.sfx('victory');
  document.getElementById('resultModal').hidden = false;
}

function wireGlobalEvents() {
  // Le contexte audio ne peut démarrer qu'après un premier geste utilisateur (règle des
  // navigateurs) — n'importe quelle touche ou clic suffit à le débloquer.
  window.addEventListener('keydown', function () { AudioEngine.unlock(); }, { once: true });
  window.addEventListener('mousedown', function () { AudioEngine.unlock(); }, { once: true });
  // Clic UI générique : un seul écouteur couvre tous les boutons de tous les menus
  // (délégation sur <button>) plutôt que d'ajouter l'appel à chaque gestionnaire existant.
  document.addEventListener('click', function (evt) {
    if (evt.target.closest && evt.target.closest('button')) AudioEngine.sfx('ui');
  }, true);

  window.addEventListener('keydown', function (evt) {
    if (isCapturing()) {
      evt.preventDefault();
      if (evt.code === 'Escape') cancelCapture(); else applyKeyCapture(evt.code);
      return;
    }
    if (evt.code === 'Escape' && !document.getElementById('settingsModal').hidden) {
      closeSettings();
      return;
    }
    var wasDown = isDown(evt.code);
    KEYS[evt.code] = true;
    if (VIEW !== 'combat' || wasDown) return;
    if (KEYBINDS.pause === evt.code) { evt.preventDefault(); triggerAction('pause'); }
  });
  window.addEventListener('keyup', function (evt) { KEYS[evt.code] = false; });

  // Pendant une capture, un clic sur un AUTRE vrai contrôle (bouton "Fermer", une autre
  // ligne de raccourci, etc.) garde son comportement normal — jamais de piège. Un clic sur
  // LE bouton en cours de capture lui-même (le geste le plus naturel pour assigner un clic
  // de souris), ou n'importe où ailleurs (fond de la modale, canvas...), assigne ce bouton
  // de souris comme raccourci.
  window.addEventListener('mousedown', function (evt) {
    if (!isCapturing()) return;
    var controlEl = evt.target.closest && evt.target.closest('button, input, select, textarea');
    var isCapturingBtn = controlEl && controlEl.dataset && controlEl.dataset.action === getCaptureAction();
    if (controlEl && !isCapturingBtn) return;
    evt.preventDefault();
    applyMouseCapture(evt.button);
  }, true);
  window.addEventListener('mouseup', function (evt) { MOUSE_DOWN[evt.button] = false; });
  window.addEventListener('contextmenu', function (evt) { if (isCapturing()) evt.preventDefault(); });

  // Les deux canvases de combat (2D et 3D) se superposent au même endroit, un seul étant
  // affiché à la fois (voir resizeCombatCanvas/combat3DAvailable) — mêmes écouteurs sur
  // les deux pour que la visée fonctionne quel que soit le mode de rendu actif.
  ['combatCanvas', 'combatCanvas3D'].forEach(function (canvasId) {
    var canvas = document.getElementById(canvasId);
    canvas.addEventListener('contextmenu', function (evt) { evt.preventDefault(); });
    canvas.addEventListener('mousemove', function (evt) { mouseClientX = evt.clientX; mouseClientY = evt.clientY; });
    canvas.addEventListener('mousedown', function (evt) {
      if (VIEW !== 'combat' || !CB || CB.ended || isCapturing()) return;
      MOUSE_DOWN[evt.button] = true;
    });
  });

  window.addEventListener('resize', function () {
    if (VIEW === 'combat') resizeCombatCanvas();
    else if (VIEW === 'menu') resizeHubCanvas();
  });

  // Un <button> cliqué garde le focus par défaut du navigateur : la touche Espace (arme de
  // type 1 par défaut) est aussi la touche standard d'activation d'un bouton focus — sans
  // ce blur, rejouer après avoir cliqué Pause/Réglages pouvait redéclencher ce bouton en
  // plein jeu à la prochaine pression d'Espace, ce qui ressemblait à une pause aléatoire.
  document.addEventListener('click', function (evt) {
    if (evt.target && evt.target.tagName === 'BUTTON') evt.target.blur();
  });

  // Seules deux raisons légitimes de mettre en pause : la touche dédiée, ou le fait de
  // quitter la fenêtre/l'onglet (alt-tab, changement d'app).
  function autoPauseOnLeave() {
    if (VIEW === 'combat' && CB && !CB.ended && !CB.paused) { CB.paused = true; syncPauseButtonLabel(); }
  }
  window.addEventListener('blur', autoPauseOnLeave);
  document.addEventListener('visibilitychange', function () { if (document.hidden) autoPauseOnLeave(); });

  document.getElementById('pauseCombatBtn').addEventListener('click', function () { triggerAction('pause'); });
  document.getElementById('combatSettingsBtn').addEventListener('click', function () {
    if (CB && !CB.ended && !CB.paused) { CB.paused = true; syncPauseButtonLabel(); }
    openSettings();
  });
  document.getElementById('hubStatsCloseX').addEventListener('click', closeHubStatsDialog);
  document.getElementById('hubStatsCloseBtn').addEventListener('click', closeHubStatsDialog);
  document.getElementById('backToMenuBtn').addEventListener('click', function () {
    if (CB && CB.challengeId != null) { document.getElementById('resultModal').hidden = true; showChallengesView(); return; }
    backToMenu();
  });
  document.getElementById('rematchBtn').addEventListener('click', function () {
    document.getElementById('resultModal').hidden = true;
    if (CB && CB.challengeId != null) { startChallenge(CB.challengeId); return; }
    startRunNow();
  });
}

var prevW1Held = false, prevW2Held = false, prevSpecialHeld = false;

function loop(ts) {
  var dt = Math.min((ts - lastTime) / 1000 || 0, 0.05);
  lastTime = ts;

  if (VIEW === 'combat' && CB) {
    var use3D = combat3DAvailable();
    var canvas = document.getElementById(use3D ? 'combatCanvas3D' : 'combatCanvas');
    if (!CB.ended && !CB.paused) {
      var mv = computeMoveVector();
      var world = use3D ? window.Combat3D.screenToWorld(mouseClientX, mouseClientY) : combatMouseToWorld(canvas, mouseClientX, mouseClientY);

      // Armes de type 1/2 : maintien, front montant et front descendant sont tous
      // nécessaires (charge d'un météore, tir continu du laser, dash/mine/épée en un coup).
      var w1Held = isActionHeld('dash');
      var w2Held = isActionHeld('pulse');
      var w1 = { held: w1Held, justPressed: w1Held && !prevW1Held, justReleased: !w1Held && prevW1Held };
      var w2 = { held: w2Held, justPressed: w2Held && !prevW2Held, justReleased: !w2Held && prevW2Held };
      prevW1Held = w1Held; prevW2Held = w2Held;

      updateCombat(dt, mv[0], mv[1], world[0], world[1], w1, w2);

      // Un nouvel appui à chaque fois — pas une répétition automatique dès la fin du
      // cooldown tant que la touche reste enfoncée (ce n'est pas une arme à maintien
      // comme la météore ou le laser : il faut relâcher puis rappuyer).
      var specialHeld = isActionHeld('special');
      if (specialHeld && !prevSpecialHeld) triggerAction('special', KEYBINDS.special.indexOf('Mouse') === 0 ? world : null);
      prevSpecialHeld = specialHeld;

      updateHUD();
    }
    if (use3D) window.Combat3D.render(ts / 1000);
    else renderCombat(canvas.getContext('2d'), canvas.width, canvas.height, ts / 1000);
    if (CB.ended && !CB.resultShown) { if (CB.challengeId != null) showChallengeResult(); else showResult(); }
  } else if (VIEW === 'menu' && HUB && !(window.Hub3D && window.Hub3D.available)) {
    // Secours 2D : seulement si la scène 3D (js3d/hub3d.js) n'a pas pu s'initialiser
    // (WebGL indisponible, etc.) — sinon c'est elle qui gère le rendu du hub.
    var hubCanvas = document.getElementById('hubCanvas');
    var hv = computeMoveVector();
    updateHub(dt, hv[0], hv[1]);
    renderHub(hubCanvas.getContext('2d'), hubCanvas.width, hubCanvas.height, ts / 1000);
  }

  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', function () {
  initSettings();
  initEditor();
  wireGlobalEvents();
  // Pas de musique tant qu'aucune partie n'est lancée (menu/hub silencieux) — voir
  // goToCombat() qui la démarre à l'entrée en combat/armurerie/défi, et
  // backToMenu()/exitArmory()/showChallengesView() qui l'arrêtent au retour au menu.
  requestAnimationFrame(loop);
});
