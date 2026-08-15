// Menu principal + écran de défis pré-run. Il n'y a plus d'éditeur : tout le contenu
// d'un run (salles, boss, ennemis) est généré automatiquement (voir waves.js).

var DIFFICULTY_MODS = { enemyDmgPct: 100, enemyCountPct: 100, enemySpdPct: 100, enemyAtkSpdPct: 100 };

function updateMenuStats() {
  document.getElementById('goldTotal').textContent = loadGold();
  document.getElementById('runsCompleted').textContent = loadRunsCompleted();
  document.getElementById('bestGoldRun').textContent = loadBestGoldRun();
  var bt = loadBestTime();
  document.getElementById('bestTime').textContent = bt != null ? formatTime(bt) : '—';
  var hpl = loadLeastHpLost();
  document.getElementById('leastHpLost').textContent = hpl != null ? Math.round(hpl) : '—';
}

// Conservé pour compatibilité avec le reste du code (mêmes points d'appel qu'avant).
function updateTopbarRecords() { updateMenuStats(); }

function updateGoldMultDisplay() {
  var mult = goldDifficultyMult(DIFFICULTY_MODS);
  document.getElementById('goldMultVal').textContent = '×' + (mult < 10 ? mult.toFixed(1) : Math.round(mult));
}

// Curseur + champ numérique éditable au clavier pour chaque modificateur (tous plafonnés
// à 300%, la valeur tapée est clampée à la validation plutôt qu'à chaque frappe pour ne
// pas gêner la saisie d'un nombre à plusieurs chiffres).
var DIFFICULTY_MOD_FIELDS = [
  { rangeId: 'modDmgRange', valId: 'modDmgVal', field: 'enemyDmgPct' },
  { rangeId: 'modCountRange', valId: 'modCountVal', field: 'enemyCountPct' },
  { rangeId: 'modSpdRange', valId: 'modSpdVal', field: 'enemySpdPct' },
  { rangeId: 'modAtkSpdRange', valId: 'modAtkSpdVal', field: 'enemyAtkSpdPct' }
];

function syncDifficultyModsUI() {
  DIFFICULTY_MOD_FIELDS.forEach(function (f) {
    var v = DIFFICULTY_MODS[f.field];
    document.getElementById(f.rangeId).value = v;
    document.getElementById(f.valId).value = v;
  });
  updateGoldMultDisplay();
}

function buildDifficultyModsPanel() {
  DIFFICULTY_MOD_FIELDS.forEach(function (f) {
    document.getElementById(f.rangeId).addEventListener('input', function () {
      DIFFICULTY_MODS[f.field] = parseInt(this.value, 10);
      document.getElementById(f.valId).value = DIFFICULTY_MODS[f.field];
      updateGoldMultDisplay();
      saveDifficultyMods(DIFFICULTY_MODS);
    });
    var numInput = document.getElementById(f.valId);
    numInput.addEventListener('input', function () {
      var v = parseInt(this.value, 10);
      if (isNaN(v)) return;
      DIFFICULTY_MODS[f.field] = Math.min(200, Math.max(100, v));
      document.getElementById(f.rangeId).value = DIFFICULTY_MODS[f.field];
      updateGoldMultDisplay();
      saveDifficultyMods(DIFFICULTY_MODS);
    });
    numInput.addEventListener('blur', syncDifficultyModsUI);
  });
}

function showMenuView() {
  document.getElementById('menuView').hidden = false;
  document.getElementById('prerunView').hidden = true;
  document.getElementById('challengesView').hidden = true;
  VIEW = 'menu';
  if (!(window.Hub3D && window.Hub3D.available)) {
    if (!HUB) initHub();
    resizeHubCanvas();
  }
  updateMenuStats();
}

function showPrerunView() {
  document.getElementById('menuView').hidden = true;
  document.getElementById('prerunView').hidden = false;
}

// ---------------- Sous-menu Armes (biais de tirage, 0 à 100% par arme) ----------------

