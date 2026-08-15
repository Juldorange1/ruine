// Persistance localStorage : records, or, raccourcis clavier, défis pré-run.

var STORAGE_KEYBINDS_KEY = 'arene.keybinds';
var STORAGE_BESTTIME_KEY = 'arene.besttime';
var STORAGE_LEASTHPLOST_KEY = 'arene.leastdmgtaken'; // dégâts subis bruts (pas un %, distinct de l'ancienne clé)
var STORAGE_RUNS_COMPLETED_KEY = 'arene.runscompleted';
var STORAGE_GOLD_KEY = 'arene.gold';
var STORAGE_DIFFICULTY_MODS_KEY = 'arene.difficultymods';
var STORAGE_WEAPON_BIAS_KEY = 'arene.weaponbias';
var STORAGE_BEST_GOLD_RUN_KEY = 'arene.bestgoldrun';
var STORAGE_BEST_GOLD_RUN_BY_WEAPON_KEY = 'arene.bestgoldrunbyweapon';
var STORAGE_CHALLENGE_BEST_KEY = 'arene.challengebest';
var STORAGE_CHALLENGE_BEST_TIME_KEY = 'arene.challengebesttime';
var STORAGE_AUDIO_KEY = 'arene.audio';

function loadKeybinds() {
  try {
    var raw = localStorage.getItem(STORAGE_KEYBINDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveKeybinds(binds) {
  try { localStorage.setItem(STORAGE_KEYBINDS_KEY, JSON.stringify(binds)); } catch (e) {}
}

function loadBestTime() {
  try {
    var raw = localStorage.getItem(STORAGE_BESTTIME_KEY);
    return raw ? parseFloat(raw) : null;
  } catch (e) { return null; }
}

function saveBestTimeIfBetter(seconds) {
  var current = loadBestTime();
  if (current == null || seconds < current) {
    try { localStorage.setItem(STORAGE_BESTTIME_KEY, String(seconds)); } catch (e) {}
    return true;
  }
  return false;
}

function loadLeastHpLost() {
  try {
    var raw = localStorage.getItem(STORAGE_LEASTHPLOST_KEY);
    return raw ? parseFloat(raw) : null;
  } catch (e) { return null; }
}

function saveLeastHpLostIfBetter(amount) {
  var current = loadLeastHpLost();
  if (current == null || amount < current) {
    try { localStorage.setItem(STORAGE_LEASTHPLOST_KEY, String(amount)); } catch (e) {}
    return true;
  }
  return false;
}

// Nombre de runs complets (les 4 chapitres, donc le boss du 4e, vaincus).
function loadRunsCompleted() {
  try {
    var raw = localStorage.getItem(STORAGE_RUNS_COMPLETED_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (e) { return 0; }
}

function incrementRunsCompleted() {
  var n = loadRunsCompleted() + 1;
  try { localStorage.setItem(STORAGE_RUNS_COMPLETED_KEY, String(n)); } catch (e) {}
  return n;
}

// Or cumulé au fil des runs. Purement cosmétique — un indicateur de temps de jeu,
// aucun effet sur le déroulement du jeu.
function loadGold() {
  try {
    var raw = localStorage.getItem(STORAGE_GOLD_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (e) { return 0; }
}

function addGold(amount) {
  var n = loadGold() + Math.max(0, Math.round(amount));
  try { localStorage.setItem(STORAGE_GOLD_KEY, String(n)); } catch (e) {}
  return n;
}

// Défis pré-run (dégâts/PV/nombre d'ennemis) : conservés d'une session à l'autre.
function loadDifficultyMods() {
  try {
    var raw = localStorage.getItem(STORAGE_DIFFICULTY_MODS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveDifficultyMods(mods) {
  try { localStorage.setItem(STORAGE_DIFFICULTY_MODS_KEY, JSON.stringify(mods)); } catch (e) {}
}

// Biais de tirage des armes (0 à 100% de chance en plus par arme) : conservé d'une
// session à l'autre, comme les défis pré-run.
function loadWeaponBias() {
  try {
    var raw = localStorage.getItem(STORAGE_WEAPON_BIAS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveWeaponBias(bias) {
  try { localStorage.setItem(STORAGE_WEAPON_BIAS_KEY, JSON.stringify(bias)); } catch (e) {}
}

// Plus gros gain d'or en un seul run (distinct de l'or cumulé, géré par loadGold).
function loadBestGoldRun() {
  try {
    var raw = localStorage.getItem(STORAGE_BEST_GOLD_RUN_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch (e) { return 0; }
}

function saveBestGoldRunIfBetter(amount) {
  var current = loadBestGoldRun();
  if (amount > current) {
    try { localStorage.setItem(STORAGE_BEST_GOLD_RUN_KEY, String(amount)); } catch (e) {}
    return true;
  }
  return false;
}

// Même record que ci-dessus, mais un par arme de type 1 (celle utilisée pendant le run) —
// même motif objet-clé-valeur que loadChallengeBests, comparaison "plus grand gagne".
function loadBestGoldRunByWeapons() {
  try {
    var raw = localStorage.getItem(STORAGE_BEST_GOLD_RUN_BY_WEAPON_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function loadBestGoldRunByWeapon(id) {
  var all = loadBestGoldRunByWeapons();
  return (all && all[id] != null) ? all[id] : null;
}

function saveBestGoldRunByWeaponIfBetter(id, amount) {
  var all = loadBestGoldRunByWeapons();
  var current = all[id];
  if (current == null || amount > current) {
    all[id] = amount;
    try { localStorage.setItem(STORAGE_BEST_GOLD_RUN_BY_WEAPON_KEY, JSON.stringify(all)); } catch (e) {}
    return true;
  }
  return false;
}

// Records de défis (moins de dégâts subis pour terminer chaque défi) : un objet
// {challengeId: dégâts} en une seule clé, comme les défis pré-run (loadDifficultyMods)
// plutôt que 10 clés séparées.
function loadChallengeBests() {
  try {
    var raw = localStorage.getItem(STORAGE_CHALLENGE_BEST_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function loadChallengeBest(id) {
  var all = loadChallengeBests();
  return (all && all[id] != null) ? all[id] : null;
}

function saveChallengeBestIfBetter(id, amount) {
  var all = loadChallengeBests();
  var current = all[id];
  if (current == null || amount < current) {
    all[id] = amount;
    try { localStorage.setItem(STORAGE_CHALLENGE_BEST_KEY, JSON.stringify(all)); } catch (e) {}
    return true;
  }
  return false;
}

// Record de temps par défi, même motif que le record de dégâts ci-dessus — les deux
// coexistent (deux records individuels distincts, demandé), plus les scores totaux
// agrégés (voir totalChallengeTime/totalChallengeDamage, editor.js).
function loadChallengeBestTimes() {
  try {
    var raw = localStorage.getItem(STORAGE_CHALLENGE_BEST_TIME_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function loadChallengeBestTime(id) {
  var all = loadChallengeBestTimes();
  return (all && all[id] != null) ? all[id] : null;
}

function saveChallengeBestTimeIfBetter(id, seconds) {
  var all = loadChallengeBestTimes();
  var current = all[id];
  if (current == null || seconds < current) {
    all[id] = seconds;
    try { localStorage.setItem(STORAGE_CHALLENGE_BEST_TIME_KEY, JSON.stringify(all)); } catch (e) {}
    return true;
  }
  return false;
}

// Volumes musique/effets sonores (0 à 1), voir js/audio.js — un seul objet, comme les
// défis pré-run et le biais d'armes.
function loadAudioSettings() {
  try {
    var raw = localStorage.getItem(STORAGE_AUDIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveAudioSettings(settings) {
  try { localStorage.setItem(STORAGE_AUDIO_KEY, JSON.stringify(settings)); } catch (e) {}
}
