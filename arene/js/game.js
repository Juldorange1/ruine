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
}

function applyWeaponHUDLabels() {
  var w1 = WEAPON1_INFO[CB.player.weapon1];
  var w2 = WEAPON2_INFO[CB.player.weapon2];
  var el1 = document.getElementById('abilityDash');
  var el2 = document.getElementById('abilityPulse');
  el1.querySelector('.ability-name').textContent = w1.name;
  el1.title = w1.desc;
  el2.querySelector('.ability-name').textContent = w2.name;
  el2.title = w2.desc;
}

function resizeCombatCanvas() {
  var canvas = document.getElementById('combatCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  mouseClientX = canvas.width / 2;
  mouseClientY = canvas.height / 2;
}

function goToCombat(config) {
  closeSettings();
  document.getElementById('menuView').hidden = true;
  document.getElementById('prerunView').hidden = true;
  document.getElementById('combatView').hidden = false;
  document.getElementById('resultModal').hidden = true;
  VIEW = 'combat';
  resizeCombatCanvas();
  initCombat(config);
  applyWeaponHUDLabels();
  syncPauseButtonLabel();
}

function backToMenu() {
  closeSettings();
  document.getElementById('combatView').hidden = true;
  document.getElementById('prerunView').hidden = true;
  document.getElementById('resultModal').hidden = true;
  VIEW = 'menu';
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
  var pointsEl = document.getElementById('resultPoints');
  var statsEl = document.getElementById('resultStats');
  // PV infinis : plus de défaite possible, seul l'objectif "moins de dégâts subis" compte
  // en plus du score. Nombre brut, indépendant de tout pool de PV configurable.
  var totalDmgTaken = Math.round(CB.totalDamageTaken);
  var improvedScore = saveHighScoreIfBetter(CB.points);
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
  text.textContent = 'Les 4 boss sont vaincus — run complété en ' + formatTime(CB.elapsed) + '.';
  pointsEl.textContent = '+' + CB.points + ' points' + (improvedScore ? ' — nouveau record de score !' : '') + (improvedTime ? ' — nouveau record de vitesse !' : '');

  document.getElementById('resultModal').hidden = false;
}

function wireGlobalEvents() {
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

  var canvas = document.getElementById('combatCanvas');
  canvas.addEventListener('contextmenu', function (evt) { evt.preventDefault(); });
  canvas.addEventListener('mousemove', function (evt) { mouseClientX = evt.clientX; mouseClientY = evt.clientY; });
  canvas.addEventListener('mousedown', function (evt) {
    if (VIEW !== 'combat' || !CB || CB.ended || isCapturing()) return;
    MOUSE_DOWN[evt.button] = true;
  });

  window.addEventListener('resize', function () { if (VIEW === 'combat') resizeCombatCanvas(); });

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
  document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
  document.getElementById('rematchBtn').addEventListener('click', function () {
    document.getElementById('resultModal').hidden = true;
    startRunNow();
  });
}

var prevW1Held = false, prevW2Held = false, prevSpecialHeld = false;

function loop(ts) {
  var dt = Math.min((ts - lastTime) / 1000 || 0, 0.05);
  lastTime = ts;

  if (VIEW === 'combat' && CB) {
    var canvas = document.getElementById('combatCanvas');
    if (!CB.ended && !CB.paused) {
      var mv = computeMoveVector();
      var world = combatMouseToWorld(canvas, mouseClientX, mouseClientY);

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
    renderCombat(canvas.getContext('2d'), canvas.width, canvas.height, ts / 1000);
    if (CB.ended && !CB.resultShown) showResult();
  }

  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', function () {
  initSettings();
  initEditor();
  wireGlobalEvents();
  requestAnimationFrame(loop);
});
