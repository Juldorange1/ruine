// Couche de persistance (localStorage). Un seul blob JSON, sauvegardé à chaque mutation.
(function (global) {
  'use strict';

  const KEY = 'revang_data_v1';

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function emptyState() {
    return {
      version: 1,
      lessons: {},   // id -> lesson
      items: {},     // id -> item
      sessions: [],  // historique des sessions {id, date, mode, durationSec, itemCount, correct, total}
      settings: {
        dailyGoal: 20,
        streak: 0,
        lastActiveDay: null,
      },
      createdAt: Date.now(),
    };
  }

  let state = load();

  function load() {
    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return emptyState();
      // fusion défensive avec les valeurs par défaut si un champ manque
      const base = emptyState();
      return Object.assign(base, parsed, {
        lessons: parsed.lessons || {},
        items: parsed.items || {},
        sessions: parsed.sessions || [],
        settings: Object.assign(base.settings, parsed.settings || {}),
      });
    } catch (e) {
      console.warn('Lecture localStorage impossible, réinitialisation.', e);
      return emptyState();
    }
  }

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        global.localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Sauvegarde impossible', e);
      }
    }, 120);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
  }

  const Store = {
    uid,
    state,

    // ---- Leçons ----
    getLessons() { return Object.values(state.lessons).sort((a, b) => b.createdAt - a.createdAt); },
    getLesson(id) { return state.lessons[id]; },
    addLesson(lesson) {
      state.lessons[lesson.id] = lesson;
      save();
      return lesson;
    },
    updateLesson(id, patch) {
      if (!state.lessons[id]) return;
      Object.assign(state.lessons[id], patch, { updatedAt: Date.now() });
      save();
    },
    deleteLesson(id) {
      delete state.lessons[id];
      Object.keys(state.items).forEach((itemId) => {
        if (state.items[itemId].lessonId === id) delete state.items[itemId];
      });
      save();
    },

    // ---- Items ----
    getItem(id) { return state.items[id]; },
    getAllItems() { return Object.values(state.items); },
    getItemsByLesson(lessonId) { return Object.values(state.items).filter((it) => it.lessonId === lessonId); },
    addItem(item) {
      state.items[item.id] = item;
      save();
      return item;
    },
    updateItem(id, patch) {
      if (!state.items[id]) return;
      Object.assign(state.items[id], patch);
      save();
    },
    deleteItem(id) {
      delete state.items[id];
      save();
    },
    markDirty() { save(); },

    // ---- Sessions ----
    logSession(session) {
      state.sessions.push(session);
      if (state.sessions.length > 500) state.sessions.shift();
      save();
    },
    getSessions() { return state.sessions; },

    // ---- Réglages / série de jours ----
    getSettings() { return state.settings; },
    updateSettings(patch) { Object.assign(state.settings, patch); save(); },

    touchDailyStreak() {
      const today = new Date().toISOString().slice(0, 10);
      const last = state.settings.lastActiveDay;
      if (last === today) return state.settings.streak;
      const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      state.settings.streak = last === y ? state.settings.streak + 1 : 1;
      state.settings.lastActiveDay = today;
      save();
      return state.settings.streak;
    },

    // ---- Export / réinitialisation ----
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(json) {
      const parsed = JSON.parse(json);
      state = Object.assign(emptyState(), parsed);
      Store.state = state;
      saveNow();
    },
    resetAll() {
      state = emptyState();
      Store.state = state;
      saveNow();
    },
    saveNow,
  };

  global.Store = Store;
})(window);
