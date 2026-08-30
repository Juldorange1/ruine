// Persistance locale (localStorage). Toute la progression reste sur cette
// machine : aucune donnée n'est envoyée où que ce soit.
// L'API est volontairement asynchrone (Promises) pour pouvoir basculer vers
// IndexedDB plus tard sans changer les appelants, si le volume de données
// venait à le justifier.
const Storage = (() => {
  const KEYS = {
    PROGRESS: 'pokedex_progress_v1',
    SETTINGS: 'pokedex_settings_v1',
    SESSION_STATS: 'pokedex_sessionstats_v1',
  };

  const DEFAULT_SETTINGS = {
    pokedexShowAllImages: true, // false = cache l'image des Pokémon jamais vus dans le Pokédex
  };

  const DEFAULT_SESSION_STATS = {
    totals: { questionsAnswered: 0, correct: 0, incorrect: 0, currentStreak: 0, bestStreak: 0 },
  };

  function defaultProgressEntry(id) {
    return {
      id,
      masteryLevel: 0,
      timesSeen: 0,
      correct: 0,
      incorrect: 0,
      lastReview: null,
      nextReview: null,
      currentStreak: 0,
      bestStreak: 0,
      facets: {}, // { [mode]: {correct, incorrect} } — mémoire fine par sujet (nom, type, numéro...)
    };
  }

  let progress = {};
  let settings = { ...DEFAULT_SETTINGS };
  let sessionStats = { ...DEFAULT_SESSION_STATS };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Lecture localStorage échouée pour', key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Écriture localStorage échouée pour', key, e);
    }
  }

  async function init() {
    progress = readJSON(KEYS.PROGRESS, {});
    settings = { ...DEFAULT_SETTINGS, ...readJSON(KEYS.SETTINGS, {}) };
    sessionStats = { ...DEFAULT_SESSION_STATS, ...readJSON(KEYS.SESSION_STATS, {}) };
  }

  function getProgress(id) {
    return progress[id] || defaultProgressEntry(id);
  }

  function getAllProgress() {
    return progress;
  }

  async function setProgress(id, entry) {
    progress[id] = entry;
    writeJSON(KEYS.PROGRESS, progress);
  }

  function getSettings() {
    return settings;
  }

  async function setSettings(partial) {
    settings = { ...settings, ...partial };
    writeJSON(KEYS.SETTINGS, settings);
  }

  function getSessionStats() {
    return sessionStats;
  }

  async function setSessionStats(partial) {
    sessionStats = { ...sessionStats, ...partial };
    writeJSON(KEYS.SESSION_STATS, sessionStats);
  }

  function exportBackup() {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        progress,
        settings,
        sessionStats,
      },
      null,
      1
    );
  }

  async function importBackup(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Fichier de sauvegarde invalide (JSON illisible).');
    }
    if (!data || typeof data.progress !== 'object') {
      throw new Error('Fichier de sauvegarde invalide (structure inattendue).');
    }
    progress = data.progress || {};
    settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    sessionStats = { ...DEFAULT_SESSION_STATS, ...(data.sessionStats || {}) };
    writeJSON(KEYS.PROGRESS, progress);
    writeJSON(KEYS.SETTINGS, settings);
    writeJSON(KEYS.SESSION_STATS, sessionStats);
  }

  async function resetAll() {
    progress = {};
    settings = { ...DEFAULT_SETTINGS };
    sessionStats = { ...DEFAULT_SESSION_STATS };
    localStorage.removeItem(KEYS.PROGRESS);
    localStorage.removeItem(KEYS.SETTINGS);
    localStorage.removeItem(KEYS.SESSION_STATS);
  }

  return {
    init,
    getProgress,
    getAllProgress,
    setProgress,
    getSettings,
    setSettings,
    getSessionStats,
    setSessionStats,
    exportBackup,
    importBackup,
    resetAll,
    defaultProgressEntry,
  };
})();
