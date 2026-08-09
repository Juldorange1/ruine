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

// Tant qu'aucun run n'a été complété, les curseurs de défi et de biais d'armes restent
// bloqués à leurs valeurs par défaut : le premier run se joue toujours "vanille".
function isProgressLocked() { return loadRunsCompleted() === 0; }

function applyDifficultyLock() {
  var locked = isProgressLocked();
  var hint = document.getElementById('prerunLockHint');
  if (hint) hint.hidden = !locked;
  DIFFICULTY_MOD_FIELDS.forEach(function (f) {
    document.getElementById(f.rangeId).disabled = locked;
    document.getElementById(f.valId).disabled = locked;
  });
}

function syncDifficultyModsUI() {
  DIFFICULTY_MOD_FIELDS.forEach(function (f) {
    var v = DIFFICULTY_MODS[f.field];
    document.getElementById(f.rangeId).value = v;
    document.getElementById(f.valId).value = v;
  });
  updateGoldMultDisplay();
  applyDifficultyLock();
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
      DIFFICULTY_MODS[f.field] = Math.min(300, Math.max(100, v));
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
  document.getElementById('weaponsView').hidden = true;
  updateMenuStats();
}

function showPrerunView() {
  document.getElementById('menuView').hidden = true;
  document.getElementById('prerunView').hidden = false;
  applyDifficultyLock();
}

// ---------------- Sous-menu Armes (biais de tirage, 0 à 100% par arme) ----------------

function buildWeaponBiasRow(id, info) {
  var row = document.createElement('div');
  row.className = 'weapon-bias-row';

  var nameEl = document.createElement('div');
  nameEl.className = 'weapon-bias-name';
  nameEl.textContent = info.name;

  var descEl = document.createElement('div');
  descEl.className = 'weapon-bias-desc';
  descEl.textContent = info.desc;

  var controls = document.createElement('div');
  controls.className = 'weapon-bias-controls';
  var range = document.createElement('input');
  range.type = 'range'; range.min = 0; range.max = 100; range.value = WEAPON_BIAS[id] || 0;
  range.disabled = isProgressLocked();
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

function buildWeaponsView() {
  var list1 = document.getElementById('weapon1List');
  var list2 = document.getElementById('weapon2List');
  list1.innerHTML = '';
  list2.innerHTML = '';
  WEAPON1_IDS.forEach(function (id) { list1.appendChild(buildWeaponBiasRow(id, WEAPON1_INFO[id])); });
  WEAPON2_IDS.forEach(function (id) { list2.appendChild(buildWeaponBiasRow(id, WEAPON2_INFO[id])); });
  document.getElementById('weaponsLockHint').hidden = !isProgressLocked();
}

function showWeaponsView() {
  document.getElementById('menuView').hidden = true;
  document.getElementById('weaponsView').hidden = false;
  buildWeaponsView();
}

function startRunNow() {
  var queue = buildRunQueue(DIFFICULTY_MODS);
  goToCombat({
    queue: queue,
    playerConfig: { spawnX: ARENA_W / 2, spawnY: ARENA_H - 90 },
    difficultyMods: {
      enemyDmgPct: DIFFICULTY_MODS.enemyDmgPct,
      enemyCountPct: DIFFICULTY_MODS.enemyCountPct, enemySpdPct: DIFFICULTY_MODS.enemySpdPct,
      enemyAtkSpdPct: DIFFICULTY_MODS.enemyAtkSpdPct
    }
  });
}

function initEditor() {
  var saved = loadDifficultyMods();
  if (saved) {
    DIFFICULTY_MODS = {
      enemyDmgPct: saved.enemyDmgPct != null ? saved.enemyDmgPct : 100,
      enemyCountPct: saved.enemyCountPct != null ? saved.enemyCountPct : 100,
      enemySpdPct: saved.enemySpdPct != null ? saved.enemySpdPct : 100,
      enemyAtkSpdPct: saved.enemyAtkSpdPct != null ? saved.enemyAtkSpdPct : 100
    };
  }
  buildDifficultyModsPanel();
  syncDifficultyModsUI();

  var savedBias = loadWeaponBias();
  WEAPON1_IDS.concat(WEAPON2_IDS).forEach(function (id) {
    WEAPON_BIAS[id] = (savedBias && savedBias[id] != null) ? savedBias[id] : 0;
  });

  document.getElementById('goToPrerunBtn').addEventListener('click', showPrerunView);
  document.getElementById('backToMenuFromPrerunBtn').addEventListener('click', showMenuView);
  document.getElementById('confirmRunBtn').addEventListener('click', startRunNow);
  document.getElementById('weaponsBtn').addEventListener('click', showWeaponsView);
  document.getElementById('backToMenuFromWeaponsBtn').addEventListener('click', showMenuView);

  updateMenuStats();
}