function buildWeaponBiasRow(id, info) {
  var row = document.createElement('div');
  row.className = 'weapon-bias-row';

  var nameEl = document.createElement('div');
  nameEl.className = 'weapon-bias-name';
  nameEl.textContent = weaponLabel(id);

  var descEl = document.createElement('div');
  descEl.className = 'weapon-bias-desc';
  descEl.textContent = info.desc;

  var controls = document.createElement('div');
  controls.className = 'weapon-bias-controls';
  var range = document.createElement('input');
  range.type = 'range'; range.min = 0; range.max = 100; range.value = WEAPON_BIAS[id] || 0;
  var valEl = document.createElement('span');
  valEl.className = 'weapon-bias-val';
  valEl.textContent = '+' + (WEAPON_BIAS[id] || 0) + '%';
  range.addEventListener('input', function () {
    var v = parseInt(this.value, 10);
    WEAPON_BIAS[id] = v;
    valEl.textContent = '+' + v + '%';
    saveWeaponBias(WEAPON_BIAS);
  });
  controls.appendChild(range);
  controls.appendChild(valEl);

  row.appendChild(nameEl);
  row.appendChild(descEl);
  row.appendChild(controls);
  return row;
}

// ---------------- Panneau flottant de l'armurerie (voir enterArmory, js/game.js) ----------------
// S'approcher d'un présentoir et appuyer sur E équipe l'arme ET ouvre ce panneau — même
// ligne de biais que l'ancien menu Armes en page pleine (buildWeaponBiasRow ci-dessus),
// affichée ici en surimpression du combat au lieu d'un écran séparé.
function openArmoryPanel(weaponId) {
  var info = WEAPON1_INFO[weaponId] || WEAPON2_INFO[weaponId];
  var body = document.getElementById('armoryPanelBody');
  body.innerHTML = '';
  body.appendChild(buildWeaponBiasRow(weaponId, info));
  // Le record d'or n'existe que pour les armes de type 1 (weapon1), tirées au sort en
  // début de run — les armes de type 2 n'ont pas de "run avec cette arme" équivalent.
  if (WEAPON1_INFO[weaponId]) {
    var recordEl = document.createElement('div');
    recordEl.className = 'weapon-bias-desc';
    var rec = loadBestGoldRunByWeapon(weaponId);
    recordEl.textContent = '🪙 Record en un run avec cette arme : ' + (rec != null ? rec : '—');
    body.appendChild(recordEl);
  }
  document.getElementById('armoryPanel').hidden = false;
}

function closeArmoryPanel() {
  if (CB) CB.armoryPanelWeapon = null;
  var panel = document.getElementById('armoryPanel');
  if (panel) panel.hidden = true;
}

// Le run est entièrement préparé (vague ET armes tirées au sort) avant que le combat
// ne démarre réellement — les armes sont révélées sur un écran dédié (voir
// showWeaponRevealView) que le joueur doit valider pour entrer dans la salle 1.
var PENDING_RUN = null;

function startRunNow() {
  randomizeArenaSize();
  PENDING_RUN = {
    queue: buildRunQueue(DIFFICULTY_MODS),
    weapons: { weapon1: pickWeightedWeapon(WEAPON1_IDS), weapon2: pickWeightedWeapon(WEAPON2_IDS) },
    difficultyMods: {
      enemyDmgPct: DIFFICULTY_MODS.enemyDmgPct,
      enemyCountPct: DIFFICULTY_MODS.enemyCountPct, enemySpdPct: DIFFICULTY_MODS.enemySpdPct,
      enemyAtkSpdPct: DIFFICULTY_MODS.enemyAtkSpdPct
    }
  };
  showWeaponRevealView();
}

function showWeaponRevealView() {
  document.getElementById('menuView').hidden = true;
  document.getElementById('prerunView').hidden = true;
  document.getElementById('weaponRevealView').hidden = false;
  var w1 = PENDING_RUN.weapons.weapon1, w2 = PENDING_RUN.weapons.weapon2;
  document.getElementById('revealWeapon1Name').textContent = weaponLabel(w1);
  document.getElementById('revealWeapon1Desc').textContent = WEAPON1_INFO[w1].desc;
  document.getElementById('revealWeapon2Name').textContent = weaponLabel(w2);
  document.getElementById('revealWeapon2Desc').textContent = WEAPON2_INFO[w2].desc;
}

function confirmWeaponRevealAndFight() {
  document.getElementById('weaponRevealView').hidden = true;
  goToCombat({
    queue: PENDING_RUN.queue,
    playerConfig: { spawnX: ARENA_W / 2, spawnY: ARENA_H - 90 },
    weapons: PENDING_RUN.weapons,
    difficultyMods: PENDING_RUN.difficultyMods
  });
}

