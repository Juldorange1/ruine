// Raccourcis clavier configurables : modèle de bindings, capture de
// réassignation, construction de la modale de réglages.

// dash/pulse restent les noms internes des touches, mais l'arme qui y est équipée est
// tirée au hasard à chaque run (voir WEAPON1_INFO/WEAPON2_INFO dans combat.js).
var ACTION_LABELS = { up: 'Haut', down: 'Bas', left: 'Gauche', right: 'Droite', dash: 'Arme de type 1', special: 'Grappin', pulse: 'Arme de type 2', pause: 'Pause' };
var KEY_ACTIONS = ['up', 'down', 'left', 'right', 'dash', 'special', 'pulse', 'pause'];

var DEFAULT_KEYBINDS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', dash: 'Space', special: 'Mouse2', pulse: 'Mouse0', pause: 'KeyP' };

var KEYBINDS = {};
var _capture = null; // action en cours de réassignation, ou null

function cloneObj(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

function keyLabel(code) {
  if (!code) return '—';
  if (code === 'Mouse0') return 'Clic gauche';
  if (code === 'Mouse2') return 'Clic droit';
  if (code === 'Mouse1') return 'Clic milieu';
  if (code === 'Space') return 'Espace';
  if (code.indexOf('Arrow') === 0) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] || code;
  if (code.indexOf('Key') === 0) return code.slice(3);
  if (code.indexOf('Digit') === 0) return code.slice(5);
  return code;
}

function isCapturing() { return !!_capture; }
function getCaptureAction() { return _capture; }

function startCapture(action) {
  _capture = action;
  buildSettingsRows();
}

function cancelCapture() { _capture = null; buildSettingsRows(); }

function applyKeyCapture(code) {
  if (!_capture) return false;
  KEYBINDS[_capture] = code;
  saveKeybinds(KEYBINDS);
  _capture = null;
  buildSettingsRows();
  return true;
}

// Idem pour un bouton de souris (evt.button : 0 gauche, 1 milieu, 2 droit, 3/4 latéraux).
// _justCapturedMouse évite que le 'click' généré par ce même clic (juste après le
// mousedown qui a servi à capturer) ne referme aussitôt la modale via le gestionnaire
// de clic sur le fond assombri (voir initSettings).
var _justCapturedMouse = false;

function applyMouseCapture(button) {
  if (!_capture) return false;
  KEYBINDS[_capture] = 'Mouse' + button;
  saveKeybinds(KEYBINDS);
  _capture = null;
  _justCapturedMouse = true;
  buildSettingsRows();
  return true;
}

function buildSettingsRows() {
  var keyRows = document.getElementById('keybindRows');
  if (!keyRows) return;
  keyRows.innerHTML = '';
  KEY_ACTIONS.forEach(function (action) {
    keyRows.appendChild(buildBindRow(action, keyLabel(KEYBINDS[action])));
  });
}

function buildBindRow(action, currentLabel) {
  var row = document.createElement('div');
  row.className = 'bind-row';
  var label = document.createElement('span');
  label.className = 'bind-label';
  label.textContent = ACTION_LABELS[action];
  var btn = document.createElement('button');
  btn.className = 'bind-btn';
  btn.dataset.action = action;
  var capturing = _capture === action;
  btn.textContent = capturing ? 'Appuie sur une touche…' : currentLabel;
  if (capturing) btn.classList.add('capturing');
  btn.addEventListener('click', function () {
    // Si ce clic vient de servir à capturer un clic de souris (voir game.js), le bouton
    // reçoit aussi son propre événement 'click' juste après : il ne doit pas rouvrir une
    // capture, sinon le raccourci qu'on vient d'assigner semble ne "rien faire".
    if (_justCapturedMouse) { _justCapturedMouse = false; return; }
    startCapture(action);
  });
  row.appendChild(label);
  row.appendChild(btn);
  return row;
}

function resetBinds() {
  KEYBINDS = cloneObj(DEFAULT_KEYBINDS);
  saveKeybinds(KEYBINDS);
  cancelCapture();
}

function openSettings() {
  cancelCapture();
  buildSettingsRows();
  document.getElementById('settingsModal').hidden = false;
}
function closeSettings() {
  cancelCapture();
  document.getElementById('settingsModal').hidden = true;
}

function mergeDefaults(loaded, defaults) {
  var merged = cloneObj(loaded);
  var changed = false;
  for (var k in defaults) { if (merged[k] == null) { merged[k] = defaults[k]; changed = true; } }
  return { merged: merged, changed: changed };
}

function initSettings() {
  var loadedKeys = loadKeybinds();
  if (loadedKeys) {
    var km = mergeDefaults(loadedKeys, DEFAULT_KEYBINDS);
    KEYBINDS = km.merged;
    if (km.changed) saveKeybinds(KEYBINDS);
  } else {
    KEYBINDS = cloneObj(DEFAULT_KEYBINDS);
    saveKeybinds(KEYBINDS);
  }

  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);
  document.getElementById('settingsCloseX').addEventListener('click', closeSettings);
  document.getElementById('resetBindsBtn').addEventListener('click', function () { resetBinds(); buildSettingsRows(); });
  // Cliquer sur le fond assombri (en dehors de la carte) ferme aussi la modale —
  // sauf si ce clic vient juste de servir à capturer un bouton de souris comme raccourci.
  document.getElementById('settingsModal').addEventListener('click', function (evt) {
    if (_justCapturedMouse) { _justCapturedMouse = false; return; }
    if (evt.target.id === 'settingsModal') closeSettings();
  });
}
