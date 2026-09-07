// ============================================================================
// ASCENSION — storage.js
// Sauvegarde locale : meilleurs temps, réglages, raccourcis clavier et
// niveaux créés dans l'éditeur. Toutes les mécaniques (double saut,
// wall-jump, dash...) sont disponibles dès le départ, il n'y a rien à
// débloquer. Chaque lancement d'un niveau repart du tout début — aucune
// progression de checkpoint n'est donc persistée d'une partie à l'autre.
// Tout est conservé dans localStorage sous deux clés JSON (partie et niveaux).
// ============================================================================
window.AS = window.AS || {};

AS.Storage = (function () {
  const KEY = 'ascension_save_v1';
  const LEVELS_KEY = 'ascension_levels_v1';

  const DEFAULT_KEYBINDS = {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    jump: 'Space', dash: 'ShiftLeft', pause: 'Escape',
  };

  function defaultSave() {
    return {
      settings: { difficulty: 'court-1', sfxVolume: 0.8, skin: 'bleu' },
      keybinds: Object.assign({}, DEFAULT_KEYBINDS),
      zoneBest: {},      // { [difficulty]: ms }  temps total du niveau
    };
  }

  let data = null;

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? Object.assign(defaultSave(), JSON.parse(raw)) : defaultSave();
      const d = defaultSave();
      data.settings = Object.assign(d.settings, data.settings);
      data.keybinds = Object.assign({}, d.keybinds, data.keybinds);
      data.zoneBest = data.zoneBest || {};
    } catch (e) {
      data = defaultSave();
    }
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function recordZone(difficulty, ms) {
    load();
    const prev = data.zoneBest[difficulty];
    if (prev == null || ms < prev) {
      data.zoneBest[difficulty] = ms;
      save();
      return true;
    }
    return false;
  }

  function setDifficulty(d) { load(); data.settings.difficulty = d; save(); }

  // ---- Volume des effets sonores --------------------------------------------
  function getSfxVolume() { load(); return data.settings.sfxVolume; }
  function setSfxVolume(v) { load(); data.settings.sfxVolume = AS.Util.clamp(v, 0, 1); save(); }

  // ---- Skin du personnage ----------------------------------------------------
  // Tous les skins partagent exactement la même hitbox (capsule dérivée de
  // AS.CFG.playerHeight/playerRadius) : seule l'apparence change, jamais la
  // collision — voir buildPlayerMesh dans main.js.
  function getSkin() { load(); return data.settings.skin; }
  function setSkin(id) { load(); data.settings.skin = id; save(); }

  // ---- Raccourcis clavier --------------------------------------------------
  function getKeybinds() { load(); return data.keybinds; }
  function setKeybind(action, code) {
    load();
    data.keybinds[action] = code;
    save();
  }
  function resetKeybinds() {
    load();
    data.keybinds = Object.assign({}, DEFAULT_KEYBINDS);
    save();
  }

  // ---- Niveaux créés dans l'éditeur -----------------------------------------
  function loadLevels() {
    try {
      const raw = localStorage.getItem(LEVELS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveLevel(name, levelData) {
    const levels = loadLevels();
    const prevBest = levels[name] ? levels[name].best : null;
    // Une ré-sauvegarde (édition d'un niveau existant) ne doit jamais effacer
    // son assignation à une difficulté principale (voir setLevelMainDifficulty).
    const prevMainDifficulty = levels[name] ? levels[name].mainDifficulty : null;
    levels[name] = Object.assign({}, levelData, { savedAt: Date.now(), best: prevBest, mainDifficulty: prevMainDifficulty });
    try { localStorage.setItem(LEVELS_KEY, JSON.stringify(levels)); } catch (e) { /* ignore */ }
  }

  // ---- Niveaux principaux ----------------------------------------------------
  // Un niveau créé dans l'éditeur peut être assigné à une difficulté
  // (easy/normal/hard/extreme) : c'est ce niveau qui se lance depuis l'écran
  // titre pour cette difficulté. Une seule difficulté par niveau, et un seul
  // niveau par difficulté (assigner en retire l'ancien titulaire du poste).
  function setLevelMainDifficulty(name, diff) {
    const levels = loadLevels();
    if (!levels[name]) return;
    if (diff) {
      Object.keys(levels).forEach((n) => {
        if (levels[n].mainDifficulty === diff) delete levels[n].mainDifficulty;
      });
      levels[name].mainDifficulty = diff;
    } else {
      delete levels[name].mainDifficulty;
    }
    try { localStorage.setItem(LEVELS_KEY, JSON.stringify(levels)); } catch (e) { /* ignore */ }
  }

  function getMainLevelFor(diff) {
    const levels = loadLevels();
    for (const name of Object.keys(levels)) {
      if (levels[name].mainDifficulty === diff) return Object.assign({ name }, levels[name]);
    }
    return null;
  }

  function deleteLevel(name) {
    const levels = loadLevels();
    delete levels[name];
    try { localStorage.setItem(LEVELS_KEY, JSON.stringify(levels)); } catch (e) { /* ignore */ }
  }

  function recordLevelBest(name, ms) {
    const levels = loadLevels();
    const lvl = levels[name];
    if (!lvl) return false;
    if (lvl.best == null || ms < lvl.best) {
      lvl.best = ms;
      try { localStorage.setItem(LEVELS_KEY, JSON.stringify(levels)); } catch (e) { /* ignore */ }
      return true;
    }
    return false;
  }

  return {
    load, save, recordZone,
    setDifficulty, getSfxVolume, setSfxVolume, getSkin, setSkin, DEFAULT_KEYBINDS,
    getKeybinds, setKeybind, resetKeybinds,
    loadLevels, saveLevel, deleteLevel, recordLevelBest,
    setLevelMainDifficulty, getMainLevelFor,
  };
})();