function initEditor() {
  var saved = loadDifficultyMods();
  if (saved) {
    // Reclampe au cas où une valeur sauvegardée dépasserait l'ancien plafond (300%).
    var clampDiff = function (v) { return Math.min(200, Math.max(100, v != null ? v : 100)); };
    DIFFICULTY_MODS = {
      enemyDmgPct: clampDiff(saved.enemyDmgPct),
      enemyCountPct: clampDiff(saved.enemyCountPct),
      enemySpdPct: clampDiff(saved.enemySpdPct),
      enemyAtkSpdPct: clampDiff(saved.enemyAtkSpdPct)
    };
  }
  buildDifficultyModsPanel();
  syncDifficultyModsUI();

  var savedBias = loadWeaponBias();
  WEAPON1_IDS.concat(WEAPON2_IDS).forEach(function (id) {
    WEAPON_BIAS[id] = (savedBias && savedBias[id] != null) ? savedBias[id] : 0;
  });

  document.getElementById('backToMenuFromPrerunBtn').addEventListener('click', showMenuView);
  document.getElementById('confirmRunBtn').addEventListener('click', startRunNow);
  document.getElementById('confirmWeaponRevealBtn').addEventListener('click', confirmWeaponRevealAndFight);
  document.getElementById('backToMenuFromChallengesBtn').addEventListener('click', showMenuView);
  document.getElementById('armoryExitBtn').addEventListener('click', exitArmory);
  document.getElementById('armoryPanelCloseBtn').addEventListener('click', closeArmoryPanel);

  showMenuView();
}

// ---------------- Défis (second portail du hub, voir js/challenges.js) ----------------

// Scores totaux : simple somme des records individuels déjà obtenus (les défis pas
// encore complétés comptent pour 0) — un défi peut battre son record de temps et son
// record de dégâts indépendamment l'un de l'autre.
function totalChallengeTime() {
  var total = 0;
  CHALLENGES.forEach(function (c) { total += loadChallengeBestTime(c.id) || 0; });
  return total;
}
function totalChallengeDamage() {
  var total = 0;
  CHALLENGES.forEach(function (c) { total += loadChallengeBest(c.id) || 0; });
  return total;
}
function challengesCompletedCount() {
  return CHALLENGES.filter(function (c) { return loadChallengeBest(c.id) != null; }).length;
}

function buildChallengesView() {
  var completed = challengesCompletedCount();
  document.getElementById('challengesTotals').innerHTML =
    '<span>' + completed + ' / ' + CHALLENGES.length + ' défis complétés</span>' +
    '<span>⏱ Score total temps : <b>' + formatTime(totalChallengeTime()) + '</b></span>' +
    '<span>🩸 Score total dégâts : <b>' + Math.round(totalChallengeDamage()) + '</b></span>';

  var grid = document.getElementById('challengesGrid');
  grid.innerHTML = '';
  CHALLENGES.forEach(function (c) {
    var card = document.createElement('div');
    card.className = 'challenge-card';
    var bestDmg = loadChallengeBest(c.id);
    var bestTime = loadChallengeBestTime(c.id);
    card.innerHTML =
      '<div class="challenge-icon">' + c.icon + '</div>' +
      '<h3>' + c.name + '</h3>' +
      '<p class="challenge-desc">' + c.desc + '</p>' +
      '<div class="challenge-record">⏱ Meilleur temps : <b>' + (bestTime != null ? formatTime(bestTime) : '—') + '</b></div>' +
      '<div class="challenge-record">🩸 Moins de dégâts subis : <b>' + (bestDmg != null ? Math.round(bestDmg) : '—') + '</b></div>';
    var btn = document.createElement('button');
    btn.className = 'btn btn-start';
    btn.textContent = 'Combattre';
    btn.addEventListener('click', function () { startChallenge(c.id); });
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

function showChallengesView() {
  // Rejoignable depuis le hub (VIEW déjà 'menu', combatView déjà masquée) ET depuis le
  // bouton "Retour" de l'écran de résultat d'un défi (VIEW encore 'combat', CB encore la
  // session terminée) — on nettoie les deux sans condition pour ne jamais laisser le
  // combat tourner en arrière-plan sous cet écran.
  CB = null;
  document.getElementById('combatView').hidden = true;
  document.getElementById('menuView').hidden = true;
  document.getElementById('challengesView').hidden = false;
  VIEW = 'menu';
  AudioEngine.stopMusic();
  buildChallengesView();
}
